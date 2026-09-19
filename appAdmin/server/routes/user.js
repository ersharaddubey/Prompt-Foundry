import express from 'express';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

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

export default router;
