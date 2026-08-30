import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function BookServiceScreen() {
  const router = useRouter();
  const { serviceId, name, icon, basePrice } = useLocalSearchParams();
  
  const [description, setDescription] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingUser, setFetchingUser] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const userDataStr = await SecureStore.getItemAsync('userData');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        setAddress(userData.address || '');
      }
    } catch (e) {
      console.log('Error fetching user data', e);
    } finally {
      setFetchingUser(false);
    }
  };

  const handleBook = async () => {
    if (!description.trim()) {
      Alert.alert('Missing Details', 'Please provide a brief description of the issue.');
      return;
    }
    if (!preferredTime.trim()) {
      Alert.alert('Missing Details', 'Please provide a preferred time (e.g., Today 4 PM).');
      return;
    }

    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      await axios.post(`${API_URL}/service-bookings`, {
        service: serviceId,
        description,
        preferred_time: preferredTime,
        address
      }, {
        headers: { 'x-auth-token': token }
      });
      
      Alert.alert('Success', 'Your service has been booked successfully! A partner will be assigned shortly.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to book service.');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingUser) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1D4ED8" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Book Service</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
          {/* Service Info Card */}
          <View style={styles.serviceCard}>
            <View style={styles.iconCircle}>
              <Ionicons name={icon as any || 'briefcase'} size={28} color="#1D4ED8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.serviceName}>{name}</Text>
              <Text style={styles.serviceDesc}>Professional & verified partner</Text>
            </View>
            <View style={styles.priceTag}>
              <Text style={styles.priceText}>{basePrice}</Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Problem Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="E.g. AC is not cooling properly, making weird noises..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Preferred Time</Text>
            <TextInput
              style={styles.input}
              placeholder="E.g. Today at 5:00 PM, Tomorrow morning"
              placeholderTextColor="#9CA3AF"
              value={preferredTime}
              onChangeText={setPreferredTime}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Service Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Your flat/house number"
              placeholderTextColor="#9CA3AF"
              value={address}
              onChangeText={setAddress}
            />
            <Text style={styles.hint}>This address will be shared with the partner.</Text>
          </View>
          
        </ScrollView>
        
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.bookBtn, loading && { opacity: 0.7 }]} 
            onPress={handleBook}
            disabled={loading}
          >
            <LinearGradient
              colors={['#1D4ED8', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientBtn}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.bookBtnText}>Confirm Booking</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FCFDF6' },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', 
    justifyContent: 'center', alignItems: 'center'
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
  },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#EFF6FF', 
    justifyContent: 'center', alignItems: 'center', marginRight: 16
  },
  serviceName: { fontSize: 18, fontWeight: '800', color: '#111827' },
  serviceDesc: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  priceTag: {
    backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 6, 
    borderRadius: 12, borderWidth: 1, borderColor: '#F59E0B'
  },
  priceText: { color: '#D97706', fontSize: 13, fontWeight: '700' },
  formGroup: { marginBottom: 24 },
  label: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827'
  },
  textArea: { minHeight: 120, paddingTop: 16 },
  hint: { fontSize: 12, color: '#6B7280', marginTop: 8 },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6'
  },
  bookBtn: { borderRadius: 16, overflow: 'hidden' },
  gradientBtn: {
    flexDirection: 'row',
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20
  },
  bookBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }
});
