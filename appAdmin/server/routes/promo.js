import express from 'express';
import PromoCode from '../models/PromoCode.js';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Admin: create promo code
router.post('/', protect, async (req, res) => {
  try {
    const { code, credits, maxUses, expiresAt } = req.body;

    if (!code || !credits) {
      return res.status(400).json({ message: 'Code and credits are required' });
    }

    const exists = await PromoCode.findOne({ code: code.toUpperCase() });
    if (exists) {
      return res.status(400).json({ message: 'Promo code already exists' });
    }

    const promo = await PromoCode.create({
      code: code.toUpperCase().trim(),
      credits: Number(credits),
      maxUses: maxUses ? Number(maxUses) : 1,
      expiresAt: expiresAt || null,
      createdBy: req.user._id,
    });

    res.status(201).json(promo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: list all promo codes
router.get('/', protect, async (req, res) => {
  try {
    const promos = await PromoCode.find().sort({ createdAt: -1 });
    res.json(promos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: delete ALL promo codes (above '/:id')
router.delete('/all', protect, async (req, res) => {
  try {
    const result = await PromoCode.deleteMany({});
    res.json({ message: 'All promo codes deleted', deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: deactivate / delete
router.delete('/:id', protect, async (req, res) => {
  try {
    await PromoCode.findByIdAndDelete(req.params.id);
    res.json({ message: 'Promo code deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// User: redeem promo code
router.post('/redeem', protect, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Enter a promo code' });

    const promo = await PromoCode.findOne({ code: code.toUpperCase().trim() });

    if (!promo || !promo.isActive) {
      return res.status(400).json({ message: 'Invalid or inactive promo code' });
    }

    if (promo.expiresAt && new Date() > promo.expiresAt) {
      return res.status(400).json({ message: 'Promo code has expired' });
    }

    if (promo.usedCount >= promo.maxUses) {
      return res.status(400).json({ message: 'Promo code usage limit reached' });
    }

    if (promo.usedBy.some((id) => id.toString() === req.user._id.toString())) {
      return res.status(400).json({ message: 'You already used this code' });
    }

    // Add credits
    const user = await User.findById(req.user._id);
    user.credits += promo.credits;
    await user.save();

    promo.usedCount += 1;
    promo.usedBy.push(req.user._id);
    await promo.save();

    res.json({
      message: `Success! ${promo.credits} credits added`,
      credits: user.credits,
      dailyCredits: user.dailyCredits,
      added: promo.credits,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
