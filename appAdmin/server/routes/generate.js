import express from 'express';
import multer from 'multer';
import ImageKit from 'imagekit';
import crypto from 'crypto';
import axios from 'axios';
import sharp from 'sharp';
import mongoose from 'mongoose';
import GeneratedImage from '../models/GeneratedImage.js';
import GenerationJob from '../models/GenerationJob.js';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => file.mimetype?.startsWith('image/') ? cb(null, true) : cb(new Error('Only image files are allowed')),
});
const HORDE_BASE = 'https://aihorde.net/api/v2';
const HORDE_API_KEY = process.env.AI_HORDE_API_KEY || '0000000000'; // anonymous fallback
const CLIENT_AGENT = process.env.AI_HORDE_CLIENT_AGENT || 'PromptFoundry:1.0.0:contact@promptfoundry.app';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || '',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || '',
});

function hordeHeaders() {
  return { apikey: HORDE_API_KEY, 'Client-Agent': CLIENT_AGENT, 'Content-Type': 'application/json' };
}

function quotaSnapshot(events = [], now = Date.now()) {
  const active = events.filter((e) => e.status !== 'failed' && !(e.status === 'pending' && now - new Date(e.createdAt).getTime() > 9 * 60 * 1000));
  const hour = active.filter((e) => new Date(e.createdAt).getTime() > now - HOUR_MS);
  const day = active.filter((e) => new Date(e.createdAt).getTime() > now - DAY_MS);
  const nextHour = hour.length >= 3 ? Math.max(0, HOUR_MS - (now - Math.min(...hour.map((e) => new Date(e.createdAt).getTime())))) : 0;
  const nextDay = day.length >= 10 ? Math.max(0, DAY_MS - (now - Math.min(...day.map((e) => new Date(e.createdAt).getTime())))) : 0;
  const wait = Math.max(nextHour, nextDay);
  return { hourlyLimit: 3, dailyLimit: 10, hourlyUsed: hour.length, dailyUsed: day.length,
    hourlyRemaining: Math.max(0, 3 - hour.length), dailyRemaining: Math.max(0, 10 - day.length),
    nextAvailableAt: wait ? new Date(now + wait).toISOString() : null };
}

async function uploadToImageKit(buffer, folder = '/prompt-foundry/generated') {
  if (!process.env.IMAGEKIT_PUBLIC_KEY || !process.env.IMAGEKIT_PRIVATE_KEY || !process.env.IMAGEKIT_URL_ENDPOINT) {
    throw new Error('ImageKit is not configured on the server.');
  }
  const uploaded = await imagekit.upload({
    file: buffer.toString('base64'),
    fileName: `pf-${Date.now()}-${crypto.randomBytes(5).toString('hex')}.webp`,
    folder,
    useUniqueFileName: true,
    tags: ['prompt-foundry', 'ai-horde'],
  });
  if (!uploaded?.url) throw new Error('ImageKit did not return an image URL');
  return uploaded;
}

function dimensionsForRatio(ratio) {
  // AI Horde rejects anonymous requests above 576x576 pixels of area, and sizes must be multiples of 64.
  return ({
    '1:1': [512, 512], '3:4': [448, 576], '4:3': [576, 448],
    '9:16': [320, 576], '16:9': [576, 320],
  })[ratio] || [448, 576];
}

async function markUsage(userId, jobId, status) {
  await User.updateOne({ _id: userId, 'generationUsage.jobId': String(jobId) }, {
    $set: { 'generationUsage.$.status': status },
  });
}

router.get('/provider-status', protect, async (_req, res) => {
  res.json({ provider: 'AI Horde', billing: 'anonymous-community-workers', configured: true, storageProvider: 'ImageKit', storageConfigured: !!(process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT) });
});

router.get('/quota', protect, async (req, res) => {
  const user = await User.findById(req.user._id).select('generationUsage').lean();
  res.json(quotaSnapshot(user?.generationUsage || []));
});

// Submit a single asynchronous AI Horde request. The user is charged only against Prompt Foundry's own free quota.
router.post('/ai-horde', protect, upload.single('image'), async (req, res) => {
  let reservedJobId = null;
  let lockAcquired = false;
  try {
    const prompt = String(req.body?.prompt || '').trim();
    const ratio = ['1:1', '3:4', '4:3', '9:16', '16:9'].includes(req.body?.ratio) ? req.body.ratio : '3:4';
    if (!prompt || prompt.length > 2048) return res.status(400).json({ message: 'Prompt must contain 1–2048 characters' });

    const now = new Date();
    const lock = await User.findOneAndUpdate(
      { _id: req.user._id, $or: [{ generationLockUntil: null }, { generationLockUntil: { $lt: now } }] },
      { $set: { generationLockUntil: new Date(now.getTime() + 45000) } },
      { new: true }
    ).select('_id');
    if (!lock) return res.status(409).json({ message: 'A generation request is already being submitted. Please wait a moment.' });
    lockAcquired = true;
    const user = await User.findById(req.user._id).select('generationUsage');
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.generationUsage = (user.generationUsage || []).filter((e) => new Date(e.createdAt).getTime() > now.getTime() - DAY_MS);
    const quota = quotaSnapshot(user.generationUsage, now.getTime());
    if (quota.hourlyRemaining <= 0 || quota.dailyRemaining <= 0) {
      return res.status(429).json({ message: quota.hourlyRemaining <= 0 ? 'Hourly free limit reached. Your next image credit will return after one hour.' : 'Daily free limit reached. Please try again later.', quota });
    }

    reservedJobId = new mongoose.Types.ObjectId();
    user.generationUsage.push({ jobId: String(reservedJobId), createdAt: now, status: 'pending' });
    await user.save();

    const [width, height] = dimensionsForRatio(ratio);
    const payload = {
      prompt,
      params: { width, height, steps: 25, cfg_scale: 7.5, sampler_name: 'k_euler_a', karras: true, n: 1 },
      nsfw: false,
      censor_nsfw: true,
      r2: true,
      shared: true,
      replacement_filter: true,
    };

    if (req.file) {
      const webp = await sharp(req.file.buffer).rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).webp({ quality: 86 }).toBuffer();
      payload.source_image = webp.toString('base64');
      payload.source_processing = 'img2img';
    } else if (/^https:\/\//i.test(String(req.body?.sourceImageUrl || ''))) {
      payload.source_image = String(req.body.sourceImageUrl).slice(0, 4096);
      payload.source_processing = 'img2img';
    }

    const submitted = await axios.post(`${HORDE_BASE}/generate/async`, payload, {
      headers: hordeHeaders(), timeout: 30000,
    });
    const providerRequestId = submitted.data?.id;
    if (!providerRequestId) throw new Error(submitted.data?.message || 'AI Horde did not return a request ID');

    const job = await GenerationJob.create({
      _id: reservedJobId,
      user: req.user._id,
      providerRequestId,
      promptText: prompt,
      ratio,
      status: 'pending',
    });
    res.status(202).json({ jobId: job._id, status: 'pending', message: 'Your image is in the AI Horde queue.', quota: quotaSnapshot(user.generationUsage) });
  } catch (error) {
    if (reservedJobId) await markUsage(req.user._id, reservedJobId, 'failed').catch(() => {});
    const providerMessage = error.response?.data?.message || error.response?.data?.errors?.[0]?.message;
    res.status(error.response?.status === 429 ? 503 : 502).json({ message: providerMessage || error.message || 'Could not submit image generation request. Your credit has been restored.' });
  } finally {
    if (lockAcquired) await User.updateOne({ _id: req.user._id }, { $set: { generationLockUntil: null } }).catch(() => {});
  }
});

// Poll the job. The Horde check endpoint is used until done; full status is fetched only once.
router.get('/ai-horde/:jobId', protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.jobId)) return res.status(400).json({ message: 'Invalid generation job' });
    const job = await GenerationJob.findOne({ _id: req.params.jobId, user: req.user._id });
    if (!job) return res.status(404).json({ message: 'Generation job not found' });
    if (job.status === 'success') return res.json({ status: 'success', imageUrl: job.imageUrl, quota: quotaSnapshot((await User.findById(req.user._id).select('generationUsage').lean())?.generationUsage || []) });
    if (job.status === 'failed') return res.status(422).json({ status: 'failed', message: job.error || 'Generation failed. Your credit has been restored.' });

    if (Date.now() - job.createdAt.getTime() > 9 * 60 * 1000) {
      job.status = 'failed'; job.error = 'AI Horde request timed out. Your credit has been restored.'; await job.save();
      await markUsage(req.user._id, job._id, 'failed');
      return res.status(408).json({ status: 'failed', message: job.error });
    }

    let check;
    try {
      check = await axios.get(`${HORDE_BASE}/generate/check/${job.providerRequestId}`, { headers: hordeHeaders(), timeout: 15000 });
    } catch (e) {
      const code = e.response?.status;
      // Timeout / 429 / 5xx from Horde are transient: keep the job pending and retry on next poll.
      if (!code || code === 429 || code >= 500) return res.json({ status: 'pending', queuePosition: null, waitTime: null });
      throw e;
    }
    if (check.data?.faulted || check.data?.is_possible === false) {
      throw new Error('No AI Horde worker can serve this request right now. Please try again. Your credit has been restored.');
    }
    if (!check.data?.done) {
      return res.json({ status: 'pending', queuePosition: check.data?.queue_position ?? null, waitTime: check.data?.wait_time ?? null, finished: check.data?.finished || 0, quota: quotaSnapshot((await User.findById(req.user._id).select('generationUsage').lean())?.generationUsage || []) });
    }

    const full = await axios.get(`${HORDE_BASE}/generate/status/${job.providerRequestId}`, { headers: hordeHeaders(), timeout: 20000 });
    const generation = full.data?.generations?.[0];
    if (!generation?.img) throw new Error('AI Horde completed but returned no image. Your credit has been restored.');
    let buffer;
    if (/^https?:\/\//i.test(generation.img)) {
      const downloaded = await axios.get(generation.img, { responseType: 'arraybuffer', timeout: 45000, maxContentLength: 25 * 1024 * 1024 });
      buffer = Buffer.from(downloaded.data);
    } else {
      const encoded = String(generation.img).replace(/^data:image\/[^;]+;base64,/, '');
      buffer = Buffer.from(encoded, 'base64');
    }
    if (!buffer.length) throw new Error('AI Horde returned an empty image. Your credit has been restored.');
    const normalized = await sharp(buffer).rotate().webp({ quality: 88 }).toBuffer();
    const uploaded = await uploadToImageKit(normalized);
    const promptHash = crypto.createHash('sha256').update(`${job.promptText.toLowerCase()}|ai-horde|${job.ratio}|${req.user._id}`).digest('hex');
    await GeneratedImage.create({
      promptHash, promptText: job.promptText, imageUrl: uploaded.url,
      model: generation.model || 'ai-horde-community', ratio: job.ratio,
      storageProvider: 'imagekit', storagePath: uploaded.filePath || '',
      user: req.user._id, isCached: false,
    });
    job.status = 'success'; job.imageUrl = uploaded.url; await job.save();
    await markUsage(req.user._id, job._id, 'success');
    const updatedUser = await User.findById(req.user._id).select('generationUsage').lean();
    res.json({ status: 'success', imageUrl: uploaded.url, quota: quotaSnapshot(updatedUser?.generationUsage || []) });
  } catch (error) {
    const job = await GenerationJob.findOne({ _id: req.params.jobId, user: req.user._id }).catch(() => null);
    if (job && job.status === 'pending') {
      job.status = 'failed'; job.error = error.response?.data?.message || error.message || 'Generation failed. Your credit has been restored.';
      await job.save().catch(() => {});
      await markUsage(req.user._id, job._id, 'failed').catch(() => {});
    }
    res.status(502).json({ status: 'failed', message: error.response?.data?.message || error.message || 'Generation failed. Your credit has been restored.' });
  }
});

// ---------- Gallery: user's generated images ----------
router.get('/gallery', protect, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 60);
    const filter = { user: req.user._id, isCached: false };
    const [items, total] = await Promise.all([
      GeneratedImage.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
        .select('imageUrl promptText ratio createdAt storagePath').lean(),
      GeneratedImage.countDocuments(filter),
    ]);
    res.json({ items, total, page, hasMore: page * limit < total });
  } catch (error) { res.status(500).json({ message: error.message || 'Could not load gallery' }); }
});

router.delete('/gallery/:id', protect, async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ message: 'Invalid image id' });
    const removed = await GeneratedImage.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!removed) return res.status(404).json({ message: 'Image not found' });
    res.json({ success: true, id: removed._id });
  } catch (error) { res.status(500).json({ message: error.message || 'Could not delete image' }); }
});

export default router;
