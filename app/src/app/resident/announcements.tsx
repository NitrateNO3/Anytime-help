import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, StatusBar, RefreshControl, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function Announcements() {
  const router = useRouter();
  const { t } = useTranslation();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastViewedDate, setLastViewedDate] = useState<Date>(new Date(0));

  React.useEffect(() => {
    SecureStore.getItemAsync('lastViewedAnnouncement').then(dateStr => {
      if (dateStr) setLastViewedDate(new Date(dateStr));
    });
    fetchAnnouncements();
  }, []);

  React.useEffect(() => {
    const now = new Date();
    setLastViewedDate(now);
    SecureStore.setItemAsync('lastViewedAnnouncement', now.toISOString());
  }, [announcements]);

  const fetchAnnouncements = async () => {
    try {
      setLoadingAnnouncements(true);
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.get(`${API_URL}/announcements`, {
        headers: { 'x-auth-token': token }
      });
      setAnnouncements(res.data);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1D4ED8" />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 30) : 40, paddingBottom: 15, backgroundColor: '#1D4ED8', zIndex: 1 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#FFFFFF' }}>{t('resident.announcements')}</Text>
      </View>

      <ScrollView 
        style={styles.container} 
        contentContainerStyle={[styles.contentContainer, { paddingTop: 10 }]} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loadingAnnouncements ? (
          <View style={{ marginTop: 20 }}>
             <Text>Loading announcements...</Text>
          </View>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FCFDF6' },
  container: { flex: 1 },
  contentContainer: { paddingBottom: 100, paddingHorizontal: 24 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 3, borderWidth: 1, borderColor: '#F3F4F6' },
  emptyStateContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTextLarge: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 16, textAlign: 'center' },
  emptyTextSub: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 22 },
});
