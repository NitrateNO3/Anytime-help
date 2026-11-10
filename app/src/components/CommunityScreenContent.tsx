import React, { useEffect, useState, useCallback, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  View, Text, StyleSheet, ScrollView, Platform, ActivityIndicator, 
  StatusBar, TouchableOpacity, RefreshControl, BackHandler, TextInput,
  FlatList, Alert, KeyboardAvoidingView, Animated, Easing
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { io, Socket } from 'socket.io-client';
import { socketAuth } from '../utils/socketAuth';
import StoriesBar, { refreshStoriesBar } from './StoriesBar';
import OfficialProfile from './OfficialProfile';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

interface CommunitySectionItem {
  _id: string;
  community_id: string;
  name: string;
  description: string;
  icon: string;
  section_type: 'announcement' | 'discussion';
  followers_count?: number;
  assigned_count?: number;
  last_message?: {
    text: string;
    sender_name: string;
    timestamp: string;
  };
  user_access?: {
    can_view: boolean;
    can_send: boolean;
    is_assigned: boolean;
    is_following: boolean;
    is_admin: boolean;
  };
  createdAt: string;
}

interface CommunityItem {
  _id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  target_roles: string[];
  sections_count?: number;
  total_followers?: number;
  sections?: CommunitySectionItem[];
  is_following_any?: boolean;
}

interface CommunityMessageItem {
  _id: string;
  section_id: string;
  community_id: string;
  sender: any;
  sender_name: string;
  sender_role: string;
  sender_designation?: string;
  text: string;
  createdAt: string;
}

interface CommunityScreenContentProps {
  backRoute: string;
  headerThemeColor?: string;
}

// Avatar Initials & Color Helpers
const AVATAR_PALETTES = [
  { bg: '#3B82F6', text: '#FFFFFF' }, // Blue
  { bg: '#8B5CF6', text: '#FFFFFF' }, // Purple
  { bg: '#EC4899', text: '#FFFFFF' }, // Pink
  { bg: '#10B981', text: '#FFFFFF' }, // Emerald
  { bg: '#F59E0B', text: '#FFFFFF' }, // Amber
  { bg: '#06B6D4', text: '#FFFFFF' }, // Cyan
  { bg: '#6366F1', text: '#FFFFFF' }, // Indigo
  { bg: '#F97316', text: '#FFFFFF' }, // Orange
  { bg: '#14B8A6', text: '#FFFFFF' }, // Teal
  { bg: '#64748B', text: '#FFFFFF' }, // Slate
];

const getSenderInitials = (name?: string, fallback = 'U'): string => {
  if (!name || typeof name !== 'string') return fallback;
  const trimmed = name.trim();
  if (!trimmed) return fallback;

  const clean = trimmed.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;

  if (parts.length === 1) {
    const word = parts[0];
    if (word.includes('-')) {
      const sub = word.split('-').filter(Boolean);
      if (sub[0].length >= 2 && /^[A-Za-z]+$/.test(sub[0])) {
        return sub[0].slice(0, 2).toUpperCase();
      }
      return word.slice(0, 2).toUpperCase();
    }
    return word.charAt(0).toUpperCase();
  }

  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return (first + last).toUpperCase();
};

const getAvatarColor = (name?: string, isAdmin = false) => {
  if (isAdmin) {
    return { bg: '#1E293B', text: '#F59E0B' }; // Dark charcoal with amber letter
  }
  if (!name) return { bg: '#64748B', text: '#FFFFFF' };
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx];
};

interface OfficialItem {
  _id: string;
  name: string;
  designation: string;
  ward: string;
  bio?: string;
  verified: boolean;
  followers_count: number;
  is_following: boolean;
  is_mine?: boolean; // the logged-in user is this official (can post on the page)
}

const OFFICIAL_PASTELS = [
  { bg: '#FEE2E2', fg: '#DC2626' }, { bg: '#FEF3C7', fg: '#B45309' }, { bg: '#DCFCE7', fg: '#15803D' },
  { bg: '#E0E7FF', fg: '#4338CA' }, { bg: '#FCE7F3', fg: '#BE185D' }, { bg: '#CFFAFE', fg: '#0E7490' },
];

const hashStr = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return h;
};

const formatCount = (n: number) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n || 0);
};

const officialPalette = (name: string) => OFFICIAL_PASTELS[Math.abs(hashStr(name)) % OFFICIAL_PASTELS.length];

const officialMeta = (o: OfficialItem) =>
  [o.designation, o.ward ? `Ward ${o.ward}` : '', `${formatCount(o.followers_count)} followers`].filter(Boolean).join(' · ');

const LAST_SEEN_KEY = 'community_section_last_seen';

// WhatsApp-like Typing Indicator with 3 animated bouncing dots
function TypingIndicator({ typingUsers }: { typingUsers: string[] }) {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(animValue, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();

    return () => {
      animation.stop();
    };
  }, [animValue]);

  if (!typingUsers || typingUsers.length === 0) return null;

  const label = typingUsers.length === 1 
    ? `${typingUsers[0]} is typing...` 
    : `${typingUsers.join(', ')} are typing...`;

  const primaryName = typingUsers[0] || '?';
  const initial = primaryName.charAt(0).toUpperCase();

  // Dot 1: Peak bounce at 20% of cycle
  const translateY1 = animValue.interpolate({
    inputRange: [0, 0.2, 0.4, 1.0],
    outputRange: [0, -6, 0, 0],
  });
  const opacity1 = animValue.interpolate({
    inputRange: [0, 0.2, 0.4, 1.0],
    outputRange: [0.35, 1, 0.35, 0.35],
  });
  const scale1 = animValue.interpolate({
    inputRange: [0, 0.2, 0.4, 1.0],
    outputRange: [0.85, 1.25, 0.85, 0.85],
  });

  // Dot 2: Peak bounce at 40% of cycle
  const translateY2 = animValue.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 1.0],
    outputRange: [0, 0, -6, 0, 0],
  });
  const opacity2 = animValue.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 1.0],
    outputRange: [0.35, 0.35, 1, 0.35, 0.35],
  });
  const scale2 = animValue.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 1.0],
    outputRange: [0.85, 0.85, 1.25, 0.85, 0.85],
  });

  // Dot 3: Peak bounce at 60% of cycle
  const translateY3 = animValue.interpolate({
    inputRange: [0, 0.4, 0.6, 0.8, 1.0],
    outputRange: [0, 0, -6, 0, 0],
  });
  const opacity3 = animValue.interpolate({
    inputRange: [0, 0.4, 0.6, 0.8, 1.0],
    outputRange: [0.35, 0.35, 1, 0.35, 0.35],
  });
  const scale3 = animValue.interpolate({
    inputRange: [0, 0.4, 0.6, 0.8, 1.0],
    outputRange: [0.85, 0.85, 1.25, 0.85, 0.85],
  });

  return (
    <View style={styles.typingRow}>
      <View style={styles.typingAvatar}>
        <Text style={styles.typingAvatarText}>{initial}</Text>
      </View>
      <View style={styles.typingBubble}>
        <Animated.View 
          style={[
            styles.typingDot, 
            { 
              transform: [{ translateY: translateY1 }, { scale: scale1 }],
              opacity: opacity1,
            }
          ]} 
        />
        <Animated.View 
          style={[
            styles.typingDot, 
            { 
              transform: [{ translateY: translateY2 }, { scale: scale2 }],
              opacity: opacity2,
            }
          ]} 
        />
        <Animated.View 
          style={[
            styles.typingDot, 
            { 
              transform: [{ translateY: translateY3 }, { scale: scale3 }],
              opacity: opacity3,
            }
          ]} 
        />
      </View>
      <Text style={styles.typingLabelText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export default function CommunityScreenContent({ 
  backRoute, 
  headerThemeColor = '#0F172A' 
}: CommunityScreenContentProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const [communities, setCommunities] = useState<CommunityItem[]>([]);
  const communitiesLoadedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Active Channel View
  const [activeSection, setActiveSection] = useState<CommunitySectionItem | null>(null);
  const [activeParentComm, setActiveParentComm] = useState<CommunityItem | null>(null);
  const [messages, setMessages] = useState<CommunityMessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [requiresFollow, setRequiresFollow] = useState(false);
  const [userAccess, setUserAccess] = useState<any>(null);

  // Message input for assigned members / admins
  const [msgText, setMsgText] = useState('');
  const [followingActionId, setFollowingActionId] = useState<string | null>(null);

  // Current user & Live typing state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [communityTypingUsers, setCommunityTypingUsers] = useState<string[]>([]);
  const isTypingRef = useRef(false);
  const lastTypingHeartbeatRef = useRef(0);
  const typingTimeoutRef = useRef<any>(null);
  const typingTimersRef = useRef<{ [userName: string]: any }>({});

  const socketRef = useRef<Socket | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const activeSectionRef = useRef<CommunitySectionItem | null>(null);

  // List view: area name, search toggle, officials, per-channel last-seen (for unread dots)
  const [areaName, setAreaName] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [officials, setOfficials] = useState<OfficialItem[]>([]);
  const [officialActionId, setOfficialActionId] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<Record<string, number>>({});

  // Official's page (opened from the Officials list)
  const [activeOfficialId, setActiveOfficialId] = useState<string | null>(null);
  const [officialPostTick, setOfficialPostTick] = useState(0);
  const [liveReaction, setLiveReaction] = useState<{ postId: string; counts: any; at: number } | null>(null);
  const activeOfficialRef = useRef<string | null>(null);
  const activeOfficial = officials.find(o => o._id === activeOfficialId) || null;
  useEffect(() => { activeOfficialRef.current = activeOfficialId; }, [activeOfficialId]);

  // Opened from an "official post" push notification: /resident/community?officialId=...
  const { officialId: officialIdParam } = useLocalSearchParams<{ officialId?: string }>();
  useEffect(() => {
    if (officialIdParam) {
      setActiveSection(null);
      setActiveOfficialId(String(officialIdParam));
    }
  }, [officialIdParam]);

  const fetchOfficials = async () => {
    try {
      const res = await axios.get(`${API_URL}/officials`);
      if (Array.isArray(res.data)) setOfficials(res.data);
    } catch (err) {
      console.log('Error fetching officials:', err);
    }
  };

  useEffect(() => {
    axios.get(`${API_URL}/areas/current`).then(res => setAreaName(res.data?.name || '')).catch(() => {});
    AsyncStorage.getItem(LAST_SEEN_KEY).then(v => { if (v) setLastSeen(JSON.parse(v)); }).catch(() => {});
  }, []);

  const openSection = (sec: CommunitySectionItem, comm: CommunityItem) => {
    setActiveParentComm(comm);
    setActiveSection(sec);
    setLastSeen(prev => {
      const next = { ...prev, [sec._id]: Date.now() };
      AsyncStorage.setItem(LAST_SEEN_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const toggleFollowOfficial = async (o: OfficialItem) => {
    setOfficialActionId(o._id);
    try {
      const res = await axios.post(`${API_URL}/officials/${o._id}/${o.is_following ? 'unfollow' : 'follow'}`);
      setOfficials(prev => prev.map(x => (x._id === o._id ? { ...x, ...res.data } : x)));
      // Official status is shown to followers only
      refreshStoriesBar();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.msg || 'Failed to update follow status');
    } finally {
      setOfficialActionId(null);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const stored = await SecureStore.getItemAsync('userData');
        if (stored) {
          setCurrentUser(JSON.parse(stored));
        }
      } catch {}
    };
    loadUser();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCommunities();
      fetchOfficials();

      const onBackPress = () => {
        if (activeOfficialRef.current) {
          setActiveOfficialId(null);
          return true;
        }
        if (activeSectionRef.current) {
          setActiveSection(null);
          return true;
        }
        router.replace(backRoute as any);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [backRoute])
  );

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  useEffect(() => {
    const socket = io(SOCKET_URL, { ...socketAuth, 
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true
    });
    socketRef.current = socket;

    socket.on('community_created', () => fetchCommunities(false));
    socket.on('community_updated', () => fetchCommunities(false));
    socket.on('community_deleted', () => fetchCommunities(false));
    socket.on('community_section_created', () => fetchCommunities(false));
    socket.on('community_section_updated', () => fetchCommunities(false));
    socket.on('community_section_deleted', () => fetchCommunities(false));
    socket.on('officials_updated', () => fetchOfficials());
    socket.on('official_post_changed', ({ officialId }: { officialId: string }) => {
      if (officialId && officialId === activeOfficialRef.current) setOfficialPostTick(n => n + 1);
    });
    socket.on('official_post_reacted', ({ officialId, postId, counts }: any) => {
      if (officialId && officialId === activeOfficialRef.current && postId && counts) {
        setLiveReaction({ postId, counts, at: Date.now() });
      }
    });

    socket.on('new_community_message', (newMsg: CommunityMessageItem) => {
      const currentActiveId = activeSectionRef.current?._id;
      if (currentActiveId && newMsg.section_id === currentActiveId) {
        setMessages(prev => {
          if (prev.some(m => m._id === newMsg._id)) return prev;
          // Reconcile optimistic message
          const optIdx = prev.findIndex(m => m._id.startsWith('temp_') && m.text === newMsg.text);
          if (optIdx !== -1) {
            const copy = [...prev];
            copy[optIdx] = newMsg;
            return copy;
          }
          return [...prev, newMsg];
        });

        // Clear typing indicator for the sender who just sent the message
        if (newMsg.sender_name) {
          setCommunityTypingUsers(prev => prev.filter(u => u !== newMsg.sender_name));
        }

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 50);
      }
    });

    socket.on('community_user_typing', ({ sectionId, userName, userId, isTyping }: any) => {
      const myId = (currentUser?._id || currentUser?.id || '').toString();
      if (userId && myId && userId === myId) return;
      if (userName && (userName === currentUser?.name || userName === currentUser?.member_id)) return;

      const currentActiveId = activeSectionRef.current?._id;
      if (currentActiveId && currentActiveId === sectionId) {
        setCommunityTypingUsers(prev => {
          if (isTyping) {
            if (typingTimersRef.current[userName]) {
              clearTimeout(typingTimersRef.current[userName]);
            }
            typingTimersRef.current[userName] = setTimeout(() => {
              setCommunityTypingUsers(curr => curr.filter(u => u !== userName));
              delete typingTimersRef.current[userName];
            }, 3000);

            if (!prev.includes(userName)) {
              return [...prev, userName];
            }
            return prev;
          } else {
            if (typingTimersRef.current[userName]) {
              clearTimeout(typingTimersRef.current[userName]);
              delete typingTimersRef.current[userName];
            }
            return prev.filter(u => u !== userName);
          }
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Join/leave section socket room when activeSection changes
  useEffect(() => {
    setCommunityTypingUsers([]);
    setMsgText('');
    setUserAccess(null); // don't show the previous channel's permissions
    if (activeSection && socketRef.current) {
      socketRef.current.emit('join_community_section', activeSection._id);
      loadSectionMessages(activeSection._id);
    }
    return () => {
      if (activeSection && socketRef.current) {
        socketRef.current.emit('leave_community_section', activeSection._id);
      }
    };
  }, [activeSection?._id]);

  const fetchCommunities = async (showLoading = true) => {
    // Spinner only on the very first load; afterwards refresh silently in the
    // background and keep showing what is already on screen.
    if (showLoading && !communitiesLoadedRef.current) setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.get(`${API_URL}/community?include_sections=true`, {
        headers: { 'x-auth-token': token }
      });
      if (Array.isArray(res.data)) {
        setCommunities(res.data);
        communitiesLoadedRef.current = true;
      }
    } catch (err) {
      console.error('Error fetching communities:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCommunities(false);
  };

  const loadSectionMessages = async (sectionId: string) => {
    setLoadingMessages(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.get(`${API_URL}/community/sections/${sectionId}/messages`, {
        headers: { 'x-auth-token': token }
      });
      setMessages(res.data?.messages || []);
      setRequiresFollow(!!res.data?.requires_follow);
      setUserAccess(res.data?.user_access || null);
    } catch (err) {
      console.error('Error loading section messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Follow / Unfollow section
  const handleToggleFollow = async (section: CommunitySectionItem, parentComm: CommunityItem) => {
    setFollowingActionId(section._id);
    const isCurrentlyFollowing = !!section.user_access?.is_following;

    try {
      const token = await SecureStore.getItemAsync('userToken');
      const endpoint = isCurrentlyFollowing ? 'unfollow' : 'follow';
      const res = await axios.post(`${API_URL}/community/sections/${section._id}/${endpoint}`, {}, {
        headers: { 'x-auth-token': token }
      });

      const nextIsFollowing = !isCurrentlyFollowing;

      // Update local state in communities list
      setCommunities(prev => prev.map(c => {
        if (c._id !== parentComm._id) return c;
        const updatedSections = (c.sections || []).map(s => {
          if (s._id !== section._id) return s;
          const currentCount = s.followers_count || 0;
          return {
            ...s,
            followers_count: nextIsFollowing ? currentCount + 1 : Math.max(0, currentCount - 1),
            user_access: {
              ...(s.user_access || { can_send: false, is_assigned: false, is_admin: false }),
              can_view: nextIsFollowing,
              is_following: nextIsFollowing
            }
          };
        });
        return { ...c, sections: updatedSections };
      }));

      // If this is the active section, update activeSection
      if (activeSection && activeSection._id === section._id) {
        setActiveSection(prev => prev ? ({
          ...prev,
          followers_count: res.data?.follower_count ?? (nextIsFollowing ? (prev.followers_count || 0) + 1 : Math.max(0, (prev.followers_count || 0) - 1)),
          user_access: {
            ...(prev.user_access || { can_send: false, is_assigned: false, is_admin: false }),
            can_view: nextIsFollowing,
            is_following: nextIsFollowing
          }
        }) : null);

        setRequiresFollow(!nextIsFollowing);
        if (nextIsFollowing) {
          loadSectionMessages(section._id);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.msg || 'Failed to update follow status');
    } finally {
      setFollowingActionId(null);
    }
  };

  // Continuous typing event handler
  const handleTextChange = (text: string) => {
    setMsgText(text);

    if (!socketRef.current || !activeSection) return;
    const myName = currentUser?.name || currentUser?.member_id || 'Member';
    const myId = currentUser?._id || '';

    if (text.trim().length > 0) {
      const now = Date.now();
      if (!isTypingRef.current || (now - lastTypingHeartbeatRef.current > 1500)) {
        isTypingRef.current = true;
        lastTypingHeartbeatRef.current = now;
        socketRef.current.emit('community_typing_start', {
          sectionId: activeSection._id,
          userName: myName,
          userId: myId
        });
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        lastTypingHeartbeatRef.current = 0;
        socketRef.current?.emit('community_typing_stop', {
          sectionId: activeSection._id,
          userName: myName,
          userId: myId
        });
      }, 2000);
    } else {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        lastTypingHeartbeatRef.current = 0;
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        socketRef.current.emit('community_typing_stop', {
          sectionId: activeSection._id,
          userName: myName,
          userId: myId
        });
      }
    }
  };

  // Post message in section (Admin or Assigned Members) - WhatsApp-style instant send
  const handleSendMessage = async () => {
    if (!msgText.trim() || !activeSection) return;

    const textToSend = msgText.trim();
    const myName = currentUser?.name || currentUser?.member_id || 'You';
    const myRole = currentUser?.role || 'Resident';
    const myDesignation = currentUser?.designation || '';
    const myId = currentUser?._id || '';

    // Immediately stop typing
    if (isTypingRef.current) {
      isTypingRef.current = false;
      lastTypingHeartbeatRef.current = 0;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socketRef.current?.emit('community_typing_stop', {
        sectionId: activeSection._id,
        userName: myName,
        userId: myId
      });
    }

    // 1. WhatsApp-style instant optimistic send (0ms delay)
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const optimisticMsg: CommunityMessageItem = {
      _id: tempId,
      section_id: activeSection._id,
      community_id: activeSection.community_id,
      sender: myId,
      sender_name: myName,
      sender_role: myRole,
      sender_designation: myDesignation,
      text: textToSend,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setMsgText('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 40);

    // 2. Background HTTP request
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.post(`${API_URL}/community/sections/${activeSection._id}/messages`, {
        text: textToSend
      }, {
        headers: { 'x-auth-token': token }
      });
      if (res.data) {
        setMessages(prev => {
          if (prev.some(m => m._id === res.data._id)) {
            return prev.filter(m => m._id !== tempId);
          }
          const hasTemp = prev.some(m => m._id === tempId);
          if (hasTemp) {
            return prev.map(m => m._id === tempId ? res.data : m);
          }
          return [...prev, res.data];
        });
      }
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m._id !== tempId));
      Alert.alert('Notice', err.response?.data?.msg || 'Could not send message');
    }
  };

  const getSectionIconName = (icon: string) => {
    switch (icon) {
      case 'flash':
      case 'zap':
        return 'flash';
      case 'shield':
        return 'shield-checkmark';
      case 'water':
      case 'droplets':
        return 'water';
      case 'chatbubbles':
        return 'chatbubbles';
      case 'home':
        return 'home';
      case 'megaphone':
      default:
        return 'megaphone';
    }
  };

  const formatMessageTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  // All channels across communities, most recent activity first
  const q = searchQuery.trim().toLowerCase();
  const channelRows = communities
    .flatMap(comm => (comm.sections || []).map(sec => ({ sec, comm })))
    .filter(({ sec, comm }) => !q
      || sec.name.toLowerCase().includes(q)
      || (sec.description || '').toLowerCase().includes(q)
      || comm.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const ta = a.sec.last_message?.timestamp ? new Date(a.sec.last_message.timestamp).getTime() : 0;
      const tb = b.sec.last_message?.timestamp ? new Date(b.sec.last_message.timestamp).getTime() : 0;
      return tb - ta;
    });

  const filteredOfficials = officials.filter(o => !q
    || o.name.toLowerCase().includes(q)
    || (o.designation || '').toLowerCase().includes(q)
    || (o.ward || '').toLowerCase().includes(q));

  return (
    <SafeAreaView style={[styles.safeArea, !activeSection && { backgroundColor: '#F4F6FA' }]}>
      <StatusBar barStyle={activeSection ? 'light-content' : 'dark-content'} />

      {/* HEADER (only inside a channel; the list view has its own light header) */}
      {activeSection && (
      <View style={[styles.headerBar, { backgroundColor: headerThemeColor }]}>
        <TouchableOpacity
          onPress={() => setActiveSection(null)}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>{activeSection.name}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {`${activeParentComm?.name || 'Community'} • ${activeSection.followers_count || 0} followers`}
          </Text>
        </View>

        <View style={{ width: 36 }} />
      </View>
      )}

      {/* An official's page (opened on top of the list) */}
      {activeOfficial && !activeSection && (
        <OfficialProfile
          official={activeOfficial}
          initials={getSenderInitials(activeOfficial.name, 'O')}
          avatarBg={officialPalette(activeOfficial.name).bg}
          avatarFg={officialPalette(activeOfficial.name).fg}
          metaText={officialMeta(activeOfficial)}
          followLoading={officialActionId === activeOfficial._id}
          refreshTick={officialPostTick}
          liveReaction={liveReaction}
          onBack={() => setActiveOfficialId(null)}
          onToggleFollow={() => toggleFollowOfficial(activeOfficial)}
        />
      )}

      {/* VIEW 1: STATUS, CHANNELS & OFFICIALS
          Stays mounted (just hidden) while a channel / official is open, like WhatsApp:
          coming back keeps the scroll position and the Status row with no reload. */}
      <View style={{ flex: 1, display: activeSection || activeOfficial ? 'none' : 'flex' }}>
        <ScrollView
          style={{ backgroundColor: '#F4F6FA' }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[headerThemeColor]} />}
        >
          {/* Title header */}
          <View style={styles.lvHeader}>
            <View style={{ flex: 1 }}>
              {!!areaName && <Text style={styles.lvArea} numberOfLines={1}>{areaName}</Text>}
              <Text style={styles.lvTitle}>{t('community.title', { defaultValue: 'Community' })}</Text>
            </View>
            <TouchableOpacity
              style={styles.lvSearchBtn}
              activeOpacity={0.7}
              onPress={() => { if (showSearch) setSearchQuery(''); setShowSearch(!showSearch); }}
            >
              <Ionicons name={showSearch ? 'close' : 'search'} size={20} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {showSearch && (
            <View style={styles.searchBarWrap}>
              <Ionicons name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search channels & officials..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
            </View>
          )}

          {/* WhatsApp-style category stories (posted by staff) */}
          {/* Hidden (not unmounted) while searching, so it never reloads */}
          <View style={{ display: searchQuery ? 'none' : 'flex' }}>
            <StoriesBar title={t('community.status', { defaultValue: 'Status' })} />
          </View>

          {/* CHANNELS */}
          <View style={styles.lvSectionHead}>
            <Text style={styles.lvSectionTitle}>{t('community.channels', { defaultValue: 'Channels' })}</Text>
            {channelRows.length > 0 && (
              <Text style={styles.lvSectionHint}>{channelRows.filter(r => r.sec.user_access?.is_following).length} following</Text>
            )}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={headerThemeColor} style={{ marginVertical: 30 }} />
          ) : channelRows.length === 0 ? (
            <View style={styles.lvCard}>
              <Text style={styles.lvEmpty}>{searchQuery ? 'No matching channels' : (t('community.noNotifications') || 'No community channels are available at this time.')}</Text>
            </View>
          ) : (
            <View style={styles.lvCard}>
              {channelRows.map(({ sec, comm }, idx) => {
                const isFollowing = !!sec.user_access?.is_following;
                const ts = sec.last_message?.timestamp;
                const unread = isFollowing && !!ts && new Date(ts).getTime() > (lastSeen[sec._id] || 0);
                const tint = comm.color || '#2563EB';
                return (
                  <TouchableOpacity
                    key={sec._id}
                    style={[styles.chRow, idx > 0 && styles.rowDivider]}
                    activeOpacity={0.7}
                    onPress={() => openSection(sec, comm)}
                  >
                    <View style={[styles.chAvatar, { backgroundColor: tint }]}>
                      <Text style={styles.chAvatarText}>{getSenderInitials(sec.name, 'C')}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={styles.nameRow}>
                        <Text style={styles.chName} numberOfLines={2}>{sec.name}</Text>
                        {sec.section_type === 'announcement' && <Ionicons name="checkmark-circle" size={15} color="#2563EB" style={{ marginLeft: 4 }} />}
                      </View>
                      <Text style={styles.chPreview} numberOfLines={1}>
                        {!isFollowing
                          ? 'Tap to follow this channel'
                          : sec.last_message?.text
                            ? `${sec.last_message.sender_name ? sec.last_message.sender_name + ': ' : ''}${sec.last_message.text}`
                            : (sec.description || comm.name)}
                      </Text>
                    </View>
                    <View style={styles.chMeta}>
                      {!!ts && <Text style={[styles.chTime, unread && { color: '#2563EB', fontWeight: '700' }]}>{formatMessageTime(ts)}</Text>}
                      {unread ? <View style={styles.unreadDot} /> : !isFollowing ? <Ionicons name="add-circle-outline" size={18} color="#94A3B8" /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* OFFICIALS */}
          {filteredOfficials.length > 0 && (
            <>
              <View style={styles.lvSectionHead}>
                <Text style={styles.lvSectionTitle}>{t('community.officials', { defaultValue: 'Officials' })}</Text>
                <Text style={styles.lvSectionHint}>
                  Following {officials.filter(o => o.is_following).length} of {officials.length}
                </Text>
              </View>
              <View style={styles.lvCard}>
                {filteredOfficials.map((o, idx) => {
                  const pal = officialPalette(o.name);
                  const meta = officialMeta(o);
                  return (
                    <View key={o._id} style={[styles.ofRow, idx > 0 && styles.rowDivider]}>
                      <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} activeOpacity={0.7} onPress={() => setActiveOfficialId(o._id)}>
                        <View style={[styles.ofAvatar, { backgroundColor: pal.bg }]}>
                          <Text style={[styles.ofAvatarText, { color: pal.fg }]}>{getSenderInitials(o.name, 'O')}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
                          <View style={styles.nameRow}>
                            <Text style={styles.ofName} numberOfLines={1}>{o.name}</Text>
                            {o.verified && <Ionicons name="checkmark-circle" size={15} color="#2563EB" style={{ marginLeft: 4 }} />}
                            {o.is_mine && (
                              <View style={styles.yourPageBadge}><Text style={styles.yourPageText}>Your page</Text></View>
                            )}
                          </View>
                          <Text style={styles.ofMeta} numberOfLines={1}>{meta}</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.ofBtn, o.is_following ? styles.ofBtnFollowing : styles.ofBtnFollow]}
                        activeOpacity={0.7}
                        disabled={officialActionId === o._id}
                        onPress={() => toggleFollowOfficial(o)}
                      >
                        {officialActionId === o._id ? (
                          <ActivityIndicator size="small" color="#2563EB" />
                        ) : (
                          <Text style={[styles.ofBtnText, { color: o.is_following ? '#0F172A' : '#2563EB' }]}>
                            {o.is_following ? (t('community.following') || 'Following') : `+ ${t('community.follow') || 'Follow'}`}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </>
          )}
          <View style={{ height: 110 }} />
        </ScrollView>
      </View>

      {activeSection && (
        /* VIEW 2: ACTIVE CHANNEL / SECTION MESSAGES STREAM */
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {/* Channel Banner Info */}
          <View style={styles.channelHeaderBar}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.channelNameText}>{activeSection.name}</Text>
              <Text style={styles.channelDescText} numberOfLines={2}>
                {activeSection.description || 'Community broadcast & updates'}
              </Text>
            </View>

            {/* Follow Toggle */}
            <TouchableOpacity 
              style={[
                styles.channelHeaderFollowBtn,
                activeSection.user_access?.is_following ? styles.channelHeaderFollowing : styles.channelHeaderNotFollowing
              ]}
              onPress={() => activeParentComm && handleToggleFollow(activeSection, activeParentComm)}
              disabled={followingActionId === activeSection._id}
            >
              <Ionicons 
                name={activeSection.user_access?.is_following ? "checkmark" : "add"} 
                size={14} 
                color={activeSection.user_access?.is_following ? "#16A34A" : "#2563EB"} 
              />
              <Text style={[styles.channelHeaderFollowBtnText, { color: activeSection.user_access?.is_following ? "#16A34A" : "#2563EB" }]}>
                {activeSection.user_access?.is_following ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Messages Feed OR Follow-Gate */}
          {loadingMessages ? (
            <View style={styles.loadingFeed}>
              <ActivityIndicator size="large" color={headerThemeColor} />
            </View>
          ) : requiresFollow && !activeSection.user_access?.is_following ? (
            /* Follow Required Screen */
            <View style={styles.followGateBox}>
              <View style={styles.lockIconCircle}>
                <Ionicons name="notifications-outline" size={44} color="#D97706" />
              </View>
              <Text style={styles.followGateTitle}>Follow to View Updates</Text>
              <Text style={styles.followGateDesc}>
                {t('community.followToRead') || 'Follow this channel to get visible read-only access to power notices, community updates, and alerts.'}
              </Text>

              <TouchableOpacity 
                style={styles.gateFollowBtn}
                activeOpacity={0.8}
                onPress={() => activeParentComm && handleToggleFollow(activeSection, activeParentComm)}
              >
                <Ionicons name="add-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.gateFollowBtnText}>
                  {t('community.follow') || 'Follow Channel for Read Access'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Active Messages List */
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={item => item._id}
              contentContainerStyle={styles.messagesListContent}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={<TypingIndicator typingUsers={communityTypingUsers} />}
              ListEmptyComponent={
                <View style={styles.emptyMessagesBox}>
                  <Ionicons name="chatbubble-ellipses-outline" size={40} color="#CBD5E1" />
                  <Text style={styles.emptyMessagesTitle}>No Messages Yet</Text>
                  <Text style={styles.emptyMessagesDesc}>
                    Updates and announcements posted by administration will appear here.
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isAdmin = item.sender_role === 'Admin' || item.sender_role === 'SubAdmin';
                const senderName = item.sender_name || (isAdmin ? 'Admin' : 'Member');
                const initials = getSenderInitials(senderName);
                const avatarColor = getAvatarColor(senderName, isAdmin);

                return (
                  <View style={styles.messageCard}>
                    <View style={styles.messageHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <View style={[styles.msgAvatarCircle, { backgroundColor: avatarColor.bg }]}>
                          <Text style={[styles.msgAvatarText, { color: avatarColor.text }]}>{initials}</Text>
                        </View>
                        <View style={styles.senderPill}>
                          <Ionicons 
                            name={isAdmin ? "shield-checkmark" : "person"} 
                            size={12} 
                            color={isAdmin ? "#2563EB" : "#475569"} 
                            style={{ marginRight: 4 }}
                          />
                          <Text style={styles.senderName}>{item.sender_name}</Text>
                          {item.sender_role && (
                            <Text style={styles.senderRoleBadge}>• {item.sender_role}</Text>
                          )}
                        </View>
                      </View>
                      <Text style={styles.messageTimeText}>{formatMessageTime(item.createdAt)}</Text>
                    </View>

                    <Text style={styles.messageBodyText}>{item.text}</Text>
                  </View>
                );
              }}
            />
          )}

          {/* Bottom Bar: Read-only Notice OR Post Input */}
          {(userAccess?.can_send ?? activeSection.user_access?.can_send) ? (
            /* Message Input for Assigned Members / Admin */
            <View style={styles.inputContainer}>
              <TextInput 
                style={styles.chatInput}
                placeholder="Post update in this channel..."
                placeholderTextColor="#94A3B8"
                value={msgText}
                onChangeText={handleTextChange}
                multiline
              />
              <TouchableOpacity 
                style={[styles.sendBtn, !msgText.trim() && { opacity: 0.5 }]}
                disabled={!msgText.trim()}
                onPress={handleSendMessage}
              >
                <Ionicons name="send" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            /* Read-Only Notice Bar for Followers */
            <View style={styles.readOnlyNoticeBar}>
              <Ionicons name="eye-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
              <Text style={styles.readOnlyNoticeText}>
                {t('community.readOnlyNotice') || 'You are following this channel with read-only access'}
              </Text>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  headerBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 16, 
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 24) : 18, 
    paddingBottom: 14, 
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 1,
  },
  backButton: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#FFFFFF', 
    textAlign: 'center' 
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
    textAlign: 'center'
  },

  contentContainer: {
    padding: 16,
    paddingTop: 12
  },

  // ---- List view (Status / Channels / Officials) ----
  listContent: {
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'android' ? 14 : 8,
  },
  lvHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  lvArea: { fontSize: 13, color: '#475569', fontWeight: '600', marginBottom: 2 },
  lvTitle: { fontSize: 30, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  lvSearchBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  lvSectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 10 },
  lvSectionTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  lvSectionHint: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  lvCard: {
    backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 14, marginBottom: 18,
    shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  lvEmpty: { paddingVertical: 22, textAlign: 'center', color: '#64748B', fontSize: 13 },
  rowDivider: { borderTopWidth: 1, borderTopColor: '#EEF2F7' },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  chRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  chAvatar: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chAvatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  chName: { fontSize: 15, fontWeight: '800', color: '#0F172A', flexShrink: 1 },
  chPreview: { fontSize: 12.5, color: '#64748B', marginTop: 3 },
  chMeta: { alignItems: 'flex-end', justifyContent: 'center', marginLeft: 8, minWidth: 54, gap: 6 },
  chTime: { fontSize: 11, color: '#94A3B8' },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563EB' },
  ofRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  ofAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  ofAvatarText: { fontWeight: '800', fontSize: 14 },
  ofName: { fontSize: 14.5, fontWeight: '700', color: '#0F172A', flexShrink: 1 },
  ofMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  yourPageBadge: { marginLeft: 6, backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  yourPageText: { fontSize: 10, fontWeight: '800', color: '#15803D' },
  ofBtn: { minWidth: 86, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  ofBtnFollow: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  ofBtnFollowing: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  ofBtnText: { fontSize: 13, fontWeight: '700' },

  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    padding: 0
  },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 18,
    fontWeight: '500'
  },

  emptyState: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 60, 
    paddingHorizontal: 24 
  },
  emptyIconCircle: { 
    width: 72, 
    height: 72, 
    borderRadius: 36, 
    backgroundColor: '#F1F5F9', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  emptyTitle: { 
    fontSize: 17, 
    fontWeight: '700', 
    color: '#0F172A', 
    marginBottom: 6 
  },
  emptyText: { 
    fontSize: 13, 
    color: '#64748B', 
    textAlign: 'center',
    lineHeight: 18 
  },

  // Community Card
  communityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  communityBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  commIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  commTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2
  },
  commDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16
  },

  sectionsListWrap: {
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  noSectionsText: {
    padding: 16,
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center'
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionDetails: {
    flex: 1,
    marginRight: 10
  },
  sectionNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2
  },
  sectionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
    marginRight: 6
  },
  followerBadgeText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500'
  },
  sectionDesc: {
    fontSize: 12,
    color: '#64748B'
  },

  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  notFollowingBtn: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  followingBtn: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  followBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Active Channel Screen Styles
  channelHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  channelNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2
  },
  channelDescText: {
    fontSize: 12,
    color: '#64748B'
  },
  channelHeaderFollowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  channelHeaderNotFollowing: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  channelHeaderFollowing: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  channelHeaderFollowBtnText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4
  },

  loadingFeed: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },

  // Follow Gate
  followGateBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  lockIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  followGateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center'
  },
  followGateDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24
  },
  gateFollowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  gateFollowBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14
  },

  // Messages List
  messagesListContent: {
    padding: 16,
    paddingBottom: 24
  },
  emptyMessagesBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyMessagesTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 10,
    marginBottom: 4
  },
  emptyMessagesDesc: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 240
  },

  messageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  messageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  msgAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  msgAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
  senderPill: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  senderName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A'
  },
  senderRoleBadge: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '600',
    marginLeft: 4
  },
  messageTimeText: {
    fontSize: 11,
    color: '#94A3B8'
  },
  messageBodyText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20
  },

  // Bottom Notice Bar
  readOnlyNoticeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F1F5F9',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  readOnlyNoticeText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500'
  },

  // Input Bar (For Admins / Assigned Members)
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
    maxHeight: 100,
    marginRight: 8,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 10,
    paddingLeft: 4,
  },
  typingAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  typingAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },
  typingLabelText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    fontStyle: 'italic',
    maxWidth: 180,
  }
});
