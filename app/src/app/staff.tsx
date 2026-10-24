import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, StatusBar, ActivityIndicator, Alert, RefreshControl, Modal, TextInput, Platform, BackHandler, KeyboardAvoidingView, Keyboard, FlatList, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

import { getNextLanguage, getLanguageDisplayName } from '../utils/localization';
import { walkthroughable, CopilotStep, useCopilot } from 'react-native-copilot';

const WalkthroughableTouchableOpacity = walkthroughable(TouchableOpacity);

export default function StaffScreen() {
  const { start } = useCopilot();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>(['All', 'Electricity', 'Garbage', 'Sweeping', 'Sewage cleaning', 'Rainwater drainage', 'Tree cutting', 'Street light', 'Water service']);
  const [activeTab, setActiveTab] = useState<'Tasks' | 'Broadcasts' | 'Announcements'>('Tasks');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const toggleLanguage = async () => {
    const newLang = getNextLanguage(i18n.language);
    await i18n.changeLanguage(newLang);
    await AsyncStorage.setItem('user-language', newLang);
  };
  const [loading, setLoading] = useState(true);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({ pending: 0, inProgress: 0, resolved: 0 });

  // Staff Banners State
  const [banners, setBanners] = useState<any[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerFlatListRef = React.useRef<FlatList>(null);
  const [bannerCardWidth, setBannerCardWidth] = useState(Dimensions.get('window').width - 40);

  const fetchBanners = async () => {
    try {
      const res = await axios.get(`${API_URL}/staff-banners`);
      if (Array.isArray(res.data) && res.data.length > 0) {
        setBanners(res.data);
      } else {
        const fallback = await axios.get(`${API_URL}/banners?type=staff`);
        if (Array.isArray(fallback.data) && fallback.data.length > 0) {
          setBanners(fallback.data);
        } else {
          setBanners([]);
        }
      }
    } catch (e) {
      try {
        const fallback = await axios.get(`${API_URL}/banners?type=staff`);
        if (Array.isArray(fallback.data) && fallback.data.length > 0) {
          setBanners(fallback.data);
        } else {
          setBanners([]);
        }
      } catch (err) {
        console.log('Error fetching staff banners:', err);
      }
    }
  };

  useEffect(() => {
    if (banners.length > 1) {
      const currentBanner = banners[bannerIndex];
      const durationSec = Number(currentBanner?.duration) > 0 ? Number(currentBanner.duration) : 4;
      const durationMs = durationSec * 1000;

      const timer = setTimeout(() => {
        const nextIndex = bannerIndex >= banners.length - 1 ? 0 : bannerIndex + 1;
        setBannerIndex(nextIndex);
        if (bannerCardWidth > 0 && bannerFlatListRef.current) {
          bannerFlatListRef.current.scrollToOffset({
            offset: nextIndex * bannerCardWidth,
            animated: true,
          });
        }
      }, durationMs);

      return () => clearTimeout(timer);
    }
  }, [banners, bannerIndex, bannerCardWidth]);

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        BackHandler.exitApp();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      SecureStore.getItemAsync('hasViewedStaffTour').then((data) => {
        if (!data && start) {
          setTimeout(() => {
            start();
            SecureStore.setItemAsync('hasViewedStaffTour', 'true');
          }, 500);
        }
      });
      
      return () => sub.remove();
    }, [])
  );

  // Modal State for Dropdown
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);

  // Broadcast State
  const [broadcastModalVisible, setBroadcastModalVisible] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState<'All' | 'Members'>('All');
  const [broadcastImage, setBroadcastImage] = useState<string | null>(null);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Delete Modal State
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [broadcastToDelete, setBroadcastToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Full Screen Image State
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
      fetchComplaints(searchQuery, selectedCategory, selectedStatus);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const fetchUserProfile = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) return;
      const res = await axios.get(`${API_URL}/users/me`, {
        headers: { 'x-auth-token': token }
      });
      const updatedUser = res.data;
      await SecureStore.setItemAsync('userData', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (err) {
      console.error('Fetch user profile error:', err);
    }
  };

  const fetchComplaints = async (currentSearch = searchQuery, currentCategory = selectedCategory, currentStatus = selectedStatus) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const userDataStr = await SecureStore.getItemAsync('userData');
      let userData = null;
      if (userDataStr) {
        userData = JSON.parse(userDataStr);
        setUser(userData);
      }
      const res = await axios.get(`${API_URL}/complaints?all=true&stats=true${currentSearch ? `&search=${encodeURIComponent(currentSearch)}` : ''}${currentCategory ? `&category=${encodeURIComponent(currentCategory)}` : ''}${currentStatus !== 'ALL' ? `&status=${currentStatus}` : ''}`, {
        headers: { 'x-auth-token': token }
      });
      
      const sortComplaints = (list: any[]) => {
        return [...list].sort((a, b) => {
          // Only active escalated complaints (NOT DONE / NOT RESOLVED) show first
          const isAActiveEscalated = a.is_escalated && a.status !== 'DONE' && a.status !== 'RESOLVED';
          const isBActiveEscalated = b.is_escalated && b.status !== 'DONE' && b.status !== 'RESOLVED';
          if (isAActiveEscalated && !isBActiveEscalated) return -1;
          if (!isAActiveEscalated && isBActiveEscalated) return 1;

          const statusOrder: Record<string, number> = { 'PENDING': 1, 'IN_PROGRESS': 2, 'RESOLVED': 3, 'DONE': 3 };
          const orderA = statusOrder[a.status] || 4;
          const orderB = statusOrder[b.status] || 4;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });
      };

      let fetchedComplaints = [];
      let fetchedStats = { pending: 0, inProgress: 0, resolved: 0 };
      if (res.data && res.data.complaints) {
        fetchedComplaints = res.data.complaints;
        fetchedStats = res.data.stats || { pending: 0, inProgress: 0, resolved: 0 };
      } else if (Array.isArray(res.data)) {
        fetchedComplaints = res.data;
        
        const cachedStatsStr = await AsyncStorage.getItem('cached_staff_stats');
        let fallbackStats = { pending: 0, inProgress: 0, resolved: 0 };
        if (cachedStatsStr) {
          try { fallbackStats = JSON.parse(cachedStatsStr); } catch (e) {}
        }
        
        // If we are viewing ALL statuses, we can recalculate the stats from the array
        if (currentStatus === 'ALL') {
          fallbackStats = {
            pending: fetchedComplaints.filter((c: any) => c.status === 'PENDING').length,
            inProgress: fetchedComplaints.filter((c: any) => c.status === 'IN_PROGRESS').length,
            resolved: fetchedComplaints.filter((c: any) => c.status === 'RESOLVED' || c.status === 'DONE').length
          };
        }
        
        fetchedStats = fallbackStats;
      }
      
      setStats(fetchedStats);
      AsyncStorage.setItem('cached_staff_stats', JSON.stringify(fetchedStats));

      if (fetchedComplaints.length >= 0) {
        const sortedData = sortComplaints(fetchedComplaints);
        setComplaints(sortedData);
        AsyncStorage.setItem('cached_staff_complaints', JSON.stringify(sortedData));
      }
      setIsOffline(false);
    } catch (err) {
      console.error('Fetch complaints error:', err);
      const cachedStr = await AsyncStorage.getItem('cached_staff_complaints');
      const cachedStatsStr = await AsyncStorage.getItem('cached_staff_stats');
      if (cachedStatsStr) {
        try { setStats(JSON.parse(cachedStatsStr)); } catch (e) {}
      }
      if (cachedStr) {
        const parsedCache = JSON.parse(cachedStr);
        setComplaints(Array.isArray(parsedCache) ? parsedCache : []);
        setIsOffline(true);
      } else {
        setComplaints([]);
      }
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

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const datePart = d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      const timePart = d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      return `${datePart} • ${timePart}`;
    } catch (e) {
      return dateStr;
    }
  };

  const fetchFilterCategories = async () => {
    try {
      const userDataStr = await SecureStore.getItemAsync('userData');
      let allowedCats = new Set<string>();
      let hasAllAccess = false;
      
      if (userDataStr) {
        const u = JSON.parse(userDataStr);
        if (u.assigned_category && u.assigned_category.toLowerCase() !== 'all complaints') {
          u.assigned_category.split(',').forEach((c: string) => allowedCats.add(c.trim()));
        } else if (u.assigned_category?.toLowerCase() === 'all complaints') {
          hasAllAccess = true;
        }
        
        if (u.accounts) {
          u.accounts.forEach((acc: any) => {
            if (acc.role === 'Staff') {
              if (acc.assigned_category && acc.assigned_category.toLowerCase() !== 'all complaints') {
                acc.assigned_category.split(',').forEach((c: string) => allowedCats.add(c.trim()));
              } else if (acc.assigned_category?.toLowerCase() === 'all complaints') {
                hasAllAccess = true;
              }
            }
          });
        }
      }

      const res = await axios.get(`${API_URL}/categories`);
      if (res.data && res.data.length > 0) {
        res.data.forEach((c: any) => {
          if (c.title && c.title_hi) {
            i18n.addResource('hi', 'translation', `categories.${c.title}`, c.title_hi);
          }
        });
        let catTitles = res.data.map((c: any) => c.title);
        if (!hasAllAccess && allowedCats.size > 0) {
          catTitles = catTitles.filter((c: string) => allowedCats.has(c));
        } else if (!hasAllAccess && allowedCats.size === 0) {
          catTitles = [];
        }
        setFilterCategories(['All', ...catTitles]);
      }
    } catch (err) {
      console.error('Fetch categories error:', err);
    }
  };

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.on('complaint_changed', () => {
      fetchComplaints();
    });
    socket.on('announcement_changed', () => {
      fetchAnnouncements();
    });
    socket.on('categories_updated', () => {
      fetchFilterCategories();
    });
    socket.on('staff_banner_changed', () => {
      fetchBanners();
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  const hasFetchedRef = React.useRef(false);
  useFocusEffect(
    React.useCallback(() => {
      const init = async () => {
        if (!hasFetchedRef.current) {
          hasFetchedRef.current = true;
          await fetchUserProfile();
          fetchComplaints();
          fetchAnnouncements();
          fetchFilterCategories();
          fetchBanners();
        }
      };
      init();
      import('../services/pushNotifications').then(({ clearAppBadge }) => clearAppBadge());
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserProfile();
    fetchComplaints();
    fetchAnnouncements();
    fetchFilterCategories();
    fetchBanners();
  };

  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const updateStatus = async (newStatus: string) => {
    if (!selectedComplaintId || updatingStatus) return;
    
    setUpdatingStatus(newStatus);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      await axios.patch(`${API_URL}/complaints/${selectedComplaintId}`, { status: newStatus }, {
        headers: { 'x-auth-token': token }
      });
      setModalVisible(false);
      Toast.show({
        type: 'success',
        text1: 'Status Updated',
        text2: `Task marked as ${newStatus.replace('_', ' ')}`
      });
      fetchComplaints(); // Refresh list after update
    } catch (err) {
      console.error('Update status error:', err);
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: 'Could not update status'
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const openStatusDropdown = (id: string) => {
    setSelectedComplaintId(id);
    setModalVisible(true);
  };

  const handleBroadcast = async () => {
    if (!broadcastTitle || !broadcastMessage) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Title and Message are required' });
      return;
    }

    try {
      setSendingBroadcast(true);
      const token = await SecureStore.getItemAsync('userToken');
      await axios.post(`${API_URL}/announcements`, 
        { 
          title: broadcastTitle, 
          message: broadcastMessage, 
          targetAudience: broadcastTarget, 
          image: broadcastImage,
          targetLocations: user?.assigned_locations || []
        },
        { headers: { 'x-auth-token': token } }
      );
      setBroadcastModalVisible(false);
      setBroadcastTitle('');
      setBroadcastMessage('');
      setBroadcastTarget('All');
      setBroadcastImage(null);
      const targetMsg = broadcastTarget === 'Members' ? 'RWA (Members)' : 'All Residents';
      Toast.show({ type: 'success', text1: 'Broadcast Sent', text2: `Your message has been sent to ${targetMsg}` });
      fetchAnnouncements(); // Refresh the broadcasts list
    } catch (err) {
      console.error('Broadcast error:', err);
      Toast.show({ type: 'error', text1: 'Broadcast Failed', text2: 'Could not send broadcast' });
    } finally {
      setSendingBroadcast(false);
    }
  };

  const pickBroadcastImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setBroadcastImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const confirmDeleteBroadcast = (id: string) => {
    setBroadcastToDelete(id);
    setDeleteModalVisible(true);
  };

  const executeDeleteBroadcast = async () => {
    if (!broadcastToDelete) return;
    setIsDeleting(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      await axios.delete(`${API_URL}/announcements/${broadcastToDelete}`, {
        headers: { 'x-auth-token': token }
      });
      Toast.show({ type: 'success', text1: 'Deleted', text2: 'Broadcast removed successfully' });
      // Delete locally instantly
      setAnnouncements(prev => prev.filter(a => a._id !== broadcastToDelete));
      setDeleteModalVisible(false);
      setBroadcastToDelete(null);
    } catch (err) {
      console.error('Delete broadcast error:', err);
      Toast.show({ type: 'error', text1: 'Delete Failed', text2: 'Could not delete broadcast' });
      setDeleteModalVisible(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.offlineText}>No Internet Connection - Showing offline data</Text>
        </View>
      )}

      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header matched with Resident Theme */}
        <View style={styles.header}>
          <TouchableOpacity onPress={toggleLanguage} style={styles.langToggle}>
            <Text style={styles.langToggleText}>{getLanguageDisplayName(i18n.language)}</Text>
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <CopilotStep text="यहाँ से आप अपनी प्रोफ़ाइल, भाषा और सेटिंग्स मैनेज कर सकते हैं।" order={3} name="staff_settings">
              <WalkthroughableTouchableOpacity style={styles.iconBtn} onPress={() => router.push('/staff-settings')}>
                <Ionicons name="settings-outline" size={24} color="#3B82F6" />
              </WalkthroughableTouchableOpacity>
            </CopilotStep>
          </View>
        </View>

        {/* Title Area */}
        <View style={styles.titleArea}>
          <Text style={styles.title}>{t('staff.portal')}</Text>
          <Text style={styles.subtitle}>{t('resident.hello', { defaultValue: 'Welcome,' })} {user?.name?.split(' ')[0] || 'Staff'}</Text>
          
          {/* Dynamic Staff Banner */}
          <View 
            style={{ marginBottom: 16 }}
            onLayout={(e) => setBannerCardWidth(e.nativeEvent.layout.width)}
          >
            {banners.length > 0 ? (
              banners.length === 1 ? (
                <View style={{ borderRadius: 16, overflow: 'hidden', height: 160, backgroundColor: '#0F172A', position: 'relative' }}>
                  <Image 
                    source={{ uri: banners[0].url }} 
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                  {banners[0].title ? (
                    <LinearGradient
                      colors={['transparent', 'rgba(15, 23, 42, 0.85)']}
                      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 14, paddingVertical: 10 }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                        {banners[0].title}
                      </Text>
                    </LinearGradient>
                  ) : null}
                </View>
              ) : (
                <View style={{ borderRadius: 16, overflow: 'hidden', height: 160, backgroundColor: '#0F172A', position: 'relative' }}>
                  <FlatList
                    ref={bannerFlatListRef}
                    data={banners}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item._id}
                    getItemLayout={(_, index) => ({
                      length: bannerCardWidth,
                      offset: bannerCardWidth * index,
                      index,
                    })}
                    onMomentumScrollEnd={(e) => {
                      const idx = Math.round(e.nativeEvent.contentOffset.x / bannerCardWidth);
                      setBannerIndex(idx);
                    }}
                    renderItem={({ item }) => (
                      <View style={{ width: bannerCardWidth, height: 160, position: 'relative' }}>
                        <Image 
                          source={{ uri: item.url }} 
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                        />
                        {item.title ? (
                          <LinearGradient
                            colors={['transparent', 'rgba(15, 23, 42, 0.85)']}
                            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 14, paddingVertical: 10 }}
                          >
                            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                              {item.title}
                            </Text>
                          </LinearGradient>
                        ) : null}
                      </View>
                    )}
                  />
                  {/* Carousel Dots */}
                  <View style={{ position: 'absolute', bottom: 8, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
                    {banners.map((_, i) => (
                      <View 
                        key={i} 
                        style={{
                          width: bannerIndex === i ? 18 : 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: bannerIndex === i ? '#38BDF8' : 'rgba(255, 255, 255, 0.5)',
                        }}
                      />
                    ))}
                  </View>
                </View>
              )
            ) : (
              <View style={{ alignItems: 'center' }}>
                <Image 
                  source={require('../../assets/image.png')} 
                  style={{ width: '100%', height: 160, borderRadius: 16, resizeMode: 'cover' }}
                />
              </View>
            )}
          </View>
          
          {user && (
            <View style={styles.assignmentBox}>
              <View style={styles.infoRow}>
                <Ionicons name="location" size={16} color="#3B82F6" />
                <Text style={styles.infoText}>
                  {(() => {
                    if (Array.isArray(user.assigned_locations) && user.assigned_locations.length > 0) {
                      return user.assigned_locations.map((loc: any) => {
                        const isAll = !loc.blocks || loc.blocks.length === 0 || loc.blocks.includes('ALL') || loc.blocks.includes('All Blocks');
                        const blks = isAll ? 'All Blocks' : loc.blocks.join(', ');
                        return `${loc.phase}: ${blks}`;
                      }).join(' | ');
                    }
                    if (user.phase && user.address) return `${user.phase}: ${user.address}`;
                    if (user.phase) return user.phase;
                    if (user.address) return user.address;
                    return t('staff.allLocations', { defaultValue: 'All Locations' });
                  })()}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="pricetag" size={16} color="#10B981" />
                <Text style={styles.infoText}>{user.assigned_category === 'All Complaints' ? t('staff.allComplaints', { defaultValue: 'All Complaints' }) : (user.assigned_category || t('staff.allComplaints', { defaultValue: 'All Complaints' }))}</Text>
              </View>
              {user.accounts?.filter((acc: any) => acc.role === 'Staff').map((acc: any, idx: number) => (
                <View key={idx} style={styles.extraAccountBox}>
                  <View style={styles.infoRow}>
                    <Ionicons name="location" size={16} color="#3B82F6" />
                    <Text style={styles.infoText}>
                      {(() => {
                        if (acc.phase && acc.address) return `${acc.phase}: ${acc.address}`;
                        if (acc.phase) return acc.phase;
                        if (acc.address) return acc.address;
                        return t('staff.allLocations', { defaultValue: 'All Locations' });
                      })()}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="pricetag" size={16} color="#10B981" />
                    <Text style={styles.infoText}>{acc.assigned_category === 'All Complaints' ? t('staff.allComplaints', { defaultValue: 'All Complaints' }) : (acc.assigned_category || t('staff.allComplaints', { defaultValue: 'All Complaints' }))}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {user && (
            <View style={styles.statsBanner}>
              <TouchableOpacity 
                style={[styles.statItem, selectedStatus === 'PENDING' && { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}
                activeOpacity={0.7}
                onPress={() => {
                  const newStatus = selectedStatus === 'PENDING' ? 'ALL' : 'PENDING';
                  setSelectedStatus(newStatus);
                  setLoading(true);
                  fetchComplaints(searchQuery, selectedCategory, newStatus);
                  setActiveTab('Tasks');
                }}
              >
                <Text style={[styles.statNumber, { color: '#F59E0B' }]}>{stats.pending}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.statItem, selectedStatus === 'IN_PROGRESS' && { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
                activeOpacity={0.7}
                onPress={() => {
                  const newStatus = selectedStatus === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS';
                  setSelectedStatus(newStatus);
                  setLoading(true);
                  fetchComplaints(searchQuery, selectedCategory, newStatus);
                  setActiveTab('Tasks');
                }}
              >
                <Text style={[styles.statNumber, { color: '#3B82F6' }]}>{stats.inProgress}</Text>
                <Text style={styles.statLabel}>In Progress</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.statItem, selectedStatus === 'RESOLVED' && { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
                activeOpacity={0.7}
                onPress={() => {
                  const newStatus = selectedStatus === 'RESOLVED' ? 'ALL' : 'RESOLVED';
                  setSelectedStatus(newStatus);
                  setLoading(true);
                  fetchComplaints(searchQuery, selectedCategory, newStatus);
                  setActiveTab('Tasks');
                }}
              >
                <Text style={[styles.statNumber, { color: '#10B981' }]}>{stats.resolved}</Text>
                <Text style={styles.statLabel}>Resolved</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContainer}>
          <CopilotStep text="यहाँ आप अपने सभी असाइन किए गए कार्य (tasks) देख और मैनेज कर सकते हैं।" order={1} name="tasks_tab">
            <WalkthroughableTouchableOpacity 
              style={[styles.filterChip, activeTab === 'Tasks' && styles.filterChipActive]}
              onPress={() => setActiveTab('Tasks')}
            >
              <Text style={[styles.filterText, activeTab === 'Tasks' && styles.filterTextActive]}>{t('staff.assignedTasks')}</Text>
            </WalkthroughableTouchableOpacity>
          </CopilotStep>
          <CopilotStep text="एडमिन या मैनेजमेंट से आई घोषणाएं यहाँ देखें।" order={2} name="announcements_tab">
            <WalkthroughableTouchableOpacity 
              style={[styles.filterChip, activeTab === 'Announcements' && styles.filterChipActive]}
              onPress={() => setActiveTab('Announcements')}
            >
              <Text style={[styles.filterText, activeTab === 'Announcements' && styles.filterTextActive]}>{t('resident.announcements', { defaultValue: 'Announcements' })}</Text>
            </WalkthroughableTouchableOpacity>
          </CopilotStep>
          <CopilotStep text="निवासियों को ज़रूरी अपडेट या घोषणाएँ भेजने के लिए इसका उपयोग करें।" order={3} name="broadcasts_tab">
            <WalkthroughableTouchableOpacity 
              style={[styles.filterChip, activeTab === 'Broadcasts' && styles.filterChipActive]}
              onPress={() => setActiveTab('Broadcasts')}
            >
              <Text style={[styles.filterText, activeTab === 'Broadcasts' && styles.filterTextActive]}>{t('staff.myBroadcasts', { defaultValue: 'My Broadcasts' })}</Text>
            </WalkthroughableTouchableOpacity>
          </CopilotStep>
        </ScrollView>

        {activeTab === 'Tasks' ? (
          <>
            <View style={{ marginBottom: 16 }}>
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={20} color="#94A3B8" style={{ marginRight: 8 }} />
                <TextInput
                  style={{ flex: 1, height: 40, color: '#111827' }}
                  placeholder={t('staff.searchTasks', { defaultValue: 'Search tasks...' })}
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearchQuery(''); fetchComplaints('', selectedCategory, selectedStatus); }}>
                    <Ionicons name="close-circle" size={20} color="#D1D5DB" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Status Filter - Segmented Control */}
              <View style={styles.statusContainer}>
                {['ALL', 'PENDING', 'IN_PROGRESS', 'RESOLVED'].map(status => {
                  const isActive = selectedStatus === status;
                  const label = status === 'ALL' ? 'All' : status.replace('_', ' ');
                  return (
                    <TouchableOpacity 
                      key={status}
                      style={[styles.statusTab, isActive && styles.statusTabActive]}
                      onPress={() => {
                        setSelectedStatus(status);
                        setLoading(true);
                        fetchComplaints(searchQuery, selectedCategory, status);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.statusTabText, isActive && styles.statusTabTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20, paddingVertical: 15, gap: 10 }}>
                {filterCategories.map(cat => {
                  const isActive = (cat === 'All' && selectedCategory === '') || cat === selectedCategory;
                  return (
                    <TouchableOpacity 
                      key={cat} 
                      style={[styles.catChip, isActive && styles.catChipActive]}
                      onPress={() => {
                        const newCat = cat === 'All' ? '' : cat;
                        setSelectedCategory(newCat);
                        setLoading(true);
                        fetchComplaints(searchQuery, newCat, selectedStatus);
                      }}
                    >
                      <Text style={[styles.catChipText, isActive && styles.catChipTextActive]}>{cat === 'All' ? 'All' : t(`categories.${cat}`, { defaultValue: cat })}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color="#1D4ED8" style={{ marginTop: 40 }} />
            ) : complaints.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Ionicons name="checkmark-circle-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyTextLarge}>{t('staff.noTasks')}</Text>
              </View>
            ) : (
              complaints.map((item) => (
                <TouchableOpacity 
                  key={item._id} 
                  style={[
                    styles.card,
                    item.is_escalated && { borderColor: '#EF4444', borderWidth: 1.5, backgroundColor: '#FFF5F5' }
                  ]}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/task-details?id=${item._id}`)}
                >
                  {/* Escalated Header Banner for Staff */}
                  {item.is_escalated && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#FCA5A5', marginBottom: 10, gap: 6 }}>
                      <Ionicons name="flame" size={15} color="#DC2626" />
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#DC2626', letterSpacing: 0.5 }}>
                        ESCALATED
                      </Text>
                      {(item.escalated_by_name || item.escalated_by?.name) && (
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#991B1B', marginLeft: 'auto' }}>
                          By: {item.escalated_by_name || item.escalated_by?.name}
                        </Text>
                      )}
                    </View>
                  )}

                  <View style={[styles.cardHeader, { marginBottom: 10 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#E0E7FF' }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#4338CA', letterSpacing: 0.5 }}>
                          {item.complaint_id || `#AH-${item._id?.slice(-5).toUpperCase()}`}
                        </Text>
                      </View>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.priority}</Text>
                      </View>
                    </View>
                    <Text style={[
                      styles.statusText, 
                      item.status === 'PENDING' ? { color: '#F59E0B' } : 
                      item.status === 'IN_PROGRESS' ? { color: '#3B82F6' } : { color: '#10B981' }
                    ]}>
                      ● {item.status === 'DONE' ? 'RESOLVED' : item.status.replace('_', ' ')}
                    </Text>
                  </View>

                  <Text style={styles.cardTitle}>{t(`categories.${item.title}`, { defaultValue: item.title })}</Text>
                  
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={16} color="#6B7280" />
                    <Text style={styles.cardLocation}>{item.location}</Text>
                  </View>

                  <Text style={styles.descText}>{item.description}</Text>

                  {item.before_image ? (
                    <TouchableOpacity activeOpacity={0.8} onPress={() => setFullScreenImage(item.before_image)} style={styles.imageContainer}>
                      <Image source={{ uri: item.before_image }} style={styles.cardImage} />
                    </TouchableOpacity>
                  ) : null}

                  {/* Action Dropdown Button */}
                  <TouchableOpacity 
                    style={styles.dropdownBtn}
                    onPress={() => openStatusDropdown(item._id)}
                  >
                    <Text style={styles.dropdownBtnText}>{t('staff.updateStatus')}</Text>
                    <Ionicons name="chevron-down" size={20} color="#111827" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )}
          </>
        ) : activeTab === 'Announcements' ? (
          <>
            {(() => {
              const filteredAnnouncements = announcements.filter(item => {
                const uid = user?._id || user?.id;
                const cid = item?.createdBy?._id || item?.createdBy?.id || item?.createdBy;
                return !uid || !cid || String(uid) !== String(cid);
              });

              if (loadingAnnouncements) {
                return <ActivityIndicator size="large" color="#1D4ED8" style={{ marginTop: 40 }} />;
              }

              if (filteredAnnouncements.length === 0) {
                return (
                  <View style={styles.emptyStateContainer}>
                    <Ionicons name="megaphone-outline" size={64} color="#D1D5DB" />
                    <Text style={styles.emptyTextLarge}>{t('resident.noAnnouncements', { defaultValue: 'No Announcements' })}</Text>
                    <Text style={styles.emptyTextSub}>{t('staff.noAnnouncementsSub', { defaultValue: 'You have no new announcements from management.' })}</Text>
                  </View>
                );
              }

              return filteredAnnouncements.map((item) => (
                <View key={item._id} style={[styles.card, { padding: 16 }]}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 }}>{item.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 }}>
                    <Ionicons name="time-outline" size={13} color="#6B7280" />
                    <Text style={{ fontSize: 12, color: '#6B7280' }}>{formatDateTime(item.date || item.createdAt)}</Text>
                  </View>
                  <Text style={{ fontSize: 15, color: '#4B5563', lineHeight: 22 }}>{item.message}</Text>
                  {item.image && (
                    <TouchableOpacity activeOpacity={0.8} onPress={() => setFullScreenImage(item.image)}>
                      <Image source={{ uri: item.image }} style={{ width: '100%', height: 200, borderRadius: 12, marginTop: 12, backgroundColor: '#E2E8F0' }} resizeMode="cover" />
                    </TouchableOpacity>
                  )}
                </View>
              ));
            })()}
          </>
        ) : (
          <>
            {(() => {
              const filteredAnnouncements = announcements.filter(item => {
                const uid = user?._id || user?.id;
                const cid = item?.createdBy?._id || item?.createdBy?.id || item?.createdBy;
                return uid && cid && String(uid) === String(cid);
              });

              if (loadingAnnouncements) {
                return <ActivityIndicator size="large" color="#1D4ED8" style={{ marginTop: 40 }} />;
              }

              if (filteredAnnouncements.length === 0) {
                return (
                  <View style={styles.emptyStateContainer}>
                    <Ionicons name="megaphone-outline" size={64} color="#D1D5DB" />
                    <Text style={styles.emptyTextLarge}>{t('staff.noBroadcasts', { defaultValue: 'No broadcasts sent yet.' })}</Text>
                    <Text style={styles.emptyTextSub}>{t('staff.noBroadcastsSub', { defaultValue: "You haven't sent any messages to the residents. Tap the button below to send your first message." })}</Text>
                  </View>
                );
              }

              return filteredAnnouncements.map((item) => (
                <View key={item._id} style={[styles.card, { padding: 16 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6, flex: 1 }}>{item.title}</Text>
                    <TouchableOpacity onPress={() => confirmDeleteBroadcast(item._id)} style={{ padding: 4, backgroundColor: '#FEE2E2', borderRadius: 8 }}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 }}>
                    <Ionicons name="time-outline" size={13} color="#6B7280" />
                    <Text style={{ fontSize: 12, color: '#6B7280' }}>{formatDateTime(item.date || item.createdAt)}</Text>
                  </View>
                  <Text style={{ fontSize: 15, color: '#4B5563', lineHeight: 22 }}>{item.message}</Text>
                  {item.image && (
                    <TouchableOpacity activeOpacity={0.8} onPress={() => setFullScreenImage(item.image)}>
                      <Image source={{ uri: item.image }} style={{ width: '100%', height: 200, borderRadius: 12, marginTop: 12, backgroundColor: '#E2E8F0' }} resizeMode="cover" />
                    </TouchableOpacity>
                  )}
                </View>
              ));
            })()}
          </>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Status Selection Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('staff.updateStatus')}</Text>
            
            <TouchableOpacity style={styles.modalOption} onPress={() => updateStatus('PENDING')} disabled={!!updatingStatus}>
              {updatingStatus === 'PENDING' ? <ActivityIndicator size="small" color="#F59E0B" /> : <Ionicons name="time-outline" size={24} color="#F59E0B" />}
              <Text style={styles.modalOptionText}>{t('staff.pending')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.modalOption} onPress={() => updateStatus('IN_PROGRESS')} disabled={!!updatingStatus}>
              {updatingStatus === 'IN_PROGRESS' ? <ActivityIndicator size="small" color="#3B82F6" /> : <Ionicons name="construct-outline" size={24} color="#3B82F6" />}
              <Text style={styles.modalOptionText}>{t('staff.inProgress')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.modalOption} onPress={() => updateStatus('DONE')} disabled={!!updatingStatus}>
              {updatingStatus === 'DONE' ? <ActivityIndicator size="small" color="#10B981" /> : <Ionicons name="checkmark-circle-outline" size={24} color="#10B981" />}
              <Text style={styles.modalOptionText}>{t('staff.resolved')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.modalOption, { borderBottomWidth: 0, marginTop: 8 }]} onPress={() => setModalVisible(false)}>
              <Text style={{ fontSize: 16, color: '#6B7280', fontWeight: '600', textAlign: 'center', width: '100%' }}>{t('staff.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Broadcast Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={broadcastModalVisible}
        onRequestClose={() => setBroadcastModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={{ flex: 1 }}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => {
              Keyboard.dismiss();
            }}
          >
            <TouchableOpacity 
              activeOpacity={1} 
              style={styles.broadcastModalContent}
              onPress={() => Keyboard.dismiss()}
            >
            <View style={styles.broadcastHeader}>
              <Text style={styles.modalTitle}>{t('staff.newAnnouncement', { defaultValue: 'New Announcement' })}</Text>
              <TouchableOpacity onPress={() => setBroadcastModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.broadcastHelpText}>{t('staff.chooseAudience', { defaultValue: 'Choose who should receive this announcement.' })}</Text>

            {/* Target Society Groups & Blocks Indicator */}
            <View style={{ marginBottom: 14, padding: 10, backgroundColor: '#EFF6FF', borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                <Ionicons name="location" size={14} color="#1D4ED8" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#1D4ED8' }}>
                  Target Groups & Blocks:
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: '#1E3A8A', lineHeight: 16 }}>
                {Array.isArray(user?.assigned_locations) && user.assigned_locations.length > 0
                  ? user.assigned_locations.map((l: any) => `${l.phase}: ${(!l.blocks || l.blocks.length === 0 || l.blocks.includes('ALL')) ? 'All Blocks' : `Block ${l.blocks.join(', ')}`}`).join(' | ')
                  : (user?.phase || 'All Assigned Locations')}
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', marginBottom: 16, backgroundColor: '#F3F4F6', borderRadius: 8, padding: 4 }}>
              <TouchableOpacity 
                style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: broadcastTarget === 'All' ? '#FFFFFF' : 'transparent', borderRadius: 6, shadowColor: broadcastTarget === 'All' ? '#000' : 'transparent', shadowOpacity: 0.1, shadowRadius: 2, elevation: broadcastTarget === 'All' ? 2 : 0 }}
                onPress={() => setBroadcastTarget('All')}
              >
                <Text style={{ fontWeight: broadcastTarget === 'All' ? '600' : '500', color: broadcastTarget === 'All' ? '#111827' : '#6B7280' }}>{t('staff.residentAll', { defaultValue: 'Resident (All)' })}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: broadcastTarget === 'Members' ? '#FFFFFF' : 'transparent', borderRadius: 6, shadowColor: broadcastTarget === 'Members' ? '#000' : 'transparent', shadowOpacity: 0.1, shadowRadius: 2, elevation: broadcastTarget === 'Members' ? 2 : 0 }}
                onPress={() => setBroadcastTarget('Members')}
              >
                <Text style={{ fontWeight: broadcastTarget === 'Members' ? '600' : '500', color: broadcastTarget === 'Members' ? '#111827' : '#6B7280' }}>{t('staff.rwaMembers', { defaultValue: 'RWA (Members)' })}</Text>
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.input}
              placeholder={t('staff.broadcastTitle', { defaultValue: 'Broadcast Title (e.g., Power Outage)' })}
              value={broadcastTitle}
              onChangeText={setBroadcastTitle}
              placeholderTextColor="#9CA3AF"
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('staff.messageDetails', { defaultValue: 'Message details...' })}
              value={broadcastMessage}
              onChangeText={setBroadcastMessage}
              multiline
              numberOfLines={4}
              placeholderTextColor="#9CA3AF"
            />
            
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>{t('staff.imageOptional', { defaultValue: 'Image (Optional)' })}</Text>
              {broadcastImage ? (
                <View style={{ position: 'relative' }}>
                  <Image source={{ uri: broadcastImage }} style={{ width: '100%', height: 150, borderRadius: 12, backgroundColor: '#E2E8F0' }} resizeMode="cover" />
                  <TouchableOpacity onPress={() => setBroadcastImage(null)} style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 16 }}>
                    <Ionicons name="close" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={pickBroadcastImage} style={{ padding: 16, borderWidth: 1, borderColor: '#D1D5DB', borderStyle: 'dashed', borderRadius: 12, alignItems: 'center', backgroundColor: '#F9FAFB' }}>
                  <Ionicons name="image-outline" size={32} color="#9CA3AF" />
                  <Text style={{ marginTop: 8, color: '#6B7280', fontWeight: '500' }}>{t('staff.tapToAttach', { defaultValue: 'Tap to attach an image' })}</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <TouchableOpacity 
              style={styles.broadcastBtn} 
              onPress={handleBroadcast}
              disabled={sendingBroadcast}
            >
              {sendingBroadcast ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <>
                  <Ionicons name="megaphone" size={20} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.broadcastBtnText}>{t('staff.sendAnnouncement', { defaultValue: 'Send Announcement' })}</Text>
                </>
              )}
            </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Full Screen Image Modal */}
      <Modal visible={!!fullScreenImage} transparent={true} animationType="fade" onRequestClose={() => setFullScreenImage(null)}>
        <View style={styles.fullScreenImageContainer}>
          <TouchableOpacity style={styles.closeImageBtn} onPress={() => setFullScreenImage(null)}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {fullScreenImage && <Image source={{ uri: fullScreenImage }} style={styles.fullScreenImage} resizeMode="contain" />}
        </View>
      </Modal>

      {/* Custom Delete Modal */}
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
            <Text style={styles.deleteModalTitle}>Delete Broadcast</Text>
            <Text style={styles.deleteModalText}>
              Are you sure you want to delete this broadcast? It will be removed for everyone.
            </Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteModalVisible(false)} disabled={isDeleting}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.deleteBtn, isDeleting && { opacity: 0.6 }]} 
                onPress={executeDeleteBroadcast}
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

      {/* FAB for Broadcast */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setBroadcastModalVisible(true)}
      >
        <Ionicons name="megaphone" size={24} color="#FFF" />
      </TouchableOpacity>


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  offlineBanner: { backgroundColor: '#EF4444', paddingVertical: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  offlineText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  container: { flex: 1 },
  contentContainer: { paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 20 : 50) : 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  langToggle: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9' },
  langToggleText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9' },
  
  titleArea: { marginBottom: 24 },
  title: { fontSize: 20, fontWeight: '600', color: '#64748B', marginBottom: 4 },
  subtitle: { fontSize: 26, fontWeight: '800', color: '#1E293B', marginBottom: 12 },
  
  assignmentBox: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  infoText: { fontSize: 14, fontWeight: '600', color: '#475569', marginLeft: 8 },
  extraAccountBox: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  
  statsBanner: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, gap: 10 },
  statItem: { flex: 1, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9' },
  statDivider: { width: 1, backgroundColor: '#E2E8F0', height: '80%', alignSelf: 'center' },
  statNumber: { fontSize: 22, fontWeight: '800', color: '#3B82F6', marginBottom: 2 },
  statLabel: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  
  filterScroll: { marginBottom: 20 },
  filterContainer: { paddingRight: 20, paddingVertical: 10, gap: 12 },
  filterChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  filterChipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  filterText: { fontSize: 15, fontWeight: '600', color: '#475569' },
  filterTextActive: { color: '#FFFFFF' },
  
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0', height: 46 },
  
  statusContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  statusTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  statusTabActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statusTabText: { fontSize: 13, fontWeight: '600', color: '#64748B', textTransform: 'capitalize' },
  statusTabTextActive: { color: '#3B82F6', fontWeight: '700' },

  catChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  catChipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  catChipText: { fontSize: 13, fontWeight: '600', color: '#475569', textTransform: 'capitalize' },
  catChipTextActive: { color: '#FFFFFF' },
  
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: '#F1F5F9' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  badge: { backgroundColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#1D4ED8' },
  statusText: { fontSize: 13, fontWeight: '700' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardLocation: { fontSize: 14, color: '#64748B', marginLeft: 4, fontWeight: '500' },
  descText: { fontSize: 14, color: '#475569', lineHeight: 22, marginBottom: 16 },
  imageContainer: { width: '100%', height: 160, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  cardImage: { width: '100%', height: '100%' },
  
  dropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F1F5F9', padding: 14, borderRadius: 12, marginTop: 4 },
  dropdownBtnText: { color: '#334155', fontSize: 15, fontWeight: '600' },
  
  emptyStateContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyTextLarge: { fontSize: 20, fontWeight: '700', color: '#475569', marginTop: 16, textAlign: 'center' },
  emptyTextSub: { fontSize: 15, color: '#64748B', textAlign: 'center', marginTop: 8, lineHeight: 22 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: 'white', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 16, textAlign: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalOptionText: { fontSize: 16, color: '#475569', fontWeight: '500', marginLeft: 12 },
  
  broadcastModalContent: { width: '90%', backgroundColor: 'white', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  broadcastHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  broadcastHelpText: { fontSize: 14, color: '#64748B', marginBottom: 20 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16, fontSize: 16, color: '#1E293B', marginBottom: 16 },
  textArea: { height: 120, textAlignVertical: 'top' },
  broadcastBtn: { backgroundColor: '#3B82F6', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, borderRadius: 16, marginTop: 8 },
  broadcastBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: '#3B82F6', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  
  deleteModalContainer: { width: '90%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  deleteIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  deleteModalTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  deleteModalText: { fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  deleteModalActions: { flexDirection: 'row', width: '100%', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '700', color: '#475569' },
  deleteBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: '#EF4444', alignItems: 'center' },
  deleteBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  
  // Full screen image styles
  fullScreenImageContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullScreenImage: { width: '100%', height: '100%' },
  closeImageBtn: { position: 'absolute', top: Platform.OS === 'android' ? 40 : 60, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
});
