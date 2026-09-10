import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Linking, Platform, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

export default function DirectoryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchContacts();

    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    
    socket.on('directory_updated', (payload) => {
      if (!payload) {
        fetchContacts();
        return;
      }
      
      setContacts(prev => {
        if (payload.action === 'create') {
          return [payload.data, ...prev]; // Or add to the end depending on your sorting
        } else if (payload.action === 'update') {
          return prev.map(c => c._id === payload.data._id ? payload.data : c);
        } else if (payload.action === 'delete') {
          return prev.filter(c => c._id !== payload.id);
        }
        return prev;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchContacts = async () => {
    try {
      const res = await axios.get(`${API_URL}/directory`);
      setContacts(res.data);
    } catch (error) {
      console.error('Error fetching directory:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchContacts();
    setRefreshing(false);
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1D4ED8" />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 30) : 40, paddingBottom: 15, backgroundColor: '#1D4ED8', zIndex: 1 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#FFFFFF' }}>{t('search.title')}</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1D4ED8']} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#1D4ED8" style={{ marginTop: 40 }} />
        ) : contacts.length === 0 ? (
          <Text style={{ textAlign: 'center', marginTop: 40, color: '#6B7280' }}>No contacts found.</Text>
        ) : (
          contacts.map((contact) => (
            <View key={contact._id || contact.id} style={styles.card}>
              <View style={styles.iconBox}>
                <Ionicons name={contact.icon as any || 'call'} size={24} color="#111827" />
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{contact.name}</Text>
              </View>
              <TouchableOpacity style={styles.callBtn} onPress={() => handleCall(contact.phone)}>
                <Ionicons name="call" size={20} color="#1D4ED8" />
              </TouchableOpacity>
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
  header: { padding: 24, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 20 : 50) : 60, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#111827' },
  headerSubtitle: { fontSize: 16, color: '#6B7280', marginTop: 4 },
  contentContainer: { padding: 20 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  iconBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  role: { fontSize: 14, color: '#6B7280' },
  callBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center' },
});
