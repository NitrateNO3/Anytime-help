import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, StatusBar, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { io } from 'socket.io-client';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

export default function EditProfileScreen() {
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    loadUserData();
    
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.on('user_updated', async (data: any) => {
      const storedUser = await SecureStore.getItemAsync('userData');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed._id === data.userId || parsed.id === data.userId) {
          setTimeout(() => {
            loadUserData();
          }, 1500);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const loadUserData = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync('userToken');
      const storedUser = await SecureStore.getItemAsync('userData');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        const parsed = JSON.parse(storedUser);
        setUserId(parsed.id || parsed._id);
        
        // Fetch fresh user data
        const res = await axios.get(`${API_URL}/users/me`, {
          headers: { 'x-auth-token': storedToken }
        });
        
        const u = res.data;
        setName(u.name || '');
        setPhoneNumber(u.phone_number ? u.phone_number.replace('+91', '') : '');
        setAddress(u.address || '');
      }
    } catch (e) {
      console.log('Error loading user profile:', e);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load profile data' });
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !phoneNumber.trim()) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Name and Phone Number are required' });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name,
        phone_number: phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`,
        address
      };

      const res = await axios.put(`${API_URL}/users/me`, payload, {
        headers: { 'x-auth-token': token }
      });

      if (res.data) {
        // Update local storage
        const storedUser = await SecureStore.getItemAsync('userData');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          const updatedUser = { ...parsed, ...res.data.user };
          await SecureStore.setItemAsync('userData', JSON.stringify(updatedUser));
        }

        Toast.show({ type: 'success', text1: 'Success', text2: 'Profile updated successfully' });
        router.back();
      }
    } catch (e: any) {
      console.log('Update profile error:', e.response?.data || e.message);
      Toast.show({ type: 'error', text1: 'Update Failed', text2: e.response?.data?.message || 'Something went wrong. Have you deployed the backend?' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 42 }} /> 
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <View style={styles.avatarContainer}>
            <View style={styles.avatarBox}>
              <Ionicons name="person" size={40} color="#2563EB" />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputBox}>
              <Ionicons name="person-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput 
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputBox}>
              <Ionicons name="call-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <Text style={styles.prefixText}>+91</Text>
              <TextInput 
                style={styles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="9876543210"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Address</Text>
            <View style={[styles.inputBox, { height: 'auto', minHeight: 60, paddingVertical: 12, alignItems: 'flex-start' }]}>
              <Ionicons name="location-outline" size={20} color="#64748B" style={[styles.inputIcon, { marginTop: 2 }]} />
              <TextInput 
                style={[styles.input, { textAlignVertical: 'top' }]}
                value={address}
                onChangeText={setAddress}
                placeholder="Enter your complete address"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.primaryBtn, loading && styles.disabledBtn]} 
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.primaryBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  iconBtn: { padding: 10, borderRadius: 12, backgroundColor: '#F8FAFC' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  
  scrollContent: { padding: 24 },
  avatarContainer: { alignItems: 'center', marginBottom: 32 },
  avatarBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#BFDBFE' },
  
  formGroup: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, height: 56, paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  prefixText: { fontSize: 16, color: '#0F172A', marginRight: 8, fontWeight: '500' },
  input: { flex: 1, fontSize: 16, color: '#0F172A', fontWeight: '500' },
  
  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 24 : 24, paddingTop: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  primaryBtn: { backgroundColor: '#2563EB', height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  disabledBtn: { backgroundColor: '#94A3B8' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' }
});
