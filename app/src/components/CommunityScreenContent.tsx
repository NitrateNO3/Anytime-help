import React, { useEffect, useState, useCallback, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  View, Text, StyleSheet, ScrollView, Platform, ActivityIndicator, 
  StatusBar, TouchableOpacity, RefreshControl, BackHandler, TextInput,
  FlatList, Alert, KeyboardAvoidingView, Animated, Easing
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { io, Socket } from 'socket.io-client';

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

      const onBackPress = () => {
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
    const socket = io(SOCKET_URL, { 
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
    if (showLoading) setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.get(`${API_URL}/community?include_sections=true`, {
        headers: { 'x-auth-token': token }
      });
      if (Array.isArray(res.data)) {
        setCommunities(res.data);
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
        setMessages(prev => prev.map(m => m._id === tempId ? res.data : m));
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

  const filteredCommunities = communities.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.sections || []).some(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={[styles.headerBar, { backgroundColor: headerThemeColor }]}>
        <TouchableOpacity 
          onPress={() => {
            if (activeSection) {
              setActiveSection(null);
            } else {
              router.replace(backRoute as any);
            }
          }} 
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {activeSection ? activeSection.name : (t('community.title') || 'Community')}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {activeSection 
              ? `${activeParentComm?.name || 'Community'} • ${activeSection.followers_count || 0} followers` 
              : (t('community.subtitle') || 'Official channels & updates')}
          </Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      {/* VIEW 1: COMMUNITIES & SECTIONS LIST */}
      {!activeSection ? (
        <ScrollView 
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[headerThemeColor]} />}
        >
          {/* Search Bar */}
          <View style={styles.searchBarWrap}>
            <Ionicons name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput 
              style={styles.searchInput}
              placeholder="Search community channels..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Info Banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={20} color="#2563EB" style={{ marginRight: 8, marginTop: 1 }} />
            <Text style={styles.infoBannerText}>
              Follow channels (e.g. Electricity) for live updates. Followers get visible read-only access.
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={headerThemeColor} style={{ marginTop: 40 }} />
          ) : filteredCommunities.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="people-outline" size={40} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>No Communities Found</Text>
              <Text style={styles.emptyText}>
                {t('community.noNotifications') || 'No community channels are available at this time.'}
              </Text>
            </View>
          ) : (
            filteredCommunities.map(comm => (
              <View key={comm._id} style={styles.communityCard}>
                {/* Community Top Banner */}
                <View style={styles.communityBannerHeader}>
                  <View style={[styles.commIconBadge, { backgroundColor: `${comm.color || '#F59E0B'}22` }]}>
                    <Ionicons 
                      name={getSectionIconName(comm.icon) as any} 
                      size={22} 
                      color={comm.color || '#F59E0B'} 
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.commTitle}>{comm.name}</Text>
                    <Text style={styles.commDesc} numberOfLines={2}>{comm.description || 'Official community'}</Text>
                  </View>
                </View>

                {/* Sections List under this community */}
                <View style={styles.sectionsListWrap}>
                  {(!comm.sections || comm.sections.length === 0) ? (
                    <Text style={styles.noSectionsText}>No channels added yet.</Text>
                  ) : (
                    comm.sections.map(sec => {
                      const isFollowing = !!sec.user_access?.is_following;
                      const isAssigned = !!sec.user_access?.is_assigned;
                      const isActionLoading = followingActionId === sec._id;

                      return (
                        <TouchableOpacity 
                          key={sec._id}
                          style={styles.sectionItem}
                          activeOpacity={0.7}
                          onPress={() => {
                            setActiveParentComm(comm);
                            setActiveSection(sec);
                          }}
                        >
                          {/* Channel Icon */}
                          <View style={[styles.sectionIconBadge, { backgroundColor: sec.section_type === 'discussion' ? '#EFF6FF' : '#FEF3C7' }]}>
                            <Ionicons 
                              name={getSectionIconName(sec.icon) as any} 
                              size={20} 
                              color={sec.section_type === 'discussion' ? '#2563EB' : '#D97706'} 
                            />
                          </View>

                          {/* Channel Details */}
                          <View style={styles.sectionDetails}>
                            <View style={styles.sectionNameRow}>
                              <Text style={styles.sectionName} numberOfLines={1}>{sec.name}</Text>
                              <Text style={styles.followerBadgeText}>
                                {sec.followers_count || 0} followers
                              </Text>
                            </View>

                            <Text style={styles.sectionDesc} numberOfLines={1}>
                              {sec.last_message?.text 
                                ? `${sec.last_message.sender_name}: ${sec.last_message.text}` 
                                : (sec.description || 'Tap to view channel updates')}
                            </Text>
                          </View>

                          {/* Follow Button */}
                          <TouchableOpacity
                            style={[
                              styles.followBtn,
                              isFollowing ? styles.followingBtn : styles.notFollowingBtn
                            ]}
                            activeOpacity={0.7}
                            disabled={isActionLoading}
                            onPress={() => handleToggleFollow(sec, comm)}
                          >
                            {isActionLoading ? (
                              <ActivityIndicator size="small" color={isFollowing ? '#16A34A' : '#2563EB'} />
                            ) : (
                              <>
                                <Ionicons 
                                  name={isFollowing ? "checkmark-circle" : "add-circle-outline"} 
                                  size={14} 
                                  color={isFollowing ? "#16A34A" : "#2563EB"} 
                                  style={{ marginRight: 3 }}
                                />
                                <Text style={[styles.followBtnText, { color: isFollowing ? '#16A34A' : '#2563EB' }]}>
                                  {isFollowing ? (t('community.following') || 'Following') : (t('community.follow') || 'Follow')}
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              </View>
            ))
          )}
          <View style={{ height: 60 }} />
        </ScrollView>
      ) : (
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
          {activeSection.user_access?.can_send ? (
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
