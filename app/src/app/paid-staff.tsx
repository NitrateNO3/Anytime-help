import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl, Modal, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { io } from 'socket.io-client';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

export default function PaidStaffScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'Available' | 'My Bookings'>('Available');
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);

  // OTP Modal State
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [otpAction, setOtpAction] = useState<'start' | 'complete'>('start');
  const [otpInput, setOtpInput] = useState('');
  const [processing, setProcessing] = useState(false);
  
  const [modalConfig, setModalConfig] = useState({ visible: false, title: '', message: '' });

  const showAlert = (title: string, message: string) => {
    setModalConfig({ visible: true, title, message });
  };

  const closeAlert = () => {
    setModalConfig(prev => ({ ...prev, visible: false }));
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const userDataStr = await SecureStore.getItemAsync('userData');
      if (userDataStr) {
        setUser(JSON.parse(userDataStr));
      }
    } catch (e) {
      console.log('Error fetching user data', e);
    }
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync('userToken');
      const endpoint = activeTab === 'Available' ? '/service-bookings/available' : '/service-bookings/me';
      const res = await axios.get(`${API_URL}${endpoint}`, {
        headers: { 'x-auth-token': token }
      });
      setBookings(res.data);
    } catch (err) {
      console.error('Fetch bookings error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchBookings();
    }, [activeTab])
  );

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.on('new_service_booking', () => {
      if (activeTab === 'Available') fetchBookings();
    });
    socket.on('booking_updated', () => {
      fetchBookings();
    });
    return () => {
      socket.disconnect();
    };
  }, [activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('userToken');
    await SecureStore.deleteItemAsync('userData');
    Toast.show({ type: 'success', text1: 'Logged out successfully' });
    router.replace('/login' as any);
  };

  const handleAccept = async (id: string) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      await axios.put(`${API_URL}/service-bookings/${id}/accept`, {}, {
        headers: { 'x-auth-token': token }
      });
      Toast.show({ type: 'success', text1: 'Booking Accepted', text2: 'You can now proceed to the address.' });
      fetchBookings();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Action Failed', text2: error.response?.data?.message || 'Could not accept booking' });
    }
  };

  const openOtpModal = (id: string, action: 'start' | 'complete') => {
    setSelectedBookingId(id);
    setOtpAction(action);
    setOtpInput('');
    setOtpModalVisible(true);
  };

  const handleVerifyOtp = async () => {
    if (!otpInput || otpInput.length !== 4) {
      showAlert('Invalid OTP', 'Please enter a 4-digit OTP');
      return;
    }

    setProcessing(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      await axios.put(`${API_URL}/service-bookings/${selectedBookingId}/${otpAction}`, 
        { otp: otpInput },
        { headers: { 'x-auth-token': token } }
      );
      
      Toast.show({ 
        type: 'success', 
        text1: 'Success', 
        text2: otpAction === 'start' ? 'Job Started' : 'Job Completed' 
      });
      setOtpModalVisible(false);
      fetchBookings();
    } catch (error: any) {
      showAlert('Verification Failed', error.response?.data?.message || 'Invalid OTP');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FCFDF6" />
      
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Partner Portal</Text>
            <Text style={styles.subtitle}>{user?.name || 'Service Partner'} • {user?.assigned_category || 'Assigned'}</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'Available' && styles.tabActive]}
            onPress={() => setActiveTab('Available')}
          >
            <Text style={[styles.tabText, activeTab === 'Available' && styles.tabTextActive]}>New Leads</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'My Bookings' && styles.tabActive]}
            onPress={() => setActiveTab('My Bookings')}
          >
            <Text style={[styles.tabText, activeTab === 'My Bookings' && styles.tabTextActive]}>My Jobs</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#1D4ED8" style={{ marginTop: 40 }} />
        ) : bookings.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="briefcase-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTextLarge}>No bookings found</Text>
          </View>
        ) : (
          bookings.map((item) => (
            <View key={item._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.service?.name}</Text>
                <View style={{ backgroundColor: item.status === 'COMPLETED' ? '#D1FAE5' : '#DBEAFE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ color: item.status === 'COMPLETED' ? '#059669' : '#1D4ED8', fontSize: 12, fontWeight: '700' }}>{item.status.replace('_', ' ')}</Text>
                </View>
              </View>

              <Text style={styles.descText}>{item.description}</Text>

              <View style={styles.detailsRow}>
                <Ionicons name="time-outline" size={16} color="#6B7280" />
                <Text style={styles.detailsText}>{item.preferred_time}</Text>
              </View>
              <View style={styles.detailsRow}>
                <Ionicons name="location-outline" size={16} color="#6B7280" />
                <Text style={styles.detailsText}>{item.address}</Text>
              </View>
              <View style={[styles.detailsRow, { marginBottom: 16 }]}>
                <Ionicons name="person-outline" size={16} color="#6B7280" />
                <Text style={styles.detailsText}>{item.resident?.name} ({item.resident?.phone_number})</Text>
              </View>

              {activeTab === 'Available' && item.status === 'PENDING' && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleAccept(item._id)}>
                  <LinearGradient colors={['#10B981', '#059669']} style={styles.gradientBtn}>
                    <Text style={styles.actionBtnText}>Accept Booking</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {activeTab === 'My Bookings' && item.status === 'ACCEPTED' && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => openOtpModal(item._id, 'start')}>
                  <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.gradientBtn}>
                    <Text style={styles.actionBtnText}>Enter Start OTP</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {activeTab === 'My Bookings' && item.status === 'IN_PROGRESS' && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => openOtpModal(item._id, 'complete')}>
                  <LinearGradient colors={['#1D4ED8', '#2563EB']} style={styles.gradientBtn}>
                    <Text style={styles.actionBtnText}>Enter End OTP</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* OTP Modal */}
      <Modal visible={otpModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{otpAction === 'start' ? 'Start Job' : 'Complete Job'}</Text>
            <Text style={{ color: '#6B7280', textAlign: 'center', marginBottom: 20 }}>
              Ask the resident for the {otpAction === 'start' ? 'Start OTP' : 'End OTP'} to proceed.
            </Text>

            <TextInput
              style={styles.otpInput}
              placeholder="Enter 4-digit OTP"
              keyboardType="number-pad"
              maxLength={4}
              value={otpInput}
              onChangeText={setOtpInput}
              placeholderTextColor="#9CA3AF"
            />

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setOtpModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmBtn, processing && { opacity: 0.7 }]} 
                onPress={handleVerifyOtp}
                disabled={processing}
              >
                {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>Verify OTP</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Alert Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalConfig.visible}
        onRequestClose={closeAlert}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertModalContainer}>
            <View style={styles.alertIconCircle}>
              <Ionicons name="information-circle" size={40} color="#3B82F6" />
            </View>
            <Text style={styles.alertModalTitle}>{modalConfig.title}</Text>
            <Text style={styles.alertModalText}>{modalConfig.message}</Text>
            <TouchableOpacity style={styles.alertModalBtn} onPress={closeAlert}>
              <Text style={styles.alertModalBtnText}>OK</Text>
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
  contentContainer: { paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 20 : 50) : 60, paddingBottom: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4, marginBottom: 24 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#111827' },
  emptyStateContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyTextLarge: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  descText: { fontSize: 14, color: '#4B5563', lineHeight: 20, marginBottom: 16 },
  detailsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  detailsText: { fontSize: 14, color: '#4B5563', marginLeft: 8, fontWeight: '500' },
  actionBtn: { borderRadius: 12, overflow: 'hidden' },
  gradientBtn: { paddingVertical: 14, alignItems: 'center' },
  actionBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: 'white', borderRadius: 20, padding: 24, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 8, textAlign: 'center' },
  otpInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, fontSize: 24, letterSpacing: 4, fontWeight: '700', color: '#111827', textAlign: 'center' },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: '#4B5563' },
  confirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#1D4ED8', alignItems: 'center' },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  
  // Custom Alert Styles
  alertModalContainer: { width: '85%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  alertIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  alertModalTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8, textAlign: 'center' },
  alertModalText: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  alertModalBtn: { width: '100%', paddingVertical: 16, borderRadius: 16, backgroundColor: '#3B82F6', alignItems: 'center' },
  alertModalBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' }
});
