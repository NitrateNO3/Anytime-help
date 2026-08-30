import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ResidentLayout() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          height: 80,
          paddingBottom: 20,
          paddingTop: 10,
          borderRadius: 40,
          position: 'absolute',
          bottom: Math.max(insets.bottom + 10, 24),
          marginHorizontal: 24,
          paddingHorizontal: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={28} color={focused ? '#000' : '#9CA3AF'} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={28} color={focused ? '#000' : '#9CA3AF'} />
          ),
        }}
      />
      <Tabs.Screen
        name="raise"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[styles.fabContainer, focused && styles.activeFab]}>
              <Ionicons name="add" size={32} color="#FFF" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={28} color={focused ? '#000' : '#9CA3AF'} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={28} color={focused ? '#000' : '#9CA3AF'} />
          ),
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
  fabContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1D4ED8', // Primary Blue
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20, // Elevates the button slightly
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  activeFab: {
    transform: [{ scale: 1.1 }],
  }
});
