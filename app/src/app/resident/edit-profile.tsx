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
import { VALID_PHASES, PHASE_BLOCKS } from '../../components/ForceBlockUpdateModal';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

export default function EditProfileScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phase, setPhase] = useState('Sushant Lok 2');
  const [block, setBlock] = useState('');
  const [houseNo, setHouseNo] = useState('');
  const [propertyType, setPropertyType] = useState('Owned');
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

        // Phase
        if (u.phase && VALID_PHASES.includes(u.phase)) {
          setPhase(u.phase);
        } else if (u.address && u.address.includes('Sushant Lok 3')) {
          setPhase('Sushant Lok 3');
        } else {
          setPhase('Sushant Lok 2');
        }

        // Block
        const availableBlocks = PHASE_BLOCKS[u.phase] || PHASE_BLOCKS['Sushant Lok 2'];
        if (u.block && availableBlocks.includes(u.block)) {
          setBlock(u.block);
        } else if (u.address) {
          const match = u.address.match(/Block\s+([A-H0-9]+)\b/i);
          if (match && match[1] && availableBlocks.includes(match[1].toUpperCase())) {
            setBlock(match[1].toUpperCase());
          }
        }

        // House No
        if (u.house_no) {
          setHouseNo(u.house_no);
        } else if (u.address) {
          const houseMatch =
            u.address.match(/House\/Flat:\s*([^,]+)/i) ||
            u.address.match(/(?:House|Flat|H\.No|Plot)\s*[:#\-]?\s*([A-Za-z0-9\/-]+)/i) ||
            u.address.match(/^([A-Za-z0-9\/-]+),/);
          if (houseMatch && houseMatch[1]) {
            setHouseNo(houseMatch[1].trim());
          }
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

  const handlePhaseChange = (selectedPhase: string) => {
    setPhase(selectedPhase);
    const availableBlocks = PHASE_BLOCKS[selectedPhase] || [];
    if (!availableBlocks.includes(block)) {
      setBlock('');
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !phoneNumber.trim()) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Name and Phone Number are required' });
      return;
    }

    if (!phase) {
      Toast.show({ type: 'error', text1: 'Phase Required', text2: 'Please select your Phase' });
      return;
    }

    if (!block) {
      Toast.show({ type: 'error', text1: 'Block Required', text2: 'Please select your Block' });
      return;
    }

    if (!houseNo.trim()) {
      Toast.show({ type: 'error', text1: 'House No Required', text2: 'Please enter your House / Flat number' });
      return;
    }

    setLoading(true);
    try {
      const combinedAddress = `House/Flat: ${houseNo.trim()}, ${phase}, Block ${block}, (${propertyType})`;

      const payload = {
        name: name.trim(),
        phone_number: phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber.trim()}`,
        phase,
        block,
        house_no: houseNo.trim(),
        property_type: propertyType,
        address: combinedAddress
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
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: e.response?.data?.message || 'Something went wrong. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const currentBlocks = PHASE_BLOCKS[phase] || [];

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

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarContainer}>
            <View style={styles.avatarBox}>
              <Ionicons name="person" size={40} color="#2563EB" />
            </View>
          </View>

          {/* Full Name */}
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

          {/* Phone Number */}
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

          {/* Phase Selection */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Phase</Text>
            <View style={styles.chipRow}>
              {VALID_PHASES.map((p) => {
                const isSelected = phase === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.phaseChip, isSelected && styles.phaseChipActive]}
                    onPress={() => handlePhaseChange(p)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={isSelected ? '#2563EB' : '#94A3B8'}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.phaseChipText, isSelected && styles.phaseChipTextActive]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Block Selection */}
          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Block</Text>
              <Text style={styles.captionText}>Select your individual block</Text>
            </View>
            <View style={styles.blocksGrid}>
              {currentBlocks.map((b) => {
                const isSelected = block === b;
                return (
                  <TouchableOpacity
                    key={b}
                    style={[styles.blockBox, isSelected && styles.blockBoxActive]}
                    onPress={() => setBlock(b)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.blockBoxText, isSelected && styles.blockBoxTextActive]}>
                      {b}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* House / Flat Number */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>House / Flat Number</Text>
            <View style={styles.inputBox}>
              <Ionicons name="home-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={houseNo}
                onChangeText={setHouseNo}
                placeholder="e.g. 104, B-12, Flat 302"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          {/* Property Type */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Property Type</Text>
            <View style={styles.chipRow}>
              {['Owned', 'Rented'].map((t) => {
                const isSelected = propertyType === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.propertyChip, isSelected && styles.propertyChipActive]}
                    onPress={() => setPropertyType(t)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={t === 'Owned' ? 'key-outline' : 'business-outline'}
                      size={16}
                      color={isSelected ? '#2563EB' : '#64748B'}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.propertyChipText, isSelected && styles.propertyChipTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Formatted Address Preview */}
          <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>FORMATTED ADDRESS</Text>
            <Text style={styles.previewContent}>
              {houseNo.trim() ? `House/Flat: ${houseNo.trim()}, ` : ''}
              {phase}, Block {block || '___'} ({propertyType})
            </Text>
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
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  captionText: { fontSize: 12, color: '#94A3B8' },

  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 14
  },
  inputIcon: { marginRight: 10 },
  prefixText: { fontSize: 15, color: '#0F172A', marginRight: 6, fontWeight: '600' },
  input: { flex: 1, fontSize: 15, color: '#0F172A', fontWeight: '500' },

  chipRow: { flexDirection: 'row', gap: 10 },
  phaseChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0'
  },
  phaseChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  phaseChipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  phaseChipTextActive: { color: '#2563EB', fontWeight: '700' },

  blocksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  blockBox: {
    width: 48,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  blockBoxActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  blockBoxText: { fontSize: 15, fontWeight: '700', color: '#334155' },
  blockBoxTextActive: { color: '#FFFFFF' },

  propertyChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0'
  },
  propertyChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  propertyChipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  propertyChipTextActive: { color: '#2563EB', fontWeight: '700' },

  previewBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
    marginTop: 6,
    marginBottom: 10
  },
  previewTitle: { fontSize: 10, fontWeight: '700', color: '#64748B', letterSpacing: 0.5, marginBottom: 4 },
  previewContent: { fontSize: 13, fontWeight: '600', color: '#0F172A' },

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
