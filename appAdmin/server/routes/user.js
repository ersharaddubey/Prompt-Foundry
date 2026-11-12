import express from 'express';
import multer from 'multer';
import ImageKit from 'imagekit';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype?.startsWith('image/')
      ? cb(null, true)
      : cb(new Error('Only image files are allowed')),
});

let imagekit;
function getImageKit() {
  if (!imagekit) {
    const { IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT } = process.env;
    if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_PRIVATE_KEY || !IMAGEKIT_URL_ENDPOINT) return null;
    imagekit = new ImageKit({
      publicKey: IMAGEKIT_PUBLIC_KEY,
      privateKey: IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: IMAGEKIT_URL_ENDPOINT,
    });
  }
  return imagekit;
}

async function storeAvatar(file) {
  const ik = getImageKit();
  if (!ik) throw new Error('ImageKit is not configured on the server.');
  const result = await ik.upload({
    file: file.buffer.toString('base64'),
    fileName: file.originalname || `avatar-${Date.now()}.jpg`,
    folder: '/prompt-foundry-avatars',
  });
  return result.url;
}

function publicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar || '',
    credits: user.credits,
    dailyCredits: user.dailyCredits,
    favorites: user.favorites,
  };
}

// Toggle favorite
router.post('/favorites/:promptId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const promptId = req.params.promptId;

    const index = user.favorites.indexOf(promptId);
    if (index > -1) {
      user.favorites.splice(index, 1);
    } else {
      user.favorites.push(promptId);
    }

    await user.save();
    const updatedUser = await User.findById(req.user._id).populate('favorites');
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get favorites
router.get('/favorites', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('favorites');
    res.json(user.favorites);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Deduct credits (for generation)
router.post('/deduct-credits', protect, async (req, res) => {
  try {
    const { amount = 5 } = req.body;
    const user = await User.findById(req.user._id);

    if (user.dailyCredits >= amount) {
      user.dailyCredits -= amount;
    } else if (user.credits >= amount) {
      user.credits -= amount;
    } else {
      return res.status(400).json({ message: 'Not enough credits' });
    }

    await user.save();
    res.json({ credits: user.credits, dailyCredits: user.dailyCredits });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update profile (name)
router.patch('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const name = String(req.body.name || '').trim();
    if (!name || name.length < 2) {
      return res.status(400).json({ message: 'Name must be at least 2 characters' });
    }
    if (name.length > 60) {
      return res.status(400).json({ message: 'Name is too long' });
    }

    user.name = name;
    await user.save();
    res.json(publicUser(user));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Upload / change profile avatar
router.post('/avatar', protect, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Avatar image is required' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const url = await storeAvatar(req.file);
    user.avatar = url;
    await user.save();
    res.json(publicUser(user));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete own account permanently
router.delete('/account', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await User.findByIdAndDelete(req.user._id);
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
