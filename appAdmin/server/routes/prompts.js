import express from 'express';
import multer from 'multer';
import ImageKit from 'imagekit';
import Prompt from '../models/Prompt.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'), false);
  },
});

let imagekit = null;
function getImageKit() {
  if (imagekit) return imagekit;
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
  if (!publicKey || !privateKey || !urlEndpoint) {
    return null;
  }
  imagekit = new ImageKit({ publicKey, privateKey, urlEndpoint });
  return imagekit;
}

async function uploadToImageKit(buffer, fileName) {
  const ik = getImageKit();
  if (!ik) {
    throw new Error(
      'ImageKit not configured. Set IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT in .env'
    );
  }
  const result = await ik.upload({
    file: buffer.toString('base64'),
    fileName: fileName || `prompt-${Date.now()}.jpg`,
    folder: '/somyalaya-prompts',
  });
  return result.url;
}

// Get all prompts
router.get('/', async (req, res) => {
  try {
    const { category, search, page = 1, limit = 24 } = req.query;
    const query = {};

    if (category && category !== 'All' && category !== 'All Prompts') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { promptText: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const prompts = await Prompt.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    const total = await Prompt.countDocuments(query);

    res.json({
      prompts,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single
router.get('/:id', async (req, res) => {
  try {
    const prompt = await Prompt.findById(req.params.id);
    if (!prompt) return res.status(404).json({ message: 'Prompt not found' });
    res.json(prompt);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create with image upload (admin)
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    const { title, promptText, category, tags, authorName, authorUsername } = req.body;

    if (!title || !promptText) {
      return res.status(400).json({ message: 'Title and prompt text are required' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required (upload, not URL)' });
    }

    const imageUrl = await uploadToImageKit(req.file.buffer, req.file.originalname);

    const prompt = await Prompt.create({
      title: title.trim(),
      promptText: promptText.trim(),
      imageUrl,
      category: category || 'Social Buzz',
      tags: tags
        ? (typeof tags === 'string' ? tags.split(',').map((t) => t.trim()).filter(Boolean) : tags)
        : [],
      author: {
        name: authorName || 'Admin',
        username: authorUsername || '@admin',
      },
    });

    res.status(201).json(prompt);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update (admin) — can also upload new image
router.put('/:id', protect, upload.single('image'), async (req, res) => {
  try {
    const updates = {};
    const fields = ['title', 'promptText', 'category', 'isFeatured', 'aspectRatio'];
    for (const key of fields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (req.body.tags !== undefined) {
      updates.tags =
        typeof req.body.tags === 'string'
          ? req.body.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : req.body.tags;
    }
    if (req.body.authorName || req.body.authorUsername) {
      updates.author = {
        name: req.body.authorName || 'Admin',
        username: req.body.authorUsername || '@admin',
      };
    }
    if (req.file) {
      updates.imageUrl = await uploadToImageKit(req.file.buffer, req.file.originalname);
    }

    const prompt = await Prompt.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!prompt) return res.status(404).json({ message: 'Prompt not found' });
    res.json(prompt);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete ALL prompts (optional ?category=Name to delete only that category)
// NOTE: must stay above '/:id' so "all" isn't treated as an id.
router.delete('/all', protect, async (req, res) => {
  try {
    const filter = req.query.category ? { category: req.query.category } : {};
    const result = await Prompt.deleteMany(filter);
    res.json({ message: 'Prompts deleted', deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete
router.delete('/:id', protect, async (req, res) => {
  try {
    const prompt = await Prompt.findByIdAndDelete(req.params.id);
    if (!prompt) return res.status(404).json({ message: 'Prompt not found' });
    res.json({ message: 'Prompt deleted', id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Increment uses
router.post('/:id/use', async (req, res) => {
  try {
    const prompt = await Prompt.findByIdAndUpdate(
      req.params.id,
      { $inc: { uses: 1 } },
      { new: true }
    );
    res.json(prompt);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/like', protect, async (req, res) => {
  try {
    const prompt = await Prompt.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    );
    res.json(prompt);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;