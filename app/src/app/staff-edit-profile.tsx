import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ScrollView, Platform, StatusBar, KeyboardAvoidingView, 
  ActivityIndicator, BackHandler 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { io } from 'socket.io-client';
import { useTranslation } from 'react-i18next';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

export default function StaffEditProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [role, setRole] = useState('Staff');
  const [assignedCategories, setAssignedCategories] = useState<string[]>([]);
  const [phase, setPhase] = useState('');
  const [rawUserData, setRawUserData] = useState<any>(null);
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [token, setToken] = useState('');

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/staff-settings' as any);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleBack();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [handleBack])
  );

  useEffect(() => {
    loadUserData();
    
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.on('user_updated', async (data: any) => {
      try {
        if (!data || !data.userId) return;
        const storedUser = await SecureStore.getItemAsync('userData');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          if (parsed && (parsed._id === data.userId || parsed.id === data.userId)) {
            setTimeout(() => {
              loadUserData();
            }, 1500);
          }
        }
      } catch (err) {
        console.log('Error handling user_updated in staff-edit-profile:', err);
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
        setRawUserData(parsed);
        setName(parsed.name || '');
        setRole(parsed.role || 'Staff');
        setPhase(parsed.phase || '');
        
        const cleanPhone = String(parsed.phone_number || '').replace(/^\+91/, '').replace(/\D/g, '');
        setPhoneNumber(cleanPhone);
        setAddress(parsed.address || '');

        const cats = parsed.assigned_categories && parsed.assigned_categories.length > 0 
          ? parsed.assigned_categories 
          : (parsed.assigned_category ? [parsed.assigned_category] : []);
        setAssignedCategories(cats);

        // Fetch fresh user data from API
        try {
          const res = await axios.get(`${API_URL}/users/me`, {
            headers: { 'x-auth-token': storedToken }
          });
          
          if (res.data) {
            const u = res.data;
            setRawUserData(u);
            setName(u.name || '');
            setRole(u.role || 'Staff');
            setPhase(u.phase || '');
            
            const freshPhone = String(u.phone_number || '').replace(/^\+91/, '').replace(/\D/g, '');
            setPhoneNumber(freshPhone);
            setAddress(u.address || '');

            const freshCats = u.assigned_categories && u.assigned_categories.length > 0
              ? u.assigned_categories
              : (u.assigned_category ? [u.assigned_category] : []);
            setAssignedCategories(freshCats);

            await SecureStore.setItemAsync('userData', JSON.stringify(u));
          }
        } catch (apiErr) {
          console.log('Failed to fetch fresh user data, using cached:', apiErr);
        }
      }
    } catch (e) {
      console.log('Error loading staff profile:', e);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load profile data' });
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const cleanPhone = phoneNumber.replace(/\D/g, '');

    if (!trimmedName) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Name is required' });
      return;
    }

    if (cleanPhone.length !== 10) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter a valid 10-digit phone number' });
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        name: trimmedName,
        phone_number: `+91${cleanPhone}`,
        address: address.trim()
      };

      const res = await axios.put(`${API_URL}/users/me`, payload, {
        headers: { 'x-auth-token': token }
      });

      if (res.data && res.data.user) {
        // Update local storage
        const storedUser = await SecureStore.getItemAsync('userData');
        const parsed = storedUser ? JSON.parse(storedUser) : {};
        const updatedUser = { ...parsed, ...res.data.user };
        await SecureStore.setItemAsync('userData', JSON.stringify(updatedUser));

        Toast.show({ type: 'success', text1: 'Success', text2: 'Profile updated successfully' });
        handleBack();
      }
    } catch (e: any) {
      console.log('Update profile error:', e.response?.data || e.message);
      const errorMsg = e.response?.data?.message || 'Failed to update profile. Please check your internet connection.';
      Toast.show({ type: 'error', text1: 'Update Failed', text2: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1D4ED8" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={handleBack} 
          style={styles.iconBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 42 }} /> 
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          
          {/* Avatar & Role Badge */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatarBox}>
              <Ionicons name="construct" size={38} color="#1D4ED8" />
            </View>
            <View style={styles.roleBadge}>
              <Ionicons name="shield-checkmark" size={13} color="#1D4ED8" style={{ marginRight: 4 }} />
              <Text style={styles.roleBadgeText}>
                {role === 'PaidStaff' ? 'Paid Maintenance Staff' : 'Maintenance Staff'}
              </Text>
            </View>
          </View>

          {/* Assigned Categories (Specialization) Card */}
          {assignedCategories.length > 0 && (
            <View style={styles.metaCard}>
              <View style={styles.metaCardHeader}>
                <Ionicons name="briefcase-outline" size={16} color="#1D4ED8" style={{ marginRight: 6 }} />
                <Text style={styles.metaCardTitle}>Assigned Department / Trade</Text>
              </View>
              <View style={styles.badgeRow}>
                {assignedCategories.map((cat, idx) => (
                  <View key={idx} style={styles.categoryBadge}>
                    <Ionicons name="hammer-outline" size={12} color="#1E40AF" style={{ marginRight: 4 }} />
                    <Text style={styles.categoryBadgeText}>{cat}</Text>
                  </View>
                ))}
              </View>
              {phase ? (
                <View style={styles.phaseRow}>
                  <Ionicons name="location-outline" size={13} color="#64748B" style={{ marginRight: 4 }} />
                  <Text style={styles.phaseText}>Zone: {phase}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Form Fields */}
          <View style={styles.formSection}>
            {/* Full Name */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Full Name <Text style={{ color: '#EF4444' }}>*</Text></Text>
              <View style={styles.inputBox}>
                <Ionicons name="person-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your full name"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Phone Number */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Phone Number <Text style={{ color: '#EF4444' }}>*</Text></Text>
              <View style={styles.inputBox}>
                <Ionicons name="call-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <Text style={styles.prefixText}>+91</Text>
                <TextInput 
                  style={styles.input}
                  value={phoneNumber}
                  onChangeText={(val: string) => setPhoneNumber(val.replace(/\D/g, ''))}
                  placeholder="9876543210"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </View>
            </View>

            {/* Address / Base Location */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Address / Office Location</Text>
              <View style={[styles.inputBox, styles.addressInputBox]}>
                <Ionicons name="location-outline" size={20} color="#64748B" style={[styles.inputIcon, { marginTop: 4 }]} />
                <TextInput 
                  style={[styles.input, { textAlignVertical: 'top' }]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Enter current address or base station"
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.primaryBtn, loading && styles.disabledBtn]} 
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>Save Changes</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500'
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, 
    borderBottomColor: '#E2E8F0' 
  },
  iconBtn: { 
    width: 40,
    height: 40,
    borderRadius: 12, 
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#0F172A' 
  },
  
  scrollContent: { 
    padding: 20,
    paddingBottom: 40
  },
  avatarContainer: { 
    alignItems: 'center', 
    marginBottom: 20 
  },
  avatarBox: { 
    width: 84, 
    height: 84, 
    borderRadius: 42, 
    backgroundColor: '#DBEAFE', 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 3, 
    borderColor: '#93C5FD',
    marginBottom: 10,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8'
  },

  metaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  metaCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  metaCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF'
  },
  phaseText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500'
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4
  },

  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  formGroup: { 
    marginBottom: 18 
  },
  label: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: '#334155', 
    marginBottom: 8 
  },
  inputBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F8FAFC', 
    borderWidth: 1, 
    borderColor: '#CBD5E1', 
    borderRadius: 12, 
    height: 52, 
    paddingHorizontal: 14 
  },
  addressInputBox: {
    height: 'auto', 
    minHeight: 80, 
    paddingVertical: 10, 
    alignItems: 'flex-start'
  },
  inputIcon: { 
    marginRight: 10 
  },
  prefixText: { 
    fontSize: 15, 
    color: '#0F172A', 
    marginRight: 6, 
    fontWeight: '600' 
  },
  input: { 
    flex: 1, 
    fontSize: 15, 
    color: '#0F172A', 
    fontWeight: '500' 
  },
  
  footer: { 
    paddingHorizontal: 20, 
    paddingBottom: Platform.OS === 'ios' ? 24 : 18, 
    paddingTop: 12, 
    backgroundColor: '#FFFFFF', 
    borderTopWidth: 1, 
    borderTopColor: '#E2E8F0' 
  },
  primaryBtn: { 
    backgroundColor: '#1D4ED8', 
    height: 52, 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4
  },
  disabledBtn: { 
    backgroundColor: '#94A3B8',
    shadowOpacity: 0
  },
  primaryBtnText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: '700' 
  }
});
