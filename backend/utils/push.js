const axios = require('axios');

/**
 * Send push notifications via Expo Push API
 * @param {Array<string>} tokens - Array of Expo push tokens
 * @param {string} title - Title of the notification
 * @param {string} body - Body of the notification
 * @param {object} data - Additional data payload
 * @param {number} badge - Number to show on the app icon
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

    if (tokenStr && tokenStr.startsWith('ExponentPushToken[') && !seenTokens.has(tokenStr)) {
      seenTokens.add(tokenStr);
      messages.push({
        to: tokenStr,
        sound: 'default',
        title,
        body,
        data,
        badge: badgeVal
      });
    }
  }

  if (messages.length === 0) return;

  // Expo Push API recommends batching in chunks of 100
  const chunkArray = (arr, size) => {
    return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
      arr.slice(i * size, i * size + size)
    );
  };

  const chunks = chunkArray(messages, 100);

  for (let chunk of chunks) {
    try {
      const response = await axios.post('https://exp.host/--/api/v2/push/send', chunk, {
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        }
      });
      console.log(`Push notifications chunk sent (${chunk.length} messages)`);
    } catch (error) {
      console.error('Error sending push notifications chunk:', error.message);
    }
  }
};

module.exports = {
  sendPushNotifications
};
