import express from 'express';
import multer from 'multer';
import ImageKit from 'imagekit';
import crypto from 'crypto';
import GeneratedImage from '../models/GeneratedImage.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => file.mimetype?.startsWith('image/') ? cb(null, true) : cb(new Error('Only image files are allowed')),
});

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || '',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || '',
});

async function uploadToImageKit(buffer, folder = '/prompt-foundry/reference-uploads') {
  if (!process.env.IMAGEKIT_PUBLIC_KEY || !process.env.IMAGEKIT_PRIVATE_KEY || !process.env.IMAGEKIT_URL_ENDPOINT) {
    throw new Error('ImageKit is not configured on the server.');
  }
  const uploaded = await imagekit.upload({
    file: buffer,
    fileName: `pf-${Date.now()}-${crypto.randomBytes(5).toString('hex')}.jpg`,
    folder,
    useUniqueFileName: true,
    tags: ['prompt-foundry', 'user-upload'],
  });
  if (!uploaded?.url) throw new Error('ImageKit did not return an image URL');
  return uploaded;
}

// Image generation and all generation billing are handled by the signed-in customer's Puter account.
// ImageKit remains in place for reference uploads and profile/app-owned assets.
router.get('/provider-status', protect, (_req, res) => {
  res.json({ provider: 'Puter User-Pays', billing: 'direct-to-user', configured: true, referenceStorage: 'ImageKit' });
});

router.post('/puter-reference-upload', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Reference image is required' });
    const uploaded = await uploadToImageKit(req.file.buffer);
    res.status(201).json({ imageUrl: uploaded.url, storageProvider: 'imagekit' });
  } catch (error) {
    res.status(502).json({ message: error.message || 'Could not upload reference image' });
  }
});

router.post('/puter-record', protect, async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || '').trim();
    const ratio = ['1:1', '3:4', '4:3', '9:16', '16:9'].includes(req.body?.ratio) ? req.body.ratio : '3:4';
    const imageUrl = String(req.body?.imageUrl || '').trim();
    const storagePath = String(req.body?.storagePath || '').trim();
    if (!prompt || prompt.length > 2048) return res.status(400).json({ message: 'Prompt must contain 1–2048 characters' });
    if (!/^https:\/\//i.test(imageUrl) || imageUrl.length > 4096) return res.status(400).json({ message: 'A valid Puter image URL is required' });
    if (!storagePath.startsWith('images/') || storagePath.includes('..')) return res.status(400).json({ message: 'Invalid Puter storage path' });

    const promptHash = crypto.createHash('sha256').update(`${prompt.toLowerCase()}|puter-user-pays|${ratio}|${req.user._id}`).digest('hex');
    const record = await GeneratedImage.create({
      promptHash, promptText: prompt, imageUrl, model: 'puter-user-pays', ratio,
      storageProvider: 'puter', storagePath, user: req.user._id, isCached: false,
    });
    res.status(201).json({ success: true, imageUrl, storagePath, id: record._id, billing: 'puter-user-pays' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Could not save generation history' });
  }
});

export default router;
