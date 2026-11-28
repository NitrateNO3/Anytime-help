const axios = require('axios');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100; // Expo accepts at most 100 messages per request

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const chunkArray = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));

// Tokens Expo says are dead (app uninstalled / logged out on that device):
// remove them so they stop being targeted.
const clearDeadTokens = async (tokens) => {
  if (!tokens.length) return;
  try {
    const User = require('../models/User');
    const { runUnscoped } = require('./areaContext');
    await runUnscoped(() =>
      User.updateMany({ expoPushToken: { $in: tokens } }, { $set: { expoPushToken: '' } })
    );
    console.log(`Cleared ${tokens.length} unregistered push token(s)`);
  } catch (err) {
    console.error('Failed to clear unregistered push tokens:', err.message);
  }
};

/**
 * Send one batch (<= 100 messages) to Expo.
 *
 * Expo rejects the WHOLE batch when it holds tokens from more than one Expo
 * project (PUSH_TOO_MANY_EXPERIENCE_IDS). This happens because older app
 * builds registered tokens under a previous EAS project id. In that case the
 * error lists which token belongs to which project, so the batch is split
 * per project and each part is sent on its own. Network / 429 / 5xx errors
 * are retried with backoff so a single hiccup doesn't drop 100 people.
 */
const sendBatch = async (batch, deadTokens, attempt = 1) => {
  try {
    const response = await axios.post(EXPO_PUSH_URL, batch, {
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    const tickets = Array.isArray(response.data?.data) ? response.data.data : [];
    let ok = 0;
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'ok') {
        ok++;
      } else if (ticket.details?.error === 'DeviceNotRegistered' && batch[i]) {
        deadTokens.push(batch[i].to);
      } else {
        console.error('Push ticket error:', ticket.details?.error || '', ticket.message || '');
      }
    });
    console.log(`Push batch sent: ${ok}/${batch.length} accepted`);
  } catch (error) {
    const status = error.response?.status;
    const errors = error.response?.data?.errors || [];
    const mixed = errors.find((e) => e.code === 'PUSH_TOO_MANY_EXPERIENCE_IDS');

    if (mixed && mixed.details && typeof mixed.details === 'object') {
      const byToken = new Map(batch.map((m) => [m.to, m]));
      const groups = Object.values(mixed.details)
        .map((tokens) => (Array.isArray(tokens) ? tokens.map((t) => byToken.get(t)).filter(Boolean) : []))
        .filter((g) => g.length > 0);
      console.log(`Push batch had tokens from ${groups.length} Expo projects, sending each separately`);
      for (const group of groups) {
        await sendBatch(group, deadTokens, 1);
      }
      return;
    }

    const retryable = !status || status === 429 || status >= 500;
    if (retryable && attempt < 3) {
      await sleep(1000 * attempt * attempt);
      return sendBatch(batch, deadTokens, attempt + 1);
    }

    console.error(
      `Error sending push batch (${batch.length} messages, status ${status || 'n/a'}):`,
      errors.length ? JSON.stringify(errors) : error.message
    );
  }
};

/**
 * Send push notifications via Expo Push API
 * @param {Array<string|{to:string,badge?:number}>} tokensOrObjects - Expo push tokens (or {to, badge})
 * @param {string} title - Title of the notification
 * @param {string} body - Body of the notification
 * @param {object} data - Additional data payload
 * @param {number} defaultBadge - Number to show on the app icon
 */
const sendPushNotifications = async (tokensOrObjects, title, body, data = {}, defaultBadge = 1) => {
  if (!tokensOrObjects || tokensOrObjects.length === 0) return;

  const messages = [];
  const seenTokens = new Set();

  for (let item of tokensOrObjects) {
    let tokenStr, badgeVal;
    if (typeof item === 'string') {
      tokenStr = item;
      badgeVal = defaultBadge;
    } else if (item && item.to) {
      tokenStr = item.to;
      badgeVal = item.badge !== undefined ? item.badge : defaultBadge;
    }

    const isValidExpoToken = tokenStr && (tokenStr.startsWith('ExponentPushToken[') || tokenStr.startsWith('ExpoPushToken['));
    if (isValidExpoToken && !seenTokens.has(tokenStr)) {
      seenTokens.add(tokenStr);
      messages.push({
        to: tokenStr,
        sound: 'default',
        title,
        body,
        data,
        // null/undefined: leave the app icon badge unchanged
        ...(typeof badgeVal === 'number' ? { badge: badgeVal } : {}),
        channelId: 'default',
        priority: 'high',
        _displayInForeground: true
      });
    }
  }

  if (messages.length === 0) return;

  const deadTokens = [];
  for (const chunk of chunkArray(messages, CHUNK_SIZE)) {
    await sendBatch(chunk, deadTokens);
  }
  await clearDeadTokens(deadTokens);
};

module.exports = {
  sendPushNotifications
};
