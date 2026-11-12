import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import ImageKit from 'imagekit';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import PuterAuthCode from '../models/PuterAuthCode.js';
import crypto from 'crypto';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype?.startsWith('image/')
      ? cb(null, true)
      : cb(new Error('Only image files are allowed')),
});

let imagekit;
function getImageKit() {
  if (!imagekit) {
    const { IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT } = process.env;
    if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_PRIVATE_KEY || !IMAGEKIT_URL_ENDPOINT) return null;
    imagekit = new ImageKit({
      publicKey: IMAGEKIT_PUBLIC_KEY,
      privateKey: IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: IMAGEKIT_URL_ENDPOINT,
    });
  }
  return imagekit;
}

async function storeAvatar(file) {
  const ik = getImageKit();
  if (!ik) throw new Error('ImageKit is not configured on the server.');
  const result = await ik.upload({
    file: file.buffer.toString('base64'),
    fileName: file.originalname || `avatar-${Date.now()}.jpg`,
    folder: '/prompt-foundry-avatars',
  });
  return result.url;
}

function publicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar || '',
    credits: user.credits,
    dailyCredits: user.dailyCredits,
    favorites: user.favorites,
  };
}

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};


// Puter bridge: only the owner's deployed Puter Worker knows PUTER_BRIDGE_SECRET.
// The mobile app never receives this shared secret or a Puter access token.
router.post('/puter/issue', async (req, res) => {
  try {
    const expected = process.env.PUTER_BRIDGE_SECRET;
    const supplied = req.get('x-puter-bridge-secret');
    if (!expected || !supplied || supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
      return res.status(401).json({ message: 'Invalid Puter bridge credentials' });
    }

    const puterId = String(req.body?.puterId || '').trim();
    const username = String(req.body?.username || '').trim().slice(0, 80);
    const displayName = String(req.body?.name || username || 'Puter User').trim().slice(0, 60);
    if (!puterId || puterId.length > 200) return res.status(400).json({ message: 'Verified Puter identity is required' });

    const emailKey = crypto.createHash('sha256').update(puterId).digest('hex').slice(0, 32);
    const email = `puter_${emailKey}@users.promptfoundry.local`;
    let user = await User.findOne({ puterId });
    if (!user) {
      user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          name: displayName,
          email,
          password: crypto.randomBytes(48).toString('base64url'),
          authProvider: 'puter',
          puterId,
          puterUsername: username,
          credits: 0,
          dailyCredits: 0,
        });
      } else {
        user.puterId = puterId;
        user.authProvider = 'puter';
        user.puterUsername = username;
      }
    } else {
      user.puterUsername = username || user.puterUsername;
      if (displayName && (!user.name || user.name === 'Puter User')) user.name = displayName;
    }
    await user.save();

    const rawCode = crypto.randomBytes(32).toString('base64url');
    const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
    await PuterAuthCode.create({ codeHash, user: user._id, expiresAt: new Date(Date.now() + 2 * 60 * 1000) });
    res.json({ code: rawCode, expiresIn: 120 });
  } catch (error) {
    console.error('Puter identity provisioning failed:', error);
    res.status(500).json({ message: 'Could not create Prompt Foundry session' });
  }
});

// One-time exchange: code is short-lived, stored only as a SHA-256 hash and consumed atomically.
router.post('/puter/exchange', async (req, res) => {
  try {
    const code = String(req.body?.code || '');
    if (code.length < 32 || code.length > 100) return res.status(400).json({ message: 'Invalid or expired sign-in code' });
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const authCode = await PuterAuthCode.findOneAndDelete({ codeHash, expiresAt: { $gt: new Date() } });
    if (!authCode) return res.status(401).json({ message: 'Sign-in code expired or already used. Please try again.' });
    const user = await User.findById(authCode.user).select('-password').populate('favorites');
    if (!user) return res.status(401).json({ message: 'Account not found' });
    res.json({
      _id: user._id, name: user.name, email: user.email, avatar: user.avatar || '',
      credits: user.credits || 0, dailyCredits: user.dailyCredits || 0,
      favorites: user.favorites || [], authProvider: 'puter',
      puterUsername: user.puterUsername || '',
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error('Puter session exchange failed:', error);
    res.status(500).json({ message: 'Could not finish sign-in' });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please fill all fields' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({ name, email, password });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar || '',
      credits: user.credits,
      dailyCredits: user.dailyCredits,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (user && (await user.comparePassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || '',
        credits: user.credits,
        dailyCredits: user.dailyCredits,
        favorites: user.favorites,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get me
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password').populate('favorites');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (error) {
    res.status(401).json({ message: 'Not authorized' });
  }
});

// Update profile name
router.patch('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const name = String(req.body.name || '').trim();
    if (!name || name.length < 2) {
      return res.status(400).json({ message: 'Name must be at least 2 characters' });
    }
    if (name.length > 60) {
      return res.status(400).json({ message: 'Name is too long' });
    }

    user.name = name;
    await user.save();
    res.json(publicUser(user));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Upload avatar
router.post('/avatar', protect, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Avatar image is required' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const url = await storeAvatar(req.file);
    user.avatar = url;
    await user.save();
    res.json(publicUser(user));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete account
router.delete('/account', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await User.findByIdAndDelete(req.user._id);
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
