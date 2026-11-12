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

  const validTokens = tokens.filter((token) => Expo.isExpoPushToken(token));

  if (validTokens.length === 0) {
    return {
      sentCount: 0,
      failedCount: 0,
      error: 'No valid Expo push tokens found',
    };
  }

  let sentCount = 0;
  let failedCount = 0;
  let error = null;

  /*
   * Send each token independently.
   *
   * This is intentional: tokens from different Expo projects cannot be
   * included in the same Expo push request.
   */
  for (const token of validTokens) {
    const message = {
      to: token,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      channelId: 'default',
    };

    try {
      const tickets = await expo.sendPushNotificationsAsync([message]);

      for (const ticket of tickets) {
        if (ticket.status === 'ok') {
          sentCount++;
        } else {
          failedCount++;

          const ticketError =
            ticket.message ||
            ticket.details?.error ||
            'Push failed';

          if (!error) {
            error = ticketError;
          }

          // Disable tokens that Expo/FCM reports as unusable.
          // This prevents old/broken devices from breaking future broadcasts.
          try {
            await DevicePushToken.findOneAndUpdate(
              { token },
              {
                $set: {
                  active: false,
                  lastSeenAt: new Date(),
                },
              }
            );

            await User.updateMany(
              { pushTokens: token },
              { $pull: { pushTokens: token } }
            );
          } catch (cleanupError) {
            console.error('Failed to deactivate bad push token:', cleanupError);
          }

          console.warn('Push ticket error:', {
            token,
            ticket,
          });
        }
      }
    } catch (e) {
      failedCount++;

      if (!error) {
        error = e.message;
      }

      console.error('sendExpoPush error:', {
        token,
        error: e.message,
      });
    }
  }

  return { sentCount, failedCount, error };
}
