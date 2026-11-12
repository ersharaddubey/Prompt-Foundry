import express from 'express';
import multer from 'multer';
import ImageKit from 'imagekit';
import mongoose from 'mongoose';
import TravelMemory from '../models/TravelMemory.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => file.mimetype?.startsWith('image/')
    ? cb(null, true) : cb(new Error('Only image files are allowed')),
});
let imagekit;
function getImageKit() {
  if (!imagekit) {
    const { IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT } = process.env;
    if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_PRIVATE_KEY || !IMAGEKIT_URL_ENDPOINT) return null;
    imagekit = new ImageKit({ publicKey: IMAGEKIT_PUBLIC_KEY, privateKey: IMAGEKIT_PRIVATE_KEY, urlEndpoint: IMAGEKIT_URL_ENDPOINT });
  }
  return imagekit;
}
async function storeImage(file) {
  const ik = getImageKit();
  if (!ik) throw new Error('ImageKit is not configured on the server.');
  const result = await ik.upload({
    file: file.buffer.toString('base64'),
    fileName: file.originalname || `travel-${Date.now()}.jpg`,
    folder: '/prompt-foundry-travel',
  });
  return { imageUrl: result.url, imageFileId: result.fileId || '' };
}
const tagsFrom = (value) => Array.isArray(value) ? value : String(value || '').split(',').map(x => x.trim()).filter(Boolean);
const adminOnly = (req, res) => {
  const role = String(req.user?.role || req.user?.accountType || '').toLowerCase();
  const allowedEmails = String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
  const emailAllowed = req.user?.email && allowedEmails.includes(String(req.user.email).toLowerCase());
  if (!req.user || !(req.user.isAdmin === true || ['admin', 'superadmin'].includes(role) || emailAllowed)) {
    res.status(403).json({ message: 'Admin access required. Configure ADMIN_EMAILS on the API server.' });
    return false;
  }
  return true;
};

// Category values used by the mobile upload form.
router.get('/categories', (_req, res) => res.json([
  'Nature', 'Mountains', 'Beach', 'City', 'Culture', 'Adventure', 'Food', 'Wildlife', 'Other',
]));

// Cities that have at least one approved public travel memory.
router.get('/cities', async (_req, res) => {
  try {
    const rows = await TravelMemory.aggregate([
      { $match: { status: 'approved', visibility: 'public', city: { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: { city: '$city', country: '$country' },
          count: { $sum: 1 },
          coverImage: { $first: '$imageUrl' },
        },
      },
      { $sort: { count: -1, '_id.city': 1 } },
      {
        $project: {
          _id: 0,
          city: '$_id.city',
          country: '$_id.country',
          count: 1,
          coverImage: 1,
        },
      },
    ]);
    res.json({ cities: rows });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Public feed: only approved public memories are visible.
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 24));
    const query = { status: 'approved', visibility: 'public' };
    if (req.query.category) query.category = String(req.query.category);
    if (req.query.city) query.city = { $regex: `^${String(req.query.city).trim()}$`, $options: 'i' };
    if (req.query.q) {
      const term = String(req.query.q).trim();
      query.$or = ['title', 'description', 'locationName', 'city', 'country', 'tags'].map(k => ({ [k]: { $regex: term, $options: 'i' } }));
    }
    const sort = req.query.sort === 'popular' || req.query.sort === 'trending'
      ? { likeCount: -1, createdAt: -1 } : { createdAt: -1 };
    const [items, total] = await Promise.all([
      TravelMemory.find(query).populate('creator', 'name username avatar').sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      TravelMemory.countDocuments(query),
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get('/admin/all', protect, async (req, res) => {
  if (!adminOnly(req, res)) return;
  try {
    const status = String(req.query.status || 'all');
    const query = status === 'all' ? {} : { status };
    if (req.query.search) query.$or = ['title', 'locationName', 'city', 'country', 'category'].map(k => ({ [k]: { $regex: String(req.query.search), $options: 'i' } }));
    const items = await TravelMemory.find(query).populate('creator', 'name username email avatar').sort({ createdAt: -1 }).limit(500).lean();
    res.json({ items, total: await TravelMemory.countDocuments(query) });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    const { title, description, locationName, city, country, category, visibility, ownershipConfirmed, externalLink } = req.body;
    if (!req.file) return res.status(400).json({ message: 'Photo is required.' });
    if (!title?.trim() || !locationName?.trim() || !country?.trim() || !category?.trim()) {
      return res.status(400).json({ message: 'Title, location, country and category are required.' });
    }
    if (String(ownershipConfirmed) !== 'true') return res.status(400).json({ message: 'Photo ownership confirmation is required.' });
    const image = await storeImage(req.file);
    const memory = await TravelMemory.create({
      title: title.trim(), description: String(description || '').trim(), locationName: locationName.trim(),
      city: String(city || '').trim(), country: country.trim(), category: category.trim(),
      tags: tagsFrom(req.body.tags), visibility: visibility === 'private' ? 'private' : 'public',
      ownershipConfirmed: true, creator: req.user._id, ...image, status: 'pending',
      externalLink: String(externalLink || '').trim(),
    });
    res.status(201).json({ message: 'Travel memory uploaded and is pending admin review.', item: memory });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// Admin: direct upload (auto-approved) with optional external link — for blank/city pages.
router.post('/admin/create', protect, upload.single('image'), async (req, res) => {
  if (!adminOnly(req, res)) return;
  try {
    const { title, description, locationName, city, country, category, externalLink } = req.body;
    if (!req.file) return res.status(400).json({ message: 'Image is required.' });
    if (!title?.trim() || !locationName?.trim() || !city?.trim() || !country?.trim()) {
      return res.status(400).json({ message: 'Title, location, city and country are required.' });
    }
    const image = await storeImage(req.file);
    const memory = await TravelMemory.create({
      title: title.trim(),
      description: String(description || '').trim(),
      locationName: locationName.trim(),
      city: city.trim(),
      country: country.trim(),
      category: String(category || 'City').trim(),
      tags: tagsFrom(req.body.tags),
      visibility: 'public',
      ownershipConfirmed: true,
      creator: req.user._id,
      ...image,
      status: 'approved',
      externalLink: String(externalLink || '').trim(),
    });
    res.status(201).json({ message: 'Travel location image published.', item: memory });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/admin/pending', protect, async (req, res) => {
  if (!adminOnly(req, res)) return;
  try {
    const items = await TravelMemory.find({ status: 'pending' }).populate('creator', 'name username email avatar').sort({ createdAt: -1 }).lean();
    res.json({ items, total: items.length });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.patch('/admin/:id/moderate', protect, async (req, res) => {
  if (!adminOnly(req, res)) return;
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid travel memory ID.' });
  const action = String(req.body.action || '');
  const statusMap = { approve: 'approved', reject: 'rejected', remove: 'removed' };
  if (!statusMap[action]) return res.status(400).json({ message: 'Action must be approve, reject or remove.' });
  try {
    const item = await TravelMemory.findByIdAndUpdate(req.params.id, {
      status: statusMap[action], moderationNote: String(req.body.note || '').slice(0, 500),
    }, { new: true, runValidators: true }).populate('creator', 'name username email avatar');
    if (!item) return res.status(404).json({ message: 'Travel memory not found.' });
    res.json({ message: `Travel memory ${statusMap[action]}.`, item });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.delete('/admin/:id', protect, async (req, res) => {
  if (!adminOnly(req, res)) return;
  try {
    const item = await TravelMemory.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Travel memory not found.' });
    res.json({ message: 'Travel memory deleted.' });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid travel memory ID.' });
    const item = await TravelMemory.findOne({ _id: req.params.id, status: 'approved', visibility: 'public' }).populate('creator', 'name username avatar').lean();
    if (!item) return res.status(404).json({ message: 'Travel memory not found.' });
    res.json(item);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

export default router;
