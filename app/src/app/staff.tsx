import React, { useState, useEffect } from 'react';
import ProfileAvatar from '../components/ProfileAvatar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ScrollViewInstance } from 'react-native';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, StatusBar, ActivityIndicator, RefreshControl, Modal, TextInput, Platform, BackHandler, KeyboardAvoidingView, Keyboard, FlatList, Dimensions, Share } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import ZoomableImage from '../components/ZoomableImage';
import DeleteAccountModal from '../components/DeleteAccountModal';
import CommunityScreenContent from '../components/CommunityScreenContent';
import StoriesBar from '../components/StoriesBar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import { socketAuth } from '../utils/socketAuth';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = 'https://api.anytimehelp.co.in/api';
const SOCKET_URL = 'https://api.anytimehelp.co.in';

import { getNextLanguage, getLanguageDisplayName } from '../utils/localization';
import { walkthroughable, CopilotStep, useCopilot } from 'react-native-copilot';

const WalkthroughableView = walkthroughable(View);

// Design tokens (Staff app design: Anytime Help Design System)
const C = {
  bg: '#F4F6FA',
  ink: '#0B1020',
  ink2: '#2B3245',
  ink3: '#475069',
  muted: '#6B7489',
  line: '#E6E9F0',
  line2: '#EEF1F6',
  field: '#DCE1EA',
  primary: '#2F6FED',
  hero: '#1E4FD8',
  pending: '#D97706',
  progress: '#2F6FED',
  resolved: '#16A34A',
  danger: '#E5484D',
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'PENDING', color: C.pending },
  IN_PROGRESS: { label: 'IN PROGRESS', color: C.progress },
  RESOLVED: { label: 'RESOLVED', color: C.resolved },
  DONE: { label: 'RESOLVED', color: C.resolved },
};

const PRIORITY_META: Record<string, [string, string]> = {
  High: ['#FFE4E1', '#C2311E'],
  Urgent: ['#FFE4E1', '#C2311E'],
  Medium: ['#DCE8FF', '#1A3FB8'],
  Low: ['#EEF0F4', '#475069'],
};

const HERO_RATIO = 470 / 1200;

// The admin panel saves staff names as "Prince (Sushant Lok 2 (Block C))". Show only the
// person's name: drop the bracketed location part (and any stray symbols around it).
const cleanStaffName = (name?: string) => {
  let n = String(name || '');
  const cut = n.indexOf('(');
  if (cut > 0) n = n.slice(0, cut);
  return n.replace(/[()[\]{}|]/g, ' ').replace(/\s+/g, ' ').trim();
};

type AccessKey = 'ann' | 'status' | 'msg';
type AccessMap = Record<AccessKey, boolean>;

// "Your access" in the Settings sheet: the real access set by the RWA admin
const AccessSection = React.memo(function AccessSection({ realAccess, t }: { realAccess: AccessMap; t: (k: string, o?: any) => string }) {
  const rows = [
    { label: t('staff.accessSolve', { defaultValue: 'Solve & update complaints' }), on: true },
    { label: t('staff.accessAnnounce', { defaultValue: 'Send announcements' }), on: realAccess.ann },
    { label: t('staff.accessStatus', { defaultValue: 'Post status' }), on: realAccess.status },
    { label: t('staff.accessCommunity', { defaultValue: 'Message in community' }), on: realAccess.msg },
  ];
  return (
    <View>
        <Text style={styles.accessHeading}>{t('staff.yourAccess', { defaultValue: 'Your access' })}</Text>
        {rows.map((a, i) => (
          <View key={a.label} style={[styles.accessRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#F0F2F6' }]}>
            <Text style={styles.accessLabel}>{a.label}</Text>
            <View style={[styles.accessPill, { backgroundColor: a.on ? '#E4F7EF' : '#F0F2F6' }]}>
              <Ionicons name={a.on ? 'checkmark' : 'lock-closed'} size={11} color={a.on ? '#067A52' : C.muted} />
              <Text style={[styles.accessPillText, { color: a.on ? '#067A52' : C.muted }]}>
                {a.on ? t('staff.allowed', { defaultValue: 'Allowed' }) : t('staff.noAccess', { defaultValue: 'No access' })}
              </Text>
            </View>
          </View>
        ))}
        <Text style={styles.accessNote}>{t('staff.setByAdmin', { defaultValue: 'Set by your RWA admin' })}</Text>
    </View>
  );
});

// One task card. Memoised: the home re-renders on every tab switch, banner slide and
// keystroke, and redrawing hundreds of cards with photos is what made taps lag.
type TaskCardProps = {
  item: any;
  t: (k: string, o?: any) => string;
  onOpen: (id: string) => void;
  onImage: (uri: string) => void;
  onStatus: (id: string) => void;
  onShare: (item: any) => void;
};
const TaskCard = React.memo(function TaskCard({ item, t, onOpen, onImage, onStatus, onShare }: TaskCardProps) {
  const st = STATUS_META[item.status] || { label: String(item.status || '').replace('_', ' '), color: C.muted };
  const pr = PRIORITY_META[item.priority] || PRIORITY_META.Low;
  const isOpen = item.status !== 'DONE' && item.status !== 'RESOLVED';
  const highlight = item.is_escalated ? '#F2A49C' : (item.priority === 'High' || item.priority === 'Urgent') && isOpen ? '#F6C7BE' : C.line2;
  const code = item.complaint_id || `#AH-${item._id?.slice(-5).toUpperCase()}`;
  return (
    <View style={[styles.taskCard, { borderColor: highlight }, item.is_escalated && { borderWidth: 1.5 }]}>
      <TouchableOpacity activeOpacity={0.85} onPress={() => onOpen(item._id)} style={{ gap: 8 }}>
        {item.is_escalated && (
          <View style={styles.escalatedRow}>
            <Ionicons name="flame" size={15} color="#DC2626" />
            <Text style={styles.escalatedText}>ESCALATED</Text>
            {(item.escalated_by_name || item.escalated_by?.name) && (
              <Text style={styles.escalatedBy} numberOfLines={1}>
                By: {item.escalated_by_name || item.escalated_by?.name}
              </Text>
            )}
          </View>
        )}
        <View style={styles.cardMetaRow}>
          <View style={styles.idPill}><Text style={styles.idPillText}>{code}</Text></View>
          {item.priority ? (
            <View style={[styles.prPill, { backgroundColor: pr[0] }]}>
              <Text style={[styles.prPillText, { color: pr[1] }]}>{item.priority}</Text>
            </View>
          ) : null}
          <View style={styles.statusWrap}>
            <View style={[styles.statusDot, { backgroundColor: st.color }]} />
            <Text style={[styles.statusCaps, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>
        <Text style={styles.taskTitle}>{t(`categories.${item.title}`, { defaultValue: item.title })}</Text>
        {item.location ? (
          <View style={styles.addrRow}>
            <Ionicons name="location-outline" size={14} color={C.ink3} style={{ marginTop: 1 }} />
            <Text style={styles.addrText}>{item.location}</Text>
          </View>
        ) : null}
        {item.description ? <Text style={styles.taskDesc}>{item.description}</Text> : null}
      </TouchableOpacity>

      {item.before_image ? (
        <TouchableOpacity activeOpacity={0.85} onPress={() => onImage(item.before_image)} style={styles.taskPhoto}>
          <ExpoImage
            source={{ uri: item.before_image }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={item._id}
            transition={120}
          />
        </TouchableOpacity>
      ) : null}

      <View style={styles.cardActions}>
        <TouchableOpacity activeOpacity={0.8} style={styles.updateBtn} onPress={() => onStatus(item._id)}>
          <Text style={styles.updateBtnText}>{t('staff.updateStatus', { defaultValue: 'Update Status' })}</Text>
          <Ionicons name="chevron-down" size={18} color={C.ink} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel={`Share ${code}`}
          activeOpacity={0.8}
          style={styles.shareBtn}
          onPress={() => onShare(item)}
        >
          <Ionicons name="share-outline" size={19} color={C.ink} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

// Tasks come from the server one page at a time; the next page loads near the bottom (like a feed)
const TASK_PAGE = 20;
const TASK_MAX_LIMIT = 100; // server caps one request at 100

export default function StaffScreen() {
  const { start } = useCopilot();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>(['All', 'Electricity', 'Garbage', 'Sweeping', 'Sewage cleaning', 'Rainwater drainage', 'Tree cutting', 'Street light', 'Water service']);
  const [activeTab, setActiveTab] = useState<'Tasks' | 'Broadcasts' | 'Announcements' | 'Community'>('Tasks');
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

  // Latest filters, so a live update reloads the list the staff is looking at
  const filtersRef = React.useRef({ searchQuery, selectedCategory, selectedStatus });
  filtersRef.current = { searchQuery, selectedCategory, selectedStatus };

  // Task paging
  const [loadingMore, setLoadingMore] = useState(false);
  const taskPageRef = React.useRef(1);
  const taskHasMoreRef = React.useRef(false);
  const taskLoadingMoreRef = React.useRef(false);
  const taskReqIdRef = React.useRef(0);
  const complaintsCountRef = React.useRef(0);
  complaintsCountRef.current = complaints.length;
  const loadMoreRef = React.useRef<() => void>(() => {});

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

  const complaintsQuery = (page: number, limit: number, s: string, c: string, st: string) =>
    `${API_URL}/complaints?page=${page}&limit=${limit}&stats=true${s ? `&search=${encodeURIComponent(s)}` : ''}${c ? `&category=${encodeURIComponent(c)}` : ''}${st !== 'ALL' ? `&status=${st}` : ''}`;

  // `keepLoaded`: reload as many tasks as are already on screen (live updates), so
  // a staff member who scrolled down does not lose their place
  const fetchComplaints = async (currentSearch = searchQuery, currentCategory = selectedCategory, currentStatus = selectedStatus, keepLoaded = false) => {
    const reqId = ++taskReqIdRef.current;
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const userDataStr = await SecureStore.getItemAsync('userData');
      let userData = null;
      if (userDataStr) {
        userData = JSON.parse(userDataStr);
        setUser(userData);
      }
      const loadedPages = keepLoaded ? Math.ceil(complaintsCountRef.current / TASK_PAGE) : 1;
      const pages = Math.min(Math.max(loadedPages, 1), TASK_MAX_LIMIT / TASK_PAGE);
      const res = await axios.get(complaintsQuery(1, pages * TASK_PAGE, currentSearch, currentCategory, currentStatus), {
        headers: { 'x-auth-token': token }
      });
      if (reqId !== taskReqIdRef.current) return; // a newer request (filter change) took over
      taskPageRef.current = pages;
      taskHasMoreRef.current = !!res.data?.hasMore;

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
      if (reqId !== taskReqIdRef.current) return;
      taskHasMoreRef.current = false;
      const cachedStr = await AsyncStorage.getItem('cached_staff_complaints');
      const cachedStatsStr = await AsyncStorage.getItem('cached_staff_stats');
      if (cachedStatsStr) {
        try { setStats(JSON.parse(cachedStatsStr)); } catch (e) {}
      }
      if (cachedStr) {
        try {
          const parsedCache = JSON.parse(cachedStr);
          setComplaints(Array.isArray(parsedCache) ? parsedCache : []);
        } catch (e) {
          setComplaints([]);
        }
        setIsOffline(true);
      } else {
        setComplaints([]);
      }
    } finally {
      if (reqId === taskReqIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  // Next page of tasks, added under the ones already shown
  const loadMoreComplaints = async () => {
    if (taskLoadingMoreRef.current || !taskHasMoreRef.current) return;
    taskLoadingMoreRef.current = true;
    setLoadingMore(true);
    const reqId = taskReqIdRef.current;
    const { searchQuery: s, selectedCategory: c, selectedStatus: st } = filtersRef.current;
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const nextPage = taskPageRef.current + 1;
      const res = await axios.get(complaintsQuery(nextPage, TASK_PAGE, s, c, st), {
        headers: { 'x-auth-token': token }
      });
      if (reqId !== taskReqIdRef.current) return; // list was reloaded meanwhile
      const more: any[] = res.data?.complaints || [];
      taskPageRef.current = nextPage;
      taskHasMoreRef.current = !!res.data?.hasMore && more.length > 0;
      if (res.data?.stats) setStats(res.data.stats);
      // New tasks can shift pages on the server: skip any already in the list
      setComplaints(prev => {
        const seen = new Set(prev.map((x) => x._id));
        return [...prev, ...more.filter((x) => !seen.has(x._id))];
      });
    } catch (err) {
      console.error('Load more complaints error:', err);
    } finally {
      taskLoadingMoreRef.current = false;
      setLoadingMore(false);
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
        try {
          setAnnouncements(JSON.parse(cachedStr));
        } catch (e) {
          setAnnouncements([]);
        }
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
    const socket = io(SOCKET_URL, { ...socketAuth, transports: ['websocket', 'polling'] });
    // Several changes often arrive together (resolve + reply): reload the list once
    let complaintTimer: ReturnType<typeof setTimeout> | null = null;
    socket.on('complaint_changed', () => {
      if (complaintTimer) clearTimeout(complaintTimer);
      complaintTimer = setTimeout(() => {
        const f = filtersRef.current;
        fetchComplaints(f.searchQuery, f.selectedCategory, f.selectedStatus, true);
      }, 1500);
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
      if (complaintTimer) clearTimeout(complaintTimer);
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
      fetchComplaints(searchQuery, selectedCategory, selectedStatus, true); // Refresh list after update, keep scroll place
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

  // ---------- UI-only state (new staff design) ----------
  const insets = useSafeAreaInsets();
  const [scrolled, setScrolled] = useState(false);
  const isTasks = activeTab === 'Tasks';
  const isAnnSection = activeTab === 'Announcements' || activeTab === 'Broadcasts';
  const isCommunity = activeTab === 'Community';
  // "PR" for Prince, "RK" for Ravi Kumar (shown on "My status")
  const myName = cleanStaffName(user?.name);
  const myInitials = (() => {
    const words = myName.split(/\s+/).filter(Boolean);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return (words[0] || '').slice(0, 2).toUpperCase();
  })();
  // Top bar stays blue on the Tasks home, even while scrolling
  const barIsBlue = isTasks;
  const heroWidth = Dimensions.get('window').width;
  const heroHeight = Math.round(heroWidth * HERO_RATIO);

  const onScroll = (e: any) => {
    const sc = e.nativeEvent.contentOffset.y > 8;
    if (sc !== scrolled) setScrolled(sc);
    // Near the bottom of the Tasks list: load the next page from the server
    if (isTasks) {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 900) {
        loadMoreRef.current();
      }
    }
  };

  // On open: let the banner show for ~3.5 s, then glide the counts up under the pinned top bar.
  // Stops if the staff member touches the list first. Runs once per visit.
  const scrollRef = React.useRef<ScrollViewInstance>(null);
  const layoutRef = React.useRef({ bar: 0, content: 0, stats: 0 });
  const userMovedRef = React.useRef(false);
  const autoScrollDoneRef = React.useRef(false);
  useEffect(() => {
    if (!isTasks || !user || autoScrollDoneRef.current) return;
    const timer = setTimeout(() => {
      autoScrollDoneRef.current = true;
      const { bar, content, stats: statsY } = layoutRef.current;
      if (userMovedRef.current || !statsY) return;
      scrollRef.current?.scrollTo({ y: Math.max(0, content + statsY - bar - 12), animated: true });
    }, 3500);
    return () => clearTimeout(timer);
  }, [isTasks, !!user]);

  // Tabs opened at least once stay mounted (hidden), so coming back needs no rebuild
  const [visitedTabs, setVisitedTabs] = useState({ Community: false, Announcements: false });
  useEffect(() => {
    if (isCommunity && !visitedTabs.Community) setVisitedTabs(v => ({ ...v, Community: true }));
    if (isAnnSection && !visitedTabs.Announcements) setVisitedTabs(v => ({ ...v, Announcements: true }));
  }, [isCommunity, isAnnSection]);

  const switchTab = (tab: 'Tasks' | 'Broadcasts' | 'Announcements' | 'Community') => {
    if (tab !== 'Community') setStaffChatOpen(false);
    if (tab === activeTab) return;
    setActiveTab(tab);
    setScrolled(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const pickStatusFilter = (status: string) => {
    setSelectedStatus(status);
    setLoading(true);
    fetchComplaints(searchQuery, selectedCategory, status);
    setActiveTab('Tasks');
  };

  const complaintCode = (item: any) => item.complaint_id || `#AH-${item._id?.slice(-5).toUpperCase()}`;

  const shareComplaint = async (item: any) => {
    const st = STATUS_META[item.status]?.label || item.status;
    const title = t(`categories.${item.title}`, { defaultValue: item.title });
    const lines = [`${complaintCode(item)} · ${title} (${st})`, item.location, item.description].filter(Boolean);
    try {
      await Share.share({ message: lines.join('\n') });
    } catch (e) {
      console.log('Share complaint error:', e);
    }
  };

  const areaLabel = (() => {
    if (!user) return '';
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
  })();

  const deptLabel = (cat?: string) =>
    !cat || cat === 'All Complaints'
      ? t('staff.allComplaints', { defaultValue: 'All Complaints' })
      : cat;

  const extraStaffAccounts = (user?.accounts || []).filter((acc: any) => acc.role === 'Staff');
  // All departments in one chip (main account + linked staff accounts), so the chips stay on one line
  const deptChipLabel = [...new Set([user?.assigned_category, ...extraStaffAccounts.map((a: any) => a.assigned_category)].map(deptLabel))].join(', ');

  // ---------- Settings sheet ----------
  const [settingsVisible, setSettingsVisible] = useState(false);

  // "Message in community": the staff member is a Channel Admin of at least one channel
  const [canMessageCommunity, setCanMessageCommunity] = useState(false);
  const [deleteAccountVisible, setDeleteAccountVisible] = useState(false);
  const [authToken, setAuthToken] = useState('');

  const openSettings = async () => {
    setSettingsVisible(true);
    const token = (await SecureStore.getItemAsync('userToken')) || '';
    setAuthToken(token);
    fetchUserProfile(); // pick up permission changes made by the admin
    try {
      const res = await axios.get(`${API_URL}/community?include_sections=true`, { headers: { 'x-auth-token': token } });
      const list = Array.isArray(res.data) ? res.data : [];
      setCanMessageCommunity(list.some((c: any) => (c.sections || []).some((s: any) => s.user_access?.is_assigned)));
    } catch (e) {
      console.log('Community access check error:', e);
    }
  };

  // Community tab: the staff chat (the admin's staff channel) shown as one chat row
  const [staffChat, setStaffChat] = useState<any | null>(null);
  const [staffChatLoading, setStaffChatLoading] = useState(false);
  const [staffChatUnread, setStaffChatUnread] = useState(false);
  const staffChatLoadedRef = React.useRef(false);

  const fetchStaffChat = React.useCallback(async () => {
    if (!staffChatLoadedRef.current) setStaffChatLoading(true);
    try {
      const token = (await SecureStore.getItemAsync('userToken')) || '';
      const res = await axios.get(`${API_URL}/community?include_sections=true`, { headers: { 'x-auth-token': token } });
      const list = Array.isArray(res.data) ? res.data : [];
      const sections = list.flatMap((c: any) => c.sections || []);
      const lastTs = (s: any) => (s.last_message?.timestamp ? new Date(s.last_message.timestamp).getTime() : 0);
      // Same pick as the chat screen: a staff channel, open to all first, then the latest active
      const pick = sections
        .filter((s: any) => s.staff_only_posting)
        .sort((a: any, b: any) => (Number(!!b.open_to_all) - Number(!!a.open_to_all)) || (lastTs(b) - lastTs(a)))[0] || null;
      setStaffChat(pick);
      setCanMessageCommunity(sections.some((s: any) => s.user_access?.is_assigned));
      if (pick) {
        const seenRaw = await AsyncStorage.getItem('community_section_last_seen').catch(() => null);
        const seen = seenRaw ? JSON.parse(seenRaw) : {};
        setStaffChatUnread(lastTs(pick) > (seen[pick._id] || 0));
      }
      staffChatLoadedRef.current = true;
    } catch (e) {
      console.log('Staff chat error:', e);
    } finally {
      setStaffChatLoading(false);
    }
  }, []);

  // Load when the tab opens, and again when coming back from the chat
  useFocusEffect(
    React.useCallback(() => {
      if (isCommunity) fetchStaffChat();
    }, [isCommunity, fetchStaffChat])
  );

  // The chat opens on top of the Community tab (tab bar stays), like an official's page
  const [staffChatOpen, setStaffChatOpen] = useState(false);
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardUp(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const openStaffChat = () => {
    setStaffChatUnread(false);
    setStaffChatOpen(true);
  };

  const closeStaffChat = React.useCallback(() => {
    setStaffChatOpen(false);
    fetchStaffChat();
  }, [fetchStaffChat]);

  const handleLogout = async () => {
    try {
      const userData = await SecureStore.getItemAsync('userData');
      if (userData) {
        const parsed = JSON.parse(userData);
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: parsed._id || parsed.id }),
        });
      }
    } catch (e) {
      console.error('Error logging out from server', e);
    }
    setSettingsVisible(false);
    // Stop this account's push notifications on this phone
    await import('../services/pushNotifications').then(m => m.clearPushTokenOnBackend()).catch(() => {});
    await SecureStore.deleteItemAsync('userToken');
    await SecureStore.deleteItemAsync('userData');
    router.replace('/' as any);
  };

  // Access set by the RWA admin: "Post Stories" permission (admin Staff page) and
  // Channel Admin of a community channel. Solving complaints and sending
  // announcements are open to every staff member.
  const staffAccounts = [user, ...extraStaffAccounts].filter(Boolean);
  const canPostStatus = staffAccounts.some((a: any) => (a.permissions || []).includes('Post Stories'));
  // Memoised so AccessSection only re-renders when the real access changes
  const realAccess = React.useMemo<AccessMap>(
    () => ({ ann: true, status: canPostStatus, msg: canMessageCommunity }),
    [canPostStatus, canMessageCommunity]
  );

  const selectedComplaint = complaints.find((c) => c._id === selectedComplaintId);

  const myAnnouncements = announcements.filter((item) => {
    const uid = user?._id || user?.id;
    const cid = item?.createdBy?._id || item?.createdBy?.id || item?.createdBy;
    return uid && cid && String(uid) === String(cid);
  });
  const otherAnnouncements = announcements.filter((item) => {
    const uid = user?._id || user?.id;
    const cid = item?.createdBy?._id || item?.createdBy?.id || item?.createdBy;
    return !uid || !cid || String(uid) !== String(cid);
  });

  const audienceLabel = (aud?: string) => {
    if (aud === 'Members') return t('staff.rwaMembers', { defaultValue: 'RWA (Members)' });
    if (aud === 'All') return t('staff.residentAll', { defaultValue: 'Resident (All)' });
    return '';
  };

  // ---------- Pieces ----------
  const renderHeaderButtons = () => (
    <View style={[styles.topBar, { backgroundColor: barIsBlue ? C.hero : 'rgba(244,246,250,0.98)' }, scrolled && !barIsBlue && styles.topBarScrolled]}>
      <TouchableOpacity
        onPress={toggleLanguage}
        activeOpacity={0.8}
        style={[styles.langBtn, barIsBlue ? styles.glassBtn : styles.solidBtn]}
      >
        <Text style={[styles.langBtnText, { color: barIsBlue ? '#FFFFFF' : C.ink }]}>{getLanguageDisplayName(i18n.language)}</Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }} />
      <CopilotStep text="यहाँ से आप अपनी प्रोफ़ाइल, भाषा और सेटिंग्स मैनेज कर सकते हैं।" order={3} name="staff_settings">
        <WalkthroughableView>
          <TouchableOpacity
            accessibilityLabel="Settings"
            onPress={openSettings}
            activeOpacity={0.8}
            style={[styles.roundBtn, barIsBlue ? styles.glassBtn : styles.solidBtn]}
          >
            <Ionicons name="settings-outline" size={24} color={barIsBlue ? '#FFFFFF' : C.primary} />
          </TouchableOpacity>
        </WalkthroughableView>
      </CopilotStep>
    </View>
  );

  const renderHero = () => (
    <View style={{ backgroundColor: C.hero, marginHorizontal: -18 }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 2, paddingBottom: 6 }}>
        <Text style={styles.heroKicker}>{t('staff.portal', { defaultValue: 'Staff Portal' })}</Text>
        <Text style={styles.heroTitle}>
          {t('resident.hello', { defaultValue: 'Hello,' })} {myName.split(' ')[0] || 'Staff'}
        </Text>
        {user && (
          <View style={styles.heroChips}>
            <View style={styles.heroChip}>
              <Ionicons name="location" size={14} color="#FFFFFF" />
              <Text style={styles.heroChipText} numberOfLines={1}>{areaLabel}</Text>
            </View>
            <View style={styles.heroChip}>
              <Ionicons name="pricetag" size={13} color="#3DDC97" />
              <Text style={styles.heroChipText} numberOfLines={1}>{deptChipLabel}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Staff-only banners from the RWA admin */}
      <View style={{ width: heroWidth, height: heroHeight, overflow: 'hidden', marginTop: 8 }}>
        {banners.length > 0 ? (
          <FlatList
            ref={bannerFlatListRef}
            data={banners}
            horizontal
            pagingEnabled
            scrollEnabled={banners.length > 1}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item._id}
            onLayout={() => setBannerCardWidth(heroWidth)}
            getItemLayout={(_, index) => ({ length: heroWidth, offset: heroWidth * index, index })}
            onMomentumScrollEnd={(e: any) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / heroWidth);
              setBannerIndex(idx);
            }}
            renderItem={({ item }) => (
              <View style={{ width: heroWidth, height: heroHeight }}>
                <Image source={{ uri: item.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                {item.title ? (
                  <LinearGradient
                    colors={['transparent', 'rgba(11,16,32,0.75)']}
                    style={styles.bannerCaption}
                  >
                    <Text style={styles.bannerCaptionText} numberOfLines={1}>{item.title}</Text>
                  </LinearGradient>
                ) : null}
              </View>
            )}
          />
        ) : (
          <Image source={require('../../assets/image.png')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        )}
        <LinearGradient pointerEvents="none" colors={[C.hero, 'rgba(30,79,216,0)']} style={styles.heroFadeTop} />
        <LinearGradient pointerEvents="none" colors={['rgba(244,246,250,0)', C.bg]} style={styles.heroFadeBottom} />
        {banners.length > 1 && (
          <View pointerEvents="none" style={styles.heroDots}>
            {banners.map((_, i) => (
              <View
                key={i}
                style={{
                  height: 6,
                  width: bannerIndex === i ? 18 : 6,
                  borderRadius: 3,
                  backgroundColor: bannerIndex === i ? C.hero : 'rgba(30,79,216,0.3)',
                }}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );

  const renderStats = () => {
    const items = [
      { key: 'PENDING', n: stats.pending, label: t('staff.pendingShort', { defaultValue: 'Pending' }), color: C.pending },
      { key: 'IN_PROGRESS', n: stats.inProgress, label: t('staff.inProgress', { defaultValue: 'In Progress' }), color: C.progress },
      { key: 'RESOLVED', n: stats.resolved, label: t('staff.resolvedShort', { defaultValue: 'Resolved' }), color: C.resolved },
    ];
    return (
      <View style={styles.statsRow}>
        {items.map((m) => {
          const on = selectedStatus === m.key;
          return (
            <TouchableOpacity
              key={m.key}
              activeOpacity={0.8}
              onPress={() => pickStatusFilter(on ? 'ALL' : m.key)}
              style={[styles.statCard, { borderColor: on ? m.color : C.line2 }]}
            >
              <Text style={[styles.statNum, { color: m.color }]}>{m.n}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>{m.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // Stable card handlers (they read the latest functions through a ref), so memoised
  // TaskCards are not redrawn when the home re-renders
  const cardFnsRef = React.useRef({ openStatusDropdown, shareComplaint });
  cardFnsRef.current = { openStatusDropdown, shareComplaint };
  const onOpenTask = React.useCallback((id: string) => router.push(`/task-details?id=${id}`), [router]);
  const onTaskImage = React.useCallback((uri: string) => setFullScreenImage(uri), []);
  const onTaskStatus = React.useCallback((id: string) => cardFnsRef.current.openStatusDropdown(id), []);
  const onTaskShare = React.useCallback((item: any) => cardFnsRef.current.shareComplaint(item), []);

  loadMoreRef.current = loadMoreComplaints;

  const renderAnnouncementCard = (item: any, mine: boolean) => {
    const aud = audienceLabel(item.targetAudience);
    const by = item?.createdBy?.name || item?.createdByName;
    return (
      <View key={item._id} style={styles.annCard}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Text style={styles.annTitle}>{item.title}</Text>
          {aud ? (
            <View style={styles.audPill}><Text style={styles.audPillText}>{aud}</Text></View>
          ) : null}
          {mine && (
            <TouchableOpacity
              accessibilityLabel="Delete broadcast"
              onPress={() => confirmDeleteBroadcast(item._id)}
              style={styles.annDeleteBtn}
            >
              <Ionicons name="trash-outline" size={17} color="#E5484D" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.annBody}>{item.message}</Text>
        {item.image ? (
          <TouchableOpacity activeOpacity={0.85} onPress={() => setFullScreenImage(item.image)}>
            <Image source={{ uri: item.image }} style={styles.annImage} resizeMode="cover" />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.annMeta}>
          {formatDateTime(item.date || item.createdAt)}{by && !mine ? ` · By ${by}` : ''}
        </Text>
      </View>
    );
  };

  const renderEmpty = (icon: any, title: string, sub?: string) => (
    <View style={styles.emptyWrap}>
      <Ionicons name={icon} size={56} color="#C9CED9" />
      <Text style={styles.emptyTitle}>{title}</Text>
      {sub ? <Text style={styles.emptySub}>{sub}</Text> : null}
    </View>
  );

  const tabItems: { key: string; label: string; icon: any; iconOn: any; badge: number; onPress: () => void; on: boolean; step: { order: number; name: string; text: string } }[] = [
    {
      key: 'Tasks', label: t('staff.tasksTab', { defaultValue: 'Tasks' }), icon: 'construct-outline', iconOn: 'construct', badge: stats.pending,
      on: isTasks, onPress: () => switchTab('Tasks'),
      step: { order: 1, name: 'tasks_tab', text: 'यहाँ आप अपने सभी असाइन किए गए कार्य (tasks) देख और मैनेज कर सकते हैं।' },
    },
    {
      key: 'Announcements', label: t('resident.announcements', { defaultValue: 'Announcements' }), icon: 'megaphone-outline', iconOn: 'megaphone', badge: 0,
      on: isAnnSection, onPress: () => switchTab('Announcements'),
      step: { order: 2, name: 'announcements_tab', text: 'एडमिन या मैनेजमेंट से आई घोषणाएं यहाँ देखें।' },
    },
    {
      key: 'Community', label: t('staff.communityTab', { defaultValue: 'Community' }), icon: 'people-outline', iconOn: 'people', badge: 0,
      on: isCommunity, onPress: () => switchTab('Community'),
      step: { order: 4, name: 'community_tab', text: 'कम्युनिटी चैनल में अपडेट पढ़ें और पोस्ट करें।' },
    },
  ];

  const statusOptions = [
    { key: 'PENDING', label: t('staff.pending', { defaultValue: 'Pending' }), icon: 'time-outline' as const, color: C.pending },
    { key: 'IN_PROGRESS', label: t('staff.inProgress', { defaultValue: 'In Progress' }), icon: 'construct-outline' as const, color: C.progress },
    { key: 'DONE', label: t('staff.resolved', { defaultValue: 'Resolved (Done)' }), icon: 'checkmark-circle-outline' as const, color: C.resolved },
  ];

  const tabBarBottom = Math.max(insets.bottom, 8) + 10;
  // The open staff chat has a blue header, so the status bar area turns blue too
  const topIsBlue = barIsBlue || (isCommunity && staffChatOpen);

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: topIsBlue ? C.hero : C.bg }]}>
      <StatusBar barStyle={topIsBlue ? 'light-content' : 'dark-content'} />

      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.offlineText}>No Internet Connection - Showing offline data</Text>
        </View>
      )}

      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
        ref={scrollRef}
        stickyHeaderIndices={[0]}
        onScroll={onScroll}
        onScrollBeginDrag={() => { userMovedRef.current = true; }}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} tintColor={barIsBlue ? '#FFFFFF' : C.primary} />}
      >
        {/* 0: sticky top bar (language, report, settings) */}
        <View style={{ marginHorizontal: -18 }} onLayout={(e) => { layoutRef.current.bar = e.nativeEvent.layout.height; }}>
          {renderHeaderButtons()}
        </View>

        {/* 1: page content */}
        <View style={{ gap: 16 }} onLayout={(e) => { layoutRef.current.content = e.nativeEvent.layout.y; }}>
          {/* Each tab stays mounted once opened and is only hidden, so switching is instant */}
          <View style={[styles.tabPane, !isTasks && styles.paneHidden]}>
              {renderHero()}
              {user && (
                <View onLayout={(e) => { layoutRef.current.stats = e.nativeEvent.layout.y; }}>
                  {renderStats()}
                </View>
              )}

              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={20} color={C.muted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('staff.searchTasks', { defaultValue: 'Search tasks...' })}
                  placeholderTextColor="#8A92A6"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    accessibilityLabel="Clear search"
                    onPress={() => { setSearchQuery(''); fetchComplaints('', selectedCategory, selectedStatus); }}
                  >
                    <Ionicons name="close-circle" size={20} color="#C9CED9" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.segment}>
                {[
                  ['ALL', t('staff.all', { defaultValue: 'All' })],
                  ['PENDING', t('staff.pendingShort', { defaultValue: 'Pending' })],
                  ['IN_PROGRESS', t('staff.inProgress', { defaultValue: 'In Progress' })],
                  ['RESOLVED', t('staff.resolvedShort', { defaultValue: 'Resolved' })],
                ].map(([key, label]) => {
                  const on = selectedStatus === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      activeOpacity={0.85}
                      onPress={() => pickStatusFilter(key)}
                      style={[styles.segBtn, on && styles.segBtnOn]}
                    >
                      <Text style={[styles.segText, { color: on ? C.primary : C.ink3 }]} numberOfLines={1}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Category chips only when the staff member handles 2+ categories ('All' + 2) */}
              {filterCategories.length > 2 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginHorizontal: -18 }}
                  contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}
                >
                  {filterCategories.map((cat) => {
                    const on = (cat === 'All' && selectedCategory === '') || cat === selectedCategory;
                    return (
                      <TouchableOpacity
                        key={cat}
                        activeOpacity={0.85}
                        style={[styles.catChip, on && styles.catChipOn]}
                        onPress={() => {
                          const newCat = cat === 'All' ? '' : cat;
                          setSelectedCategory(newCat);
                          setLoading(true);
                          fetchComplaints(searchQuery, newCat, selectedStatus);
                        }}
                      >
                        <Text style={[styles.catChipText, on && { color: '#FFFFFF' }]}>
                          {cat === 'All' ? t('staff.all', { defaultValue: 'All' }) : t(`categories.${cat}`, { defaultValue: cat })}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {loading ? (
                <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 32 }} />
              ) : complaints.length === 0 ? (
                renderEmpty('checkmark-circle-outline', t('staff.noTasks', { defaultValue: 'No tasks here.' }))
              ) : (
                <>
                  {complaints.map((item: any) => (
                    <TaskCard key={item._id} item={item} t={t} onOpen={onOpenTask} onImage={onTaskImage} onStatus={onTaskStatus} onShare={onTaskShare} />
                  ))}
                  {loadingMore && <ActivityIndicator size="small" color={C.primary} style={{ marginVertical: 16 }} />}
                </>
              )}
          </View>

          {(visitedTabs.Community || isCommunity) && (
          <View style={[styles.tabPane, !isCommunity && styles.paneHidden]}>
              <View style={{ gap: 2, marginTop: 4 }}>
                <Text style={styles.secKicker}>{t('staff.portal', { defaultValue: 'Staff Portal' })}</Text>
                <Text style={styles.secTitle}>{t('staff.communityTab', { defaultValue: 'Community' })}</Text>
              </View>

              <Text style={styles.storiesHead}>{t('staff.stories', { defaultValue: 'Stories' })}</Text>
              {/* Status row: "My status" (locked without the admin's story permission) + category statuses */}
              <StoriesBar variant="staff" myInitials={myInitials} myPhoto={user?.profile_pic} style={{ marginHorizontal: -18, paddingHorizontal: 18 }} />

              {/* Staff chat: one chat for staff and residents; only permitted staff can send */}
              <Text style={styles.chatHead}>{t('staff.chats', { defaultValue: 'Chats' })}</Text>
              {staffChatLoading && !staffChat ? (
                <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 24 }} />
              ) : staffChat ? (
                <TouchableOpacity activeOpacity={0.8} onPress={openStaffChat} style={styles.chatCard}>
                  <View style={styles.chatAvatar}>
                    <Ionicons name="people" size={24} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.chatTopRow}>
                      <Text style={styles.chatName} numberOfLines={1}>{staffChat.name}</Text>
                      {!!staffChat.last_message?.timestamp && (
                        <Text style={[styles.chatTime, staffChatUnread && { color: C.primary, fontWeight: '700' }]}>
                          {new Date(staffChat.last_message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </Text>
                      )}
                    </View>
                    <View style={styles.chatTopRow}>
                      <Text style={[styles.chatPreview, staffChatUnread && { color: C.ink, fontWeight: '600' }]} numberOfLines={1}>
                        {staffChat.last_message?.text
                          ? `${staffChat.last_message.sender_name ? cleanStaffName(staffChat.last_message.sender_name) + ': ' : ''}${staffChat.last_message.text}`
                          : t('staff.chatEmpty', { defaultValue: 'No messages yet' })}
                      </Text>
                      {staffChatUnread && <View style={styles.chatDot} />}
                    </View>
                    <View style={styles.chatMetaRow}>
                      <Text style={styles.chatMeta}>{t('staff.chatMembers', { defaultValue: 'Staff & residents' })}</Text>
                      <View style={[styles.chatPill, { backgroundColor: staffChat.user_access?.can_send ? '#E4F7EF' : '#F0F2F6' }]}>
                        <Ionicons name={staffChat.user_access?.can_send ? 'create-outline' : 'eye-outline'} size={11} color={staffChat.user_access?.can_send ? '#067A52' : C.muted} />
                        <Text style={[styles.chatPillText, { color: staffChat.user_access?.can_send ? '#067A52' : C.muted }]}>
                          {staffChat.user_access?.can_send ? t('staff.canPost', { defaultValue: 'You can post' }) : t('staff.readOnly', { defaultValue: 'Read only' })}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ) : (
                renderEmpty('chatbubbles-outline', t('staff.noStaffChat', { defaultValue: 'Staff chat is not set up yet' }), t('staff.noStaffChatSub', { defaultValue: 'Your RWA admin can create it from the admin panel.' }))
              )}
          </View>
          )}

          {(visitedTabs.Announcements || isAnnSection) && (
          <View style={[styles.tabPane, !isAnnSection && styles.paneHidden]}>
              <View style={{ gap: 2, marginTop: 4 }}>
                <Text style={styles.secKicker}>{t('staff.portal', { defaultValue: 'Staff Portal' })}</Text>
                <Text style={styles.secTitle}>{t('resident.announcements', { defaultValue: 'Announcements' })}</Text>
              </View>

              <View style={styles.segment}>
                {([
                  ['Announcements', t('staff.fromManagement', { defaultValue: 'From management' })],
                  ['Broadcasts', t('staff.myBroadcasts', { defaultValue: 'My Broadcasts' })],
                ] as const).map(([key, label]) => {
                  const on = activeTab === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      activeOpacity={0.85}
                      onPress={() => setActiveTab(key)}
                      style={[styles.segBtn, on && styles.segBtnOn]}
                    >
                      <Text style={[styles.segText, { color: on ? C.primary : C.ink3 }]} numberOfLines={1}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {loadingAnnouncements ? (
                <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 32 }} />
              ) : activeTab === 'Announcements' ? (
                otherAnnouncements.length === 0
                  ? renderEmpty('megaphone-outline', t('resident.noAnnouncements', { defaultValue: 'No Announcements' }), t('staff.noAnnouncementsSub', { defaultValue: 'You have no new announcements from management.' }))
                  : otherAnnouncements.map((a) => renderAnnouncementCard(a, false))
              ) : (
                myAnnouncements.length === 0
                  ? renderEmpty('megaphone-outline', t('staff.noBroadcasts', { defaultValue: 'No broadcasts sent yet.' }), t('staff.noBroadcastsSub', { defaultValue: "You haven't sent any messages to the residents. Tap the button below to send your first message." }))
                  : myAnnouncements.map((a) => renderAnnouncementCard(a, true))
              )}
          </View>
          )}
        </View>
      </ScrollView>

      {/* Staff chat, opened over the Community tab */}
      {/* Kept mounted (hidden) once the staff chat exists, so a tap opens it instantly */}
      {!!staffChat && (
        <View
          pointerEvents={isCommunity && staffChatOpen ? 'auto' : 'none'}
          style={[styles.chatOverlay, { top: insets.top }, !(isCommunity && staffChatOpen) && { display: 'none' }]}
        >
          <CommunityScreenContent
            active={isCommunity && staffChatOpen}
            backRoute="/staff"
            headerThemeColor={C.hero}
            hasTabBar
            embeddedStaffChat
            tabBarSpace={tabBarBottom + 68 + 8}
            onExit={closeStaffChat}
          />
        </View>
      )}

      {/* Floating bottom tab bar (hidden while typing in the chat) */}
      <View style={[styles.tabBar, { bottom: tabBarBottom }, isCommunity && staffChatOpen && keyboardUp && { display: 'none' }]}>
        {tabItems.map((tb) => (
          <CopilotStep key={tb.key} text={tb.step.text} order={tb.step.order} name={tb.step.name}>
            <WalkthroughableView style={{ flex: 1 }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={tb.onPress}
                accessibilityState={{ selected: tb.on }}
                style={styles.tabBtn}
              >
                <View style={[styles.tabPill, tb.on && { backgroundColor: '#EEF4FF' }]}>
                  <Ionicons name={tb.on ? tb.iconOn : tb.icon} size={22} color={tb.on ? C.primary : C.muted} />
                  {tb.badge > 0 && (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeText}>{tb.badge > 99 ? '99+' : tb.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.tabLabel, { color: tb.on ? C.primary : C.muted, fontWeight: tb.on ? '800' : '600' }]} numberOfLines={1}>
                  {tb.label}
                </Text>
              </TouchableOpacity>
            </WalkthroughableView>
          </CopilotStep>
        ))}
      </View>

      {/* FAB: new announcement (hidden while the staff chat is open: it covered the send button) */}
      {!(isCommunity && staffChatOpen) && (
      <TouchableOpacity
        accessibilityLabel={t('staff.newAnnouncement', { defaultValue: 'New Announcement' })}
        activeOpacity={0.85}
        style={[styles.fab, { bottom: tabBarBottom + 82 }]}
        onPress={() => setBroadcastModalVisible(true)}
      >
        <Ionicons name="megaphone" size={26} color="#FFFFFF" />
      </TouchableOpacity>
      )}

      {/* Update status: centre dialog */}
      <Modal animationType="fade" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.dialogWrap}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{t('staff.updateStatus', { defaultValue: 'Update Status' })}</Text>
            {selectedComplaint && (
              <Text style={styles.dialogSub} numberOfLines={1}>
                {complaintCode(selectedComplaint)} · {t(`categories.${selectedComplaint.title}`, { defaultValue: selectedComplaint.title })}
              </Text>
            )}
            {statusOptions.map((o) => {
              const current = selectedComplaint && (selectedComplaint.status === o.key || (o.key === 'DONE' && selectedComplaint.status === 'RESOLVED'));
              return (
                <TouchableOpacity
                  key={o.key}
                  activeOpacity={0.8}
                  disabled={!!updatingStatus}
                  onPress={() => updateStatus(o.key)}
                  style={[styles.dialogOption, current && { backgroundColor: '#F5F8FF' }]}
                >
                  {updatingStatus === o.key
                    ? <ActivityIndicator size="small" color={o.color} />
                    : <Ionicons name={o.icon} size={22} color={o.color} />}
                  <Text style={styles.dialogOptionText}>{o.label}</Text>
                  {current && <Ionicons name="checkmark" size={20} color={C.primary} />}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.dialogCancel}>
              <Text style={styles.dialogCancelText}>{t('staff.cancel', { defaultValue: 'Cancel' })}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* New announcement: bottom sheet */}
      <Modal animationType="slide" transparent visible={broadcastModalVisible} onRequestClose={() => setBroadcastModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.sheetWrap}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => { Keyboard.dismiss(); setBroadcastModalVisible(false); }} />
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 14 }]}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.sheetTitle}>{t('staff.newAnnouncement', { defaultValue: 'New Announcement' })}</Text>
                    <Text style={styles.sheetSub}>{t('staff.chooseAudience', { defaultValue: 'Choose who should receive this announcement.' })}</Text>
                  </View>
                  <TouchableOpacity accessibilityLabel="Close" onPress={() => setBroadcastModalVisible(false)} style={styles.sheetClose}>
                    <Ionicons name="close" size={20} color={C.ink} />
                  </TouchableOpacity>
                </View>

                <View style={styles.targetBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="location" size={15} color="#1A3FB8" />
                    <Text style={styles.targetTitle}>Target Groups & Blocks:</Text>
                  </View>
                  <Text style={styles.targetText}>
                    {Array.isArray(user?.assigned_locations) && user.assigned_locations.length > 0
                      ? user.assigned_locations.map((l: any) => `${l.phase}: ${(!l.blocks || l.blocks.length === 0 || l.blocks.includes('ALL')) ? 'All Blocks' : `Block ${l.blocks.join(', ')}`}`).join(' | ')
                      : (user?.phase || 'All Assigned Locations')}
                  </Text>
                </View>

                <View style={[styles.segment, { backgroundColor: '#F0F2F6' }]}>
                  {([
                    ['All', t('staff.residentAll', { defaultValue: 'Resident (All)' })],
                    ['Members', t('staff.rwaMembers', { defaultValue: 'RWA (Members)' })],
                  ] as const).map(([key, label]) => {
                    const on = broadcastTarget === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        activeOpacity={0.85}
                        onPress={() => setBroadcastTarget(key)}
                        style={[styles.segBtn, { height: 44 }, on && styles.segBtnOn]}
                      >
                        <Text style={[styles.segText, { fontSize: 14, color: on ? C.ink : C.ink3 }]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TextInput
                  style={styles.input}
                  placeholder={t('staff.broadcastTitle', { defaultValue: 'Broadcast Title (e.g., Power Outage)' })}
                  value={broadcastTitle}
                  onChangeText={setBroadcastTitle}
                  placeholderTextColor="#8A92A6"
                />
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder={t('staff.messageDetails', { defaultValue: 'Message details...' })}
                  value={broadcastMessage}
                  onChangeText={setBroadcastMessage}
                  multiline
                  numberOfLines={4}
                  placeholderTextColor="#8A92A6"
                />

                <Text style={styles.fieldLabel}>{t('staff.imageOptional', { defaultValue: 'Image (Optional)' })}</Text>
                {broadcastImage ? (
                  <View>
                    <Image source={{ uri: broadcastImage }} style={{ width: '100%', height: 150, borderRadius: 16, backgroundColor: '#E2E8F0' }} resizeMode="cover" />
                    <TouchableOpacity accessibilityLabel="Remove image" onPress={() => setBroadcastImage(null)} style={styles.removeImg}>
                      <Ionicons name="close" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={pickBroadcastImage} activeOpacity={0.8} style={styles.imgDrop}>
                    <Ionicons name="image-outline" size={26} color={C.muted} />
                    <Text style={styles.imgDropText}>{t('staff.tapToAttach', { defaultValue: 'Tap to attach an image' })}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.primaryBtn, { backgroundColor: broadcastTitle.trim() && broadcastMessage.trim() ? C.primary : '#A9C0F2' }]}
                  onPress={handleBroadcast}
                  disabled={sendingBroadcast}
                >
                  {sendingBroadcast ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="megaphone" size={18} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>{t('staff.sendAnnouncement', { defaultValue: 'Send Announcement' })}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Settings: bottom sheet */}
      <Modal animationType="slide" transparent visible={settingsVisible} onRequestClose={() => setSettingsVisible(false)}>
        <View style={styles.sheetWrap}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSettingsVisible(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 14 }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.sheetTitle}>{t('settings.settingsTitle', { defaultValue: 'Settings' })}</Text>
                  <Text style={styles.sheetSub}>{t('staff.settingsSub', { defaultValue: 'Language, access and account' })}</Text>
                </View>
                <TouchableOpacity accessibilityLabel="Close" onPress={() => setSettingsVisible(false)} style={styles.sheetClose}>
                  <Ionicons name="close" size={20} color={C.ink} />
                </TouchableOpacity>
              </View>

              {/* Profile */}
              <View style={styles.profileRow}>
                <ProfileAvatar
                  uri={user?.profile_pic}
                  size={48}
                  name={myName || 'Staff'}
                  style={styles.profileAvatar}
                  fallback={<Text style={styles.profileAvatarText}>{myInitials || 'ME'}</Text>}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.profileName} numberOfLines={1}>{myName || 'Staff'}</Text>
                  <Text style={styles.profileMeta} numberOfLines={1}>{deptChipLabel}{areaLabel ? ` · ${areaLabel}` : ''}</Text>
                </View>
              </View>

              {/* Your access (set by the RWA admin) */}
              <AccessSection realAccess={realAccess} t={t} />

              <TouchableOpacity activeOpacity={0.85} onPress={handleLogout} style={styles.logoutBtn}>
                <Text style={styles.logoutText}>{t('settings.logout', { defaultValue: 'Log out' })}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => { setSettingsVisible(false); setDeleteAccountVisible(true); }}
                style={styles.deleteAccountBtn}
              >
                <Ionicons name="trash-outline" size={15} color="#B4301B" />
                <Text style={styles.deleteAccountText}>{t('settings.deleteAccount', { defaultValue: 'Delete Account' })}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <DeleteAccountModal
        visible={deleteAccountVisible}
        onClose={() => setDeleteAccountVisible(false)}
        userName={myName || user?.name}
        userId={user?._id || user?.id}
        token={authToken}
      />

      {/* Full screen image */}
      <Modal visible={!!fullScreenImage} transparent animationType="fade" onRequestClose={() => setFullScreenImage(null)}>
        <View style={styles.fullScreenImageContainer}>
          <TouchableOpacity accessibilityLabel="Close" style={styles.closeImageBtn} onPress={() => setFullScreenImage(null)}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {fullScreenImage && <ZoomableImage uri={fullScreenImage} />}
        </View>
      </Modal>

      {/* Delete broadcast confirm */}
      <Modal animationType="fade" transparent visible={deleteModalVisible} onRequestClose={() => setDeleteModalVisible(false)}>
        <View style={styles.dialogWrap}>
          <View style={styles.deleteModalContainer}>
            <View style={styles.deleteIconCircle}>
              <Ionicons name="trash" size={30} color="#E5484D" />
            </View>
            <Text style={styles.deleteModalTitle}>Delete Broadcast</Text>
            <Text style={styles.deleteModalText}>
              Are you sure you want to delete this broadcast? It will be removed for everyone.
            </Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteModalVisible(false)} disabled={isDeleting}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.deleteBtn, isDeleting && { opacity: 0.6 }]} onPress={executeDeleteBroadcast} disabled={isDeleting}>
                {isDeleting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.deleteBtnText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  offlineBanner: { backgroundColor: '#E5484D', paddingVertical: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  offlineText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  // Top bar
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12 },
  topBarScrolled: { borderBottomWidth: 1, borderBottomColor: C.line, shadowColor: C.ink, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 18, elevation: 3 },
  langBtn: { height: 44, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center', borderWidth: 1 },
  langBtnText: { fontSize: 15, fontWeight: '600' },
  roundBtn: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  glassBtn: { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.3)' },
  solidBtn: { backgroundColor: '#FFFFFF', borderColor: C.line, shadowColor: C.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },

  // Hero
  heroKicker: { fontSize: 15, fontWeight: '600', color: '#DCE6FF' },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, lineHeight: 34, marginTop: 4 },
  heroChips: { flexDirection: 'row', flexWrap: 'nowrap', gap: 8, marginTop: 10 },
  heroChip: { height: 30, flexShrink: 1, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroChipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', flexShrink: 1 },
  heroFadeTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 26 },
  heroFadeBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 30 },
  heroDots: { position: 'absolute', left: 0, right: 0, bottom: 8, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  bannerCaption: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 22 },
  bannerCaptionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, height: 84, borderRadius: 18, borderWidth: 1.5, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', gap: 4 },
  statNum: { fontSize: 26, fontWeight: '800', lineHeight: 30, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 13, fontWeight: '600', color: C.ink3 },

  // Search + segments
  searchBox: { height: 48, borderRadius: 16, borderWidth: 1, borderColor: C.field, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  searchInput: { flex: 1, height: 46, fontSize: 15, color: C.ink, paddingVertical: 0 },
  segment: { flexDirection: 'row', padding: 4, backgroundColor: '#ECEFF5', borderRadius: 14 },
  segBtn: { flex: 1, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segBtnOn: { backgroundColor: '#FFFFFF', shadowColor: C.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  segText: { fontSize: 13, fontWeight: '700' },
  catChip: { height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.field, justifyContent: 'center' },
  catChipOn: { backgroundColor: C.primary, borderColor: C.primary },
  catChipText: { fontSize: 13, fontWeight: '700', color: C.ink3 },

  // Task card
  taskCard: { backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, padding: 16, gap: 10, shadowColor: C.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 14, elevation: 2 },
  escalatedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  escalatedText: { fontSize: 11, fontWeight: '800', color: '#DC2626', letterSpacing: 0.5 },
  escalatedBy: { marginLeft: 'auto', fontSize: 11, fontWeight: '700', color: '#991B1B', flexShrink: 1 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  idPill: { height: 26, paddingHorizontal: 9, borderRadius: 8, backgroundColor: '#EEF1FF', borderWidth: 1, borderColor: '#DCE1FA', justifyContent: 'center' },
  idPillText: { color: '#3B3FC4', fontSize: 12, fontWeight: '800' },
  prPill: { height: 26, paddingHorizontal: 9, borderRadius: 999, justifyContent: 'center' },
  prPillText: { fontSize: 12, fontWeight: '700' },
  statusWrap: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  statusCaps: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  taskTitle: { fontSize: 18, fontWeight: '800', color: C.ink, letterSpacing: -0.2 },
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  addrText: { flex: 1, fontSize: 13, color: C.ink3, lineHeight: 18 },
  taskDesc: { fontSize: 14, lineHeight: 21, color: C.ink2 },
  taskPhoto: { height: 120, borderRadius: 16, overflow: 'hidden', backgroundColor: '#E2E8F0' },
  cardActions: { flexDirection: 'row', gap: 8 },
  updateBtn: { flex: 1, height: 48, borderRadius: 14, backgroundColor: '#F0F3F8', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  updateBtnText: { fontSize: 15, fontWeight: '600', color: C.ink },
  shareBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#F0F3F8', alignItems: 'center', justifyContent: 'center' },

  // Announcements
  chatOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  tabPane: { gap: 16 },
  paneHidden: { display: 'none' },
  storiesHead: { fontSize: 18, fontWeight: '800', color: C.ink, marginTop: 18, marginBottom: 4 },
  chatHead: { fontSize: 18, fontWeight: '800', color: C.ink, marginTop: 18, marginBottom: 10 },
  chatCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: C.line, padding: 14, shadowColor: C.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 14, elevation: 2 },
  chatAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.hero, alignItems: 'center', justifyContent: 'center' },
  chatTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chatName: { flex: 1, fontSize: 16, fontWeight: '800', color: C.ink },
  chatTime: { fontSize: 12, color: C.muted },
  chatPreview: { flex: 1, fontSize: 13.5, color: C.muted, marginTop: 3 },
  chatDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },
  chatMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  chatMeta: { fontSize: 12, fontWeight: '600', color: C.ink3 },
  chatPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  chatPillText: { fontSize: 11, fontWeight: '700' },
  secKicker: { fontSize: 17, fontWeight: '600', color: C.muted },
  secTitle: { fontSize: 30, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  annCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line2, borderRadius: 20, padding: 16, gap: 8 },
  annTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: C.ink },
  audPill: { height: 22, paddingHorizontal: 8, borderRadius: 999, backgroundColor: '#F0F2F6', justifyContent: 'center' },
  audPillText: { fontSize: 11, fontWeight: '700', color: C.ink3 },
  annDeleteBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#FFF1F0', alignItems: 'center', justifyContent: 'center' },
  annBody: { fontSize: 14, lineHeight: 21, color: C.ink2 },
  annImage: { width: '100%', height: 190, borderRadius: 14, backgroundColor: '#E2E8F0', marginTop: 2 },
  annMeta: { fontSize: 12, color: C.muted },

  emptyWrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.ink3, marginTop: 14, textAlign: 'center' },
  emptySub: { fontSize: 14, color: C.muted, marginTop: 6, textAlign: 'center', lineHeight: 20 },

  // Tab bar + FAB
  tabBar: { position: 'absolute', left: 16, right: 16, height: 68, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line, borderRadius: 26, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, shadowColor: C.ink, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 10 },
  tabBtn: { height: 58, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabPill: { width: 52, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  tabBadge: { position: 'absolute', top: -3, right: 2, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: C.danger, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  tabBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  tabLabel: { fontSize: 11 },
  fab: { position: 'absolute', right: 18, width: 58, height: 58, borderRadius: 29, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', shadowColor: C.primary, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 18, elevation: 8 },

  // Status dialog
  dialogWrap: { flex: 1, backgroundColor: 'rgba(11,16,32,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  dialog: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 26, paddingTop: 20, paddingHorizontal: 18, paddingBottom: 8 },
  dialogTitle: { textAlign: 'center', fontSize: 18, fontWeight: '800', color: C.ink, marginBottom: 6 },
  dialogSub: { textAlign: 'center', fontSize: 12, color: C.muted, marginBottom: 8 },
  dialogOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#F0F2F6', borderRadius: 10 },
  dialogOptionText: { flex: 1, fontSize: 16, fontWeight: '600', color: C.ink },
  dialogCancel: { height: 54, alignItems: 'center', justifyContent: 'center' },
  dialogCancelText: { fontSize: 16, fontWeight: '600', color: C.muted },

  // Announcement sheet
  // No dark backdrop (it slid up with the sheet and looked like a black shadow)
  sheetWrap: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 18, paddingHorizontal: 20, borderWidth: 1, borderBottomWidth: 0, borderColor: C.line, shadowColor: C.ink, shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: C.ink, letterSpacing: -0.2 },
  sheetSub: { fontSize: 13, color: C.muted },
  sheetClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F2F6', alignItems: 'center', justifyContent: 'center' },

  // Settings sheet
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: '#F6F8FC' },
  profileAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  profileName: { fontSize: 16, fontWeight: '800', color: C.ink },
  profileMeta: { fontSize: 12, color: C.muted },
  accessHeading: { fontSize: 13, fontWeight: '800', color: C.ink, marginBottom: 4 },
  accessRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  accessLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: C.ink },
  accessPill: { height: 24, paddingHorizontal: 9, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 4 },
  accessPillText: { fontSize: 11, fontWeight: '800' },
  accessNote: { fontSize: 11, color: C.muted, marginTop: 4 },
  logoutBtn: { height: 50, borderRadius: 16, borderWidth: 1, borderColor: '#F6C7BE', backgroundColor: '#FFF6F4', alignItems: 'center', justifyContent: 'center' },
  logoutText: { fontSize: 15, fontWeight: '800', color: '#B4301B' },
  deleteAccountBtn: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: -4 },
  deleteAccountText: { fontSize: 13, fontWeight: '700', color: '#B4301B' },
  targetBox: { padding: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#C7D5FA', gap: 2 },
  targetTitle: { fontSize: 13, fontWeight: '800', color: '#1A3FB8' },
  targetText: { fontSize: 13, color: C.ink2, lineHeight: 18 },
  input: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: C.field, backgroundColor: '#F8F9FC', paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: C.ink },
  textArea: { height: 120, textAlignVertical: 'top' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: C.ink2, marginBottom: -6 },
  imgDrop: { height: 96, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#C9D2E3', backgroundColor: '#FAFBFD', alignItems: 'center', justifyContent: 'center', gap: 6 },
  imgDropText: { fontSize: 13, fontWeight: '600', color: C.ink3 },
  removeImg: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  primaryBtn: { height: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  // Delete confirm
  deleteModalContainer: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, alignItems: 'center' },
  deleteIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFE4E1', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  deleteModalTitle: { fontSize: 20, fontWeight: '800', color: C.ink, marginBottom: 8 },
  deleteModalText: { fontSize: 15, color: C.muted, textAlign: 'center', marginBottom: 22, lineHeight: 22 },
  deleteModalActions: { flexDirection: 'row', width: '100%', gap: 12 },
  cancelBtn: { flex: 1, height: 50, borderRadius: 16, backgroundColor: '#F0F2F6', alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '700', color: C.ink3 },
  deleteBtn: { flex: 1, height: 50, borderRadius: 16, backgroundColor: '#E5484D', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  // Full screen image
  fullScreenImageContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  closeImageBtn: { position: 'absolute', top: Platform.OS === 'android' ? 40 : 60, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
});
