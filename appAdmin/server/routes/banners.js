import express from 'express';
import Banner from '../models/Banner.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const adminOnly = (req, res) => {
  const role = String(req.user?.role || req.user?.accountType || '').toLowerCase();
  const allowedEmails = String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const emailAllowed = req.user?.email && allowedEmails.includes(String(req.user.email).toLowerCase());
  if (!req.user || !(req.user.isAdmin === true || ['admin', 'superadmin'].includes(role) || emailAllowed)) {
    res.status(403).json({ message: 'Admin access required. Configure ADMIN_EMAILS on the API server.' });
    return false;
  }
  return true;
};

const isHttps = (u) => /^https?:\/\//i.test(String(u || '').trim());

// Public: Generate screen ka slider
router.get('/', async (_req, res) => {
  try {
    const banners = await Banner.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .limit(12)
      .select('title imageUrl linkUrl')
      .lean();
    res.set('Cache-Control', 'public, max-age=60');
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: create  { title?, imageUrl, linkUrl, order?, isActive? }
router.post('/', protect, async (req, res) => {
  if (!adminOnly(req, res)) return;
  try {
    const { title = '', imageUrl, linkUrl, order = 0, isActive = true } = req.body || {};
    if (!isHttps(imageUrl) || !isHttps(linkUrl)) {
      return res.status(400).json({ message: 'imageUrl aur linkUrl valid http(s) URL hone chahiye' });
    }
    const banner = await Banner.create({ title, imageUrl, linkUrl, order, isActive });
    res.status(201).json(banner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: update
router.put('/:id', protect, async (req, res) => {
  if (!adminOnly(req, res)) return;
  try {
    const updates = {};
    for (const k of ['title', 'imageUrl', 'linkUrl', 'order', 'isActive']) {
      if (req.body?.[k] !== undefined) updates[k] = req.body[k];
    }
    if ((updates.imageUrl && !isHttps(updates.imageUrl)) || (updates.linkUrl && !isHttps(updates.linkUrl))) {
      return res.status(400).json({ message: 'Invalid URL' });
    }
    const banner = await Banner.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!banner) return res.status(404).json({ message: 'Banner not found' });
    res.json(banner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: delete
router.delete('/:id', protect, async (req, res) => {
  if (!adminOnly(req, res)) return;
  try {
    const removed = await Banner.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ message: 'Banner not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
