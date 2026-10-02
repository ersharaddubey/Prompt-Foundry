import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cloudinary from 'cloudinary';
import authRoutes from './routes/auth.js';
import promptRoutes from './routes/prompts.js';
import userRoutes from './routes/user.js';
import generateRoutes from './routes/generate.js';
import promoRoutes from './routes/promo.js';
import categoryRoutes from './routes/categories.js';
import paymentRoutes from './routes/payment.js';
import featuresRoutes from './routes/features.js';
import notificationRoutes from './routes/notifications.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

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
    cached.promise = mongoose.connect(process.env.MONGO_URI).then((mongoose) => mongoose);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

app.use(cors());

// Static pages DB se pehle (DB down ho tab bhi page chale)
app.use(express.static(path.join(__dirname, 'public')));
app.get('/delete-account', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'delete-account.html'));
});

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Har API request se pehle DB connect
app.use(async (req, res, next) => {
  try {
    await connectDB();
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
app.use('/api/payment', paymentRoutes);
app.use('/api/features', featuresRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'somyalaya Clone API is running 🚀' });
});

// Local only
if (process.env.VERCEL !== '1') {
  connectDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });

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
