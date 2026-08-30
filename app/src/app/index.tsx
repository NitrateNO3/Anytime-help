import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkToken();
  }, []);

  const checkToken = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const userData = await SecureStore.getItemAsync('userData');
      
      if (token && userData) {
        const user = JSON.parse(userData);
        if (user.role === 'Resident') {
          router.replace('/resident');
        } else if (user.role === 'Staff') {
          router.replace('/staff');
        } else if (user.role === 'PaidStaff') {
          router.replace('/paid-staff');
        } else {
          // If somehow admin tries to login to mobile app
          router.replace('/login' as any);
        }
      } else {
        router.replace('/login' as any);
      }
    } catch (e) {
      router.replace('/login' as any);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB'
  }
});
