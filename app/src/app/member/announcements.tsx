import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, RefreshControl, Platform, ActivityIndicator, BackHandler, Modal, TextInput, Alert, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function Announcements() {
  const router = useRouter();
  const { t } = useTranslation();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newTargetPhase, setNewTargetPhase] = useState('All');

  const getAvailableAudiences = () => {
    if (!user?.permissions) return [{ label: 'All', value: 'All' }];
    const options = [];
    if (user.permissions.includes('Announcements (All)')) options.push({ label: 'All', value: 'All' });
    if (user.permissions.includes('Announcements (Residents)')) options.push({ label: 'Residents', value: 'Resident' });
    if (user.permissions.includes('Announcements (Members)')) options.push({ label: 'Members', value: 'Members' });
    if (options.length === 0) options.push({ label: 'All', value: 'All' }); // Fallback
    return options;
  };

  // Set default phase when opening modal
  useEffect(() => {
    if (createModalVisible) {
      const opts = getAvailableAudiences();
      if (!opts.some(o => o.value === newTargetPhase)) {
        setNewTargetPhase(opts[0].value);
      }
    }
  }, [createModalVisible]);
  useEffect(() => {
    SecureStore.getItemAsync('userData').then((data) => {
      if (data) setUser(JSON.parse(data));
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      SecureStore.getItemAsync('userData').then((data) => {
        if (data) setUser(JSON.parse(data));
      });
      fetchAnnouncements();
      import('../../services/pushNotifications').then(({ clearAppBadge }) => clearAppBadge());

      const socket = io(API_URL.replace('/api', ''), { transports: ['websocket', 'polling'] });
      socket.on('announcement_changed', () => {
        fetchAnnouncements();
      });

      const onBackPress = () => {
        router.replace('/member' as any);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      
      return () => {
        sub.remove();
        socket.disconnect();
      };
    }, [])
  );

  const fetchAnnouncements = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.get(`${API_URL}/announcements`, {
        headers: { 'x-auth-token': token }
      });
      setAnnouncements(res.data || []);
      if (res.data) {
        await SecureStore.setItemAsync('last_announcements_count', res.data.length.toString());
      }
    } catch (err) {
      console.log('Error fetching announcements:', err);
    } finally {
      setLoadingAnnouncements(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnnouncements();
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!newTitle.trim() || !newDesc.trim()) {
      Alert.alert('Validation Error', 'Title and description are required.');
      return;
    }

    setIsCreating(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      await axios.post(`${API_URL}/announcements`, {
        title: newTitle.trim(),
        message: newDesc.trim(),
        phases: [newTargetPhase]
      }, {
        headers: { 'x-auth-token': token }
      });
      
      Alert.alert('Success', 'Announcement posted successfully');
      setCreateModalVisible(false);
      setNewTitle('');
      setNewDesc('');
      fetchAnnouncements();
    } catch (err: any) {
      console.log('Error creating announcement:', err);
      Alert.alert('Error', err.response?.data?.msg || 'Failed to create announcement');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1D4ED8" />

      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity 
          onPress={() => router.replace('/member' as any)} 
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('resident.announcements')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.contentContainer} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1D4ED8']} />}
      >
        {loadingAnnouncements ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#1D4ED8" />
          </View>
        ) : announcements.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="notifications-off-outline" size={60} color="#CBD5E1" />
            <Text style={styles.emptyText}>{t('resident.noAnnouncements')}</Text>
          </View>
        ) : (
          announcements.map((item, index) => (
            <View key={item._id || index} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.titleContainer}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                </View>
              </View>
              <Text style={styles.cardMessage}>{item.message}</Text>
              
              <View style={styles.cardFooter}>
                <Text style={styles.dateText}>{formatDate(item.date)}</Text>
                {item.creatorName && (
                  <View style={styles.creatorBadge}>
                    <Text style={styles.creatorText}>By: {item.creatorName} {item.creatorId ? `(ID: ${item.creatorId})` : ''}</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {(!user?.permissions || user?.permissions?.some((p: string) => p.startsWith('Announcements'))) && (
        <TouchableOpacity 
          style={styles.fab} 
          onPress={() => setCreateModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Create Announcement Modal */}
      <Modal
        visible={createModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Announcement</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="Announcement Title"
                value={newTitle}
                onChangeText={setNewTitle}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter details..."
                value={newDesc}
                onChangeText={setNewDesc}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Send To</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {getAvailableAudiences().map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setNewTargetPhase(opt.value)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      alignItems: 'center',
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: newTargetPhase === opt.value ? '#2563EB' : '#E2E8F0',
                      backgroundColor: newTargetPhase === opt.value ? '#EFF6FF' : '#F8FAFC'
                    }}
                  >
                    <Text style={{ 
                      fontWeight: '600', 
                      fontSize: 14, 
                      color: newTargetPhase === opt.value ? '#1D4ED8' : '#64748B' 
                    }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleCreateAnnouncement}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Post Announcement</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  headerBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 24) : 20, 
    paddingBottom: 14, 
    backgroundColor: '#1D4ED8',
    elevation: 4,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 1,
  },
  backButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', flex: 1 },

  container: { flex: 1 },
  contentContainer: { padding: 16, paddingTop: 16 },
  
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748B' },

  card: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    padding: 16,
    marginBottom: 14, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.04, 
    shadowRadius: 8, 
    elevation: 2, 
    borderWidth: 1, 
    borderColor: '#F1F5F9' 
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  announcementTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  dateText: { 
    fontSize: 12, 
    color: '#94A3B8',
    fontWeight: '500',
  },
  cardTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#0F172A', 
    marginBottom: 8,
    lineHeight: 22,
  },
  cardMessage: { 
    fontSize: 14, 
    color: '#475569', 
    lineHeight: 22 
  },
  emptyStateContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTextLarge: { fontSize: 17, fontWeight: '700', color: '#1E293B', marginBottom: 6, textAlign: 'center' },
  emptyTextSub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },

  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { marginTop: 16, fontSize: 16, color: '#64748B' },
  
  titleContainer: { flex: 1 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  creatorBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  creatorText: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  
  fab: { position: 'absolute', bottom: 90, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#1D4ED8', justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#1D4ED8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 400 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 15, color: '#0F172A' },
  textArea: { minHeight: 100 },
  submitButton: { backgroundColor: '#1D4ED8', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  submitButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
