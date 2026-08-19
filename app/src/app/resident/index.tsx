import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Image, StatusBar, ActivityIndicator, RefreshControl, Alert, Platform, Modal, Animated, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  React.useEffect(() => {
    SecureStore.getItemAsync('lastViewedAnnouncement').then(dateStr => {
      if (dateStr) setLastViewedDate(new Date(dateStr));
    });
  }, []);

  React.useEffect(() => {
    if (activeTab === 'Announcements') {
      const now = new Date();
      setLastViewedDate(now);
      SecureStore.setItemAsync('lastViewedAnnouncement', now.toISOString());
    }
  }, [activeTab, announcements]);

  const unreadCount = activeTab === 'Announcements' ? 0 : announcements.filter(a => new Date(a.date) > lastViewedDate).length;

  const fetchComplaints = async (pageNum = 1, append = false, currentSearch = searchQuery, currentCategory = selectedCategory) => {
    try {
      if (!append) setLoading(true);
      else setLoadingMore(true);

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

  const fetchAnnouncements = async () => {
    try {
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
      fetchComplaints(1, false);
      fetchAnnouncements();
      if (tab === 'Complaints') {
        setActiveTab('Complaints');
      }
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FCFDF6" />
      
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.offlineText}>No Internet Connection - Showing offline data</Text>
        </View>
      )}

      {/* Soft Blue Gradient Banner behind top content */}
      <LinearGradient
        colors={['#DBEAFE', '#FCFDF6']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 350, zIndex: 0 }}
      />

      <ScrollView 
        style={[styles.container, { zIndex: 1 }]} 
        contentContainerStyle={styles.contentContainer} 
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={400}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        
        {/* Title Area */}
        <View style={styles.titleArea}>
          <View style={styles.greetingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingText}>
                {t('resident.hello').replace(',', '')} {user?.name ? user.name.split(' ')[0] : 'Resident'} 👋
              </Text>
              <Text style={styles.exploreText}>{t('resident.exploreSociety')}</Text>
            </View>
            <TouchableOpacity style={styles.avatarContainer} onPress={() => router.push('/resident/settings')}>
              <Ionicons name="person" size={24} color="#1D4ED8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filterScroll, { overflow: 'visible' }]} contentContainerStyle={styles.filterContainer}>
          <TouchableOpacity 
            style={[styles.filterChip, activeTab === 'Complaints' && styles.filterChipActive]}
            onPress={() => setActiveTab('Complaints')}
          >
            <Text style={[styles.filterText, activeTab === 'Complaints' && styles.filterTextActive]}>{t('resident.myComplaints')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterChip, activeTab === 'Announcements' && styles.filterChipActive, { position: 'relative', marginRight: 15, overflow: 'visible' }]}
            onPress={() => setActiveTab('Announcements')}
          >
            <Text style={[styles.filterText, activeTab === 'Announcements' && styles.filterTextActive]}>{t('resident.announcements')}</Text>
            {unreadCount > 0 && (
              <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 12, minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, borderWidth: 2, borderColor: '#FCFDF6', zIndex: 10 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>

        {activeTab === 'Complaints' ? (
          <>
            <View style={{ marginBottom: 16 }}>
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
                <TextInput
                  style={{ flex: 1, height: 40, color: '#111827' }}
                  placeholder="Search complaints..."
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearchQuery(''); fetchComplaints(1, false, '', selectedCategory); }}>
                    <Ionicons name="close-circle" size={20} color="#D1D5DB" />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20, gap: 10 }}>
                {['All', 'Plumbing', 'Electrical', 'Cleaning', 'Security', 'Other'].map(cat => {
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
                    >
                      <Text style={[styles.catChipText, isActive && styles.catChipTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <Text style={styles.sectionTitle}>{t('resident.myComplaints')}</Text>
            
            {loading ? (
              <View style={{ marginTop: 20 }}>
                {[1, 2, 3].map(key => <SkeletonCard key={key} />)}
              </View>
            ) : complaints.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyTextLarge}>{t('resident.noComplaints')}</Text>
              </View>
            ) : (
              complaints.map((item) => (
                <TouchableOpacity key={item._id} style={styles.card} activeOpacity={0.9}>
                  {item.before_image ? (
                    <TouchableOpacity activeOpacity={0.8} onPress={() => setFullScreenImage(item.before_image)} style={styles.imageContainer}>
                      <Image source={{ uri: item.before_image }} style={styles.cardImage} />
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>{item.priority} {t('resident.priority')}</Text>
                      </View>
                    </TouchableOpacity>
                  ) : null}
                  
                  <View style={styles.cardContent}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        <Text style={styles.cardLocation}>{item.location}</Text>
                      </View>
                      {item.status === 'PENDING' && (
                        <TouchableOpacity 
                          style={{ padding: 4, marginLeft: 12 }} 
                          onPress={() => confirmDelete(item._id)}
                        >
                          <Ionicons name="trash-outline" size={22} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                      <Text style={[styles.descText, { marginBottom: 16 }]} numberOfLines={1}>{item.description}</Text>
                      
                      <View style={styles.trackerWrapper}>
                        {/* Background Line */}
                        <View style={styles.trackerBackgroundLine}>
                          {/* Inner Shadow for 3D effect */}
                          <View style={{position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(0,0,0,0.1)'}} />
                          
                          {/* Fill Line */}
                          {(() => {
                            const step = (item.status === 'RESOLVED' || item.status === 'DONE') ? 2 : (item.status === 'IN_PROGRESS' ? 1 : 0);
                            const fillColors = (step === 0 ? ['#FDE68A', '#F59E0B', '#B45309'] : (step === 1 ? ['#93C5FD', '#2563EB', '#1E3A8A'] : ['#6EE7B7', '#10B981', '#047857'])) as readonly [string, string, ...string[]];
                            return (
                              <LinearGradient
                                colors={fillColors}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 0, y: 1 }}
                                style={[styles.trackerFillLine, { width: step === 2 ? '100%' : (step === 1 ? '50%' : '0%') }]}
                              />
                            );
                          })()}
                        </View>
                        
                        {/* Dots & Labels */}
                        <View style={styles.trackerNodes}>
                          {['PENDING', 'IN_PROGRESS', 'RESOLVED'].map((s, idx) => {
                            const step = (item.status === 'RESOLVED' || item.status === 'DONE') ? 2 : (item.status === 'IN_PROGRESS' ? 1 : 0);
                            const isActive = step >= idx;
                            const isCurrent = step === idx;
                            
                            let gradientColors: readonly [string, string, ...string[]] = ['#F3F4F6', '#D1D5DB']; // default inactive
                            if (isActive) {
                              gradientColors = (idx === 0 ? ['#FDE68A', '#F59E0B'] : (idx === 1 ? ['#93C5FD', '#2563EB'] : ['#A7F3D0', '#10B981'])) as readonly [string, string, ...string[]];
                            }
                            
                            let textColor = '#9CA3AF';
                            if (isCurrent) {
                              textColor = idx === 0 ? '#D97706' : (idx === 1 ? '#1D4ED8' : '#059669');
                            }

                            return (
                              <View key={s} style={{ alignItems: 'center' }}>
                                <LinearGradient
                                  colors={gradientColors}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 1 }}
                                  style={[styles.trackerDot, { transform: isCurrent ? [{scale: 1.25}] : [{scale: 1}] }]}
                                >
                                  {idx === 0 && <Ionicons name="time" size={14} color={isActive ? '#FFFFFF' : '#9CA3AF'} />}
                                  {idx === 1 && <Ionicons name="settings" size={14} color={isActive ? '#FFFFFF' : '#9CA3AF'} />}
                                  {idx === 2 && <Ionicons name="checkmark-circle" size={16} color={isActive ? '#FFFFFF' : '#9CA3AF'} />}
                                </LinearGradient>
                                <Text style={[styles.trackerLabel, { color: textColor }]}>
                                  {s === 'IN_PROGRESS' ? 'In Progress' : s.charAt(0) + s.slice(1).toLowerCase()}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
            
            {loadingMore && (
              <View style={{ marginTop: 10 }}>
                {[1, 2].map(key => <SkeletonCard key={key} />)}
              </View>
            )}
          </>
        ) : (
          <>
            {loadingAnnouncements ? (
              <View style={{ marginTop: 20 }}>
                {[1, 2, 3].map(key => <SkeletonCard key={key} />)}
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
          </>
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
            <Text style={styles.deleteModalTitle}>Delete Complaint</Text>
            <Text style={styles.deleteModalText}>
              Are you sure you want to delete this complaint? This action cannot be undone.
            </Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteModalVisible(false)} disabled={isDeleting}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.deleteBtn, isDeleting && { opacity: 0.6 }]} 
                onPress={handleDelete}
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
  safeArea: { flex: 1, backgroundColor: '#FCFDF6' },
  offlineBanner: { backgroundColor: '#EF4444', paddingVertical: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  offlineText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  container: { flex: 1 },
  contentContainer: { paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 20 : 50) : 60, paddingBottom: 120 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, marginRight: 12 },
  badge: { position: 'absolute', top: 10, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  titleArea: { marginBottom: 30, marginTop: 10 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatarContainer: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginLeft: 16, borderWidth: 1, borderColor: '#DBEAFE' },
  greetingText: { fontSize: 16, color: '#6B7280', marginBottom: 6, fontWeight: '600' },
  exploreText: { fontSize: 28, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  filterScroll: { marginBottom: 30, overflow: 'visible' },
  filterContainer: { paddingRight: 40, gap: 12 },
  filterChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', overflow: 'visible' },
  filterChipActive: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  filterText: { fontSize: 15, fontWeight: '600', color: '#4B5563' },
  filterTextActive: { color: '#FFFFFF' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB', height: 44 },
  catChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  catChipActive: { backgroundColor: '#1E3A8A', borderColor: '#1E3A8A' },
  catChipText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  catChipTextActive: { color: '#FFFFFF' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 12, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 4 },
  imageContainer: { width: '100%', height: 160, borderRadius: 16, overflow: 'hidden', marginBottom: 12, position: 'relative' },
  cardImage: { width: '100%', height: 180 },
  tag: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  tagText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  cardContent: { padding: 20 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 6 },
  cardLocation: { fontSize: 14, color: '#6B7280', marginBottom: 12, fontWeight: '500' },
  descText: { fontSize: 14, color: '#4B5563' },
  trackerWrapper: { position: 'relative', marginVertical: 8, paddingHorizontal: 4 },
  trackerBackgroundLine: { 
    position: 'absolute', top: 10, left: 24, right: 24, height: 8, 
    backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
    borderWidth: 1, borderColor: '#D1D5DB'
  },
  trackerFillLine: { height: '100%', borderRadius: 4 },
  trackerNodes: { flexDirection: 'row', justifyContent: 'space-between' },
  trackerDot: { 
    width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)'
  },
  trackerDotInner: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.4, shadowRadius: 1, elevation: 2
  },
  trackerLabel: { fontSize: 11, fontWeight: '800', marginTop: 10, letterSpacing: 0.2 },
  emptyText: { textAlign: 'center', color: '#6B7280', fontSize: 16, marginTop: 20 },
  emptyStateContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyTextLarge: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 16, textAlign: 'center' },
  emptyTextSub: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 22 },
  
  // Custom Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  deleteModalContainer: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  deleteIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  deleteModalTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 8 },
  deleteModalText: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  deleteModalActions: { flexDirection: 'row', width: '100%', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '700', color: '#4B5563' },
  deleteBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: '#EF4444', alignItems: 'center' },
  deleteBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  
  // Full screen image styles
  fullScreenImageContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullScreenImage: { width: '100%', height: '100%' },
  closeImageBtn: { position: 'absolute', top: Platform.OS === 'android' ? 40 : 60, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
});
