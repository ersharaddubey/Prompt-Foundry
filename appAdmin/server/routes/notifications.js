import express from 'express';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { protect } from '../middleware/auth.js';
import { sendExpoPush, getAllPushTokens } from '../lib/push.js';

const router = express.Router();

// ========== Mobile app: register this device's Expo push token ==========
router.post('/register-token', protect, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Push token required' });

    await User.findByIdAndUpdate(req.user._id, { $addToSet: { pushTokens: token } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ========== Mobile app: remove token (e.g. on logout) ==========
router.post('/unregister-token', protect, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Push token required' });

    await User.findByIdAndUpdate(req.user._id, { $pull: { pushTokens: token } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ========== Admin: list notifications (sent + scheduled), newest first ==========
router.get('/', protect, async (req, res) => {
  try {
    const list = await Notification.find().sort({ createdAt: -1 }).limit(100);
    res.json(list);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ========== Admin: create a notification (send now, or schedule for later) ==========
router.post('/', protect, async (req, res) => {
  try {
    const { title, body, data, scheduledAt } = req.body;
    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ message: 'Title and body are required' });
    }

    const sendAt = scheduledAt ? new Date(scheduledAt) : null;
    const isFuture = sendAt && sendAt.getTime() > Date.now() + 30 * 1000; // >30s away = truly scheduled

    const notif = await Notification.create({
      title: title.trim(),
      body: body.trim(),
      data: data || {},
      scheduledAt: isFuture ? sendAt : null,
      status: 'scheduled', // immediately overwritten to sent/failed below if not scheduled for later
      createdBy: req.user._id,
    });

    if (!isFuture) {
      await dispatchNotification(notif);
    }

    const fresh = await Notification.findById(notif._id);
    res.status(201).json(fresh);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ========== Admin: cancel a still-pending scheduled notification ==========
router.delete('/:id', protect, async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif) return res.status(404).json({ message: 'Not found' });
    if (notif.status !== 'scheduled') {
      return res.status(400).json({ message: 'Only scheduled (not-yet-sent) notifications can be cancelled' });
    }
    notif.status = 'cancelled';
    await notif.save();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/**
 * Actually deliver a notification doc to all target users and update its
 * status. Shared by the immediate-send path above, the Daily Challenge
 * auto-notify hook, and the scheduled-notification runner below.
 */
export async function dispatchNotification(notif) {
  try {
    const tokens = await getAllPushTokens(); // target === 'all' for now
    const { sentCount, failedCount, error } = await sendExpoPush(tokens, {
      title: notif.title,
      body: notif.body,
      data: notif.data || {},
    });
    notif.status = error ? 'failed' : 'sent';
    notif.sentAt = new Date();
    notif.sentCount = sentCount;
    notif.failedCount = failedCount;
    notif.error = error || '';
    await notif.save();
  } catch (e) {
    notif.status = 'failed';
    notif.error = e.message;
    await notif.save();
  }
  return notif;
}

// ========== Cron entry point: send any scheduled notification that is due ==========
// Called every few minutes by a scheduler (node-cron locally, Vercel Cron in
// production — see vercel.json). Vercel Cron calls URLs with GET, so this
// responds to both GET and POST. Optionally protected by CRON_SECRET so it
// can't be triggered by randoms hitting the URL.
async function runScheduledHandler(req, res) {
  try {
    if (process.env.CRON_SECRET) {
      const provided = req.headers['x-cron-secret'] || req.headers.authorization?.replace('Bearer ', '') || req.query.secret;
      if (provided !== process.env.CRON_SECRET) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
    }

    const due = await Notification.find({
      status: 'scheduled',
      scheduledAt: { $lte: new Date() },
    });

    for (const notif of due) {
      await dispatchNotification(notif);
    }

    res.json({ processed: due.length });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}
router.get('/run-scheduled', runScheduledHandler);
router.post('/run-scheduled', runScheduledHandler);

export default router;
