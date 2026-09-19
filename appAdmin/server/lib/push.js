import { Expo } from 'expo-server-sdk';
import User from '../models/User.js';

const expo = new Expo();

/**
 * Send a push notification to a list of Expo push tokens.
 * Automatically batches into chunks (Expo's limit), skips invalid tokens,
 * and removes tokens that Expo reports as dead (DeviceNotRegistered) so we
 * don't keep trying to notify uninstalled apps.
 *
 * @param {string[]} tokens
 * @param {{ title: string, body: string, data?: object }} content
 * @returns {Promise<{ sentCount: number, failedCount: number, error?: string }>}
 */
export async function sendExpoPush(tokens, { title, body, data = {} }) {
  const validTokens = [...new Set(tokens)].filter((t) => Expo.isExpoPushToken(t));

  if (validTokens.length === 0) {
    return { sentCount: 0, failedCount: 0, error: 'No valid push tokens found' };
  }

  const messages = validTokens.map((token) => ({
    to: token,
    sound: 'default',
    title,
    body,
    data,
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    try {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...receipts);
    } catch (err) {
      console.error('Expo push chunk failed:', err.message);
    }
  }

  let sentCount = 0;
  let failedCount = 0;
  const deadTokens = [];

  tickets.forEach((ticket, i) => {
    if (ticket.status === 'ok') {
      sentCount += 1;
    } else {
      failedCount += 1;
      if (ticket.details?.error === 'DeviceNotRegistered') {
        deadTokens.push(validTokens[i]);
      }
    }
  });

  if (deadTokens.length > 0) {
    await User.updateMany(
      { pushTokens: { $in: deadTokens } },
      { $pull: { pushTokens: { $in: deadTokens } } }
    );
  }

  return { sentCount, failedCount };
}

/** Fetch every push token from every user (used for "send to all"). */
export async function getAllPushTokens() {
  const users = await User.find({ pushTokens: { $exists: true, $ne: [] } }).select('pushTokens');
  return users.flatMap((u) => u.pushTokens);
}
