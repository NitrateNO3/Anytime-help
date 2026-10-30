import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar as RNStatusBar, BackHandler, Platform, RefreshControl, Image, FlatList, Dimensions, Linking, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { io } from 'socket.io-client';

import Toast from 'react-native-toast-message';
import { walkthroughable, CopilotStep, useCopilot } from 'react-native-copilot';

const API_URL = 'https://anytime-help.onrender.com/api';

const WalkthroughableView = walkthroughable(View);

export default function MemberHome() {
  const { start } = useCopilot();
  const router = useRouter();
  const { t } = useTranslation();
  const [user, setUser] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Member Banners State
  const [banners, setBanners] = useState<any[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerFlatListRef = useRef<FlatList>(null);
  const [bannerCardWidth, setBannerCardWidth] = useState(Dimensions.get('window').width - 32);
  const bannerIndexRef = useRef(0);

  // Bottom Banners Slider State
  const [bottomBanners, setBottomBanners] = useState<any[]>([]);
  const [bottomBannerIndex, setBottomBannerIndex] = useState(0);
  const bottomBannerFlatListRef = useRef<FlatList>(null);
  const bottomBannerIndexRef = useRef(0);
  const [bottomBannerCardWidth, setBottomBannerCardWidth] = useState(Dimensions.get('window').width - 32);

  // Fullscreen Banner Image Preview Modal State
  const [previewImage, setPreviewImage] = useState<{ url: string; title?: string; link?: string } | null>(null);

  // Complaint stats & Latest announcement state
  const [stats, setStats] = useState({ pending: 0, inProgress: 0, resolved: 0 });
  const [latestAnnouncement, setLatestAnnouncement] = useState<any>(null);

  const fetchBanners = async () => {
    try {
      const res = await axios.get(`${API_URL}/staff-banners?target=Member`);
      if (Array.isArray(res.data)) {
        setBanners(res.data);
      }
    } catch (e) {
      console.log('Error fetching member banners:', e);
    }
  };

  const fetchBottomBanners = async () => {
    try {
      const res = await axios.get(`${API_URL}/bottom-banners?target=Member`);
      if (Array.isArray(res.data)) {
        setBottomBanners(res.data);
      }
    } catch (e) {
      console.log('Error fetching member bottom banners:', e);
    }
  };

  const fetchStats = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (token) {
        const url = `${API_URL}/complaints?page=1&limit=5&overall_stats=true`;
        
        const res = await axios.get(url, {
          headers: { 'x-auth-token': token }
        });

        if (res.data?.stats) {
          setStats({
            pending: Number(res.data.stats.pending) || 0,
            inProgress: Number(res.data.stats.inProgress) || 0,
            resolved: Number(res.data.stats.resolved) || 0,
          });
        } else if (Array.isArray(res.data)) {
          setStats({
            pending: res.data.filter((c: any) => c.status === 'PENDING').length,
            inProgress: res.data.filter((c: any) => c.status === 'IN_PROGRESS').length,
            resolved: res.data.filter((c: any) => c.status === 'RESOLVED' || c.status === 'DONE').length,
          });
        }
      }
    } catch (e) {
      console.log('Error fetching member stats:', e);
    }
  };

  const fetchAnnouncementsData = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (token) {
        const res = await axios.get(`${API_URL}/announcements`, {
          headers: { 'x-auth-token': token }
        });
        const announcements = res.data || [];
        if (announcements.length > 0) {
          setLatestAnnouncement(announcements[0]);
        } else {
          setLatestAnnouncement(null);
        }
        const lastCountStr = await SecureStore.getItemAsync('last_announcements_count');
        const lastCount = lastCountStr ? parseInt(lastCountStr, 10) : 0;
        if (announcements.length > lastCount) {
          setUnreadCount(announcements.length - lastCount);
        } else {
          setUnreadCount(0);
        }
      }
    } catch (e) {
      console.log('Error fetching announcements:', e);
    }
  };

  useEffect(() => {
    bannerIndexRef.current = bannerIndex;
  }, [bannerIndex]);

  useEffect(() => {
    if (banners.length > 1) {
      const currentBanner = banners[bannerIndex];
      const durationSec = Number(currentBanner?.duration) > 0 ? Number(currentBanner.duration) : 4;
      const durationMs = durationSec * 1000;

      const timer = setTimeout(() => {
        const nextIndex = bannerIndex >= banners.length - 1 ? 0 : bannerIndex + 1;
        bannerIndexRef.current = nextIndex;
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

  // Bottom Banner auto-advance slider timer
  useEffect(() => {
    if (bottomBanners.length > 1) {
      const currentBanner = bottomBanners[bottomBannerIndex];
      const durationSec = Number(currentBanner?.duration) > 0 ? Number(currentBanner.duration) : 4;
      const durationMs = durationSec * 1000;

      const timer = setTimeout(() => {
        const nextIndex = bottomBannerIndex >= bottomBanners.length - 1 ? 0 : bottomBannerIndex + 1;
        bottomBannerIndexRef.current = nextIndex;
        setBottomBannerIndex(nextIndex);
        if (bottomBannerCardWidth > 0 && bottomBannerFlatListRef.current) {
          bottomBannerFlatListRef.current.scrollToOffset({
            offset: nextIndex * bottomBannerCardWidth,
            animated: true,
          });
        }
      }, durationMs);

      return () => clearTimeout(timer);
    }
  }, [bottomBanners, bottomBannerIndex, bottomBannerCardWidth]);

  const handleBottomBannerPress = (banner: any) => {
    if (!banner) return;
    if (banner.link) {
      const link = String(banner.link).trim();
      if (link.startsWith('http://') || link.startsWith('https://')) {
        Linking.openURL(link).catch((err) => console.log('Failed to open banner url:', err));
        return;
      } else if (link.startsWith('/')) {
        router.push(link as any);
        return;
      }
    }
    router.push('/member-announcements' as any);
  };

  const { startTour } = useLocalSearchParams();
  const [lastStartTour, setLastStartTour] = useState<string | null>(null);

  useEffect(() => {
    if (startTour && startTour !== lastStartTour) {
      if (start) {
        setLastStartTour(startTour as string);
        setTimeout(() => {
          try {
            start();
            SecureStore.setItemAsync('hasViewedMemberTour', 'true');
          } catch (e) {
            console.log('Copilot start error:', e);
          }
        }, 1000);
      }
    }
  }, [startTour, start, lastStartTour]);

  useFocusEffect(
    useCallback(() => {
      SecureStore.getItemAsync('userData').then((data) => {
        if (data) setUser(JSON.parse(data));
      });

      SecureStore.getItemAsync('userToken').then((token) => {
        if (token) {
          axios.get(`${API_URL}/users/me`, { headers: { 'x-auth-token': token } })
            .then((res) => {
              if (res.data) {
                setUser(res.data);
                SecureStore.setItemAsync('userData', JSON.stringify(res.data));
              }
            })
            .catch(() => {});
        }
      });

      if (!startTour) {
        SecureStore.getItemAsync('hasViewedMemberTour').then((data) => {
          if (!data && start) {
            setTimeout(() => {
              try {
                start();
                SecureStore.setItemAsync('hasViewedMemberTour', 'true');
              } catch (e) {
                console.log('Copilot start error:', e);
              }
            }, 1000);
          }
        });
      }

      fetchAnnouncementsData();
      fetchBanners();
      fetchBottomBanners();
      fetchStats();

      const socket = io(API_URL.replace('/api', ''), { transports: ['websocket', 'polling'] });
      socket.on('announcement_changed', () => {
        fetchAnnouncementsData();
      });
      socket.on('complaint_changed', () => {
        fetchStats();
      });
      socket.on('member_banner_changed', () => {
        fetchBanners();
      });
      socket.on('banner_changed', () => {
        fetchBanners();
      });
      socket.on('bottom_banners_changed', () => {
        fetchBottomBanners();
      });
      socket.on('user_updated', async (data: any) => {
        const stored = await SecureStore.getItemAsync('userData');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed._id === data.userId || parsed.id === data.userId) {
            try {
              const token = await SecureStore.getItemAsync('userToken');
              if (token) {
                const res = await axios.get(`${API_URL}/users/me`, {
                  headers: { 'x-auth-token': token }
                });
                if (res.data) {
                  const updatedUser = { ...parsed, ...res.data };
                  await SecureStore.setItemAsync('userData', JSON.stringify(updatedUser));
                  setUser(updatedUser);
                }
              }
            } catch (err) {
              console.log('Failed to fetch fresh user data via socket:', err);
              const fallbackUser = { ...parsed, permissions: data.permissions, name: data.name, designation: data.designation };
              await SecureStore.setItemAsync('userData', JSON.stringify(fallbackUser));
              setUser(fallbackUser);
            }
          }
        }
      });

      let lastBackPress = 0;
      const onBackPress = () => {
        const now = Date.now();
        if (now - lastBackPress < 2000) {
          BackHandler.exitApp();
          return true;
        }
        lastBackPress = now;
        Toast.show({
          type: 'info',
          text1: t('common.pressBackAgain', { defaultValue: 'Press back again to exit' }),
          visibilityTime: 2000,
          position: 'bottom',
        });
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      
      return () => {
        subscription.remove();
        socket.disconnect();
      };
    }, [start, startTour])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchBanners(),
      fetchBottomBanners(),
      fetchAnnouncementsData(),
      fetchStats()
    ]);
    setRefreshing(false);
  }, []);

  const formatAnnouncementDate = (dateStr: any) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <StatusBar style="light" />

      {/* Modern Compact Branded Header */}
      <View style={styles.headerWrapper}>
        <LinearGradient
          colors={['#0F172A', '#1E1B4B', '#1E293B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          {/* Top Row: App Branding + Profile Settings */}
          <View style={styles.headerTopRow}>
            <View style={styles.brandContainer}>
              <View style={styles.brandLogoCircle}>
                <Image 
                  source={require('../../../assets/images/logo.png')} 
                  style={{ width: '100%', height: '100%' }} 
                  resizeMode="contain" 
                />
              </View>
              <View style={styles.brandTextGroup}>
                <Text style={styles.brandName}>ANYTIME HELP</Text>
                <View style={styles.portalPill}>
                  <Text style={styles.portalPillText}>MEMBER PORTAL</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.avatarContainer} 
              onPress={() => router.navigate('/member/settings')}
              activeOpacity={0.8}
            >
              <Ionicons name="person" size={20} color="#1E1B4B" />
            </TouchableOpacity>
          </View>

          {/* User Welcome Row with Member ID */}
          <View style={styles.userWelcomeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingText} numberOfLines={1}>
                {t('resident.hello').replace(',', '')} {user?.name ? user.name.split(' ')[0] : 'Member'}
              </Text>

              <View style={styles.badgeRow}>
                {/* Member ID Pill */}
                <LinearGradient 
                  colors={['#F59E0B', '#D97706']} 
                  start={{ x: 0, y: 0 }} 
                  end={{ x: 1, y: 1 }}
                  style={styles.memberIdBadge}
                >
                  <Ionicons name="star" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.memberIdText}>
                    MEMBER ID: {user?.member_id ? user.member_id : 'PENDING'}
                  </Text>
                </LinearGradient>

                {/* Optional Designation Badge */}
                {user?.designation ? (
                  <View style={styles.designationBadge}>
                    <Text style={styles.designationText} numberOfLines={1}>
                      {user.designation}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Main Content Body */}
      <ScrollView 
        style={styles.bodyScroll}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0F172A']} />
        }
      >
        {/* Profile incomplete warning */}
        {(!user?.address || user?.address.trim() === '') && (
          <TouchableOpacity 
            style={styles.incompleteProfileBanner}
            onPress={() => router.push('/member/edit-profile' as any)}
            activeOpacity={0.8}
          >
            <View style={styles.warningIconCircle}>
              <Ionicons name="warning" size={20} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>Complete Your Profile</Text>
              <Text style={styles.warningSub}>Your address is missing. Tap here to add it.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#EF4444" />
          </TouchableOpacity>
        )}

        {/* Dynamic Member Banner Carousel */}
        <View 
          style={styles.bannerSection}
          onLayout={(e) => setBannerCardWidth(e.nativeEvent.layout.width)}
        >
          {banners.length > 0 ? (
            banners.length === 1 ? (
              <TouchableOpacity 
                style={styles.bannerCardWrapper}
                activeOpacity={0.9}
                onPress={() => setPreviewImage({ url: banners[0].url, title: banners[0].title, link: banners[0].link })}
              >
                <Image 
                  source={{ uri: banners[0].url }} 
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
                {banners[0].title ? (
                  <LinearGradient
                    colors={['transparent', 'rgba(15, 23, 42, 0.85)']}
                    style={styles.bannerTitleGradient}
                  >
                    <Text style={styles.bannerTitleText} numberOfLines={1}>
                      {banners[0].title}
                    </Text>
                  </LinearGradient>
                ) : null}
              </TouchableOpacity>
            ) : (
              <View style={styles.bannerCardWrapper}>
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
                  onMomentumScrollEnd={(e: any) => {
                    if (bannerCardWidth > 0) {
                      const idx = Math.round(e.nativeEvent.contentOffset.x / bannerCardWidth);
                      const safeIdx = Math.max(0, Math.min(idx, banners.length - 1));
                      bannerIndexRef.current = safeIdx;
                      setBannerIndex(safeIdx);
                    }
                  }}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      activeOpacity={0.9}
                      onPress={() => setPreviewImage({ url: item.url, title: item.title, link: item.link })}
                      style={{ width: bannerCardWidth, height: 145, position: 'relative' }}
                    >
                      <Image 
                        source={{ uri: item.url }} 
                        style={styles.bannerImage}
                        resizeMode="cover"
                      />
                      {item.title ? (
                        <LinearGradient
                          colors={['transparent', 'rgba(15, 23, 42, 0.85)']}
                          style={styles.bannerTitleGradient}
                        >
                          <Text style={styles.bannerTitleText} numberOfLines={1}>
                            {item.title}
                          </Text>
                        </LinearGradient>
                      ) : null}
                    </TouchableOpacity>
                  )}
                />
                {/* Carousel Dots */}
                <View style={styles.bannerDotsContainer}>
                  {banners.map((_, i) => (
                    <View 
                      key={i} 
                      style={[
                        styles.bannerDot, 
                        bannerIndex === i ? styles.bannerDotActive : styles.bannerDotInactive
                      ]}
                    />
                  ))}
                </View>
              </View>
            )
          ) : (
            /* Fallback sleek member notice card */
            <LinearGradient
              colors={['#1E1B4B', '#312E81']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fallbackBanner}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View style={styles.fallbackTag}>
                  <Text style={styles.fallbackTagText}>MANAGEMENT PORTAL</Text>
                </View>
                <Text style={styles.fallbackTitle}>Community Oversight</Text>
                <Text style={styles.fallbackSub}>Manage complaints, notices, and resident queries.</Text>
              </View>
              <View style={styles.fallbackIconBox}>
                <Ionicons name="shield-checkmark" size={28} color="#A5B4FC" />
              </View>
            </LinearGradient>
          )}
        </View>

        {/* 6 Circular Quick Actions (2 Rows of 3) */}
        <View style={styles.quickActionsContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Quick Services</Text>
          </View>

          <View style={styles.sixGridWrapper}>
            {/* 1: Raise Complaint */}
            <View style={styles.gridItemColumn}>
              <CopilotStep text="यहाँ से किसी भी निवासी (resident) के लिए एक नई शिकायत दर्ज करें।" order={1} name="raise_complaint">
                <WalkthroughableView>
                  <TouchableOpacity 
                    style={styles.actionTouchable}
                    onPress={() => router.push('/member-raise' as any)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.circleIcon, { backgroundColor: '#DBEAFE', borderColor: '#BFDBFE' }]}>
                      <Ionicons name="add-circle" size={25} color="#2563EB" />
                    </View>
                    <Text style={styles.actionLabel} numberOfLines={2}>
                      {t('member.raiseComplaint', { defaultValue: 'Raise Issue' })}
                    </Text>
                  </TouchableOpacity>
                </WalkthroughableView>
              </CopilotStep>
            </View>

            {/* 2: All / My Complaints */}
            <View style={styles.gridItemColumn}>
              <CopilotStep text="शिकायतें देखें" order={2} name="all_complaints">
                <WalkthroughableView>
                  <TouchableOpacity 
                    style={styles.actionTouchable}
                    onPress={() => router.navigate('/member/my-complaints' as any)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.circleIcon, { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' }]}>
                      <Ionicons name="list" size={24} color="#059669" />
                    </View>
                    <Text style={styles.actionLabel} numberOfLines={2}>
                      {user?.permissions?.includes('All Complaints') 
                        ? t('member.allComplaints', { defaultValue: 'Complaints' }) 
                        : t('resident.myComplaints', 'My Complaints')}
                    </Text>
                  </TouchableOpacity>
                </WalkthroughableView>
              </CopilotStep>
            </View>

            {/* 3: Announcements */}
            <View style={styles.gridItemColumn}>
              <CopilotStep text="यहाँ से नई सूचनाएँ पोस्ट करें या ज़रूरी घोषणाएँ देखें।" order={3} name="announcements">
                <WalkthroughableView>
                  <TouchableOpacity 
                    style={styles.actionTouchable}
                    onPress={() => router.push('/member-announcements' as any)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.circleIcon, { backgroundColor: '#EDE9FE', borderColor: '#DDD6FE' }]}>
                      <Ionicons name="notifications" size={24} color="#7C3AED" />
                      {unreadCount > 0 && (
                        <View style={styles.badgeContainer}>
                          <Text style={styles.badgeText}>{unreadCount}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.actionLabel} numberOfLines={2}>
                      {t('resident.announcements', 'Notices')}
                    </Text>
                  </TouchableOpacity>
                </WalkthroughableView>
              </CopilotStep>
            </View>

            {/* 4: Residents List */}
            <View style={styles.gridItemColumn}>
              <CopilotStep text="सभी निवासियों की सूची देखें।" order={5} name="residents_list">
                <WalkthroughableView>
                  <TouchableOpacity 
                    style={styles.actionTouchable}
                    onPress={() => router.push('/member-residents' as any)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.circleIcon, { backgroundColor: '#FCE7F3', borderColor: '#FBCFE8' }]}>
                      <Ionicons name="people" size={24} color="#DB2777" />
                    </View>
                    <Text style={styles.actionLabel} numberOfLines={2}>
                      {t('member.residents', { defaultValue: 'Residents' })}
                    </Text>
                  </TouchableOpacity>
                </WalkthroughableView>
              </CopilotStep>
            </View>

            {/* 5: Directory */}
            <View style={styles.gridItemColumn}>
              <CopilotStep text="RWA कमेटी और मैनेजमेंट डायरेक्टरी देखने व संपर्क करने के लिए यहाँ टैप करें।" order={4} name="directory">
                <WalkthroughableView>
                  <TouchableOpacity 
                    style={styles.actionTouchable}
                    onPress={() => router.push('/member-directory' as any)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.circleIcon, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                      <Ionicons name="call" size={24} color="#D97706" />
                    </View>
                    <Text style={styles.actionLabel} numberOfLines={2}>
                      {t('resident.directory', 'Directory')}
                    </Text>
                  </TouchableOpacity>
                </WalkthroughableView>
              </CopilotStep>
            </View>
          </View>
        </View>

        {/* Status Tracker: Pending | Progress | Done */}
        <View style={styles.trackerContainer}>
          <View style={styles.trackerHeader}>
            <View style={styles.trackerTitleGroup}>
              <Ionicons name="stats-chart" size={17} color="#1E293B" style={{ marginRight: 6 }} />
              <Text style={styles.trackerTitle}>Complaints Overview</Text>
            </View>
          </View>

          <View style={styles.trackerStatsRow}>
            {/* Pending Stat */}
            <View style={[styles.statBox, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
              <View style={[styles.statIconBadge, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="time" size={14} color="#D97706" />
              </View>
              <Text style={[styles.statNumber, { color: '#B45309' }]}>{stats.pending}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>

            {/* In Progress Stat */}
            <View style={[styles.statBox, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
              <View style={[styles.statIconBadge, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="sync" size={14} color="#2563EB" />
              </View>
              <Text style={[styles.statNumber, { color: '#1D4ED8' }]}>{stats.inProgress}</Text>
              <Text style={styles.statLabel}>In Progress</Text>
            </View>

            {/* Done / Resolved Stat */}
            <View style={[styles.statBox, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
              <View style={[styles.statIconBadge, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="checkmark-done" size={14} color="#059669" />
              </View>
              <Text style={[styles.statNumber, { color: '#047857' }]}>{stats.resolved}</Text>
              <Text style={styles.statLabel}>Resolved</Text>
            </View>
          </View>
        </View>

        {/* Dynamic Bottom Banner Slider Section */}
        <View style={styles.announcementSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name={bottomBanners.length > 0 ? "images-outline" : "megaphone-outline"} 
                size={18} 
                color="#1E293B" 
                style={{ marginRight: 6 }} 
              />
              <Text style={styles.sectionTitle}>
                {bottomBanners.length > 0 ? 'Featured Updates' : 'Latest Notice'}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => router.push('/member-announcements' as any)}
              style={styles.trackerSeeAllBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.trackerSeeAllText}>Notices</Text>
              <Ionicons name="chevron-forward" size={14} color="#2563EB" />
            </TouchableOpacity>
          </View>

          {bottomBanners.length > 0 ? (
            bottomBanners.length === 1 ? (
              <TouchableOpacity 
                style={styles.announcementCard}
                onPress={() => setPreviewImage({ url: bottomBanners[0].url, title: bottomBanners[0].title, link: bottomBanners[0].link })}
                activeOpacity={0.88}
              >
                <View style={styles.noticeBannerContainer}>
                  <Image 
                    source={{ uri: bottomBanners[0].url }} 
                    style={styles.noticeBannerImage} 
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(15, 23, 42, 0.65)']}
                    style={styles.noticeBannerGradient}
                  />
                  {bottomBanners[0].title ? (
                    <View style={styles.bottomBannerCaptionOverlay}>
                      <Text style={styles.bottomBannerCaptionText} numberOfLines={1}>
                        {bottomBanners[0].title}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.noticeTagOverlay}>
                    <Ionicons name="sparkles" size={11} color="#FFFFFF" style={{ marginRight: 3 }} />
                    <Text style={styles.noticeTagOverlayText}>Featured</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ) : (
              <View 
                style={styles.announcementCard}
                onLayout={(e) => {
                  const w = e.nativeEvent.layout.width;
                  if (w > 0) setBottomBannerCardWidth(w);
                }}
              >
                <FlatList
                  ref={bottomBannerFlatListRef}
                  data={bottomBanners}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item, index) => item._id || `bottom-banner-${index}`}
                  getItemLayout={(_, index) => ({
                    length: bottomBannerCardWidth,
                    offset: bottomBannerCardWidth * index,
                    index,
                  })}
                  onMomentumScrollEnd={(e: any) => {
                    if (bottomBannerCardWidth > 0) {
                      const idx = Math.round(e.nativeEvent.contentOffset.x / bottomBannerCardWidth);
                      const safeIdx = Math.max(0, Math.min(idx, bottomBanners.length - 1));
                      bottomBannerIndexRef.current = safeIdx;
                      setBottomBannerIndex(safeIdx);
                    }
                  }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => setPreviewImage({ url: item.url, title: item.title, link: item.link })}
                      style={{ width: bottomBannerCardWidth, height: 160, position: 'relative' }}
                    >
                      <Image 
                        source={{ uri: item.url }} 
                        style={styles.noticeBannerImage} 
                        resizeMode="cover"
                      />
                      <LinearGradient
                        colors={['transparent', 'rgba(15, 23, 42, 0.65)']}
                        style={styles.noticeBannerGradient}
                      />
                      {item.title ? (
                        <View style={styles.bottomBannerCaptionOverlay}>
                          <Text style={styles.bottomBannerCaptionText} numberOfLines={1}>
                            {item.title}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.noticeTagOverlay}>
                        <Ionicons name="sparkles" size={11} color="#FFFFFF" style={{ marginRight: 3 }} />
                        <Text style={styles.noticeTagOverlayText}>Featured</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />

                {/* Slider Pagination Dots */}
                <View style={styles.bannerDotsContainer}>
                  {bottomBanners.map((_, i) => (
                    <View 
                      key={i} 
                      style={[
                        styles.bannerDot, 
                        bottomBannerIndex === i ? styles.bannerDotActive : styles.bannerDotInactive
                      ]} 
                    />
                  ))}
                </View>
              </View>
            )
          ) : latestAnnouncement ? (
            <TouchableOpacity 
              style={styles.announcementCard}
              onPress={() => setPreviewImage({ 
                url: latestAnnouncement.image || 'https://res.cloudinary.com/dpajfmfl/image/upload/v1792147978/anytime_help/staff_banners/puhwnrswyjr1mrvqrobe.jpg', 
                title: latestAnnouncement.title,
                link: '/member-announcements'
              })}
              activeOpacity={0.88}
            >
              <View style={styles.noticeBannerContainer}>
                <Image 
                  source={{ uri: latestAnnouncement.image || 'https://res.cloudinary.com/dpajfmfl/image/upload/v1792147978/anytime_help/staff_banners/puhwnrswyjr1mrvqrobe.jpg' }} 
                  style={styles.noticeBannerImage} 
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['transparent', 'rgba(15, 23, 42, 0.45)']}
                  style={styles.noticeBannerGradient}
                />
                <View style={styles.noticeTagOverlay}>
                  <Ionicons name="notifications" size={11} color="#FFFFFF" style={{ marginRight: 3 }} />
                  <Text style={styles.noticeTagOverlayText}>Latest Notice</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyAnnouncementCard}>
              <Ionicons name="checkmark-circle-outline" size={28} color="#94A3B8" />
              <Text style={styles.emptyAnnouncementText}>No active updates</Text>
              <Text style={styles.emptyAnnouncementSub}>You can broadcast new announcements anytime.</Text>
            </View>
          )}
        </View>

        {/* Bottom padding */}
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Fullscreen Banner Image Preview Modal */}
      <Modal
        visible={!!previewImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
        statusBarTranslucent={true}
      >
        <View style={styles.imageModalBackdrop}>
          <SafeAreaView style={styles.imageModalSafeArea}>
            {/* Top Bar with Title and Close Button */}
            <View style={styles.imageModalHeader}>
              <View style={{ flex: 1, marginRight: 12 }}>
                {previewImage?.title ? (
                  <Text style={styles.imageModalTitle} numberOfLines={1}>
                    {previewImage.title}
                  </Text>
                ) : (
                  <Text style={styles.imageModalTitle}>Image Preview</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.imageModalCloseBtn}
                onPress={() => setPreviewImage(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Main Center Image */}
            <View style={styles.imageModalImageContainer}>
              {previewImage?.url ? (
                <Image
                  source={{ uri: previewImage.url }}
                  style={styles.imageModalFullImage}
                  resizeMode="contain"
                />
              ) : null}
            </View>

            {/* Action Footer (if link exists or close) */}
            <View style={styles.imageModalFooter}>
              {previewImage?.link ? (
                <TouchableOpacity
                  style={styles.imageModalActionBtn}
                  onPress={() => {
                    const link = previewImage.link?.trim();
                    setPreviewImage(null);
                    if (link) {
                      if (link.startsWith('http://') || link.startsWith('https://')) {
                        Linking.openURL(link).catch((e) => console.log('Err opening link:', e));
                      } else if (link.startsWith('/')) {
                        router.push(link as any);
                      }
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="open-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.imageModalActionText}>Visit Link</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.imageModalDismissBtn}
                  onPress={() => setPreviewImage(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.imageModalDismissText}>Close</Text>
                </TouchableOpacity>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  headerWrapper: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    elevation: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  headerGradient: {
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ? RNStatusBar.currentHeight + 10 : 32) : 44,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandLogoCircle: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: 'transparent',
  },
  brandTextGroup: {
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.1,
  },
  portalPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    marginTop: 2,
  },
  portalPillText: {
    color: '#FCD34D',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  avatarContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  userWelcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greetingText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  memberIdText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  designationBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
  },
  designationText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  bodyScroll: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  incompleteProfileBanner: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
  },
  warningSub: {
    fontSize: 11,
    color: '#B91C1C',
  },
  bannerSection: {
    marginBottom: 18,
  },
  bannerCardWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    height: 145,
    backgroundColor: '#0F172A',
    position: 'relative',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerTitleGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bannerTitleText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  bannerDotsContainer: {
    position: 'absolute',
    bottom: 7,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  bannerDot: {
    height: 5,
    borderRadius: 2.5,
  },
  bannerDotActive: {
    width: 16,
    backgroundColor: '#F59E0B',
  },
  bannerDotInactive: {
    width: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  fallbackBanner: {
    borderRadius: 16,
    padding: 16,
    height: 135,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  fallbackTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 6,
  },
  fallbackTagText: {
    color: '#FCD34D',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  fallbackTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  fallbackSub: {
    color: '#C7D2FE',
    fontSize: 12,
    lineHeight: 16,
  },
  fallbackIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -0.2,
  },
  sixGridWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    rowGap: 16,
    width: '100%',
  },
  gridItemColumn: {
    width: '33.33%',
    alignItems: 'center',
  },
  actionTouchable: {
    alignItems: 'center',
    width: '100%',
  },
  circleIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1.5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    position: 'relative',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
    lineHeight: 15,
  },
  badgeContainer: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  trackerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  trackerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trackerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  trackerSeeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackerSeeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
    marginRight: 2,
  },
  trackerStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statBox: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  statIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  announcementSection: {
    marginBottom: 16,
  },
  announcementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  noticeBannerContainer: {
    width: '100%',
    height: 145,
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  noticeBannerImage: {
    width: '100%',
    height: '100%',
  },
  noticeBannerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
  },
  bottomBannerCaptionOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 60,
  },
  bottomBannerCaptionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  noticeTagOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  noticeTagOverlayText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  announcementContentPadding: {
    padding: 14,
  },
  noticeDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  announcementCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noticeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF5FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  noticeTagText: {
    color: '#7C3AED',
    fontSize: 11,
    fontWeight: '700',
  },
  announcementDate: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  announcementTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  announcementSnippet: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 10,
  },
  announcementFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  readMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
    marginRight: 4,
  },
  emptyAnnouncementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  emptyAnnouncementText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginTop: 8,
    marginBottom: 2,
  },
  emptyAnnouncementSub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  /* Fullscreen Image Preview Modal Styles */
  imageModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
  },
  imageModalSafeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  imageModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ? RNStatusBar.currentHeight + 8 : 20) : 12,
    paddingBottom: 12,
    zIndex: 10,
  },
  imageModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  imageModalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageModalImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  imageModalFullImage: {
    width: Dimensions.get('window').width - 24,
    height: '100%',
    maxHeight: Dimensions.get('window').height * 0.78,
  },
  imageModalFooter: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 24 : 20,
    alignItems: 'center',
  },
  imageModalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
  },
  imageModalActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  imageModalDismissBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 20,
  },
  imageModalDismissText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
});
