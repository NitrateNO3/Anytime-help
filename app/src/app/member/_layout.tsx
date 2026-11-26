import React, { useState, useEffect, useRef, type ComponentRef } from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurTargetView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { io } from 'socket.io-client';
import { socketAuth } from '../../utils/socketAuth';
import { refreshChatUnread, refreshChatUnreadSoon } from '../../utils/chatUnread';
import LiquidGlassTabBar from '../../components/LiquidGlassTabBar';
import ForceBlockUpdateModal, { isProfileBlockUpdateRequired } from '../../components/ForceBlockUpdateModal';

const API_URL = 'https://api.anytimehelp.co.in/api';
const SOCKET_URL = 'https://api.anytimehelp.co.in';

export default function MemberLayout() {
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<ComponentRef<typeof View>>(null);
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
      console.log('Error checking member profile in layout:', e);
    }
  };

  useEffect(() => {
    checkUserProfile();

    const socket = io(SOCKET_URL, { ...socketAuth, transports: ['websocket', 'polling'] });
    // Chat tab unread count: on open, on new messages, and back in the foreground
    refreshChatUnread();
    socket.on('new_message', () => refreshChatUnreadSoon());
    socket.on('chat_group_last_message', () => refreshChatUnreadSoon());
    const appStateSub = AppState.addEventListener('change', (st) => { if (st === 'active') refreshChatUnread(); });
    socket.on('user_updated', (data: any) => {
      if (userData && (userData._id === data.userId || userData.id === data.userId)) {
        checkUserProfile();
      }
    });

    return () => {
      appStateSub.remove();
      socket.disconnect();
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
      <Tabs
        id={undefined}
        tabBar={() => null}
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="chats" />
        <Tabs.Screen name="community" />
        <Tabs.Screen name="settings" />
        <Tabs.Screen name="my-complaints" />
        <Tabs.Screen name="search" />
        <Tabs.Screen 
          name="raise" 
          options={{ 
            tabBarStyle: { display: 'none' }
          }} 
        />
        <Tabs.Screen name="privacy" />
        <Tabs.Screen name="about" />
        <Tabs.Screen name="support" />
        <Tabs.Screen name="announcements" />
        <Tabs.Screen name="residents" />
        <Tabs.Screen name="edit-profile" options={{ tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="complaint-details" options={{ tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="chat-room" options={{ tabBarStyle: { display: 'none' } }} />
      </Tabs>
      </BlurTargetView>

      {/* Sibling of the blur target (not inside it) so Android can blur the screens behind it */}
      <LiquidGlassTabBar
        insets={insets}
        basePath="/member"
        blurTarget={blurTargetRef}
        hiddenRoutes={['raise', 'edit-profile', 'complaint-details', 'chat-room']}
      />

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
    shadowColor: '#0F172A',
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
