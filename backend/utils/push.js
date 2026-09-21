const axios = require('axios');

/**
 * Send push notifications via Expo Push API
 * @param {Array<string>} tokens - Array of Expo push tokens
 * @param {string} title - Title of the notification
 * @param {string} body - Body of the notification
 * @param {object} data - Additional data payload
 * @param {number} badge - Number to show on the app icon
 */
const sendPushNotifications = async (tokens, title, body, data = {}, badge = 1) => {
  if (!tokens || tokens.length === 0) return;

  // Filter out invalid tokens
  const validTokens = tokens.filter(token => token && token.startsWith('ExponentPushToken['));
  if (validTokens.length === 0) return;

  const messages = validTokens.map(token => ({
    to: token,
    sound: 'default',
    title,
    body,
    data,
    badge
  }));

  try {
    const response = await axios.post('https://exp.host/--/api/v2/push/send', messages, {
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      }
    });
    console.log('Push notifications sent:', response.data);
  } catch (error) {
    console.error('Error sending push notifications:', error.message);
  }
};

module.exports = {
  sendPushNotifications
};
