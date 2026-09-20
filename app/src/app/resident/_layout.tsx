import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity } from 'react-native';
import { walkthroughable, CopilotStep } from 'react-native-copilot';

const WalkthroughableTouchableOpacity = walkthroughable(TouchableOpacity);

export default function ResidentLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  
  return (
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
            <Ionicons name="home" size={24} color={color} />
          ),
          tabBarButton: (props: any) => (
            <CopilotStep text="This is your Home tab. Return to your dashboard from here." order={6} name="home_tab">
              <WalkthroughableTouchableOpacity {...props} style={[props.style, { flex: 1 }]} />
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
            <Ionicons name="list" size={24} color={color} />
          ),
          tabBarButton: (props: any) => (
            <CopilotStep text="Quickly check your complaints from this tab." order={7} name="complaints_tab">
              <WalkthroughableTouchableOpacity {...props} style={[props.style, { flex: 1 }]} />
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
            <Ionicons name="person" size={24} color={color} />
          ),
          tabBarButton: (props: any) => (
            <CopilotStep text="Manage your profile and settings here." order={8} name="profile_tab">
              <WalkthroughableTouchableOpacity {...props} style={[props.style, { flex: 1 }]} />
            </CopilotStep>
          ),
        }}
      />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="raise" options={{ href: null }} />
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
      <Tabs.Screen name="complaint-details" options={{ href: null, tabBarStyle: { display: 'none' } }} />
    </Tabs>
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
