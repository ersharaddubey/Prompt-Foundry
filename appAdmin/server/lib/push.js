import { Expo } from 'expo-server-sdk';
import User from '../models/User.js';

const expo = new Expo();

/**
 * Saare users ke valid Expo push tokens collect karta hai
 */
export async function getAllPushTokens() {
  const users = await User.find({
    pushTokens: { $exists: true, $not: { $size: 0 } },
  }).select('pushTokens');

  const tokens = new Set();
  for (const user of users) {
    for (const token of user.pushTokens || []) {
      if (Expo.isExpoPushToken(token)) {
        tokens.add(token);
      }
    }
  }
  return Array.from(tokens);
}

/**
 * Expo push notifications bhejta hai
 * @returns { sentCount, failedCount, error }
 */
export async function sendExpoPush(tokens, { title, body, data = {} }) {
  if (!tokens || tokens.length === 0) {
    return { sentCount: 0, failedCount: 0, error: 'No push tokens found' };
  }

  const messages = tokens.map((token) => ({
    to: token,
    sound: 'default',
    title,
    body,
    data,
    priority: 'high',
  }));

  const chunks = expo.chunkPushNotifications(messages);
  let sentCount = 0;
  let failedCount = 0;
  let error = null;

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);

      for (const ticket of tickets) {
        if (ticket.status === 'ok') {
          sentCount++;
        } else {
          failedCount++;
          if (!error) {
            error = ticket.message || ticket.details?.error || 'Push failed';
          }
          // Invalid token clean karne ke liye log
          console.warn('Push ticket error:', ticket);
        }
      }
    } catch (e) {
      failedCount += chunk.length;
      error = e.message;
      console.error('sendExpoPush error:', e);
    }
  }

  return { sentCount, failedCount, error };
}
