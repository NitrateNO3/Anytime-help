import React, { useState, useEffect } from 'react';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Platform } from 'react-native';
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

interface TabDefinition {
  name: string;
  label: string;
  activeIcon: any;
  inactiveIcon: any;
}

const TABS: TabDefinition[] = [
  {
    name: 'index',
    label: 'Home',
    activeIcon: 'home',
    inactiveIcon: 'home-outline',
  },
  {
    name: 'chats',
    label: 'Chat',
    activeIcon: 'chatbubble-ellipses',
    inactiveIcon: 'chatbubble-ellipses-outline',
  },
  {
    name: 'community',
    label: 'Community',
    activeIcon: 'people',
    inactiveIcon: 'people-outline',
  },
  {
    name: 'settings',
    label: 'Profile',
    activeIcon: 'person',
    inactiveIcon: 'person-outline',
  },
];

function WhatsAppFloatingTabBar({ state, descriptors, insets }: any) {
  const router = useRouter();
  const pathname = usePathname();

  const focusedRoute = state?.routes ? state.routes[state.index] : null;
  const focusedDescriptor = descriptors && focusedRoute ? descriptors[focusedRoute.key] : null;
  const focusedOptions = focusedDescriptor?.options;

  if (focusedOptions?.tabBarStyle?.display === 'none') {
    return null;
  }

  const currentTabName = focusedRoute?.name;

  return (
    <View 
      style={[
        tabBarStyles.dockedWrapper, 
        { paddingBottom: Platform.OS === 'ios' ? Math.max(insets?.bottom || 0, 16) : 10 }
      ]} 
    >
      <View style={tabBarStyles.tabBarInner}>
        {TABS.map((tab) => {
          const isFocused = tab.name === 'index'
            ? (pathname === '/resident' || pathname === '/resident/' || pathname === '/resident/index' || currentTabName === 'index')
            : (pathname === `/resident/${tab.name}` || pathname?.startsWith(`/resident/${tab.name}/`) || currentTabName === tab.name);

          const handlePress = () => {
            if (tab.name === 'index') {
              router.navigate('/resident' as any);
            } else {
              router.navigate(`/resident/${tab.name}` as any);
            }
          };

          const tabButton = (
            <TouchableOpacity
              onPress={handlePress}
              style={tabBarStyles.tabItem}
              activeOpacity={0.7}
            >
              <View style={[tabBarStyles.iconPill, isFocused && tabBarStyles.iconPillActive]}>
                <Ionicons
                  name={isFocused ? tab.activeIcon : tab.inactiveIcon}
                  size={22}
                  color={isFocused ? '#2563EB' : '#64748B'}
                />
              </View>
              <Text style={[tabBarStyles.tabLabel, isFocused && tabBarStyles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );

          if (tab.name === 'index') {
            return (
              <CopilotStep
                key={tab.name}
                text="यह आपका होम टैब है। यहाँ से आप वापस अपने डैशबोर्ड पर जा सकते हैं।"
                order={6}
                name="home_tab"
              >
                <WalkthroughableView style={{ flex: 1, height: '100%' }}>
                  {tabButton}
                </WalkthroughableView>
              </CopilotStep>
            );
          }

          if (tab.name === 'settings') {
            return (
              <CopilotStep
                key={tab.name}
                text="यहाँ से आप अपनी प्रोफ़ाइल और सेटिंग्स मैनेज कर सकते हैं।"
                order={8}
                name="profile_tab"
              >
                <WalkthroughableView style={{ flex: 1, height: '100%' }}>
                  {tabButton}
                </WalkthroughableView>
              </CopilotStep>
            );
          }

          return (
            <View key={tab.name} style={{ flex: 1, height: '100%' }}>
              {tabButton}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const tabBarStyles = StyleSheet.create({
  dockedWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
    zIndex: 999,
    elevation: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  tabBarInner: {
    flexDirection: 'row',
    width: '100%',
    height: 52,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
  },
  iconPill: {
    width: 52,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  iconPillActive: {
    backgroundColor: '#EFF6FF',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
});

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
        tabBar={(props) => <WhatsAppFloatingTabBar {...props} insets={insets} />}
        backBehavior="initialRoute"
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="chats" />
        <Tabs.Screen name="community" />
        <Tabs.Screen name="settings" />
        <Tabs.Screen name="my-complaints" options={{ href: null }} />
        <Tabs.Screen name="search" options={{ href: null }} />
        <Tabs.Screen 
          name="raise" 
          options={{ 
            href: null,
            tabBarStyle: { display: 'none' }
          }} 
        />
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
