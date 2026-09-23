import { Expo } from 'expo-server-sdk';
import User from '../models/User.js';
import DevicePushToken from '../models/DevicePushToken.js';

const expo = new Expo();

/**
 * Saare users aur registered devices ke valid Expo push tokens collect karta hai.
 */
export async function getAllPushTokens() {
  const tokens = new Set();

  // Existing logged-in user tokens.
  const users = await User.find({
    pushTokens: { $exists: true, $not: { $size: 0 } },
  }).select('pushTokens');

  for (const user of users) {
    for (const token of user.pushTokens || []) {
      if (Expo.isExpoPushToken(token)) {
        tokens.add(token);
      }
    }
  }

  // Anonymous + logged-in device tokens.
  const deviceTokens = await DevicePushToken.find({
    active: true,
  }).select('token');

  for (const device of deviceTokens) {
    if (Expo.isExpoPushToken(device.token)) {
      tokens.add(device.token);
    }
  }

  return Array.from(tokens);
}

/**
 * Expo push notifications bhejta hai.
 * @returns { sentCount, failedCount, error }
 */
export async function sendExpoPush(tokens, { title, body, data = {} }) {
  if (!tokens || tokens.length === 0) {
    return {
      sentCount: 0,
      failedCount: 0,
      error: 'No push tokens found',
    };
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
            error =
              ticket.message ||
              ticket.details?.error ||
              'Push failed';
          }

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
