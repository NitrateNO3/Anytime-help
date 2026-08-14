import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function CommunityScreen() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.get(`${API_URL}/announcements`, {
        headers: { 'x-auth-token': token }
      });
      setNotifications(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('community.title')}</Text>
        <Text style={styles.headerSubtitle}>{t('community.subtitle')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {loading ? (
          <ActivityIndicator size="large" color="#E1F21E" style={{ marginTop: 40 }} />
        ) : notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>{t('community.noNotifications')}</Text>
          </View>
        ) : (
          notifications.map(notif => (
            <View key={notif._id} style={styles.card}>
              <View style={[styles.iconBox, { backgroundColor: `#10B98115` }]}>
                <Ionicons name="megaphone-outline" size={24} color="#10B981" />
              </View>
              <View style={styles.info}>
                <Text style={styles.title}>{notif.title}</Text>
                <Text style={styles.time}>{new Date(notif.date).toLocaleDateString()}</Text>
                <Text style={{ marginTop: 4, color: '#4B5563', fontSize: 14 }}>{notif.message}</Text>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FCFDF6' },
  header: { padding: 24, paddingTop: Platform.OS === 'android' ? 40 : 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#111827' },
  headerSubtitle: { fontSize: 16, color: '#6B7280', marginTop: 4 },
  contentContainer: { padding: 20 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 20, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  iconBox: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  info: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  time: { fontSize: 13, color: '#6B7280' },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { marginTop: 16, fontSize: 18, fontWeight: '600', color: '#6B7280' }
});
