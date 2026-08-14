import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Image, StatusBar, ActivityIndicator, Alert, RefreshControl, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function StaffScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [complaints, setComplaints] = useState<any[]>([]);

  const toggleLanguage = async () => {
    const newLang = i18n.language === 'en' ? 'hi' : 'en';
    await i18n.changeLanguage(newLang);
    await AsyncStorage.setItem('user-language', newLang);
  };
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Modal State for Dropdown
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);

  const fetchComplaints = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const userDataStr = await SecureStore.getItemAsync('userData');
      let userData = null;
      if (userDataStr) {
        userData = JSON.parse(userDataStr);
        setUser(userData);
      }

      const res = await axios.get(`${API_URL}/complaints`, {
        headers: { 'x-auth-token': token }
      });
      if (Array.isArray(res.data)) {
        setComplaints(res.data);
      } else {
        setComplaints([]);
      }
    } catch (err) {
      console.error('Fetch complaints error:', err);
      setComplaints([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchComplaints();
  };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('userToken');
    await SecureStore.deleteItemAsync('userData');
    Toast.show({ type: 'success', text1: 'Logged out successfully' });
    router.replace('/login' as any);
  };

  const updateStatus = async (newStatus: string) => {
    if (!selectedComplaintId) return;
    
    try {
      const token = await SecureStore.getItemAsync('userToken');
      await axios.patch(`${API_URL}/complaints/${selectedComplaintId}`, { status: newStatus }, {
        headers: { 'x-auth-token': token }
      });
      setModalVisible(false);
      Toast.show({
        type: 'success',
        text1: 'Status Updated',
        text2: `Task marked as ${newStatus.replace('_', ' ')}`
      });
      fetchComplaints(); // Refresh list after update
    } catch (err) {
      console.error('Update status error:', err);
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: 'Could not update status'
      });
    }
  };

  const openStatusDropdown = (id: string) => {
    setSelectedComplaintId(id);
    setModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1F2937" />
      
      {/* Dark Theme Header for Staff */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t('staff.portal')}</Text>
          <Text style={styles.subGreeting}>
            {user?.name || 'Staff Member'} • {user?.assigned_category || 'Assigned'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={toggleLanguage} style={{ backgroundColor: '#4B5563', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginRight: 12 }}>
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 12 }}>{i18n.language === 'en' ? 'हिंदी' : 'English'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#F87171" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.sectionTitle}>{t('staff.assignedTasks')}</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
        ) : complaints.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>{t('staff.noTasks')}</Text>
          </View>
        ) : (
          complaints.map((item) => (
            <View key={item._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.priority}</Text>
                </View>
                <Text style={[
                  styles.statusText, 
                  item.status === 'PENDING' ? { color: '#F59E0B' } : 
                  item.status === 'IN_PROGRESS' ? { color: '#3B82F6' } : { color: '#10B981' }
                ]}>
                  ● {item.status.replace('_', ' ')}
                </Text>
              </View>

              <Text style={styles.cardTitle}>{item.title}</Text>
              
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={16} color="#6B7280" />
                <Text style={styles.cardLocation}>{item.location}</Text>
              </View>

              <Text style={styles.descText}>{item.description}</Text>

              {item.before_image ? (
                <Image source={{ uri: item.before_image }} style={styles.cardImage} />
              ) : null}

              {/* Action Dropdown Button */}
              <TouchableOpacity 
                style={styles.dropdownBtn}
                onPress={() => openStatusDropdown(item._id)}
              >
                <Text style={styles.dropdownBtnText}>{t('staff.updateStatus')}</Text>
                <Ionicons name="chevron-down" size={20} color="#374151" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Status Selection Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('staff.updateStatus')}</Text>
            
            <TouchableOpacity style={styles.modalOption} onPress={() => updateStatus('PENDING')}>
              <Ionicons name="time-outline" size={24} color="#F59E0B" />
              <Text style={styles.modalOptionText}>{t('staff.pending')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.modalOption} onPress={() => updateStatus('IN_PROGRESS')}>
              <Ionicons name="construct-outline" size={24} color="#3B82F6" />
              <Text style={styles.modalOptionText}>{t('staff.inProgress')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.modalOption} onPress={() => updateStatus('DONE')}>
              <Ionicons name="checkmark-circle-outline" size={24} color="#10B981" />
              <Text style={styles.modalOptionText}>{t('staff.resolved')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.modalOption, { borderBottomWidth: 0, marginTop: 8 }]} onPress={() => setModalVisible(false)}>
              <Text style={{ fontSize: 16, color: '#6B7280', fontWeight: '600', textAlign: 'center', width: '100%' }}>{t('staff.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, backgroundColor: '#1F2937' },
  greeting: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  subGreeting: { fontSize: 14, color: '#9CA3AF', marginTop: 4, fontWeight: '500' },
  logoutBtn: { padding: 8, backgroundColor: 'rgba(255,0,0,0.1)', borderRadius: 12 },
  container: { flex: 1 },
  contentContainer: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { marginTop: 16, fontSize: 16, color: '#6B7280', textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  badge: { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#B91C1C' },
  statusText: { fontSize: 13, fontWeight: '700' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardLocation: { fontSize: 14, color: '#4B5563', marginLeft: 4, fontWeight: '500' },
  descText: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 16 },
  cardImage: { width: '100%', height: 180, borderRadius: 12, marginBottom: 16 },
  dropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F3F4F6', padding: 14, borderRadius: 12, marginTop: 8 },
  dropdownBtnText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: 'white', borderRadius: 20, padding: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16, textAlign: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalOptionText: { fontSize: 16, color: '#111827', fontWeight: '500', marginLeft: 12 }
});
