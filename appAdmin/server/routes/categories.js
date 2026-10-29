import express from 'express';
import Category from '../models/Category.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Get all active categories (public)
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ order: 1, name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: create category
router.post('/', protect, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Category name required' });
    }

    const exists = await Category.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    });
    if (exists) {
      return res.status(400).json({ message: 'Category already exists' });
    }

    const category = await Category.create({ name: name.trim() });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: update
router.put('/:id', protect, async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { name: req.body.name, isActive: req.body.isActive, order: req.body.order },
      { new: true }
    );
    if (!category) return res.status(404).json({ message: 'Not found' });
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: delete ALL categories (above '/:id')
router.delete('/all', protect, async (req, res) => {
  try {
    const result = await Category.deleteMany({});
    res.json({ message: 'All categories deleted', deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: delete
router.delete('/:id', protect, async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
