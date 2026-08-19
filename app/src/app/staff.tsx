import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Image, StatusBar, ActivityIndicator, Alert, RefreshControl, Modal, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

export default function StaffScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'Tasks' | 'Broadcasts'>('Tasks');

  const toggleLanguage = async () => {
    const newLang = i18n.language === 'en' ? 'hi' : 'en';
    await i18n.changeLanguage(newLang);
    await AsyncStorage.setItem('user-language', newLang);
  };
  const [loading, setLoading] = useState(true);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Modal State for Dropdown
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);

  // Broadcast State
  const [broadcastModalVisible, setBroadcastModalVisible] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Delete Modal State
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [broadcastToDelete, setBroadcastToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const fetchAnnouncements = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.get(`${API_URL}/announcements`, {
        headers: { 'x-auth-token': token }
      });
      setAnnouncements(res.data);
    } catch (err) {
      console.error('Fetch announcements error:', err);
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.on('complaint_changed', () => {
      fetchComplaints();
    });
    socket.on('announcement_changed', () => {
      fetchAnnouncements();
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchComplaints();
      fetchAnnouncements();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchComplaints();
    fetchAnnouncements();
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

  const handleBroadcast = async () => {
    if (!broadcastTitle || !broadcastMessage) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Title and Message are required' });
      return;
    }

    try {
      setSendingBroadcast(true);
      const token = await SecureStore.getItemAsync('userToken');
      await axios.post(`${API_URL}/announcements`, 
        { title: broadcastTitle, message: broadcastMessage },
        { headers: { 'x-auth-token': token } }
      );
      setBroadcastModalVisible(false);
      setBroadcastTitle('');
      setBroadcastMessage('');
      Toast.show({ type: 'success', text1: 'Broadcast Sent', text2: 'Your message has been sent to all residents' });
      fetchAnnouncements(); // Refresh the broadcasts list
    } catch (err) {
      console.error('Broadcast error:', err);
      Toast.show({ type: 'error', text1: 'Broadcast Failed', text2: 'Could not send broadcast' });
    } finally {
      setSendingBroadcast(false);
    }
  };

  const confirmDeleteBroadcast = (id: string) => {
    setBroadcastToDelete(id);
    setDeleteModalVisible(true);
  };

  const executeDeleteBroadcast = async () => {
    if (!broadcastToDelete) return;
    setIsDeleting(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      await axios.delete(`${API_URL}/announcements/${broadcastToDelete}`, {
        headers: { 'x-auth-token': token }
      });
      Toast.show({ type: 'success', text1: 'Deleted', text2: 'Broadcast removed successfully' });
      // Delete locally instantly
      setAnnouncements(prev => prev.filter(a => a._id !== broadcastToDelete));
      setDeleteModalVisible(false);
      setBroadcastToDelete(null);
    } catch (err) {
      console.error('Delete broadcast error:', err);
      Toast.show({ type: 'error', text1: 'Delete Failed', text2: 'Could not delete broadcast' });
      setDeleteModalVisible(false);
    } finally {
      setIsDeleting(false);
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
        {/* Header matched with Resident Theme */}
        <View style={styles.header}>
          <TouchableOpacity onPress={toggleLanguage} style={styles.langToggle}>
            <Text style={styles.langToggleText}>{i18n.language === 'en' ? 'हिंदी में बदलें' : 'English'}</Text>
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Title Area */}
        <View style={styles.titleArea}>
          <Text style={styles.title}>{t('staff.portal')}</Text>
          <Text style={styles.subtitle}>{user?.name || 'Staff Member'} • {user?.assigned_category || 'Assigned'}</Text>
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContainer}>
          <TouchableOpacity 
            style={[styles.filterChip, activeTab === 'Tasks' && styles.filterChipActive]}
            onPress={() => setActiveTab('Tasks')}
          >
            <Text style={[styles.filterText, activeTab === 'Tasks' && styles.filterTextActive]}>{t('staff.assignedTasks')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterChip, activeTab === 'Broadcasts' && styles.filterChipActive]}
            onPress={() => setActiveTab('Broadcasts')}
          >
            <Text style={[styles.filterText, activeTab === 'Broadcasts' && styles.filterTextActive]}>My Broadcasts</Text>
          </TouchableOpacity>
        </ScrollView>

        {activeTab === 'Tasks' ? (
          <>
            {loading ? (
              <ActivityIndicator size="large" color="#1D4ED8" style={{ marginTop: 40 }} />
            ) : complaints.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Ionicons name="checkmark-circle-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyTextLarge}>{t('staff.noTasks')}</Text>
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
                      ● {item.status === 'DONE' ? 'RESOLVED' : item.status.replace('_', ' ')}
                    </Text>
                  </View>

                  <Text style={styles.cardTitle}>{item.title}</Text>
                  
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={16} color="#6B7280" />
                    <Text style={styles.cardLocation}>{item.location}</Text>
                  </View>

                  <Text style={styles.descText}>{item.description}</Text>

                  {item.before_image ? (
                    <View style={styles.imageContainer}>
                      <Image source={{ uri: item.before_image }} style={styles.cardImage} />
                    </View>
                  ) : null}

                  {/* Action Dropdown Button */}
                  <TouchableOpacity 
                    style={styles.dropdownBtn}
                    onPress={() => openStatusDropdown(item._id)}
                  >
                    <Text style={styles.dropdownBtnText}>{t('staff.updateStatus')}</Text>
                    <Ionicons name="chevron-down" size={20} color="#111827" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        ) : (
          <>
            {(() => {
              const filteredAnnouncements = announcements.filter(item => {
                const uid = user?._id || user?.id;
                const cid = item?.createdBy;
                return uid && cid && String(uid) === String(cid);
              });

              if (loadingAnnouncements) {
                return <ActivityIndicator size="large" color="#1D4ED8" style={{ marginTop: 40 }} />;
              }

              if (filteredAnnouncements.length === 0) {
                return (
                  <View style={styles.emptyStateContainer}>
                    <Ionicons name="megaphone-outline" size={64} color="#D1D5DB" />
                    <Text style={styles.emptyTextLarge}>No broadcasts sent yet.</Text>
                    <Text style={styles.emptyTextSub}>You haven't sent any messages to the residents. Tap the button below to send your first message.</Text>
                  </View>
                );
              }

              return filteredAnnouncements.map((item) => (
                <View key={item._id} style={[styles.card, { padding: 16 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6, flex: 1 }}>{item.title}</Text>
                    <TouchableOpacity onPress={() => confirmDeleteBroadcast(item._id)} style={{ padding: 4, backgroundColor: '#FEE2E2', borderRadius: 8 }}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>{new Date(item.date).toLocaleDateString()}</Text>
                  <Text style={{ fontSize: 15, color: '#4B5563', lineHeight: 22 }}>{item.message}</Text>
                </View>
              ));
            })()}
          </>
        )}
        <View style={{ height: 120 }} />
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

      {/* Broadcast Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={broadcastModalVisible}
        onRequestClose={() => setBroadcastModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setBroadcastModalVisible(false)}
        >
          <View style={styles.broadcastModalContent}>
            <View style={styles.broadcastHeader}>
              <Text style={styles.modalTitle}>New Broadcast</Text>
              <TouchableOpacity onPress={() => setBroadcastModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.broadcastHelpText}>This message will be sent to all residents as an announcement.</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Broadcast Title (e.g., Power Outage)"
              value={broadcastTitle}
              onChangeText={setBroadcastTitle}
              placeholderTextColor="#9CA3AF"
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Message details..."
              value={broadcastMessage}
              onChangeText={setBroadcastMessage}
              multiline
              numberOfLines={4}
              placeholderTextColor="#9CA3AF"
            />
            
            <TouchableOpacity 
              style={styles.broadcastBtn} 
              onPress={handleBroadcast}
              disabled={sendingBroadcast}
            >
              {sendingBroadcast ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <>
                  <Ionicons name="megaphone" size={20} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.broadcastBtnText}>Send Broadcast</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Custom Delete Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={deleteModalVisible}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContainer}>
            <View style={styles.deleteIconCircle}>
              <Ionicons name="trash" size={32} color="#EF4444" />
            </View>
            <Text style={styles.deleteModalTitle}>Delete Broadcast</Text>
            <Text style={styles.deleteModalText}>
              Are you sure you want to delete this broadcast? It will be removed for everyone.
            </Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteModalVisible(false)} disabled={isDeleting}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.deleteBtn, isDeleting && { opacity: 0.6 }]} 
                onPress={executeDeleteBroadcast}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.deleteBtnText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* FAB for Broadcast matched with new theme */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setBroadcastModalVisible(true)}
      >
        <Ionicons name="megaphone" size={24} color="#FFF" />
      </TouchableOpacity>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FCFDF6' },
  container: { flex: 1 },
  contentContainer: { paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 20 : 50) : 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  langToggle: { backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  langToggleText: { fontSize: 13, fontWeight: '600', color: '#111827' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  titleArea: { marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '600', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  filterScroll: { marginBottom: 30, maxHeight: 45 },
  filterContainer: { paddingRight: 20, gap: 12 },
  filterChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  filterChipActive: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  filterText: { fontSize: 15, fontWeight: '500', color: '#4B5563' },
  filterTextActive: { color: '#FFFFFF', fontWeight: '600' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  badge: { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#B91C1C' },
  statusText: { fontSize: 13, fontWeight: '700' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardLocation: { fontSize: 14, color: '#6B7280', marginLeft: 4, fontWeight: '500' },
  descText: { fontSize: 14, color: '#4B5563', lineHeight: 20, marginBottom: 16 },
  imageContainer: { width: '100%', height: 160, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  cardImage: { width: '100%', height: '100%' },
  dropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F3F4F6', padding: 14, borderRadius: 12, marginTop: 4 },
  dropdownBtnText: { color: '#111827', fontSize: 15, fontWeight: '600' },
  emptyStateContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyTextLarge: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 16, textAlign: 'center' },
  emptyTextSub: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 22 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: 'white', borderRadius: 20, padding: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16, textAlign: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalOptionText: { fontSize: 16, color: '#111827', fontWeight: '500', marginLeft: 12 },
  broadcastModalContent: { width: '90%', backgroundColor: 'white', borderRadius: 24, padding: 24, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  broadcastHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  broadcastHelpText: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, padding: 16, fontSize: 16, color: '#111827', marginBottom: 16 },
  textArea: { height: 120, textAlignVertical: 'top' },
  broadcastBtn: { backgroundColor: '#1D4ED8', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, borderRadius: 16, marginTop: 8 },
  broadcastBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: '#1D4ED8', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: '#1D4ED8', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 15, elevation: 6 },
  deleteModalContainer: { width: '90%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  deleteIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  deleteModalTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 8 },
  deleteModalText: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  deleteModalActions: { flexDirection: 'row', width: '100%', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '700', color: '#4B5563' },
  deleteBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: '#EF4444', alignItems: 'center' },
  deleteBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
