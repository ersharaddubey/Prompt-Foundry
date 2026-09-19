import express from 'express';
import crypto from 'crypto';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import GeneratedImage from '../models/GeneratedImage.js';
import { protect } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Cache key banane ke liye
function createPromptHash(prompt, model, ratio, sourceImageUrl = '') {
  const str = `${prompt.trim().toLowerCase()}|${model}|${ratio}|${sourceImageUrl || ''}`;
  return crypto.createHash('sha256').update(str).digest('hex');
}

// Aspect ratio se dimensions
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

// Pollinations URL
function getPollinationsUrl(prompt, width, height) {
  const encoded = encodeURIComponent(prompt.trim());
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true&model=flux&seed=${Date.now()}`;
}

// Image download (retry + wait ke saath)
async function downloadImageBuffer(url, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      if (i === 0) {
        await fetch(url, { method: 'HEAD' }).catch(() => {});
        await new Promise((r) => setTimeout(r, 3000));
      }

      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      });

      if (res.status === 429) {
        console.log('Rate limited (429). Waiting longer...');
        await new Promise((r) => setTimeout(r, 8000 + i * 3000)); // 8s, 11s, 14s...
        continue;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        throw new Error('Not an image response');
      }

      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      console.log(`Download attempt ${i + 1} failed:`, err.message);
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
      }
    }
  }
  return null;
}

// Buffer ko Cloudinary pe upload
async function uploadBufferToCloudinary(buffer, folder = 'somyalaya-generations') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

// ====================== MAIN GENERATE ROUTE ======================
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    const { prompt, model = 'flux', ratio = '3:4', amount = 2 } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    const user = await User.findById(req.user._id);
    let sourceImageUrl = null;

    // User ne apni image upload ki hai
    if (req.file) {
      try {
        const uploadResult = await uploadBufferToCloudinary(
          req.file.buffer,
          'somyalaya-uploads'
        );
        sourceImageUrl = uploadResult.secure_url;
      } catch (err) {
        console.error('Source image upload failed:', err.message);
      }
    }

    // Cache key
    const promptHash = createPromptHash(prompt, model, ratio, sourceImageUrl);

    // 1. Cache check → instant return
    const cached = await GeneratedImage.findOne({
      promptHash,
      model,
      ratio,
    }).sort({ createdAt: -1 });

    if (cached && cached.imageUrl) {
      return res.json({
        success: true,
        fromCache: true,
        imageUrl: cached.imageUrl,
        prompt: cached.promptText,
        model,
        ratio,
        sourceImageUrl: cached.sourceImageUrl || null,
        credits: {
          credits: user.credits,
          dailyCredits: user.dailyCredits,
        },
        message: 'Instant from cache',
      });
    }

    // 2. Credits check — dailyCredits aur credits DONO pools ko jodkar check
    // karo. Pehle ye alag-alag check hota tha (sirf ek pool >= amount), isliye
    // total credits kaafi hone par bhi "Not enough credits" aa jaata tha
    // (e.g. dailyCredits=5, credits=3, needed=6 → total=8 kaafi hai, lekin
    // dono pools alag se check karne par dono fail ho jaate the).
    const creditsNeeded = parseInt(amount) || 2;
    const totalAvailable = (user.dailyCredits || 0) + (user.credits || 0);

    if (totalAvailable < creditsNeeded) {
      return res.status(400).json({ message: 'Not enough credits' });
    }

    // Pehle dailyCredits se kaato, baaki (agar kuch bache) credits se.
    const fromDaily = Math.min(user.dailyCredits || 0, creditsNeeded);
    user.dailyCredits = (user.dailyCredits || 0) - fromDaily;
    user.credits = (user.credits || 0) - (creditsNeeded - fromDaily);
    await user.save();

    // 3. Generate
    const { width, height } = getDimensions(ratio);
    const pollinationsUrl = getPollinationsUrl(prompt, width, height);

    console.log('Downloading from Pollinations...');
    let finalUrl = pollinationsUrl;
    let cloudinaryPublicId = null;

    const imageBuffer = await downloadImageBuffer(pollinationsUrl);

    if (imageBuffer) {
      try {
        console.log('Uploading to Cloudinary...');
        const cloudResult = await uploadBufferToCloudinary(
          imageBuffer,
          'somyalaya-generations'
        );
        finalUrl = cloudResult.secure_url;
        cloudinaryPublicId = cloudResult.public_id;
      } catch (err) {
        console.error('Cloudinary upload failed:', err.message);
        // fallback → Pollinations URL hi use hoga
      }
    } else {
      console.log('Download failed → using Pollinations URL directly');
    }

    // 4. Cache me save
    const newGen = await GeneratedImage.create({
      promptHash,
      promptText: prompt.trim(),
      imageUrl: finalUrl,
      cloudinaryPublicId,
      model,
      ratio,
      sourceImageUrl,
      user: req.user._id,
    });

    res.json({
      success: true,
      fromCache: false,
      imageUrl: finalUrl,
      prompt: prompt.trim(),
      model,
      ratio,
      sourceImageUrl,
      credits: {
        credits: user.credits,
        dailyCredits: user.dailyCredits,
      },
      id: newGen._id,
      message: imageBuffer
        ? 'Image generated successfully'
        : 'Image generated (direct link)',
    });
  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({
      message: error.message || 'Generation failed',
    });
  }
});

// History route (optional)
router.get('/history', protect, async (req, res) => {
  try {
    const images = await GeneratedImage.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(images);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;