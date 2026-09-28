import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, StatusBar, ActivityIndicator, TextInput, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function ResidentsScreen() {
  const router = useRouter();
  
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  // Debounce search timeout
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchContacts(1, searchQuery, false);

      const onBackPress = () => {
        router.replace('/member' as any);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [])
  );

  const fetchContacts = async (pageNum: number, search: string, isLoadMore = false) => {
    if (!isLoadMore) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.get(`${API_URL}/users/residents`, {
        headers: { 'x-auth-token': token },
        params: {
          page: pageNum,
          limit: 20,
          search: search || undefined
        }
      });
      
      const newContacts = res.data.residents || [];
      const totalPages = res.data.totalPages || 1;

      if (isLoadMore) {
        setContacts(prev => [...prev, ...newContacts]);
      } else {
        setContacts(newContacts);
      }
      
      setHasMore(pageNum < totalPages);
      setPage(pageNum);
      
    } catch (error) {
      console.error('Error fetching residents:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchContacts(1, searchQuery, false);
  };

  const loadMore = () => {
    if (hasMore && !loadingMore && !loading) {
      fetchContacts(page + 1, searchQuery, true);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeout) clearTimeout(searchTimeout);
    
    // Debounce backend search
    const timeout = setTimeout(() => {
      fetchContacts(1, text, false);
    }, 500);
    setSearchTimeout(timeout);
  };

  const clearSearch = () => {
    setSearchQuery('');
    if (searchTimeout) clearTimeout(searchTimeout);
    fetchContacts(1, '', false);
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const cleanName = name.replace(/^(Mr\.|Mrs\.|Ms\.|Dr\.)\s*/i, '');
    const parts = cleanName.split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return cleanName.substring(0, 2).toUpperCase();
  };

  const renderItem = ({ item: contact }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.iconBox}>
        <Text style={styles.initialsText}>{getInitials(contact.name)}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{contact.name}</Text>
        {Boolean(contact.address) && (
          <Text style={styles.role}>{contact.address}{contact.phase ? `, ${contact.phase}` : ''}</Text>
        )}
        {Boolean(contact.phone_number) && (
          <Text style={styles.phone}>{contact.phone_number}</Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

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
        <Text style={styles.headerTitle}>Residents List</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#94A3B8" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, flat, phone..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color="#0F172A" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item._id || item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          onRefresh={onRefresh}
          refreshing={refreshing}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="people-outline" size={40} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>No residents found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery 
                  ? 'Try searching with a different name or flat number'
                  : 'Residents will appear here once added by the administration'}
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color="#0F172A" style={{ marginVertical: 20 }} />
            ) : <View style={{ height: 60 }} />
          }
        />
      )}
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
    backgroundColor: '#0F172A',
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
    borderRadius: 23, 
    backgroundColor: '#EFF6FF', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 14 
  },
  initialsText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  role: { fontSize: 13, color: '#2563EB', fontWeight: '500', marginBottom: 2 },
  phone: { fontSize: 13, color: '#64748B' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
});
