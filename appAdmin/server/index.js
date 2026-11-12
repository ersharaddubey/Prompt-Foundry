import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import User from './models/User.js';
import authRoutes from './routes/auth.js';
import promptRoutes from './routes/prompts.js';
import userRoutes from './routes/user.js';
import generateRoutes from './routes/generate.js';
import promoRoutes from './routes/promo.js';
import categoryRoutes from './routes/categories.js';
import featuresRoutes from './routes/features.js';
import notificationRoutes from './routes/notifications.js';
import travelMemoryRoutes from './routes/travelMemories.js';

const app = express();
const PORT = process.env.PORT || 5001;

// MongoDB connection cache (serverless ke liye)
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 20000,
    }).then((mongoose) => mongoose).catch((error) => {
      cached.promise = null;
      throw error;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}


let testUserSetupPromise;
async function ensureTestUser() {
  if (String(process.env.FREE_TESTING_MODE || '').toLowerCase() !== 'true') return;
  const email = String(process.env.TEST_USER_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.TEST_USER_PASSWORD || '');
  if (!email || !password) {
    console.warn('Free testing mode is enabled, but TEST_USER_EMAIL or TEST_USER_PASSWORD is missing.');
    return;
  }
  if (!testUserSetupPromise) {
    testUserSetupPromise = (async () => {
      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({ name: 'Prompt Foundry Tester', email, password, credits: 0, dailyCredits: 0 });
        console.log(`Created dedicated free testing account: ${email}`);
      } else {
        const passwordMatches = await user.comparePassword(password);
        if (!passwordMatches || user.name !== 'Prompt Foundry Tester') {
          user.password = password;
          user.name = 'Prompt Foundry Tester';
          await user.save();
        }
      }
    })().catch((error) => {
      testUserSetupPromise = null;
      console.error('Could not provision test account:', error.message);
      throw error;
    });
  }
  await testUserSetupPromise;
}

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Har request se pehle DB connect
app.use(async (req, res, next) => {
  try {
    await connectDB();
    await ensureTestUser();
    next();
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ message: 'Database connection failed' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/prompts', promptRoutes);
app.use('/api/user', userRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/promo', promoRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/features', featuresRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/travel-memories', travelMemoryRoutes);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.json({ message: 'somyalaya Clone API is running 🚀' });
});

// Local only
if (process.env.VERCEL !== '1') {
  connectDB().then(ensureTestUser).then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });

    // On Vercel, scheduled notifications are triggered by Vercel Cron hitting
    // /api/notifications/run-scheduled (see vercel.json). Locally there's no
    // such cron, so we poll every minute ourselves instead.
    setInterval(async () => {
      try {
        const Notification = (await import('./models/Notification.js')).default;
        const { dispatchNotification } = await import('./routes/notifications.js');
        const due = await Notification.find({ status: 'scheduled', scheduledAt: { $lte: new Date() } });
        for (const notif of due) await dispatchNotification(notif);
      } catch (err) {
        console.error('Scheduled notification check failed:', err.message);
      }
    }, 60 * 1000);
  });
}

export default app;
