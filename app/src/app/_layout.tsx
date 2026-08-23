import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import * as SecureStore from 'expo-secure-store';
import { io } from 'socket.io-client';
import '../i18n';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const API_URL = 'https://anytime-help.onrender.com';

// Catch any errors thrown by the Layout component or its children.
// This guarantees the app won't just crash/close abruptly if there's a JS error.
export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    console.log('Connecting to socket at:', API_URL);
    const socket = io(API_URL, {
      transports: ['websocket'],
      forceNew: true
    });

    socket.on('connect', () => {
      console.log('Socket connected successfully:', socket.id);
    });
    
    socket.on('connect_error', (error) => {
      console.log('Socket connection error:', error);
    });

    socket.on('user_deleted', async (data: { id: string }) => {
      console.log('Received user_deleted event for ID:', data.id);
      try {
        const userDataStr = await SecureStore.getItemAsync('userData');
        if (userDataStr) {
          const user = JSON.parse(userDataStr);
          console.log('Current logged in user ID:', user.id);
          if (user.id === data.id || user._id === data.id) {
            // This user has been deleted by the admin, force logout
            await SecureStore.deleteItemAsync('userToken');
            await SecureStore.deleteItemAsync('userData');
            Toast.show({
              type: 'error',
              text1: 'Session Expired',
              text2: 'Your account has been removed by the admin.'
            });
            router.replace('/login');
          }
        }
      } catch (err) {
        console.error('Error handling remote logout:', err);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <Toast />
    </GestureHandlerRootView>
  );
}
