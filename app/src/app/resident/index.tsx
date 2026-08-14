import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Image, StatusBar, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function ResidentHome() {
  const router = useRouter();
  const { t } = useTranslation();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'Complaints' | 'Announcements'>('Complaints');

  const fetchComplaints = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const userData = await SecureStore.getItemAsync('userData');
      if (userData) setUser(JSON.parse(userData));

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
      console.error(err);
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
    fetchAnnouncements();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchComplaints();
    fetchAnnouncements();
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
          <TouchableOpacity style={styles.iconBtn} onPress={() => Alert.alert(t('resident.menu'), t('resident.menuComingSoon'))}>
            <Ionicons name="menu-outline" size={28} color="#111827" />
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="notifications-outline" size={24} color="#111827" />
              <View style={styles.badge} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Title Area */}
        <View style={styles.titleArea}>
          <Text style={styles.title}>{t('resident.hello')} {user?.name || 'Resident'}</Text>
          <Text style={styles.subtitle}>{t('resident.exploreSociety')}</Text>
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContainer}>
          <TouchableOpacity 
            style={[styles.filterChip, activeTab === 'Complaints' && styles.filterChipActive]}
            onPress={() => setActiveTab('Complaints')}
          >
            <Text style={[styles.filterText, activeTab === 'Complaints' && styles.filterTextActive]}>{t('resident.myComplaints')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterChip, activeTab === 'Announcements' && styles.filterChipActive]}
            onPress={() => setActiveTab('Announcements')}
          >
            <Text style={[styles.filterText, activeTab === 'Announcements' && styles.filterTextActive]}>{t('resident.announcements')}</Text>
          </TouchableOpacity>
        </ScrollView>

        {activeTab === 'Complaints' ? (
          <>
            <Text style={styles.sectionTitle}>{t('resident.myComplaints')}</Text>
            
            {loading ? (
              <ActivityIndicator size="large" color="#E1F21E" style={{ marginTop: 40 }} />
            ) : complaints.length === 0 ? (
              <Text style={styles.emptyText}>{t('resident.noComplaints')}</Text>
            ) : (
              complaints.map((item) => (
                <TouchableOpacity key={item._id} style={styles.card} activeOpacity={0.9}>
                  {item.before_image ? (
                    <View style={styles.imageContainer}>
                      <Image source={{ uri: item.before_image }} style={styles.cardImage} />
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>{item.priority} {t('resident.priority')}</Text>
                      </View>
                    </View>
                  ) : null}
                  
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardLocation}>{item.location}</Text>
                    
                    <View style={styles.cardFooter}>
                      <Text style={styles.descText} numberOfLines={1}>{item.description}</Text>
                      <Text style={[
                        styles.statusText, 
                        item.status === 'PENDING' ? { color: '#F59E0B' } : 
                        item.status === 'IN_PROGRESS' ? { color: '#3B82F6' } : { color: '#10B981' }
                      ]}>
                        {item.status.replace('_', ' ')}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        ) : (
          <>
            {loadingAnnouncements ? (
              <ActivityIndicator size="large" color="#E1F21E" style={{ marginTop: 40 }} />
            ) : announcements.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Ionicons name="megaphone-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyTextLarge}>{t('resident.noAnnouncements')}</Text>
                <Text style={styles.emptyTextSub}>{t('resident.noAnnouncementsSub')}</Text>
              </View>
            ) : (
              announcements.map((item) => (
                <View key={item._id} style={[styles.card, { padding: 16 }]}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 }}>{item.title}</Text>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>{new Date(item.date).toLocaleDateString()}</Text>
                  <Text style={{ fontSize: 15, color: '#4B5563', lineHeight: 22 }}>{item.message}</Text>
                </View>
              ))
            )}
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FCFDF6' },
  container: { flex: 1 },
  contentContainer: { paddingHorizontal: 20, paddingTop: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, marginRight: 12 },
  badge: { position: 'absolute', top: 10, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  titleArea: { marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '600', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 28, fontWeight: '800', color: '#111827' },
  filterScroll: { marginBottom: 30 },
  filterContainer: { paddingRight: 20, gap: 12 },
  filterChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  filterChipActive: { backgroundColor: '#E1F21E', borderColor: '#E1F21E' },
  filterText: { fontSize: 15, fontWeight: '500', color: '#4B5563' },
  filterTextActive: { color: '#111827', fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 12, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 4 },
  imageContainer: { width: '100%', height: 160, borderRadius: 16, overflow: 'hidden', marginBottom: 12, position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  tag: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(255, 255, 255, 0.9)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  tagText: { fontSize: 12, fontWeight: '700', color: '#991B1B' },
  cardContent: { paddingHorizontal: 8, paddingBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 },
  cardLocation: { fontSize: 14, color: '#6B7280', marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  descText: { flex: 1, fontSize: 13, color: '#6B7280', marginRight: 10 },
  statusText: { fontSize: 13, fontWeight: '700' },
  emptyText: { textAlign: 'center', color: '#6B7280', fontSize: 16, marginTop: 20 },
  emptyStateContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyTextLarge: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 16, textAlign: 'center' },
  emptyTextSub: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 22 }
});
