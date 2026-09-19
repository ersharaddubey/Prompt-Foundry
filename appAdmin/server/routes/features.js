import express from 'express';
import crypto from 'crypto';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import GeneratedImage from '../models/GeneratedImage.js';
import Battle from '../models/Battle.js';
import Challenge from '../models/Challenge.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { protect } from '../middleware/auth.js';
import { dispatchNotification } from './notifications.js';
import {
  enhancePromptLLM,
  safetyScoreLLM,
  challengeIdeasLLM,
  battleCommentLLM,
  imageHintPromptsLLM,
  keywordSafety,
} from '../lib/openrouter.js';

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images'), false);
  },
});

function getDimensions(ratio) {
  const map = {
    '1:1': { width: 1024, height: 1024 },
    '3:4': { width: 768, height: 1024 },
    '4:3': { width: 1024, height: 768 },
    '9:16': { width: 576, height: 1024 },
    '16:9': { width: 1024, height: 576 },
  };
  return map[ratio] || map['3:4'];
}

function pollinationsUrl(prompt, width, height, seed, model = 'flux') {
  const encoded = encodeURIComponent(prompt.trim());
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true&model=${model}&seed=${seed || Date.now()}`;
}

async function downloadBuffer(url, retries = 4) {
  for (let i = 0; i < retries; i++) {
    try {
      if (i === 0) await new Promise((r) => setTimeout(r, 2500));
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'image/*',
        },
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 6000 + i * 2000));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) throw new Error('Too small');
      return buf;
    } catch (e) {
      if (i === retries - 1) return null;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  return null;
}

async function uploadToCloud(buffer, folder = 'somyalaya-generations') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

// Dono credit pools (dailyCredits + credits) ko jodkar check/deduct karta hai.
// Pehle ye har pool ko ALAG check karta tha, isliye total credits kaafi hone
// par bhi (e.g. dailyCredits=5, credits=3, cost=6) galti se "Not enough
// credits" bol deta tha — ab pehle dailyCredits se kaatega, fir baaki credits se.
async function deductCredits(user, amount) {
  const total = (user.dailyCredits || 0) + (user.credits || 0);
  if (total < amount) return false;

  const fromDaily = Math.min(user.dailyCredits || 0, amount);
  user.dailyCredits = (user.dailyCredits || 0) - fromDaily;
  user.credits = (user.credits || 0) - (amount - fromDaily);
  await user.save();
  return true;
}

// Negative prompt presets
const NEGATIVE_PRESETS = [
  { id: 'clean', label: 'Clean', text: 'blurry, low quality, distorted, ugly, deformed, extra limbs' },
  { id: 'photo', label: 'Photo realism', text: 'cartoon, anime, illustration, painting, drawing, sketch' },
  { id: 'portrait', label: 'Portrait', text: 'extra fingers, bad anatomy, asymmetrical face, cross-eyed' },
  { id: 'no-text', label: 'No text', text: 'text, watermark, signature, logo, words, letters' },
  { id: 'cinematic', label: 'Cinematic', text: 'flat lighting, overexposed, underexposed, noisy, grainy' },
];

// Style remix presets
const REMIX_STYLES = [
  { id: 'cinematic', suffix: ', cinematic lighting, dramatic atmosphere, film still, 8k' },
  { id: 'anime', suffix: ', anime style, vibrant colors, studio ghibli inspired, detailed' },
  { id: 'oil', suffix: ', oil painting, classical art, rich textures, museum quality' },
  { id: 'cyberpunk', suffix: ', cyberpunk, neon lights, futuristic city, blade runner style' },
  { id: 'minimal', suffix: ', minimalist, clean composition, soft colors, elegant' },
];

// ========== AI Prompt Enhancer (OpenRouter free + fallback) ==========
router.post('/enhance-prompt', protect, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt?.trim()) return res.status(400).json({ message: 'Prompt required' });

    const data = await enhancePromptLLM(prompt.trim());
    const safety = await safetyScoreLLM(prompt.trim());

    res.json({
      original: data.original,
      enhanced: data.enhanced,
      safetyScore: safety.score,
      safetyLabel: safety.label,
      tips: data.tips || [],
      source: data.source,
      model: data.model,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ========== Prompt Safety Score (OpenRouter free + keyword fallback) ==========
router.post('/safety-score', protect, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt?.trim()) return res.status(400).json({ message: 'Prompt required' });

    const data = await safetyScoreLLM(prompt.trim());
    res.json(data);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Optional: rewrite unsafe prompt to safe version
router.post('/safety-rewrite', protect, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt?.trim()) return res.status(400).json({ message: 'Prompt required' });
    const data = await safetyScoreLLM(prompt.trim());
    res.json({
      original: prompt.trim(),
      safeRewrite: data.safeRewrite || prompt.trim(),
      ...data,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ========== Negative presets ==========
router.get('/negative-presets', (req, res) => {
  res.json(NEGATIVE_PRESETS);
});

// ========== Prompt Remix (5 styles) ==========
router.post('/remix', protect, async (req, res) => {
  try {
    const { prompt, ratio = '1:1' } = req.body;
    if (!prompt?.trim()) return res.status(400).json({ message: 'Prompt required' });

    const user = await User.findById(req.user._id);
    const cost = 6; // 5 variations roughly
    if (!(await deductCredits(user, cost))) {
      return res.status(400).json({ message: 'Not enough credits (need 6)' });
    }

    const { width, height } = getDimensions(ratio);
    const results = [];

    for (const style of REMIX_STYLES) {
      const fullPrompt = prompt.trim() + style.suffix;
      const seed = Date.now() + Math.floor(Math.random() * 10000);
      const url = pollinationsUrl(fullPrompt, width, height, seed);
      let finalUrl = url;
      const buf = await downloadBuffer(url);
      if (buf) {
        try {
          const up = await uploadToCloud(buf);
          finalUrl = up.secure_url;
        } catch (_) {}
      }
      results.push({
        style: style.id,
        prompt: fullPrompt,
        imageUrl: finalUrl,
        seed,
      });
      // small delay to reduce rate limit
      await new Promise((r) => setTimeout(r, 1500));
    }

    res.json({
      success: true,
      results,
      credits: { credits: user.credits, dailyCredits: user.dailyCredits },
    });
  } catch (e) {
    console.error('Remix error', e);
    res.status(500).json({ message: e.message || 'Remix failed' });
  }
});

// ========== Batch Generate (4 variations) ==========
router.post('/batch', protect, async (req, res) => {
  try {
    const { prompt, ratio = '1:1', model = 'flux', negative = '', strength = 7 } = req.body;
    if (!prompt?.trim()) return res.status(400).json({ message: 'Prompt required' });

    const user = await User.findById(req.user._id);
    const cost = 5;
    if (!(await deductCredits(user, cost))) {
      return res.status(400).json({ message: 'Not enough credits (need 5)' });
    }

    let fullPrompt = prompt.trim();
    if (negative) fullPrompt += `. Avoid: ${negative}`;
    // strength maps to detail emphasis
    if (strength >= 8) fullPrompt += ', extremely detailed, intricate';
    else if (strength <= 4) fullPrompt += ', simple, minimal details';

    const { width, height } = getDimensions(ratio);
    const results = [];

    for (let i = 0; i < 4; i++) {
      const seed = Date.now() + i * 7919;
      const url = pollinationsUrl(fullPrompt, width, height, seed, model === 'flux' ? 'flux' : 'flux');
      let finalUrl = url;
      const buf = await downloadBuffer(url);
      if (buf) {
        try {
          const up = await uploadToCloud(buf);
          finalUrl = up.secure_url;
        } catch (_) {}
      }
      const gen = await GeneratedImage.create({
        promptHash: crypto.createHash('sha256').update(`${fullPrompt}|${seed}`).digest('hex'),
        promptText: fullPrompt,
        imageUrl: finalUrl,
        model,
        ratio,
        user: req.user._id,
      });
      results.push({ id: gen._id, imageUrl: finalUrl, seed, prompt: fullPrompt });
      await new Promise((r) => setTimeout(r, 1200));
    }

    res.json({
      success: true,
      results,
      credits: { credits: user.credits, dailyCredits: user.dailyCredits },
    });
  } catch (e) {
    console.error('Batch error', e);
    res.status(500).json({ message: e.message || 'Batch failed' });
  }
});

// ========== Multi-model comparison ==========
router.post('/compare', protect, async (req, res) => {
  try {
    const { prompt, ratio = '1:1' } = req.body;
    if (!prompt?.trim()) return res.status(400).json({ message: 'Prompt required' });

    const user = await User.findById(req.user._id);
    const cost = 6;
    if (!(await deductCredits(user, cost))) {
      return res.status(400).json({ message: 'Not enough credits (need 6)' });
    }

    const models = [
      { id: 'flux', name: 'Flux' },
      { id: 'flux', name: 'Flux (seed A)' }, // Pollinations mainly flux; different seeds
      { id: 'flux', name: 'Flux (seed B)' },
    ];
    // Note: true multi-model needs multiple APIs; we vary seeds + slight prompt tweaks
    const { width, height } = getDimensions(ratio);
    const results = [];
    const tweaks = ['', ', photorealistic', ', artistic interpretation'];

    for (let i = 0; i < 3; i++) {
      const full = prompt.trim() + tweaks[i];
      const seed = Date.now() + i * 13337;
      const url = pollinationsUrl(full, width, height, seed);
      let finalUrl = url;
      const buf = await downloadBuffer(url);
      if (buf) {
        try {
          const up = await uploadToCloud(buf);
          finalUrl = up.secure_url;
        } catch (_) {}
      }
      results.push({
        model: models[i].name,
        imageUrl: finalUrl,
        prompt: full,
        seed,
      });
      await new Promise((r) => setTimeout(r, 1200));
    }

    res.json({
      success: true,
      results,
      credits: { credits: user.credits, dailyCredits: user.dailyCredits },
      note: 'Full multi-vendor (SD3/Ideogram) needs their API keys. Currently Flux variants.',
    });
  } catch (e) {
    res.status(500).json({ message: e.message || 'Compare failed' });
  }
});

// ========== Image → Prompt (OpenRouter text + optional hint) ==========
router.post('/image-to-prompt', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file && !req.body.imageUrl && !req.body.hint) {
      return res.status(400).json({ message: 'Image or hint required' });
    }

    const hint = req.body.hint || req.body.prompt || '';
    // Full vision needs a vision model; free path uses hint + LLM prompt variants
    const prompts = await imageHintPromptsLLM(hint);

    res.json({
      success: true,
      prompts,
      note: req.file
        ? 'Image received. Using OpenRouter free text models for prompt variants (add vision model for true reverse).'
        : 'Generated from hint via OpenRouter free models.',
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ========== Style Transfer (upload + prompt) ==========
router.post('/style-transfer', protect, upload.single('image'), async (req, res) => {
  try {
    const { prompt, ratio = '1:1', strength = 6 } = req.body;
    if (!prompt?.trim()) return res.status(400).json({ message: 'Prompt required' });
    if (!req.file) return res.status(400).json({ message: 'Reference image required' });

    const user = await User.findById(req.user._id);
    if (!(await deductCredits(user, 4))) {
      return res.status(400).json({ message: 'Not enough credits (need 4)' });
    }

    // Upload reference to cloudinary
    let sourceUrl = null;
    try {
      const up = await uploadToCloud(req.file.buffer, 'somyalaya-refs');
      sourceUrl = up.secure_url;
    } catch (_) {}

    // Combine: strong style words based on strength
    let full = prompt.trim();
    if (strength >= 7) full += ', closely matching reference style and composition';
    else full += ', inspired by reference image style';

    const { width, height } = getDimensions(ratio);
    const seed = Date.now();
    const url = pollinationsUrl(full, width, height, seed);
    let finalUrl = url;
    const buf = await downloadBuffer(url);
    if (buf) {
      try {
        const up = await uploadToCloud(buf);
        finalUrl = up.secure_url;
      } catch (_) {}
    }

    const gen = await GeneratedImage.create({
      promptHash: crypto.createHash('sha256').update(`${full}|style|${seed}`).digest('hex'),
      promptText: full,
      imageUrl: finalUrl,
      model: 'flux',
      ratio,
      sourceImageUrl: sourceUrl,
      user: req.user._id,
    });

    res.json({
      success: true,
      imageUrl: finalUrl,
      sourceImageUrl: sourceUrl,
      prompt: full,
      id: gen._id,
      credits: { credits: user.credits, dailyCredits: user.dailyCredits },
    });
  } catch (e) {
    res.status(500).json({ message: e.message || 'Style transfer failed' });
  }
});

// ========== History with re-generate seed ==========
router.get('/history', protect, async (req, res) => {
  try {
    const images = await GeneratedImage.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(60);
    res.json(images);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/regenerate', protect, async (req, res) => {
  try {
    const { prompt, ratio = '3:4', model = 'flux', seed } = req.body;
    if (!prompt?.trim()) return res.status(400).json({ message: 'Prompt required' });

    const user = await User.findById(req.user._id);
    if (!(await deductCredits(user, 2))) {
      return res.status(400).json({ message: 'Not enough credits' });
    }

    const { width, height } = getDimensions(ratio);
    const newSeed = seed || Date.now() + Math.floor(Math.random() * 99999);
    const url = pollinationsUrl(prompt.trim(), width, height, newSeed);
    let finalUrl = url;
    const buf = await downloadBuffer(url);
    if (buf) {
      try {
        const up = await uploadToCloud(buf);
        finalUrl = up.secure_url;
      } catch (_) {}
    }

    const gen = await GeneratedImage.create({
      promptHash: crypto.createHash('sha256').update(`${prompt}|${newSeed}`).digest('hex'),
      promptText: prompt.trim(),
      imageUrl: finalUrl,
      model,
      ratio,
      user: req.user._id,
    });

    res.json({
      success: true,
      imageUrl: finalUrl,
      seed: newSeed,
      id: gen._id,
      credits: { credits: user.credits, dailyCredits: user.dailyCredits },
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ========== Community Prompt Battle ==========
router.post('/battle', protect, async (req, res) => {
  try {
    const { promptA, promptB, imageA, imageB } = req.body;
    if (!promptA || !promptB || !imageA || !imageB) {
      return res.status(400).json({ message: 'Both prompts and images required' });
    }
    const battle = await Battle.create({
      promptA,
      promptB,
      imageA,
      imageB,
      createdBy: req.user._id,
    });
    res.json(battle);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.get('/battles', async (req, res) => {
  try {
    const list = await Battle.find({ active: true })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('createdBy', 'name');
    res.json(list);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/battle/:id/vote', protect, async (req, res) => {
  try {
    const { side } = req.body; // 'A' or 'B'
    const battle = await Battle.findById(req.params.id);
    if (!battle) return res.status(404).json({ message: 'Not found' });
    if (battle.voters.some((v) => String(v) === String(req.user._id))) {
      return res.status(400).json({ message: 'Already voted' });
    }
    if (side === 'A') battle.votesA += 1;
    else battle.votesB += 1;
    battle.voters.push(req.user._id);
    await battle.save();
    res.json(battle);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ========== Admin: create / replace a Daily Challenge (auto-notifies everyone) ==========
// This is what the Admin Panel "Daily Challenge" section calls. Unlike
// /challenge/today (which auto-generates a filler theme if none exists),
// this lets the admin set a specific theme for a specific date, and — the
// moment it's created — fires a push notification to every user with a
// registered device so they know a new challenge is live.
router.post('/challenge/create', protect, async (req, res) => {
  try {
    const { theme, description = '', date, notify = true } = req.body;
    if (!theme?.trim()) return res.status(400).json({ message: 'Theme is required' });

    const targetDate = date || new Date().toISOString().slice(0, 10);

    // One challenge per date: replace it if the admin re-publishes for the
    // same day (e.g. fixing a typo in the theme), otherwise create fresh.
    let challenge = await Challenge.findOne({ date: targetDate });
    if (challenge) {
      challenge.theme = theme.trim();
      challenge.description = description.trim();
      await challenge.save();
    } else {
      challenge = await Challenge.create({
        theme: theme.trim(),
        description: description.trim(),
        date: targetDate,
        entries: [],
      });
    }

    let notification = null;
    if (notify) {
      notification = await Notification.create({
        title: '🎨 New Daily Challenge!',
        body: challenge.theme,
        data: { screen: 'challenge', challengeId: String(challenge._id) },
        status: 'scheduled',
        relatedChallenge: challenge._id,
        createdBy: req.user._id,
      });
      notification = await dispatchNotification(notification);
    }

    res.status(201).json({ challenge, notification });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ========== Daily Challenge ==========
router.get('/challenge/today', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    let ch = await Challenge.findOne({ date: today }).populate('entries.user', 'name');
    if (!ch) {
      const themes = [
        'Neon Cyberpunk City at night',
        'Ancient temple in the jungle',
        'Portrait of a futuristic warrior',
        'Surreal floating islands',
        'Cozy cabin in snowy mountains',
      ];
      const theme = themes[new Date().getDate() % themes.length];
      ch = await Challenge.create({
        theme,
        description: `Today's theme: ${theme}. Generate your best interpretation!`,
        date: today,
        entries: [],
      });
    }
    // Sort entries by votes
    ch.entries.sort((a, b) => b.votes - a.votes);
    res.json(ch);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/challenge/submit', protect, async (req, res) => {
  try {
    const { imageUrl, prompt } = req.body;
    if (!imageUrl) return res.status(400).json({ message: 'Image required' });
    const today = new Date().toISOString().slice(0, 10);
    let ch = await Challenge.findOne({ date: today });
    if (!ch) return res.status(404).json({ message: 'No challenge today' });
    if (ch.entries.some((e) => String(e.user) === String(req.user._id))) {
      return res.status(400).json({ message: 'Already submitted today' });
    }
    ch.entries.push({ user: req.user._id, imageUrl, prompt: prompt || '', votes: 0 });
    await ch.save();
    res.json({ success: true, challenge: ch });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/challenge/vote', protect, async (req, res) => {
  try {
    const { entryIndex } = req.body;
    const today = new Date().toISOString().slice(0, 10);
    const ch = await Challenge.findOne({ date: today });
    if (!ch || !ch.entries[entryIndex]) return res.status(404).json({ message: 'Not found' });
    ch.entries[entryIndex].votes += 1;
    await ch.save();
    res.json({ success: true, votes: ch.entries[entryIndex].votes });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ========== Smart credit estimate ==========
router.post('/estimate-credits', protect, async (req, res) => {
  try {
    const { prompt = '', mode = 'single' } = req.body;
    const words = prompt.trim().split(/\s+/).filter(Boolean).length;
    let base = 2;
    if (words > 40) base = 4;
    else if (words > 20) base = 3;
    if (mode === 'batch') base = 5;
    if (mode === 'remix') base = 6;
    if (mode === 'compare') base = 6;
    if (mode === 'style') base = 4;
    res.json({ estimated: base, words, mode });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ========== Challenge AI prompt ideas ==========
router.post('/challenge/ideas', async (req, res) => {
  try {
    const theme = req.body.theme || 'creative art';
    const data = await challengeIdeasLLM(theme);
    res.json(data);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ========== Battle AI comment (fun helper) ==========
router.post('/battle/ai-comment', protect, async (req, res) => {
  try {
    const { promptA, promptB } = req.body;
    if (!promptA || !promptB) return res.status(400).json({ message: 'Both prompts required' });
    const data = await battleCommentLLM(promptA, promptB);
    res.json(data);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
