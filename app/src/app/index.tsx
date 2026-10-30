import React, { useEffect, useState, useRef } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Text, Dimensions, SafeAreaView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const { width } = Dimensions.get('window');

export default function Index() {
  const router = useRouter();
  const [destination, setDestination] = useState<string | null>(null);
  const navigatedRef = useRef(false);

  useEffect(() => {
    checkToken();
  }, []);

  const checkToken = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const userData = await SecureStore.getItemAsync('userData');

      let target = '/login';
      if (token && userData) {
        const user = JSON.parse(userData);
        if (user.role === 'Resident') {
          target = '/resident';
        } else if (user.role === 'Staff') {
          target = '/staff';
        } else if (user.role === 'PaidStaff') {
          target = '/paid-staff';
        } else if (user.role === 'Member') {
          target = '/member';
        } else {
          target = '/login';
        }
      }

      setDestination(target);

      // If user is already logged in, show the splash screen for 1.6s before auto-transitioning
      if (target !== '/login') {
        const timer = setTimeout(() => {
          if (!navigatedRef.current) {
            navigatedRef.current = true;
            router.replace(target as any);
          }
        }, 1600);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      setDestination('/login');
    }
  };

  const handleGetStarted = () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    router.replace((destination || '/login') as any);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Image
        source={require('../../assets/images/Splash.png')}
        style={styles.splashImage}
        resizeMode="cover"
      />

      <SafeAreaView style={styles.overlaySafeArea}>
        <View style={styles.spacer} />
        <TouchableOpacity
          style={styles.getStartedBtn}
          activeOpacity={0.85}
          onPress={handleGetStarted}
        >
          <Text style={styles.getStartedBtnText}>Get Started</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF7FF',
  },
  splashImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  overlaySafeArea: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 14 : 24,
  },
  spacer: {
    flex: 1,
  },
  getStartedBtn: {
    width: Math.min(width - 32, 360),
    height: 52,
    backgroundColor: '#1B40B6',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#1B40B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  getStartedBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
