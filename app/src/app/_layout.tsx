import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { useEffect, useState, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, Linking, StyleSheet, Animated, PanResponder, Dimensions, Platform } from 'react-native';
import { Stack, useRouter, Redirect } from 'expo-router';
import Toast from 'react-native-toast-message';
import * as SecureStore from 'expo-secure-store';
import { io } from 'socket.io-client';
import axios from 'axios';
import Constants from 'expo-constants';
import '../i18n';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CopilotProvider } from 'react-native-copilot';
import { Ionicons } from '@expo/vector-icons';
import { requireOptionalNativeModule } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';

// Catch any errors thrown by the Layout component or its children.
// This guarantees the app won't crash/close abruptly if there's an unexpected rendering error.
export { ErrorBoundary } from 'expo-router';

// Safe check: Expo Go in SDK 53+ removed remote push notifications native code.
// Only load expo-notifications if not in standard Expo Go or if native module is present.
let Notifications: any = null;
try {
  if (Constants.appOwnership !== 'expo') {
    Notifications = require('expo-notifications');
  }
} catch (e) {
  // Gracefully ignored in Expo Go
}

const API_URL = 'https://anytime-help.onrender.com';

export default function RootLayout() {
  const router = useRouter();
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  const [playStoreUrl, setPlayStoreUrl] = useState('');

  const checkVersion = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/config`);
      const { min_version, play_store_url, app_store_url } = res.data || {};
      
      // Guard: only perform check if valid min_version string exists
      if (!min_version || typeof min_version !== 'string') {
        return;
      }
      
      const currentVersion = Constants.expoConfig?.version || '1.0.0';
      
      // Compare versions safely
      const isOutdated = currentVersion.localeCompare(min_version, undefined, { numeric: true, sensitivity: 'base' }) < 0;
      
      if (isOutdated) {
        const targetUrl = Platform.OS === 'ios'
          ? (app_store_url || 'https://apps.apple.com/app/anytime-help/id6744002621')
          : (play_store_url || 'https://play.google.com/store/apps/details?id=com.aman_mirza.app');
        setPlayStoreUrl(targetUrl);
        setShowUpdateModal(true);
      }
    } catch (e) {
      console.error('Error checking version:', e);
    }
  };

  useEffect(() => {
    if (__DEV__) {
      try {
        const DevMenuPreferences = requireOptionalNativeModule('DevMenuPreferences');
        DevMenuPreferences?.setPreferencesAsync({
          showFloatingActionButton: false,
        });
      } catch (e) {
        // Ignored if not running inside expo-dev-menu
      }
    }

    checkVersion();
    
    // Check and auto-apply EAS OTA updates in production
    const checkForUpdates = async () => {
      if (__DEV__) return;
      try {
        if (Updates.isEnabled) {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
            await Updates.fetchUpdateAsync();
            await Updates.reloadAsync();
          }
        }
      } catch (err) {
        console.log('OTA update check skipped/error:', err);
      }
    };
    checkForUpdates();
    
    // Setup Push Notifications
    const setupPushNotifications = async () => {
      try {
        const token = await SecureStore.getItemAsync('userToken');
        if (token) {
          const { registerForPushNotificationsAsync, sendPushTokenToBackend, clearAppBadge } = await import('../services/pushNotifications');
          const pushToken = await registerForPushNotificationsAsync();
          if (pushToken) {
            await sendPushTokenToBackend(pushToken);
          }
          await clearAppBadge();
        }
      } catch (err) {
        console.error('Push notification setup error:', err);
      }
    };
    setupPushNotifications();

    // Function to handle navigating when notification is tapped
    const handleNotificationNavigation = async (response: any) => {
      try {
        const data = response?.notification?.request?.content?.data;
        if (!data) return;

        const complaintId = data.id || data.complaintId || data._id;
        const type = data.type || (complaintId ? 'complaint' : null);

        let userRole = 'Resident';
        try {
          const userDataStr = await SecureStore.getItemAsync('userData');
          if (userDataStr) {
            const user = JSON.parse(userDataStr);
            userRole = user.role || 'Resident';
          }
        } catch (e) {
          console.error('Error reading userData for notification tap:', e);
        }

        // Delay slightly so React Navigation / Expo Router is fully initialized
        setTimeout(() => {
          if (type === 'complaint' && complaintId) {
            if (userRole === 'Staff' || userRole === 'PaidStaff' || userRole === 'Admin' || userRole === 'SubAdmin') {
              router.push(`/task-details?id=${complaintId}` as any);
            } else if (userRole === 'Member') {
              router.push(`/member/complaint-details?id=${complaintId}` as any);
            } else {
              router.push(`/resident/complaint-details?id=${complaintId}` as any);
            }
          } else if (type === 'announcement') {
            if (userRole === 'Member') {
              router.push('/member/announcements' as any);
            } else {
              router.push('/resident/announcements' as any);
            }
          }
        }, 500);
      } catch (err) {
        console.error('Error handling notification tap:', err);
      }
    };

    // 1. Handle notification tap that opened app from closed / killed state (safely delayed for iOS native bridge readiness)
    const initialNotificationTimer = setTimeout(async () => {
      try {
        if (Notifications?.getLastNotificationResponseAsync) {
          const response = await Notifications.getLastNotificationResponseAsync();
          if (response) {
            handleNotificationNavigation(response);
          }
        }
      } catch (e) {
        console.log('Error reading initial notification response:', e);
      }
    }, 1500);

    // 2. Listen for notification tap when app is in background or foreground
    let responseListener: any = null;
    if (Notifications?.addNotificationResponseReceivedListener) {
      try {
        responseListener = Notifications.addNotificationResponseReceivedListener((response: any) => {
          handleNotificationNavigation(response);
        });
      } catch (e) {
        // Ignored in Expo Go
      }
    }

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
            
            // Force navigation in the next tick to avoid event loop conflicts
            setTimeout(() => {
              router.replace('/login');
            }, 100);
          }
        }
      } catch (err) {
        console.error('Error handling remote logout:', err);
      }
    });

    // Global Axios Interceptor for 401 Unauthorized responses
    let isHandling401 = false;
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response && error.response.status === 401) {
          if (isHandling401) {
            return Promise.reject(error);
          }
          isHandling401 = true;
          console.log('401 Unauthorized caught globally. Logging out...');
          try {
            await SecureStore.deleteItemAsync('userToken');
            await SecureStore.deleteItemAsync('userData');
          } catch (_) {}
          Toast.show({
            type: 'error',
            text1: 'Session Expired',
            text2: 'Your account was removed or session expired.'
          });
          // Avoid multiple redirects
          setTimeout(() => {
            router.replace('/login');
            setTimeout(() => {
              isHandling401 = false;
            }, 2500);
          }, 100);
        }
        return Promise.reject(error);
      }
    );

    return () => {
      clearTimeout(initialNotificationTimer);
      axios.interceptors.response.eject(interceptor);
      socket.disconnect();
      if (responseListener && typeof responseListener.remove === 'function') {
        responseListener.remove();
      }
    };
  }, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <CopilotProvider overlay="svg" animated={true} backdropColor="rgba(0, 0, 0, 0.7)">
          <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
        </CopilotProvider>
        <Toast />
        
        {/* Force Update Modal */}
        <Modal visible={showUpdateModal} transparent={true} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Update Required</Text>
              <Text style={styles.modalText}>
                A new versiorn of Anytime Help is available. Please update your app to the latest version to continue.
              </Text>
              <TouchableOpacity 
                style={styles.updateButton} 
                onPress={() => {
                  if (playStoreUrl) {
                    Linking.openURL(playStoreUrl).catch((err) => {
                      console.error('Failed to open store URL:', err);
                    });
                  }
                }}
              >
                <Text style={styles.updateButtonText}>Update Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  updateButton: {
    backgroundColor: '#1D4ED8',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  updateButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  }
});
