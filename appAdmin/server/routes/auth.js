import express from 'express';
import jwt from 'jsonwebtoken';
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

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};


// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please fill all fields' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({ name, email, password });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar || '',
      credits: user.credits,
      dailyCredits: user.dailyCredits,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (user && (await user.comparePassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || '',
        credits: user.credits,
        dailyCredits: user.dailyCredits,
        favorites: user.favorites,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get me
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password').populate('favorites');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (error) {
    res.status(401).json({ message: 'Not authorized' });
  }
});

// Update profile name
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

// Upload avatar
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

// Delete account
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
