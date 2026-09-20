import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
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

const API_URL = 'https://anytime-help.onrender.com';

// Catch any errors thrown by the Layout component or its children.
// This guarantees the app won't just crash/close abruptly if there's a JS error.
export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  const router = useRouter();
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [playStoreUrl, setPlayStoreUrl] = useState('');

  const checkVersion = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/config`);
      const { min_version, play_store_url } = res.data;
      
      const currentVersion = Constants.expoConfig?.version || '1.0.0';
      
      // Simple version compare assuming semantic versioning like 1.0.2
      const isOutdated = currentVersion.localeCompare(min_version, undefined, { numeric: true, sensitivity: 'base' }) < 0;
      
      if (isOutdated) {
        setPlayStoreUrl(play_store_url);
        setShowUpdateModal(true);
      }
    } catch (e) {
      console.error('Error checking version:', e);
    }
  };

  useEffect(() => {
    checkVersion();
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
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response && error.response.status === 401) {
          console.log('401 Unauthorized caught globally. Logging out...');
          await SecureStore.deleteItemAsync('userToken');
          await SecureStore.deleteItemAsync('userData');
          Toast.show({
            type: 'error',
            text1: 'Session Expired',
            text2: 'Your account was removed or session expired.'
          });
          // Avoid multiple redirects
          setTimeout(() => {
            router.replace('/login');
          }, 100);
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
      socket.disconnect();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <CopilotProvider overlay="svg" animated={true} backdropColor="rgba(0, 0, 0, 0.7)">
        <Stack screenOptions={{ headerShown: false }} />
      </CopilotProvider>
      <Toast />
      
      {/* Force Update Modal */}
      <Modal visible={showUpdateModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Required</Text>
            <Text style={styles.modalText}>
              A new version of Anytime Help is available. Please update your app to the latest version to continue.
            </Text>
            <TouchableOpacity 
              style={styles.updateButton} 
              onPress={() => Linking.openURL(playStoreUrl)}
            >
              <Text style={styles.updateButtonText}>Update Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Global WhatsApp FAB */}
      <TouchableOpacity 
        style={styles.globalFab}
        activeOpacity={0.8}
        onPress={() => {
          const msg = 'Hello Anytime Help Support, I need some assistance. Could you please help me?';
          const encodedMsg = encodeURIComponent(msg);
          const url = `whatsapp://send?phone=918882004800&text=${encodedMsg}`;
          Linking.canOpenURL(url).then(supported => {
            if (supported) {
              Linking.openURL(url);
            } else {
              Linking.openURL(`https://wa.me/918882004800?text=${encodedMsg}`);
            }
          }).catch(err => console.error('An error occurred', err));
        }}
      >
        <Ionicons name="logo-whatsapp" size={30} color="#FFFFFF" />
      </TouchableOpacity>
    </GestureHandlerRootView>
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
  },
  globalFab: {
    position: 'absolute',
    bottom: 100, // Positioned high enough to avoid bottom tab bars
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#128C7E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 99999,
  }
});
