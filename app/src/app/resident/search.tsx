import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform, StatusBar, ActivityIndicator, RefreshControl, TextInput, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { io } from 'socket.io-client';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

export default function DirectoryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchContacts();

      const onBackPress = () => {
        router.replace('/resident');
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [])
  );

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    
    socket.on('directory_updated', (payload) => {
      if (!payload) {
        fetchContacts();
        return;
      }
      
      setContacts(prev => {
        if (payload.action === 'create') {
          return [payload.data, ...prev];
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
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.get(`${API_URL}/directory`, {
        headers: { 'x-auth-token': token }
      });
      setContacts(res.data || []);
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
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const filteredContacts = contacts.filter(contact => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const name = (contact.name || '').toLowerCase();
    const phone = (contact.phone || '').toLowerCase();
    const role = (contact.role || contact.designation || '').toLowerCase();
    return name.includes(q) || phone.includes(q) || role.includes(q);
  });

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
        <Text style={styles.headerTitle}>{t('search.title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#94A3B8" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('search.placeholder', { defaultValue: 'Search directory...' })}
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1D4ED8']} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#1D4ED8" style={{ marginTop: 40 }} />
        ) : filteredContacts.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="people-outline" size={40} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>{t('search.noContacts', { defaultValue: 'No contacts found' })}</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery 
                ? t('search.tryDifferent', { defaultValue: 'Try searching with a different name or keyword' })
                : t('search.contactsWillAppear', { defaultValue: 'Contacts will appear here once added by the administration' })}
            </Text>
          </View>
        ) : (
          filteredContacts.map((contact) => (
            <View key={contact._id || contact.id} style={styles.card}>
              <View style={styles.iconBox}>
                <Ionicons name={(contact.icon as any) || 'person'} size={22} color="#1D4ED8" />
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{contact.name}</Text>
                {Boolean(contact.role || contact.designation) && (
                  <Text style={styles.role}>{contact.role || contact.designation}</Text>
                )}
                {Boolean(contact.phone) && (
                  <Text style={styles.phone}>{contact.phone}</Text>
                )}
              </View>
              <TouchableOpacity 
                style={styles.callBtn} 
                onPress={() => handleCall(contact.phone)}
                activeOpacity={0.7}
              >
                <Ionicons name="call" size={18} color="#FFFFFF" />
              </TouchableOpacity>
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
  
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#F8FAFC',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
    height: '100%',
  },

  contentContainer: { padding: 16 },
  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFFFFF', 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 12, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.04, 
    shadowRadius: 8, 
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  iconBox: { 
    width: 46, 
    height: 46, 
    borderRadius: 14, 
    backgroundColor: '#EFF6FF', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 14 
  },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  role: { fontSize: 13, color: '#2563EB', fontWeight: '500', marginBottom: 2 },
  phone: { fontSize: 13, color: '#64748B' },
  callBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    backgroundColor: '#10B981', 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
});
