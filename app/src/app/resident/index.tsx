import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, BackHandler, Platform, RefreshControl, Image, FlatList, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { io } from 'socket.io-client';

import { walkthroughable, CopilotStep, useCopilot } from 'react-native-copilot';
import { isProfileBlockUpdateRequired } from '../../components/ForceBlockUpdateModal';

const API_URL = 'https://anytime-help.onrender.com/api';

const WalkthroughableTouchableOpacity = walkthroughable(TouchableOpacity);

export default function ResidentHome() {
  const { start } = useCopilot();
  const router = useRouter();
  const { t } = useTranslation();
  const [user, setUser] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Resident Banners State
  const [banners, setBanners] = useState<any[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerFlatListRef = useRef<FlatList>(null);
  const [bannerCardWidth, setBannerCardWidth] = useState(Dimensions.get('window').width - 32);
  const bannerIndexRef = useRef(0);

  // Complaint stats state
  const [stats, setStats] = useState({ pending: 0, inProgress: 0, resolved: 0 });
  const [latestAnnouncement, setLatestAnnouncement] = useState<any>(null);

  const fetchBanners = async () => {
    try {
      const res = await axios.get(`${API_URL}/staff-banners?target=Resident`);
      if (Array.isArray(res.data)) {
        setBanners(res.data);
      }
    } catch (e) {
      console.log('Error fetching resident banners:', e);
    }
  };

  const fetchStats = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (token) {
        const res = await axios.get(`${API_URL}/complaints?page=1&limit=5`, {
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
      console.log('Error fetching resident stats:', e);
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
      const durationSec = (currentBanner && typeof currentBanner.duration === 'number' && currentBanner.duration > 0)
        ? currentBanner.duration
        : 4;
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

  const { startTour } = useLocalSearchParams();
  const [lastStartTour, setLastStartTour] = useState<string | null>(null);

  useEffect(() => {
    if (startTour && startTour !== lastStartTour) {
      if (start) {
        setLastStartTour(startTour as string);
        setTimeout(() => {
          try {
            start();
            SecureStore.setItemAsync('hasViewedResidentTour', 'true');
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
        if (data) {
          const parsed = JSON.parse(data);
          setUser(parsed);
          
          if (!startTour && !isProfileBlockUpdateRequired(parsed)) {
            SecureStore.getItemAsync('hasViewedResidentTour').then((tourData) => {
              if (!tourData && start) {
                setTimeout(() => {
                  try {
                    start();
                    SecureStore.setItemAsync('hasViewedResidentTour', 'true');
                  } catch (e) {
                    console.log('Copilot start error:', e);
                  }
                }, 1000);
              }
            });
          }
        }
      });

      fetchAnnouncementsData();
      fetchBanners();
      fetchStats();

      const socket = io(API_URL.replace('/api', ''), { transports: ['websocket', 'polling'] });
      socket.on('announcement_changed', () => {
        fetchAnnouncementsData();
      });
      socket.on('complaint_changed', () => {
        fetchStats();
      });
      socket.on('resident_banner_changed', () => {
        fetchBanners();
      });
      socket.on('banner_changed', () => {
        fetchBanners();
      });

      const onBackPress = () => {
        BackHandler.exitApp();
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      
      return () => {
        subscription.remove();
        socket.disconnect();
      };
    }, [])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchBanners(),
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
      <StatusBar barStyle="light-content" backgroundColor="#1E3A8A" translucent={true} />

      {/* Modern Compact Branded Header */}
      <View style={styles.headerWrapper}>
        <LinearGradient
          colors={['#1E3A8A', '#1D4ED8', '#2563EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          {/* Top Row: App Branding + Profile Avatar */}
          <View style={styles.headerTopRow}>
            <View style={styles.brandContainer}>
              <View style={styles.brandLogoCircle}>
                <Image 
                  source={require('../../../assets/images/logo.png')} 
                  style={{ width: '100%', height: '100%' }} 
                  resizeMode="cover" 
                />
              </View>
              <View style={styles.brandTextGroup}>
                <Text style={styles.brandName}>ANYTIME HELP</Text>
                <View style={styles.portalPill}>
                  <Text style={styles.portalPillText}>RESIDENT APP</Text>
                </View>
              </View>
            </View>

            <CopilotStep text="यहाँ से आप अपनी प्रोफ़ाइल, सेटिंग्स मैनेज कर सकते हैं और ट्यूटोरियल देख सकते हैं।" order={5} name="profile_avatar">
              <WalkthroughableTouchableOpacity 
                style={styles.avatarContainer} 
                onPress={() => router.push('/resident/settings')}
                activeOpacity={0.8}
              >
                <Ionicons name="person" size={20} color="#1D4ED8" />
              </WalkthroughableTouchableOpacity>
            </CopilotStep>
          </View>

          {/* User Welcome Row */}
          <View style={styles.userWelcomeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingText} numberOfLines={1}>
                {t('resident.hello').replace(',', '')} {user?.name ? user.name.split(' ')[0] : 'Resident'}
              </Text>
              <View style={styles.unitLocationBadge}>
                <Ionicons name="location-sharp" size={13} color="#93C5FD" style={{ marginRight: 4 }} />
                <Text style={styles.unitLocationText} numberOfLines={1}>
                  {user?.block ? `Block ${user.block}` : ''} {user?.room_number ? `#${user.room_number}` : ''}
                  {!user?.block && !user?.room_number ? (user?.phase || 'Verified Resident') : ''}
                </Text>
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1D4ED8']} />
        }
      >
        {/* Dynamic Resident Banner */}
        <View 
          style={styles.bannerSection}
          onLayout={(e) => setBannerCardWidth(e.nativeEvent.layout.width)}
        >
          {banners.length > 0 ? (
            banners.length === 1 ? (
              <View style={styles.bannerCardWrapper}>
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
              </View>
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
                  onMomentumScrollEnd={(e) => {
                    if (bannerCardWidth > 0) {
                      const idx = Math.round(e.nativeEvent.contentOffset.x / bannerCardWidth);
                      const safeIdx = Math.max(0, Math.min(idx, banners.length - 1));
                      bannerIndexRef.current = safeIdx;
                      setBannerIndex(safeIdx);
                    }
                  }}
                  renderItem={({ item }) => (
                    <View style={{ width: bannerCardWidth, height: 145, position: 'relative' }}>
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
                    </View>
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
            /* Fallback sleek community announcement card */
            <LinearGradient
              colors={['#2563EB', '#1E40AF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fallbackBanner}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View style={styles.fallbackTag}>
                  <Text style={styles.fallbackTagText}>24/7 SUPPORT</Text>
                </View>
                <Text style={styles.fallbackTitle}>Fast Community Resolution</Text>
                <Text style={styles.fallbackSub}>Lodge complaints or stay connected anytime.</Text>
              </View>
              <View style={styles.fallbackIconBox}>
                <Ionicons name="sparkles" size={28} color="#60A5FA" />
              </View>
            </LinearGradient>
          )}
        </View>

        {/* Circular Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Quick Services</Text>
          </View>

          <View style={styles.sixGridWrapper}>
            {/* 1: Lodge Grievance */}
            <View style={styles.gridItemColumn}>
              <CopilotStep text="कोई समस्या है? यहाँ से आसानी से अपनी शिकायत दर्ज करें।" order={1} name="lodge_grievance">
                <WalkthroughableTouchableOpacity 
                  style={styles.actionTouchable}
                  onPress={() => router.push('/resident/raise')}
                  activeOpacity={0.75}
                >
                  <View style={[styles.circleIcon, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
                    <Ionicons name="megaphone" size={24} color="#EF4444" />
                  </View>
                  <Text style={styles.actionLabel} numberOfLines={2}>
                    {t('resident.lodgeGrievance', 'Lodge Grievance')}
                  </Text>
                </WalkthroughableTouchableOpacity>
              </CopilotStep>
            </View>

            {/* 2: My Complaints */}
            <View style={styles.gridItemColumn}>
              <CopilotStep text="अपनी दर्ज की गई शिकायतों की स्थिति (status) लाइव ट्रैक करें।" order={2} name="my_complaints">
                <WalkthroughableTouchableOpacity 
                  style={styles.actionTouchable}
                  onPress={() => router.push('/resident/my-complaints')}
                  activeOpacity={0.75}
                >
                  <View style={[styles.circleIcon, { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' }]}>
                    <Ionicons name="reader-outline" size={24} color="#059669" />
                  </View>
                  <Text style={styles.actionLabel} numberOfLines={2}>
                    {t('resident.myComplaints', 'My Complaints')}
                  </Text>
                </WalkthroughableTouchableOpacity>
              </CopilotStep>
            </View>

            {/* 3: Announcements */}
            <View style={styles.gridItemColumn}>
              <CopilotStep text="एडमिन से सीधे ज़रूरी घोषणाएँ और सूचनाएँ तुरंत प्राप्त करें।" order={3} name="announcements">
                <WalkthroughableTouchableOpacity 
                  style={styles.actionTouchable}
                  onPress={() => router.push('/resident/announcements')}
                  activeOpacity={0.75}
                >
                  <View style={[styles.circleIcon, { backgroundColor: '#DBEAFE', borderColor: '#BFDBFE' }]}>
                    <Ionicons name="notifications" size={24} color="#2563EB" />
                    {unreadCount > 0 && (
                      <View style={styles.badgeContainer}>
                        <Text style={styles.badgeText}>{unreadCount}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.actionLabel} numberOfLines={2}>
                    {t('resident.announcements', 'Announcements')}
                  </Text>
                </WalkthroughableTouchableOpacity>
              </CopilotStep>
            </View>

            {/* 4: Community */}
            <View style={styles.gridItemColumn}>
              <TouchableOpacity 
                style={styles.actionTouchable}
                onPress={() => router.push('/resident/community')}
                activeOpacity={0.75}
              >
                <View style={[styles.circleIcon, { backgroundColor: '#EDE9FE', borderColor: '#DDD6FE' }]}>
                  <Ionicons name="chatbubbles" size={24} color="#7C3AED" />
                </View>
                <Text style={styles.actionLabel} numberOfLines={2}>
                  Community
                </Text>
              </TouchableOpacity>
            </View>

            {/* 5: Directory */}
            <View style={styles.gridItemColumn}>
              <CopilotStep text="हमारी सोसाइटी डायरेक्टरी के ज़रिए अन्य निवासियों से आसानी से जुड़ें।" order={4} name="directory">
                <WalkthroughableTouchableOpacity 
                  style={styles.actionTouchable}
                  onPress={() => router.push('/resident/search')}
                  activeOpacity={0.75}
                >
                  <View style={[styles.circleIcon, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                    <Ionicons name="call" size={24} color="#D97706" />
                  </View>
                  <Text style={styles.actionLabel} numberOfLines={2}>
                    {t('resident.directory', 'Directory')}
                  </Text>
                </WalkthroughableTouchableOpacity>
              </CopilotStep>
            </View>
          </View>
        </View>

        {/* Status Tracker: Pending | Progress | Done */}
        <View style={styles.trackerContainer}>
          <View style={styles.trackerHeader}>
            <View style={styles.trackerTitleGroup}>
              <Ionicons name="stats-chart" size={17} color="#1E293B" style={{ marginRight: 6 }} />
              <Text style={styles.trackerTitle}>Complaint Status</Text>
            </View>
            <TouchableOpacity 
              onPress={() => router.push('/resident/my-complaints')}
              style={styles.trackerSeeAllBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.trackerSeeAllText}>View All</Text>
              <Ionicons name="chevron-forward" size={14} color="#2563EB" />
            </TouchableOpacity>
          </View>

          <View style={styles.trackerStatsRow}>
            {/* Pending Stat */}
            <TouchableOpacity 
              style={[styles.statBox, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}
              onPress={() => router.push('/resident/my-complaints')}
              activeOpacity={0.75}
            >
              <View style={[styles.statIconBadge, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="time" size={14} color="#D97706" />
              </View>
              <Text style={[styles.statNumber, { color: '#B45309' }]}>{stats.pending}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </TouchableOpacity>

            {/* In Progress Stat */}
            <TouchableOpacity 
              style={[styles.statBox, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
              onPress={() => router.push('/resident/my-complaints')}
              activeOpacity={0.75}
            >
              <View style={[styles.statIconBadge, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="sync" size={14} color="#2563EB" />
              </View>
              <Text style={[styles.statNumber, { color: '#1D4ED8' }]}>{stats.inProgress}</Text>
              <Text style={styles.statLabel}>In Progress</Text>
            </TouchableOpacity>

            {/* Done / Resolved Stat */}
            <TouchableOpacity 
              style={[styles.statBox, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
              onPress={() => router.push('/resident/my-complaints')}
              activeOpacity={0.75}
            >
              <View style={[styles.statIconBadge, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="checkmark-done" size={14} color="#059669" />
              </View>
              <Text style={[styles.statNumber, { color: '#047857' }]}>{stats.resolved}</Text>
              <Text style={styles.statLabel}>Resolved</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Latest Announcement Section */}
        <View style={styles.announcementSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="megaphone-outline" size={18} color="#1E293B" style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>Latest Announcement</Text>
            </View>
            <TouchableOpacity 
              onPress={() => router.push('/resident/announcements')}
              style={styles.trackerSeeAllBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.trackerSeeAllText}>See All</Text>
              <Ionicons name="chevron-forward" size={14} color="#2563EB" />
            </TouchableOpacity>
          </View>

          {latestAnnouncement ? (
            <TouchableOpacity 
              style={styles.announcementCard}
              onPress={() => router.push('/resident/announcements')}
              activeOpacity={0.8}
            >
              <View style={styles.announcementCardHeader}>
                <View style={styles.noticeTag}>
                  <Ionicons name="notifications" size={12} color="#2563EB" style={{ marginRight: 4 }} />
                  <Text style={styles.noticeTagText}>Notice</Text>
                </View>
                <Text style={styles.announcementDate}>
                  {formatAnnouncementDate(latestAnnouncement.date || latestAnnouncement.createdAt)}
                </Text>
              </View>
              <Text style={styles.announcementTitle} numberOfLines={1}>
                {latestAnnouncement.title}
              </Text>
              <Text style={styles.announcementSnippet} numberOfLines={2}>
                {latestAnnouncement.message}
              </Text>
              <View style={styles.announcementFooter}>
                <Text style={styles.readMoreText}>Tap to view full details</Text>
                <Ionicons name="arrow-forward" size={13} color="#2563EB" />
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyAnnouncementCard}>
              <Ionicons name="checkmark-circle-outline" size={28} color="#94A3B8" />
              <Text style={styles.emptyAnnouncementText}>No new announcements</Text>
              <Text style={styles.emptyAnnouncementSub}>You are all caught up with community updates.</Text>
            </View>
          )}
        </View>

        {/* Bottom padding */}
        <View style={{ height: 90 }} />
      </ScrollView>

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
    backgroundColor: '#1E3A8A',
    elevation: 6,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  headerGradient: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 32) : 44,
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
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    overflow: 'hidden',
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    marginTop: 2,
  },
  portalPillText: {
    color: '#BAE6FD',
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
    marginBottom: 4,
  },
  unitLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
  },
  unitLocationText: {
    color: '#DBEAFE',
    fontSize: 12,
    fontWeight: '600',
  },
  bodyScroll: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingTop: 16,
    paddingHorizontal: 16,
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
    backgroundColor: '#38BDF8',
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
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  fallbackTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 6,
  },
  fallbackTagText: {
    color: '#FFFFFF',
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
    color: '#BFDBFE',
    fontSize: 12,
    lineHeight: 16,
  },
  fallbackIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
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
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
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
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  noticeTagText: {
    color: '#2563EB',
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
});
