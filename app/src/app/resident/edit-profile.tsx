import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { io } from 'socket.io-client';
import ForceBlockUpdateModal from '../../components/ForceBlockUpdateModal';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

export default function EditProfileScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phase, setPhase] = useState('');
  const [block, setBlock] = useState('');
  const [houseNo, setHouseNo] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [formattedAddress, setFormattedAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [rawUserData, setRawUserData] = useState<any>(null);

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

        // Fetch fresh user data from API
        const res = await axios.get(`${API_URL}/users/me`, {
          headers: { 'x-auth-token': storedToken }
        });

        const u = res.data;
        setRawUserData(u);
        setName(u.name || '');
        setPhoneNumber(u.phone_number ? u.phone_number.replace('+91', '') : '');
        setPhase(u.phase || '');
        setFormattedAddress(u.address || '');

        // Block
        if (u.block) {
          setBlock(u.block);
        } else if (u.address) {
          const match = u.address.match(/Block\s+([A-H0-9]+)\b/i);
          if (match && match[1]) setBlock(match[1].toUpperCase());
        }

        // House No
        if (u.house_no) {
          setHouseNo(u.house_no);
        } else if (u.address) {
          const houseMatch =
            u.address.match(/House\/Flat:\s*([^,]+)/i) ||
            u.address.match(/(?:House|Flat|H\.No|Plot)\s*[:#\-]?\s*([A-Za-z0-9\/-]+)/i) ||
            u.address.match(/^([A-Za-z0-9\/-]+),/);
          if (houseMatch && houseMatch[1]) setHouseNo(houseMatch[1].trim());
        }

        // Property Type
        if (u.property_type) {
          setPropertyType(u.property_type);
        } else if (u.address && u.address.includes('(Rented)')) {
          setPropertyType('Rented');
        } else {
          setPropertyType('Owned');
        }
      }
    } catch (e) {
      console.log('Error loading user profile:', e);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load profile data' });
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Name is required' });
      return;
    }

    setLoading(true);
    try {
      // ONLY name is editable and updated
      const payload = {
        name: name.trim()
      };

      const res = await axios.put(`${API_URL}/users/me`, payload, {
        headers: { 'x-auth-token': token }
      });

      if (res.data) {
        // Update local storage
        const storedUser = await SecureStore.getItemAsync('userData');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          const updatedUser = { ...parsed, name: name.trim(), ...(res.data.user || {}) };
          await SecureStore.setItemAsync('userData', JSON.stringify(updatedUser));
        }

        Toast.show({ type: 'success', text1: 'Success', text2: 'Name updated successfully' });
        router.back();
      }
    } catch (e: any) {
      console.log('Update profile error:', e.response?.data || e.message);
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: e.response?.data?.message || 'Something went wrong. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 42 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarContainer}>
            <View style={styles.avatarBox}>
              <Ionicons name="person" size={40} color="#2563EB" />
            </View>
          </View>

          {/* Full Name (EDITABLE) */}
          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.editableBadge}>
                <Ionicons name="pencil" size={11} color="#2563EB" />
                <Text style={styles.editableBadgeText}>Editable</Text>
              </View>
            </View>
            <View style={[styles.inputBox, styles.editableInputBox]}>
              <Ionicons name="person-outline" size={20} color="#2563EB" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          {/* Phone Number (LOCKED / READ ONLY) */}
          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.lockedBadge}>
                <Ionicons name="lock-closed" size={11} color="#64748B" />
                <Text style={styles.lockedBadgeText}>Locked</Text>
              </View>
            </View>
            <View style={[styles.inputBox, styles.lockedInputBox]}>
              <Ionicons name="call-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
              <Text style={styles.prefixText}>+91</Text>
              <Text style={styles.lockedText}>{phoneNumber || '---'}</Text>
            </View>
          </View>

          {/* Registered Society & Address Section */}
          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Registered Address Details</Text>
              <TouchableOpacity
                style={styles.editableBadge}
                onPress={() => setShowBlockModal(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="pencil" size={11} color="#2563EB" />
                <Text style={styles.editableBadgeText}>Update Block</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.addressCard}
              onPress={() => setShowBlockModal(true)}
              activeOpacity={0.85}
            >
              <View style={styles.addressRow}>
                <View style={styles.addressCol}>
                  <Text style={styles.addressFieldLabel}>Phase</Text>
                  <Text style={styles.addressFieldValue}>{phase || 'Sushant Lok 2'}</Text>
                </View>
                <View style={styles.addressCol}>
                  <Text style={styles.addressFieldLabel}>Block</Text>
                  <Text style={styles.addressFieldValue}>{block ? `Block ${block}` : '---'}</Text>
                </View>
              </View>

              <View style={[styles.addressRow, { marginTop: 12 }]}>
                <View style={styles.addressCol}>
                  <Text style={styles.addressFieldLabel}>House / Flat No</Text>
                  <Text style={styles.addressFieldValue}>{houseNo || '---'}</Text>
                </View>
                <View style={styles.addressCol}>
                  <Text style={styles.addressFieldLabel}>Property Type</Text>
                  <Text style={styles.addressFieldValue}>{propertyType || 'Owned'}</Text>
                </View>
              </View>

              {formattedAddress ? (
                <View style={styles.fullAddressContainer}>
                  <Ionicons name="location-sharp" size={15} color="#64748B" style={{ marginRight: 6, marginTop: 1 }} />
                  <Text style={styles.fullAddressText}>{formattedAddress}</Text>
                </View>
              ) : null}
            </TouchableOpacity>

            {/* Tap hint */}
            <TouchableOpacity 
              style={styles.noticeBox} 
              onPress={() => setShowBlockModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="information-circle-outline" size={16} color="#2563EB" style={{ marginRight: 6 }} />
              <Text style={[styles.noticeText, { color: '#2563EB', fontWeight: '500' }]}>
                Tap here to update your Block and Flat details anytime.
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
            <Text style={styles.primaryBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>

      <ForceBlockUpdateModal
        visible={showBlockModal}
        userData={rawUserData}
        onClose={() => setShowBlockModal(false)}
        onSuccess={() => {
          setShowBlockModal(false);
          loadUserData();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  iconBtn: { padding: 10, borderRadius: 12, backgroundColor: '#F8FAFC' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },

  scrollContent: { padding: 20 },
  avatarContainer: { alignItems: 'center', marginBottom: 24 },
  avatarBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#BFDBFE'
  },

  formGroup: { marginBottom: 20 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155' },
  
  editableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  editableBadgeText: { fontSize: 11, fontWeight: '600', color: '#2563EB', marginLeft: 4 },

  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  lockedBadgeText: { fontSize: 11, fontWeight: '600', color: '#64748B', marginLeft: 4 },

  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 14
  },
  editableInputBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  lockedInputBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0'
  },
  inputIcon: { marginRight: 10 },
  prefixText: { fontSize: 15, color: '#64748B', marginRight: 6, fontWeight: '600' },
  input: { flex: 1, fontSize: 15, color: '#0F172A', fontWeight: '600' },
  lockedText: { fontSize: 15, color: '#64748B', fontWeight: '600' },

  addressCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16
  },
  addressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  addressCol: {
    flex: 1
  },
  addressFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  addressFieldValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B'
  },
  fullAddressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  fullAddressText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
    lineHeight: 18
  },

  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    marginTop: 8
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16
  },

  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    paddingTop: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  primaryBtn: {
    backgroundColor: '#2563EB',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3
  },
  disabledBtn: { backgroundColor: '#94A3B8' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }
});
