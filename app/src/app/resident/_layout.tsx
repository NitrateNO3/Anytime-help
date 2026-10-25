import React, { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity } from 'react-native';
import { walkthroughable, CopilotStep } from 'react-native-copilot';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { io } from 'socket.io-client';
import ForceBlockUpdateModal, { isProfileBlockUpdateRequired } from '../../components/ForceBlockUpdateModal';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

const WalkthroughableView = walkthroughable(View);

export default function ResidentLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  
  const [userData, setUserData] = useState<any>(null);
  const [showBlockModal, setShowBlockModal] = useState<boolean>(false);
  const [hasDismissedModal, setHasDismissedModal] = useState<boolean>(false);

  const checkUserProfile = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) return;

      try {
        const res = await axios.get(`${API_URL}/users/me`, {
          headers: { 'x-auth-token': token }
        });
        if (res.data) {
          const fresh = res.data;
          setUserData(fresh);
          await SecureStore.setItemAsync('userData', JSON.stringify(fresh));
          if (isProfileBlockUpdateRequired(fresh)) {
            if (!hasDismissedModal) {
              setShowBlockModal(true);
            }
          } else {
            setShowBlockModal(false);
          }
          return;
        }
      } catch (apiErr) {
        // Fallback to local storage
      }

      const storedUser = await SecureStore.getItemAsync('userData');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        setUserData(parsed);
        if (isProfileBlockUpdateRequired(parsed)) {
          if (!hasDismissedModal) {
            setShowBlockModal(true);
          }
        } else {
          setShowBlockModal(false);
        }
      }
    } catch (e) {
      console.log('Error checking user profile in layout:', e);
    }
  };

  useEffect(() => {
    checkUserProfile();

    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.on('user_updated', (data: any) => {
      if (userData && (userData._id === data.userId || userData.id === data.userId)) {
        checkUserProfile();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);
  
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        backBehavior="initialRoute"
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: '#2563EB',
          tabBarInactiveTintColor: '#64748B',
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: -2,
          },
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#F1F5F9',
            height: 60 + Math.max(insets.bottom, 12),
            paddingBottom: Math.max(insets.bottom, 10),
            paddingTop: 8,
            elevation: 12,
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarLabel: t('resident.tabHome'),
            title: t('resident.tabHome'),
            tabBarIcon: ({ color }) => (
              <Ionicons name="home" size={24} color={color as string} />
            ),
            tabBarButton: (props: any) => (
              <CopilotStep text="यह आपका होम टैब है। यहाँ से आप वापस अपने डैशबोर्ड पर जा सकते हैं।" order={6} name="home_tab">
                <WalkthroughableView style={{ flex: 1 }}>
                  <TouchableOpacity {...props} style={[props.style, { flex: 1 }]} />
                </WalkthroughableView>
              </CopilotStep>
            ),
          }}
        />
        <Tabs.Screen
          name="my-complaints"
          options={{
            tabBarLabel: t('resident.myComplaints'),
            title: t('resident.myComplaints'),
            tabBarIcon: ({ color }) => (
              <Ionicons name="list" size={24} color={color as string} />
            ),
            tabBarButton: (props: any) => (
              <CopilotStep text="इस टैब से आप अपनी सभी शिकायतें (complaints) जल्दी से चेक कर सकते हैं।" order={7} name="complaints_tab">
                <WalkthroughableView style={{ flex: 1 }}>
                  <TouchableOpacity {...props} style={[props.style, { flex: 1 }]} />
                </WalkthroughableView>
              </CopilotStep>
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            tabBarLabel: t('resident.tabProfile'),
            title: t('resident.tabProfile'),
            tabBarIcon: ({ color }) => (
              <Ionicons name="person" size={24} color={color as string} />
            ),
            tabBarButton: (props: any) => (
              <CopilotStep text="यहाँ से आप अपनी प्रोफ़ाइल और सेटिंग्स मैनेज कर सकते हैं।" order={8} name="profile_tab">
                <WalkthroughableView style={{ flex: 1 }}>
                  <TouchableOpacity {...props} style={[props.style, { flex: 1 }]} />
                </WalkthroughableView>
              </CopilotStep>
            ),
          }}
        />
        <Tabs.Screen name="search" options={{ href: null }} />
        <Tabs.Screen 
          name="raise" 
          options={{ 
            href: null,
            tabBarStyle: { display: 'none' }
          }} 
        />
        <Tabs.Screen name="community" options={{ href: null }} />
        <Tabs.Screen name="privacy" options={{ href: null }} />
        <Tabs.Screen name="about" options={{ href: null }} />
        <Tabs.Screen name="support" options={{ href: null }} />
        <Tabs.Screen 
          name="book-service" 
          options={{ 
            href: null,
            tabBarStyle: { display: 'none' }
          }} 
        />
        <Tabs.Screen name="announcements" options={{ href: null }} />
        <Tabs.Screen name="edit-profile" options={{ href: null }} />
        <Tabs.Screen name="complaint-details" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      </Tabs>

      <ForceBlockUpdateModal
        visible={showBlockModal}
        userData={userData}
        onClose={() => {
          setHasDismissedModal(true);
          setShowBlockModal(false);
        }}
        onSuccess={(updatedUser) => {
          setUserData(updatedUser);
          setShowBlockModal(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    padding: 10,
    borderRadius: 20,
  },
  activeIcon: {
    backgroundColor: '#F3F4F6',
  },
  fabOuter: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32, // Elevates the button significantly
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  fabIconShadow: {
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  activeFab: {
    transform: [{ scale: 1.08 }],
  }
});
