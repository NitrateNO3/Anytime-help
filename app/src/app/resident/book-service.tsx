import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Modal } from 'react-native';
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
  const [modalConfig, setModalConfig] = useState({ visible: false, type: 'success', title: '', message: '', onConfirm: null as any });

  const showAlert = (type: 'success' | 'error' | 'info', title: string, message: string, onConfirm?: () => void) => {
    setModalConfig({ visible: true, type, title, message, onConfirm });
  };

  const closeModal = () => {
    const { onConfirm } = modalConfig;
    setModalConfig(prev => ({ ...prev, visible: false }));
    if (onConfirm) onConfirm();
  };

  useEffect(() => {
    fetchUserData();
    setDescription('');
    setPreferredTime('');
  }, [serviceId]);

  const getPlaceholder = (serviceName: string) => {
    const lower = (serviceName || '').toLowerCase();
    if (lower.includes('plumb') || lower.includes('water')) return "E.g. Leaking pipe, tap replacement, drainage issue...";
    if (lower.includes('electric') || lower.includes('light')) return "E.g. Switchboard not working, short circuit, fan installation...";
    if (lower.includes('ac ') || lower.includes('ac') || lower.includes('cool')) return "E.g. AC is not cooling properly, making weird noises...";
    if (lower.includes('clean') || lower.includes('sweep') || lower.includes('garbage')) return "E.g. Deep cleaning required, regular sweep, waste pickup...";
    if (lower.includes('carpenter') || lower.includes('wood')) return "E.g. Door hinge broken, furniture assembly, custom woodwork...";
    return `E.g. Briefly describe the ${serviceName ? serviceName.toLowerCase() : 'service'} issue you are facing...`;
  };

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
      showAlert('info', 'Missing Details', 'Please provide a brief description of the issue.');
      return;
    }
    if (!preferredTime.trim()) {
      showAlert('info', 'Missing Details', 'Please provide a preferred time (e.g., Today 4 PM).');
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
      
      showAlert('success', 'Success', 'Your service has been booked successfully! A partner will be assigned shortly.', () => router.back());
    } catch (error: any) {
      console.error(error);
      showAlert('error', 'Error', error.response?.data?.message || 'Failed to book service.');
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
              placeholder={getPlaceholder(name as string)}
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

      {/* Custom Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalConfig.visible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={[
              styles.modalIconCircle,
              modalConfig.type === 'success' ? { backgroundColor: '#D1FAE5' } : 
              modalConfig.type === 'error' ? { backgroundColor: '#FEE2E2' } : { backgroundColor: '#DBEAFE' }
            ]}>
              <Ionicons 
                name={modalConfig.type === 'success' ? 'checkmark' : modalConfig.type === 'error' ? 'close' : 'information'} 
                size={40} 
                color={modalConfig.type === 'success' ? '#10B981' : modalConfig.type === 'error' ? '#EF4444' : '#3B82F6'} 
              />
            </View>
            <Text style={styles.modalTitle}>{modalConfig.title}</Text>
            <Text style={styles.modalText}>{modalConfig.message}</Text>
            <TouchableOpacity 
              style={[
                styles.modalBtn,
                modalConfig.type === 'success' ? { backgroundColor: '#10B981' } : 
                modalConfig.type === 'error' ? { backgroundColor: '#EF4444' } : { backgroundColor: '#3B82F6' }
              ]} 
              onPress={closeModal}
            >
              <Text style={styles.modalBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  bookBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  
  // Custom Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  modalIconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 },
  modalText: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  modalBtn: { width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  modalBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' }
});
