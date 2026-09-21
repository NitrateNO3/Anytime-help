import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = 'https://anytime-help.onrender.com/api';

// Config to tell Notifications how to behave when received in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request permissions and get the Expo Push Token for this device.
 */
export async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }

    try {
      // Get the token that uniquely identifies this device
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) {
        console.error('EAS project ID not found in app.json!');
      }
      const tokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });
      token = tokenResponse.data;
      console.log('Expo Push Token:', token);
    } catch (error) {
      console.error('Error fetching Expo Push Token:', error);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

/**
 * Send the token to your backend
 */
export async function sendPushTokenToBackend(token: string) {
  try {
    const authToken = await SecureStore.getItemAsync('userToken');
    if (!authToken) return;

    await axios.put(`${API_URL}/users/push-token`, { expoPushToken: token }, {
      headers: { 'x-auth-token': authToken }
    });
    console.log('Push token successfully sent to backend');
  } catch (error) {
    console.error('Error sending push token to backend:', error);
  }
}

/**
 * Set the app badge count to 0 to clear it
 */
export async function clearAppBadge() {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    console.log('Error clearing badge:', error);
  }
}
