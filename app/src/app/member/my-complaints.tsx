import React, { useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, StatusBar, ActivityIndicator, RefreshControl, Alert, Platform, Modal, Animated, TextInput, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker } from 'react-native-maps';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

const SkeletonCard = () => {
  const animatedValue = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animatedValue]);

  return (
    <Animated.View style={[{ 
      backgroundColor: '#FFFFFF', 
      borderRadius: 24, 
      padding: 16, 
      marginBottom: 20, 
      shadowColor: '#000', 
      shadowOffset: { width: 0, height: 8 }, 
      shadowOpacity: 0.06, 
      shadowRadius: 20, 
      elevation: 4 
    }, { opacity: animatedValue }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ width: 60, height: 20, backgroundColor: '#E5E7EB', borderRadius: 12 }} />
        <View style={{ width: 80, height: 20, backgroundColor: '#E5E7EB', borderRadius: 12 }} />
      </View>
      <View style={{ width: '70%', height: 24, backgroundColor: '#E5E7EB', borderRadius: 8, marginBottom: 8 }} />
      <View style={{ width: '40%', height: 16, backgroundColor: '#E5E7EB', borderRadius: 6, marginBottom: 16 }} />
      <View style={{ width: '100%', height: 14, backgroundColor: '#E5E7EB', borderRadius: 4, marginBottom: 6 }} />
      <View style={{ width: '80%', height: 14, backgroundColor: '#E5E7EB', borderRadius: 4, marginBottom: 16 }} />
      <View style={{ width: '100%', height: 160, backgroundColor: '#E5E7EB', borderRadius: 16, marginBottom: 12 }} />
      <View style={{ width: '100%', height: 8, backgroundColor: '#E5E7EB', borderRadius: 4 }} />
    </Animated.View>
  );
};

export default function MyComplaints() {
  const router = useRouter();
  const { t } = useTranslation();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'Complaints' | 'Announcements'>('Complaints');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [complaintToDelete, setComplaintToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastViewedDate, setLastViewedDate] = useState<Date>(new Date(0));
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  
  const mounted = React.useRef(false);

  React.useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      fetchComplaints(1, false, searchQuery, selectedCategory);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const fetchComplaints = async (pageNum = 1, append = false, currentSearch = searchQuery, currentCategory = selectedCategory, silent = false) => {
    try {
      if (!append && !silent) setLoading(true);
      else if (append) setLoadingMore(true);

      const token = await SecureStore.getItemAsync('userToken');
      const userData = await SecureStore.getItemAsync('userData');
      if (userData) setUser(JSON.parse(userData));

      const res = await axios.get(`${API_URL}/complaints?page=${pageNum}&limit=5${currentSearch ? `&search=${encodeURIComponent(currentSearch)}` : ''}${currentCategory ? `&category=${encodeURIComponent(currentCategory)}` : ''}`, {
        headers: { 'x-auth-token': token }
      });
      
      const newComplaints = res.data.complaints || res.data;
      const hasMoreData = res.data.hasMore !== undefined ? res.data.hasMore : false;

      if (append) {
        setComplaints(prev => {
          const existingIds = new Set(prev.map(c => c._id));
          const filteredNew = newComplaints.filter((c: any) => !existingIds.has(c._id));
          return [...prev, ...filteredNew];
        });
      } else {
        setComplaints(newComplaints);
        AsyncStorage.setItem('cached_resident_complaints', JSON.stringify(newComplaints));
      }
      
      setHasMore(hasMoreData);
      setPage(pageNum);
      setIsOffline(false);
    } catch (err) {
      console.error('Fetch complaints error:', err);
      if (!append) {
        const cachedStr = await AsyncStorage.getItem('cached_resident_complaints');
        if (cachedStr) {
          setComplaints(JSON.parse(cachedStr));
          setIsOffline(true);
        } else {
          setComplaints([]);
        }
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const fetchAnnouncements = async (silent = false) => {
    try {
      if (!silent && announcements.length === 0) setLoadingAnnouncements(true);
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.get(`${API_URL}/announcements`, {
        headers: { 'x-auth-token': token }
      });
      setAnnouncements(res.data);
      AsyncStorage.setItem('cached_announcements', JSON.stringify(res.data));
      setIsOffline(false);
    } catch (err) {
      console.error('Fetch announcements error:', err);
      const cachedStr = await AsyncStorage.getItem('cached_announcements');
      if (cachedStr) {
        setAnnouncements(JSON.parse(cachedStr));
        setIsOffline(true);
      }
    } finally {
      setLoadingAnnouncements(false);
    }
  };


  const { tab } = useLocalSearchParams();

  React.useEffect(() => {
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
    useCallback(() => {
      fetchComplaints(1, false, searchQuery, selectedCategory, true);
      fetchAnnouncements(true);
      if (tab === 'Complaints') {
        setActiveTab('Complaints');
      }

      const onBackPress = () => {
        router.replace('/member' as any);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [tab])
  );

  const isCloseToBottom = ({layoutMeasurement, contentOffset, contentSize}: any) => {
    const paddingToBottom = 50;
    return layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
  };

  const handleScroll = (event: any) => {
    if (activeTab === 'Complaints') {
      if (isCloseToBottom(event.nativeEvent) && hasMore && !loadingMore && !loading) {
        fetchComplaints(page + 1, true);
      }
    }
  };

  const confirmDelete = (id: string) => {
    setComplaintToDelete(id);
    setDeleteModalVisible(true);
  };

  const handleDelete = async () => {
    if (!complaintToDelete) return;
    setIsDeleting(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      await axios.delete(`${API_URL}/complaints/${complaintToDelete}`, {
        headers: { 'x-auth-token': token }
      });
      setComplaints(prev => prev.filter(c => c._id !== complaintToDelete));
      setDeleteModalVisible(false);
      setComplaintToDelete(null);
    } catch (error) {
      console.error('Delete error', error);
      setDeleteModalVisible(false);
      setErrorMessage('Could not delete complaint. Please try again.');
      setErrorModalVisible(true);
    } finally {
      setIsDeleting(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchComplaints();
    fetchAnnouncements();
  };

  const parseResolutionData = (afterImageStr: string | null) => {
    if (!afterImageStr) return null;
    try {
      const parsed = JSON.parse(afterImageStr);
      return parsed; // { uri, location: { latitude, longitude } }
    } catch(e) {
      return { uri: afterImageStr, location: null };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1D4ED8" />
      
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.offlineText}>No Internet Connection - Showing offline data</Text>
        </View>
      )}

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
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>All Complaints</Text>
        </View>
      </View>

      <ScrollView 
        style={[styles.container, { zIndex: 1 }]} 
        contentContainerStyle={[styles.contentContainer, { paddingTop: 14 }]} 
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={400}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Search & Category Chips */}
        <View style={{ marginBottom: 14 }}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('resident.searchComplaints')}
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); fetchComplaints(1, false, '', selectedCategory); }}>
                <Ionicons name="close-circle" size={18} color="#CBD5E1" />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20, gap: 8 }}>
            {['All', 'Electricity', 'Garbage', 'Sweeping', 'Sewage cleaning', 'Rainwater drainage', 'Tree cutting', 'Street light', 'Water service'].map(cat => {
              const isActive = (cat === 'All' && selectedCategory === '') || cat === selectedCategory;
              return (
                <TouchableOpacity 
                  key={cat} 
                  style={[styles.catChip, isActive && styles.catChipActive]}
                  onPress={() => {
                    const newCat = cat === 'All' ? '' : cat;
                    setSelectedCategory(newCat);
                    fetchComplaints(1, false, searchQuery, newCat);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.catChipText, isActive && styles.catChipTextActive]}>
                    {t(`categories.${cat}`, { defaultValue: cat })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {loading ? (
          <View style={{ marginTop: 10 }}>
            {[1, 2, 3].map(key => <SkeletonCard key={key} />)}
          </View>
        ) : complaints.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="document-text-outline" size={56} color="#CBD5E1" />
            <Text style={styles.emptyTextLarge}>{t('resident.noComplaints')}</Text>
          </View>
        ) : (
          complaints.map((item) => {
            const step = (item.status === 'RESOLVED' || item.status === 'DONE') ? 2 : (item.status === 'IN_PROGRESS' ? 1 : 0);
            const statusBadgeStyle = step === 0 ? styles.badgePending : (step === 1 ? styles.badgeInProgress : styles.badgeResolved);
            const statusTextStyle = step === 0 ? styles.badgeTextPending : (step === 1 ? styles.badgeTextInProgress : styles.badgeTextResolved);
            const statusLabel = step === 0 ? t('staff.pending') : (step === 1 ? t('staff.inProgress') : t('staff.resolved'));
            const statusIcon = step === 0 ? 'time-outline' : (step === 1 ? 'construct-outline' : 'checkmark-circle-outline');

            return (
              <TouchableOpacity 
                key={item._id} 
                style={styles.card} 
                activeOpacity={0.8}
                onPress={() => router.push(`/member/complaint-details?id=${item._id}` as any)}
              >
                {item.before_image ? (
                  <View style={styles.imageContainer}>
                    <Image source={{ uri: item.before_image }} style={styles.cardImage} />
                  </View>
                ) : null}

                <View style={styles.cardContent}>
                  {/* Top Row: Title + Status Badge */}
                  <View style={styles.cardTopRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.cardTitle}>{t(`categories.${item.title}`, { defaultValue: item.title })}</Text>
                    </View>
                    <View style={[styles.statusBadge, statusBadgeStyle]}>
                      <Ionicons name={statusIcon as any} size={12} color={statusTextStyle.color} style={{ marginRight: 4 }} />
                      <Text style={[styles.statusBadgeText, statusTextStyle]}>{statusLabel}</Text>
                    </View>
                  </View>

                  {/* Location / Address */}
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={14} color="#64748B" style={{ marginRight: 4, marginTop: 1 }} />
                    <Text style={styles.cardLocation} numberOfLines={2}>
                      {item.address || item.location}
                    </Text>
                  </View>

                  {/* Description snippet */}
                  {item.description ? (
                    <Text style={[styles.descText, { marginBottom: 0, marginTop: 6 }]} numberOfLines={1}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}
            
            {loadingMore && (
              <View style={{ marginTop: 10 }}>
                {[1, 2].map(key => <SkeletonCard key={key} />)}
              </View>
            )}
      </ScrollView>

      {/* Full Screen Image Modal */}
      <Modal visible={!!fullScreenImage} transparent={true} animationType="fade" onRequestClose={() => setFullScreenImage(null)}>
        <View style={styles.fullScreenImageContainer}>
          <TouchableOpacity style={styles.closeImageBtn} onPress={() => setFullScreenImage(null)}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {fullScreenImage && <Image source={{ uri: fullScreenImage }} style={styles.fullScreenImage} resizeMode="contain" />}
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
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
            <Text style={styles.deleteModalTitle}>{t('resident.deleteComplaint')}</Text>
            <Text style={styles.deleteModalText}>
              {t('resident.deleteConfirm')}
            </Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteModalVisible(false)} disabled={isDeleting}>
                <Text style={styles.cancelBtnText}>{t('staff.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.deleteBtn, isDeleting && { opacity: 0.6 }]} 
                onPress={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.deleteBtnText}>{t('resident.deleteBtn')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Error Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={errorModalVisible}
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContainer}>
            <View style={styles.deleteIconCircle}>
              <Ionicons name="close" size={40} color="#EF4444" />
            </View>
            <Text style={styles.deleteModalTitle}>Oops!</Text>
            <Text style={styles.deleteModalText}>{errorMessage}</Text>
            <TouchableOpacity 
              style={styles.deleteBtn} 
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={styles.deleteBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  offlineBanner: { backgroundColor: '#EF4444', paddingVertical: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  offlineText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  container: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingBottom: 140 },
  headerBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 24) : 20, 
    paddingBottom: 14, 
    backgroundColor: '#1D4ED8',
    elevation: 4,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  backButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  searchBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFFFFF', 
    borderRadius: 14, 
    paddingHorizontal: 12, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    height: 46,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  searchInput: { flex: 1, height: '100%', color: '#0F172A', fontSize: 14, paddingVertical: 0 },
  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  catChipActive: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  catChipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  catChipTextActive: { color: '#FFFFFF' },
  card: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 20, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: '#F1F5F9', 
    shadowColor: '#0F172A', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 10, 
    elevation: 3, 
    overflow: 'hidden' 
  },
  imageContainer: { width: '100%', height: 160, overflow: 'hidden' },
  cardImage: { width: '100%', height: 160 },
  cardContent: { padding: 16 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A', lineHeight: 22 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  badgePending: { backgroundColor: '#FEF3C7' },
  badgeInProgress: { backgroundColor: '#EFF6FF' },
  badgeResolved: { backgroundColor: '#ECFDF5' },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextPending: { color: '#D97706' },
  badgeTextInProgress: { color: '#2563EB' },
  badgeTextResolved: { color: '#059669' },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cardLocation: { fontSize: 13, color: '#64748B', fontWeight: '500', flex: 1, lineHeight: 18 },
  descText: { fontSize: 13, color: '#334155', lineHeight: 19, marginBottom: 12 },
  trackerWrapper: { backgroundColor: '#F8FAFC', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 8, marginTop: 4 },
  trackerBackgroundLine: { 
    position: 'absolute', top: 20, left: 32, right: 32, height: 3, 
    backgroundColor: '#E2E8F0', borderRadius: 2 
  },
  trackerFillLine: { height: '100%', borderRadius: 2 },
  trackerNodesRow: { flexDirection: 'row', justifyContent: 'space-between' },
  trackerNodeCol: { width: 75, alignItems: 'center' },
  trackerDot: { 
    width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 
  },
  trackerDotCurrent: { transform: [{ scale: 1.2 }] },
  trackerLabel: { fontSize: 10, fontWeight: '600', color: '#94A3B8', marginTop: 6, textAlign: 'center' },
  deleteFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  deleteLink: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2, paddingHorizontal: 6 },
  deleteLinkText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },
  emptyStateContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyTextLarge: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginTop: 12, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  deleteModalContainer: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  deleteIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  deleteModalTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  deleteModalText: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  deleteModalActions: { flexDirection: 'row', width: '100%', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#475569' },
  deleteBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: '#EF4444', alignItems: 'center' },
  deleteBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  fullScreenImageContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullScreenImage: { width: '100%', height: '100%' },
  closeImageBtn: { position: 'absolute', top: Platform.OS === 'android' ? 40 : 60, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
});
