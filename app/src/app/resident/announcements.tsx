import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, RefreshControl, Platform, ActivityIndicator, BackHandler } from 'react-native';
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

  useFocusEffect(
    useCallback(() => {
      fetchAnnouncements();
      import('../../services/pushNotifications').then(({ clearAppBadge }) => clearAppBadge());

      const socket = io(API_URL.replace('/api', ''), { transports: ['websocket', 'polling'] });
      socket.on('announcement_changed', () => {
        fetchAnnouncements();
      });

      const onBackPress = () => {
        router.replace('/resident');
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1D4ED8" />

      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity 
          onPress={() => router.replace('/resident')} 
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
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1D4ED8" />
            <Text style={styles.loadingText}>Fetching updates...</Text>
          </View>
        ) : announcements.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="megaphone-outline" size={40} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTextLarge}>{t('resident.noAnnouncements')}</Text>
            <Text style={styles.emptyTextSub}>{t('resident.noAnnouncementsSub')}</Text>
          </View>
        ) : (
          announcements.map((item) => (
            <View key={item._id || item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.announcementTag}>
                  <Ionicons name="notifications" size={14} color="#2563EB" style={{ marginRight: 4 }} />
                  <Text style={styles.tagText}>Notice</Text>
                </View>
                <Text style={styles.dateText}>{formatDate(item.date || item.createdAt)}</Text>
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardMessage}>{item.message}</Text>
              
              {item.creatorName && (
                <View style={styles.cardFooter}>
                  <View style={styles.creatorBadge}>
                    <Text style={styles.creatorText}>By: {item.creatorName} {item.creatorId ? `(ID: ${item.creatorId})` : ''}</Text>
                  </View>
                </View>
              )}
            </View>
          ))
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
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
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  creatorBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  creatorText: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  emptyStateContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTextLarge: { fontSize: 17, fontWeight: '700', color: '#1E293B', marginBottom: 6, textAlign: 'center' },
  emptyTextSub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
});
