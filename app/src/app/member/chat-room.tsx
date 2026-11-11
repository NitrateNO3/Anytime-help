// Group chat room (members and residents).
//
// Loading works the way WhatsApp does it:
//   1. The last messages seen are cached on the phone, so a chat opens instantly.
//   2. Only the newest page (PAGE_SIZE messages) comes from the server; older
//      pages load in chunks as the user scrolls up.
//   3. Live messages, edits and deletes come over the socket. After a reconnect
//      or when the app comes back to the foreground, only what changed since
//      the last sync is fetched (`?since=`), instead of re-downloading the chat.
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar, Keyboard, Animated, Easing, BackHandler, AppState, Modal, LayoutAnimation, Linking, PanResponder, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { AppAlert } from '../../components/AppAlert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';
import { socketAuth } from '../../utils/socketAuth';
import { getChatCacheUserId, chatRoomCacheKey } from '../../utils/chatCache';
import { markChatRead, setActiveChatGroup } from '../../utils/chatUnread';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

const PAGE_SIZE = 30;          // messages per chunk from the server
const CACHE_LIMIT = 60;        // newest messages kept on the phone per chat
const SAFETY_SYNC_MS = 20000;  // light catch-up in case a socket event was missed
const GROUP_GAP_MS = 5 * 60 * 1000; // consecutive messages within 5 min are grouped

interface ChatMessageItem {
  _id: string;
  group_id: string;
  sender: any;
  sender_name: string;
  sender_role: string;
  sender_designation?: string;
  text: string;
  reply_to?: {
    message_id: string;
    sender_name: string;
    text: string;
  };
  is_edited?: boolean;
  is_deleted?: boolean;
  createdAt: string;
  updatedAt?: string;
  // client-only
  is_optimistic?: boolean;
  failed?: boolean;
  reply_to_message_id?: string;
}

type ListRow =
  | { kind: 'msg'; key: string; msg: ChatMessageItem; firstOfGroup: boolean; lastOfGroup: boolean }
  | { kind: 'date'; key: string; label: string };

// ---------- helpers ----------

const AVATAR_PALETTES = [
  '#2563EB', '#7C3AED', '#DB2777', '#059669', '#D97706',
  '#0891B2', '#4F46E5', '#EA580C', '#0D9488', '#475569',
];

const getSenderInitials = (name?: string, fallback = 'U'): string => {
  if (!name || typeof name !== 'string') return fallback;
  const clean = name.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) {
    const word = parts[0];
    if (word.includes('-')) {
      const sub = word.split('-').filter(Boolean);
      if (sub[0] && sub[0].length >= 2 && /^[A-Za-z]+$/.test(sub[0])) return sub[0].slice(0, 2).toUpperCase();
      return word.slice(0, 2).toUpperCase();
    }
    return word.charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const colorForName = (name?: string, isAdmin = false) => {
  if (isAdmin) return '#0F172A';
  if (!name) return '#475569';
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
};

const idOf = (v: any) => ((v && (v._id || v.id)) || v || '').toString().trim();

const isTemp = (m: ChatMessageItem) => m._id.startsWith('temp_') || !!m.is_optimistic;

const sortChrono = (a: ChatMessageItem, b: ChatMessageItem) => {
  const t = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  if (t !== 0) return t;
  return a._id < b._id ? -1 : a._id > b._id ? 1 : 0;
};

// Merge server messages into the current list: replace by id, keep pending
// optimistic messages the server has not confirmed yet, keep chronological order.
const mergeMessages = (prev: ChatMessageItem[], incoming: ChatMessageItem[]) => {
  if (!incoming.length) return prev;
  const byId = new Map<string, ChatMessageItem>();
  prev.forEach((m) => byId.set(m._id, m));
  incoming.forEach((m) => byId.set(m._id, { ...byId.get(m._id), ...m }));
  let merged = Array.from(byId.values());
  // Drop an optimistic copy once the real message with the same text from the same sender exists
  const temps = merged.filter(isTemp);
  if (temps.length) {
    const real = merged.filter((m) => !isTemp(m));
    merged = merged.filter((m) => {
      if (!isTemp(m) || m.failed) return true;
      return !real.some((r) => r.text.trim() === m.text.trim() && idOf(r.sender) === idOf(m.sender)
        && new Date(r.createdAt).getTime() >= new Date(m.createdAt).getTime() - 60000);
    });
  }
  return merged.sort(sortChrono);
};

const dayLabel = (d: Date) => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString([], { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
};

const formatTime = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// ---------- typing indicator ----------

function TypingIndicator({ typingUsers }: { typingUsers: string[] }) {
  const anim = useRef(new Animated.Value(0)).current;
  const active = typingUsers.length > 0;

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(Animated.timing(anim, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [active, anim]);

  if (!active) return null;

  const dot = (peak: number) => ({
    opacity: anim.interpolate({ inputRange: [0, Math.max(peak - 0.2, 0), peak, Math.min(peak + 0.2, 1), 1], outputRange: [0.35, 0.35, 1, 0.35, 0.35] }),
    transform: [{ translateY: anim.interpolate({ inputRange: [0, Math.max(peak - 0.2, 0), peak, Math.min(peak + 0.2, 1), 1], outputRange: [0, 0, -4, 0, 0] }) }],
  });

  const label = typingUsers.length === 1 ? `${typingUsers[0]} is typing` : `${typingUsers.length} people are typing`;

  return (
    <View style={styles.typingRow}>
      <View style={styles.typingBubble}>
        <Animated.View style={[styles.typingDot, dot(0.2)]} />
        <Animated.View style={[styles.typingDot, dot(0.4)]} />
        <Animated.View style={[styles.typingDot, dot(0.6)]} />
      </View>
      <Text style={styles.typingLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ---------- tappable phone numbers, links and emails ----------

// URL | email | Indian phone number (10 digits, optional +91 / 0, spaces or dashes allowed)
const LINK_RE = /(https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]+|[\w.+-]+@[\w-]+\.[\w.-]+|(?:\+91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}\b)/g;

const openLink = (raw: string) => {
  let url = raw.trim().replace(/[),.;!?]+$/, '');
  if (/@/.test(url) && !/^https?:/i.test(url)) url = `mailto:${url}`;
  else if (/^[+\d]/.test(url) && !/^https?:/i.test(url)) url = `tel:${url.replace(/[\s-]/g, '')}`;
  else if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  Linking.openURL(url).catch(() => AppAlert.alert('Cannot open', raw));
};

function LinkedText({ text, style, linkStyle, onLongPress }: { text: string; style: any; linkStyle: any; onLongPress?: () => void }) {
  const parts = useMemo(() => {
    const out: { t: string; link: boolean }[] = [];
    let last = 0;
    text.replace(LINK_RE, (match, _g, offset: number) => {
      if (offset > last) out.push({ t: text.slice(last, offset), link: false });
      out.push({ t: match, link: true });
      last = offset + match.length;
      return match;
    });
    if (last < text.length) out.push({ t: text.slice(last), link: false });
    return out;
  }, [text]);

  if (parts.length === 1 && !parts[0].link) return <Text style={style}>{text}</Text>;
  return (
    <Text style={style}>
      {parts.map((p, i) => (p.link
        ? <Text key={i} style={linkStyle} onPress={() => openLink(p.t)} onLongPress={onLongPress} suppressHighlighting={false}>{p.t}</Text>
        : <Text key={i}>{p.t}</Text>))}
    </Text>
  );
}

// ---------- swipe right to reply ----------

const SWIPE_TRIGGER = 56;

function SwipeToReply({ enabled, onReply, children }: { enabled: boolean; onReply: () => void; children: React.ReactNode }) {
  const dx = useRef(new Animated.Value(0)).current;
  const triggered = useRef(false);
  const onReplyRef = useRef(onReply);
  onReplyRef.current = onReply;

  const responder = useMemo(() => PanResponder.create({
    // Only clear horizontal drags to the right; vertical scrolling stays with the list
    onMoveShouldSetPanResponder: (_, g) => enabled && g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => {
      const x = Math.max(0, Math.min(g.dx, 90));
      dx.setValue(x);
      triggered.current = x >= SWIPE_TRIGGER;
    },
    onPanResponderRelease: () => {
      if (triggered.current) onReplyRef.current();
      triggered.current = false;
      Animated.spring(dx, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
    },
    onPanResponderTerminate: () => {
      triggered.current = false;
      Animated.spring(dx, { toValue: 0, useNativeDriver: true }).start();
    },
  }), [enabled, dx]);

  const iconOpacity = dx.interpolate({ inputRange: [0, SWIPE_TRIGGER], outputRange: [0, 1], extrapolate: 'clamp' });
  const iconScale = dx.interpolate({ inputRange: [0, SWIPE_TRIGGER], outputRange: [0.5, 1], extrapolate: 'clamp' });

  return (
    <View {...responder.panHandlers}>
      <Animated.View style={[styles.swipeIcon, { opacity: iconOpacity, transform: [{ scale: iconScale }] }]}>
        <Ionicons name="arrow-undo" size={16} color="#2563EB" />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: dx }] }}>{children}</Animated.View>
    </View>
  );
}

// ---------- screen ----------

export default function MemberChatRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { groupId, groupName, groupType, canSend, returnTo } = useLocalSearchParams();

  const cleanGroupId = (Array.isArray(groupId) ? groupId[0] : (groupId || '')).toString().trim();
  const isWriteAllowed = canSend === '1';
  const title = (Array.isArray(groupName) ? groupName[0] : groupName) || 'Committee Chat';

  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [inputText, setInputText] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const currentUserRef = useRef<any>(null);
  const [groupDetails, setGroupDetails] = useState<any>(null);
  // iOS: space kept under the composer while the keyboard is open. Measured
  // from the keyboard itself, minus the bottom safe area the screen already
  // pads, so the input sits right on top of the keyboard with no gap.
  const [iosKeyboardSpace, setIosKeyboardSpace] = useState(0);

  const [replyingTo, setReplyingTo] = useState<ChatMessageItem | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessageItem | null>(null);
  const [actionMessage, setActionMessage] = useState<ChatMessageItem | null>(null);

  // Jump to a message (reply quote / search result) and flash it
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const pendingJumpRef = useRef<string | null>(null);
  const highlightTimerRef = useRef<any>(null);

  // In-chat search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessageItem[]>([]);
  const [searching, setSearching] = useState(false);

  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const isTypingRef = useRef(false);
  const lastTypingHeartbeatRef = useRef(0);
  const typingTimeoutRef = useRef<any>(null);
  const typingTimersRef = useRef<{ [userName: string]: any }>({});

  const [showJump, setShowJump] = useState(false);
  const [unseenCount, setUnseenCount] = useState(0);
  const atBottomRef = useRef(true);

  const flatListRef = useRef<FlatList<ListRow>>(null);
  const socketRef = useRef<Socket | null>(null);
  const tokenRef = useRef<string | null>(null);
  const lastSyncRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessageItem[]>([]);
  const loadingOlderRef = useRef(false);
  const syncingRef = useRef(false);
  const cacheKeyRef = useRef<string | null>(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // This chat is open: it counts as read now and again when leaving
  useEffect(() => {
    if (!cleanGroupId) return;
    setActiveChatGroup(cleanGroupId);
    markChatRead(cleanGroupId);
    return () => {
      setActiveChatGroup(null);
      markChatRead(cleanGroupId);
    };
  }, [cleanGroupId]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const animate = (duration?: number) => {
      LayoutAnimation.configureNext({
        duration: duration || 250,
        update: { type: LayoutAnimation.Types.keyboard },
      });
    };
    const show = Keyboard.addListener('keyboardWillShow', (e) => {
      animate(e.duration);
      setIosKeyboardSpace(Math.max(e.endCoordinates.height - insets.bottom, 0));
    });
    const hide = Keyboard.addListener('keyboardWillHide', (e) => {
      animate(e.duration);
      setIosKeyboardSpace(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, [insets.bottom]);

  const myId = idOf(currentUser);
  const roleLower = (currentUser?.role || '').toLowerCase();
  const iAmAdmin = roleLower === 'admin' || roleLower === 'subadmin';

  // ---------- navigation ----------

  const handleBackToChats = useCallback(() => {
    if (returnTo && typeof returnTo === 'string') {
      router.replace(returnTo as any);
      return;
    }
    if ((currentUserRef.current?.role || currentUser?.role) === 'Resident') {
      router.replace('/resident/chats' as any);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/member/chats' as any);
  }, [router, returnTo, currentUser?.role]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (actionMessage) { setActionMessage(null); return true; }
      if (searchOpen) { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); return true; }
      handleBackToChats();
      return true;
    });
    return () => sub.remove();
  }, [handleBackToChats, actionMessage, searchOpen]);

  // ---------- data ----------

  const getToken = async () => {
    if (!tokenRef.current) tokenRef.current = await SecureStore.getItemAsync('userToken');
    return tokenRef.current;
  };

  const saveCache = useCallback((list: ChatMessageItem[]) => {
    if (!cleanGroupId || !cacheKeyRef.current) return;
    const confirmed = list.filter((m) => !isTemp(m)).slice(-CACHE_LIMIT);
    AsyncStorage.setItem(cacheKeyRef.current, JSON.stringify({ messages: confirmed, lastSync: lastSyncRef.current }))
      .catch(() => {});
  }, [cleanGroupId]);

  // Persist the newest messages shortly after they change
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => saveCache(messages), 800);
    return () => clearTimeout(t);
  }, [messages, loading, saveCache]);

  const fetchPage = async (params: Record<string, string | number>) => {
    const token = await getToken();
    const res = await axios.get(`${API_URL}/chat/groups/${cleanGroupId}/messages`, {
      headers: { 'x-auth-token': token },
      params,
    });
    return res.data || {};
  };

  // Newest page from the server (first open without cache, or cache too stale)
  const loadLatest = async () => {
    const data = await fetchPage({ limit: PAGE_SIZE });
    const list: ChatMessageItem[] = Array.isArray(data.messages) ? data.messages : [];
    lastSyncRef.current = data.server_time || new Date().toISOString();
    setHasMore(data.has_more ?? list.length >= PAGE_SIZE);
    setMessages((prev) => {
      const pending = prev.filter(isTemp);
      return mergeMessages(list, pending);
    });
  };

  // Only what changed since the last sync: new messages plus edits and deletes
  const syncChanges = useCallback(async () => {
    if (!cleanGroupId || syncingRef.current) return;
    if (!lastSyncRef.current) return;
    syncingRef.current = true;
    try {
      const data = await fetchPage({ since: lastSyncRef.current, limit: 100 });
      const list: ChatMessageItem[] = Array.isArray(data.messages) ? data.messages : [];
      if (data.has_more) {
        // Too much happened while away: start again from the newest page
        await loadLatest();
      } else {
        if (data.server_time) lastSyncRef.current = data.server_time;
        if (list.length) {
          const before = messagesRef.current.length;
          setMessages((prev) => mergeMessages(prev, list));
          const newOnes = list.filter((m) => !messagesRef.current.some((p) => p._id === m._id)).length;
          if (newOnes && before && !atBottomRef.current) setUnseenCount((c) => c + newOnes);
        }
      }
    } catch {
      // offline: the next trigger will retry
    } finally {
      syncingRef.current = false;
    }
  }, [cleanGroupId]);

  const loadOlder = async () => {
    if (loadingOlderRef.current || !hasMore || loading) return;
    const oldest = messagesRef.current.find((m) => !isTemp(m));
    if (!oldest) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const data = await fetchPage({ before_id: oldest._id, limit: PAGE_SIZE });
      const list: ChatMessageItem[] = Array.isArray(data.messages) ? data.messages : [];
      setHasMore(data.has_more ?? list.length >= PAGE_SIZE);
      setMessages((prev) => mergeMessages(prev, list));
    } catch {
      // keep hasMore so scrolling up again retries
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  };

  // Bring a message into the list (loading older pages if needed), scroll to it and flash it
  const jumpToMessage = async (messageId?: string) => {
    if (!messageId) return;
    Keyboard.dismiss();
    if (!messagesRef.current.some((m) => m._id === messageId)) {
      let more = true;
      for (let page = 0; page < 30 && more; page++) {
        const oldest = messagesRef.current.find((m) => !isTemp(m));
        if (!oldest) break;
        try {
          const data = await fetchPage({ before_id: oldest._id, limit: 50 });
          const list: ChatMessageItem[] = Array.isArray(data.messages) ? data.messages : [];
          more = !!data.has_more && list.length > 0;
          const merged = mergeMessages(messagesRef.current, list);
          messagesRef.current = merged;
          setMessages(merged);
          setHasMore(more);
          if (list.some((m) => m._id === messageId)) break;
        } catch {
          break;
        }
      }
      if (!messagesRef.current.some((m) => m._id === messageId)) {
        AppAlert.alert('Message not found', 'The original message may have been removed.');
        return;
      }
    }
    pendingJumpRef.current = messageId;
    setRowsVersion((v) => v + 1);
  };

  const [rowsVersion, setRowsVersion] = useState(0);

  // Search inside this group (server side, so old messages are found too)
  useEffect(() => {
    if (!searchOpen) return;
    const q = searchQuery.trim();
    if (q.length < 2) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const data = await fetchPage({ q, limit: 50 });
        setSearchResults(Array.isArray(data.messages) ? data.messages.slice().reverse() : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchOpen]);

  const closeSearch = () => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); };

  // Initial load: cache first, then the server, all in parallel
  useEffect(() => {
    if (!cleanGroupId) return;
    let cancelled = false;

    (async () => {
      const [storedUser, token, cacheUserId] = await Promise.all([
        SecureStore.getItemAsync('userData').catch(() => null),
        getToken(),
        getChatCacheUserId(),
      ]);
      cacheKeyRef.current = chatRoomCacheKey(cacheUserId, cleanGroupId);
      const cachedRaw = await AsyncStorage.getItem(cacheKeyRef.current).catch(() => null);
      if (cancelled) return;

      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          setCurrentUser(parsed);
          currentUserRef.current = parsed;
        } catch {}
      }

      let hadCache = false;
      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw);
          if (Array.isArray(cached?.messages) && cached.messages.length) {
            hadCache = true;
            lastSyncRef.current = cached.lastSync || null;
            setMessages(cached.messages);
            setHasMore(true);
            setLoading(false);
          }
        } catch {}
      }

      const headers = { 'x-auth-token': token };
      // Profile and group details refresh in the background; they never block messages
      axios.get(`${API_URL}/users/me`, { headers })
        .then((r) => {
          if (cancelled || !r.data) return;
          setCurrentUser(r.data);
          currentUserRef.current = r.data;
          SecureStore.setItemAsync('userData', JSON.stringify(r.data)).catch(() => {});
        })
        .catch(() => {});
      axios.get(`${API_URL}/chat/groups/${cleanGroupId}`, { headers })
        .then((r) => { if (!cancelled && r.data) setGroupDetails(r.data); })
        .catch(() => {});

      try {
        if (hadCache && lastSyncRef.current) await syncChanges();
        else await loadLatest();
      } catch (e) {
        console.log('Error loading messages:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanGroupId]);

  // ---------- realtime ----------

  useEffect(() => {
    if (!cleanGroupId) return;
    const socket = io(SOCKET_URL, {
      ...socketAuth,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    let connectedOnce = false;
    socket.on('connect', () => {
      socket.emit('join_chat_group', cleanGroupId);
      // Anything sent while the socket was down is fetched as a small delta
      if (connectedOnce) syncChanges();
      connectedOnce = true;
    });

    socket.on('new_message', (newMsg: ChatMessageItem) => {
      if (!newMsg) return;
      if (idOf(newMsg.group_id) !== cleanGroupId) return;
      const exists = messagesRef.current.some((m) => m._id === newMsg._id);
      setMessages((prev) => mergeMessages(prev, [newMsg]));
      if (newMsg.sender_name) setTypingUsers((prev) => prev.filter((u) => u !== newMsg.sender_name));
      const mine = idOf(newMsg.sender) === idOf(currentUserRef.current);
      if (!exists && !mine && !atBottomRef.current) setUnseenCount((c) => c + 1);
      // Seen while the chat is open (batched)
      if (!exists && !mine && AppState.currentState === 'active') markChatRead(cleanGroupId, 1500);
    });

    socket.on('message_edited', ({ message_id, group_id, new_text }: any) => {
      if (group_id && idOf(group_id) !== cleanGroupId) return;
      setMessages((prev) => prev.map((m) => (m._id === message_id ? { ...m, text: new_text, is_edited: true } : m)));
    });

    socket.on('message_deleted', ({ message_id, group_id }: any) => {
      if (group_id && idOf(group_id) !== cleanGroupId) return;
      setMessages((prev) => prev.map((m) => (m._id === message_id ? { ...m, text: 'This message was deleted', is_deleted: true } : m)));
    });

    socket.on('user_typing', ({ groupId: tGid, userName, isTyping }: any) => {
      if (!userName) return;
      if (tGid && idOf(tGid) !== cleanGroupId) return;
      const me = currentUserRef.current;
      if ([me?.member_id, me?.name].filter(Boolean).map((s: string) => s.trim()).includes(userName.trim())) return;

      if (typingTimersRef.current[userName]) clearTimeout(typingTimersRef.current[userName]);
      if (isTyping) {
        typingTimersRef.current[userName] = setTimeout(() => {
          setTypingUsers((curr) => curr.filter((u) => u !== userName));
          delete typingTimersRef.current[userName];
        }, 3500);
        setTypingUsers((prev) => (prev.includes(userName) ? prev : [...prev, userName]));
      } else {
        delete typingTimersRef.current[userName];
        setTypingUsers((prev) => prev.filter((u) => u !== userName));
      }
    });

    // Back in the foreground: catch up on what changed
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') { syncChanges(); markChatRead(cleanGroupId, 500); }
    });

    // Cheap safety net (an empty delta most of the time) in case an event was missed
    const safety = setInterval(syncChanges, SAFETY_SYNC_MS);

    return () => {
      appSub.remove();
      clearInterval(safety);
      if (isTypingRef.current) {
        isTypingRef.current = false;
        const me = currentUserRef.current;
        socket.emit('typing_stop', { groupId: cleanGroupId, userName: me?.member_id || me?.name || 'Member' });
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      Object.values(typingTimersRef.current).forEach((t) => clearTimeout(t));
      socket.emit('leave_chat_group', cleanGroupId);
      socket.disconnect();
    };
  }, [cleanGroupId, syncChanges]);

  // ---------- typing ----------

  const myIdentifier = () => {
    const me = currentUserRef.current;
    return me?.member_id || me?.name || 'Member';
  };

  const stopTyping = () => {
    if (!isTypingRef.current) return;
    isTypingRef.current = false;
    lastTypingHeartbeatRef.current = 0;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socketRef.current?.emit('typing_stop', { groupId: cleanGroupId, userName: myIdentifier() });
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    if (!socketRef.current || !cleanGroupId) return;
    if (!text.trim()) { stopTyping(); return; }

    const now = Date.now();
    if (!isTypingRef.current || now - lastTypingHeartbeatRef.current > 1500) {
      isTypingRef.current = true;
      lastTypingHeartbeatRef.current = now;
      socketRef.current.emit('typing_start', { groupId: cleanGroupId, userName: myIdentifier() });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, 2000);
  };

  // ---------- send / edit / delete ----------

  const scrollToLatest = (animated = true) => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated });
    setUnseenCount(0);
  };

  const postMessage = async (tempId: string, text: string, replyId?: string) => {
    try {
      const token = await getToken();
      const res = await axios.post(
        `${API_URL}/chat/groups/${cleanGroupId}/messages`,
        replyId ? { text, reply_to_message_id: replyId } : { text },
        { headers: { 'x-auth-token': token } },
      );
      const sent: ChatMessageItem | undefined = res.data?.message;
      if (sent) {
        setMessages((prev) => mergeMessages(prev.filter((m) => m._id !== tempId), [sent]));
      }
    } catch (err: any) {
      // Keep the message on screen, marked as failed, so it can be retried
      setMessages((prev) => prev.map((m) => (m._id === tempId ? { ...m, failed: true } : m)));
      const msg = err?.response?.data?.msg;
      if (msg && err?.response?.status === 403) AppAlert.alert('Not sent', msg);
    }
  };

  const handleSendOrUpdate = async () => {
    const text = inputText.trim();
    if (!text) return;
    stopTyping();

    if (editingMessage) {
      const editingId = editingMessage._id;
      const previousText = editingMessage.text;
      setMessages((prev) => prev.map((m) => (m._id === editingId ? { ...m, text, is_edited: true } : m)));
      setEditingMessage(null);
      setInputText('');
      try {
        const token = await getToken();
        await axios.put(`${API_URL}/chat/messages/${editingId}`, { new_text: text }, { headers: { 'x-auth-token': token } });
      } catch (err: any) {
        setMessages((prev) => prev.map((m) => (m._id === editingId ? { ...m, text: previousText } : m)));
        AppAlert.alert('Error', err?.response?.data?.msg || 'Could not edit message');
      }
      return;
    }

    const me = currentUserRef.current;
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const reply = replyingTo;
    const optimistic: ChatMessageItem = {
      _id: tempId,
      group_id: cleanGroupId,
      sender: idOf(me),
      sender_name: me?.member_id || me?.name || 'You',
      sender_role: me?.role || 'Member',
      sender_designation: me?.designation || '',
      text,
      reply_to: reply ? { message_id: reply._id, sender_name: displayNameFor(reply), text: reply.text } : undefined,
      reply_to_message_id: reply?._id,
      createdAt: new Date().toISOString(),
      is_optimistic: true,
    };

    setMessages((prev) => [...prev, optimistic]);
    setInputText('');
    setReplyingTo(null);
    scrollToLatest();
    postMessage(tempId, text, reply?._id);
  };

  const retrySend = (m: ChatMessageItem) => {
    setMessages((prev) => prev.map((x) => (x._id === m._id ? { ...x, failed: false } : x)));
    postMessage(m._id, m.text, m.reply_to_message_id);
  };

  const deleteMessage = (msgId: string) => {
    AppAlert.alert('Delete message?', 'This message will be deleted for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setMessages((prev) => prev.map((m) => (m._id === msgId ? { ...m, text: 'This message was deleted', is_deleted: true } : m)));
          try {
            const token = await getToken();
            await axios.delete(`${API_URL}/chat/messages/${msgId}`, { headers: { 'x-auth-token': token } });
          } catch (err: any) {
            AppAlert.alert('Error', err?.response?.data?.msg || 'Could not delete message');
            syncChanges();
          }
        },
      },
    ]);
  };

  // ---------- display ----------

  const memberById = useMemo(() => {
    const map = new Map<string, any>();
    (groupDetails?.members || []).forEach((m: any) => map.set(idOf(m), m));
    return map;
  }, [groupDetails]);

  const senderInfo = (item: ChatMessageItem) => {
    const senderId = idOf(item.sender);
    const senderObj = typeof item.sender === 'object' && item.sender ? item.sender : null;
    const matched = memberById.get(senderId);
    const role = (item.sender_role || senderObj?.role || matched?.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'subadmin' || role === 'superadmin';
    const memberId = senderObj?.member_id || matched?.member_id
      || (item.sender_name && item.sender_name !== senderObj?.name ? item.sender_name : null);

    let label: string;
    if (isAdmin) label = role === 'subadmin' ? 'Admin' : 'Super Admin';
    else label = memberId || senderObj?.name?.trim() || item.sender_name || 'Member';

    const rawDesignation = senderObj?.designation || matched?.designation || item.sender_designation;
    const designation = rawDesignation && rawDesignation.trim().toLowerCase() !== 'member' ? rawDesignation.trim() : null;
    const fullName = isAdmin ? label : (senderObj?.name || matched?.name || item.sender_name || label);

    return { senderId, isAdmin, label, designation, fullName, color: colorForName(fullName, isAdmin) };
  };

  function displayNameFor(item: ChatMessageItem) {
    return senderInfo(item).label;
  }

  // Newest-first rows for the inverted list, with date separators and grouping
  const rows = useMemo<ListRow[]>(() => {
    const out: ListRow[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const d = new Date(m.createdAt);
      const sameSender = (a?: ChatMessageItem, b?: ChatMessageItem) =>
        !!a && !!b && idOf(a.sender) === idOf(b.sender)
        && new Date(a.createdAt).toDateString() === new Date(b.createdAt).toDateString()
        && Math.abs(new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) < GROUP_GAP_MS;

      out.push({
        kind: 'msg',
        key: m._id,
        msg: m,
        firstOfGroup: !sameSender(prev, m),
        lastOfGroup: !sameSender(m, next),
      });
      if (!prev || new Date(prev.createdAt).toDateString() !== d.toDateString()) {
        out.push({ kind: 'date', key: `date_${d.toDateString()}`, label: dayLabel(d) });
      }
    }
    return out;
  }, [messages]);

  useEffect(() => {
    const id = pendingJumpRef.current;
    if (!id) return;
    const index = rows.findIndex((r) => r.kind === 'msg' && r.msg._id === id);
    if (index === -1) return;
    pendingJumpRef.current = null;
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
    }, 60);
    setHighlightId(id);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightId(null), 1800);
  }, [rows, rowsVersion]);

  const onScrollToIndexFailed = (info: { index: number; averageItemLength: number }) => {
    // Row not measured yet: get close first, then retry precisely
    flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.5, animated: true });
    }, 120);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y; // inverted: 0 is the newest message
    const atBottom = y < 120;
    atBottomRef.current = atBottom;
    if (atBottom && unseenCount) setUnseenCount(0);
    const show = y > 400;
    if (show !== showJump) setShowJump(show);
  };

  const renderRow = ({ item }: { item: ListRow }) => {
    if (item.kind === 'date') {
      return (
        <View style={styles.dateWrap}>
          <Text style={styles.datePill}>{item.label}</Text>
        </View>
      );
    }

    const m = item.msg;
    const info = senderInfo(m);
    const isMe = Boolean(myId && info.senderId === myId);
    const showHeader = !isMe && item.firstOfGroup;
    const pending = isTemp(m) && !m.failed;
    const canSwipe = isWriteAllowed && !m.is_deleted && !isTemp(m);
    const openActions = () => { if (!m.is_deleted && !isTemp(m)) { Keyboard.dismiss(); setActionMessage(m); } };

    return (
      <SwipeToReply enabled={canSwipe} onReply={() => { setEditingMessage(null); setReplyingTo(m); }}>
      <View style={[
        styles.msgRow,
        isMe ? styles.msgRowMe : styles.msgRowOther,
        item.lastOfGroup ? styles.msgRowGroupEnd : null,
        highlightId === m._id && styles.msgRowHighlight,
      ]}>
        {!isMe && (
          <View style={styles.avatarSlot}>
            {item.firstOfGroup && (
              <View style={[styles.avatar, { backgroundColor: info.color }]}>
                <Text style={[styles.avatarText, info.isAdmin && { color: '#FBBF24' }]}>{getSenderInitials(info.fullName)}</Text>
              </View>
            )}
          </View>
        )}

        <Pressable
          onPress={() => (m.failed ? retrySend(m) : Keyboard.dismiss())}
          onLongPress={openActions}
          delayLongPress={280}
          style={({ pressed }) => [
            styles.bubble,
            isMe ? styles.bubbleMe : styles.bubbleOther,
            item.firstOfGroup && (isMe ? styles.bubbleMeFirst : styles.bubbleOtherFirst),
            pressed && { opacity: 0.85 },
          ]}
        >
          {showHeader && (
            <View style={styles.senderHeader}>
              <Text style={[styles.senderName, { color: info.color === '#0F172A' ? '#B45309' : info.color }]} numberOfLines={1}>
                {info.label}
              </Text>
              {info.designation ? <Text style={styles.senderDesignation} numberOfLines={1}>{info.designation}</Text> : null}
            </View>
          )}

          {m.reply_to?.text ? (
            <Pressable
              onPress={() => jumpToMessage(idOf(m.reply_to?.message_id))}
              onLongPress={openActions}
              style={[styles.quote, isMe ? styles.quoteMe : styles.quoteOther]}
            >
              <Text style={[styles.quoteSender, isMe && { color: '#DBEAFE' }]} numberOfLines={1}>{m.reply_to.sender_name}</Text>
              <Text style={[styles.quoteText, isMe && { color: '#EFF6FF' }]} numberOfLines={2}>{m.reply_to.text}</Text>
            </Pressable>
          ) : null}

          {/* Text and time share one wrapping row: short messages keep the time
              on the same line, long ones push it to its own line, never overlapping */}
          <View style={styles.bodyRow}>
            {m.is_deleted ? (
              <View style={styles.deletedRow}>
                <Ionicons name="ban-outline" size={14} color={isMe ? 'rgba(255,255,255,0.75)' : '#94A3B8'} />
                <Text style={[styles.deletedText, isMe && { color: 'rgba(255,255,255,0.8)' }]}>This message was deleted</Text>
              </View>
            ) : (
              <LinkedText
                text={m.text}
                style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextOther]}
                linkStyle={isMe ? styles.linkMe : styles.linkOther}
                onLongPress={openActions}
              />
            )}

            <View style={styles.meta}>
              {m.is_edited && !m.is_deleted && <Text style={[styles.metaText, isMe && styles.metaTextMe]}>edited</Text>}
              <Text style={[styles.metaText, isMe && styles.metaTextMe]}>{formatTime(m.createdAt)}</Text>
              {isMe && !m.is_deleted && (
                m.failed
                  ? <Ionicons name="alert-circle" size={13} color="#FCA5A5" />
                  : <Ionicons name={pending ? 'time-outline' : 'checkmark-done'} size={13} color="rgba(255,255,255,0.85)" />
              )}
            </View>
          </View>
        </Pressable>

        {m.failed && (
          <TouchableOpacity onPress={() => retrySend(m)} style={styles.retryBtn} hitSlop={8}>
            <Ionicons name="refresh" size={16} color="#DC2626" />
          </TouchableOpacity>
        )}
      </View>
      </SwipeToReply>
    );
  };

  // ---------- header ----------

  const participantNames = (groupDetails?.members || []).map((m: any) => m.member_id || m.name || '').filter(Boolean);
  const subtitle = typingUsers.length
    ? (typingUsers.length === 1 ? `${typingUsers[0]} is typing…` : `${typingUsers.length} people are typing…`)
    : participantNames.length
      ? participantNames.join(', ')
      : `${groupType ? `${groupType} • ` : ''}${isWriteAllowed ? 'Tap a message to reply' : 'View only'}`;

  // ---------- action sheet ----------

  const actionIsMine = actionMessage ? idOf(actionMessage.sender) === myId : false;
  const actions = actionMessage ? [
    isWriteAllowed && { key: 'reply', icon: 'arrow-undo-outline', label: 'Reply', onPress: () => setReplyingTo(actionMessage) },
    actionIsMine && { key: 'edit', icon: 'create-outline', label: 'Edit', onPress: () => { setEditingMessage(actionMessage); setReplyingTo(null); setInputText(actionMessage.text); } },
    (actionIsMine || iAmAdmin) && { key: 'delete', icon: 'trash-outline', label: 'Delete', danger: true, onPress: () => deleteMessage(actionMessage._id) },
  ].filter(Boolean) as { key: string; icon: any; label: string; danger?: boolean; onPress: () => void }[] : [];

  // ---------- render ----------

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" />

      {searchOpen ? (
        <View style={styles.header}>
          <TouchableOpacity onPress={closeSearch} style={styles.backButton} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={17} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search messages"
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              returnKeyType="search"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : (
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackToChats} style={styles.backButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color="#0F172A" />
        </TouchableOpacity>
        <View style={[styles.groupAvatar, !isWriteAllowed && { backgroundColor: '#FEF3C7' }]}>
          <Ionicons name={isWriteAllowed ? 'people' : 'megaphone-outline'} size={20} color={isWriteAllowed ? '#2563EB' : '#D97706'} />
        </View>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          <Text style={[styles.headerSubtitle, typingUsers.length > 0 && styles.headerSubtitleTyping]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        {!isWriteAllowed && (
          <View style={styles.viewOnlyBadge}>
            <Ionicons name="eye-outline" size={13} color="#B45309" />
            <Text style={styles.viewOnlyBadgeText}>View only</Text>
          </View>
        )}
        <TouchableOpacity onPress={() => setSearchOpen(true)} style={styles.headerIconBtn} hitSlop={8}>
          <Ionicons name="search" size={21} color="#334155" />
        </TouchableOpacity>
      </View>
      )}

      {/* Android resizes the window for the keyboard; iOS uses the measured
          keyboard space below instead of KeyboardAvoidingView offsets */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'android' ? 'height' : undefined}
        enabled={Platform.OS === 'android'}
      >
        <View style={styles.chatArea}>
          {loading && messages.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          ) : messages.length === 0 ? (
            // Rendered outside the inverted list so it is never drawn upside down
            <Pressable style={styles.empty} onPress={Keyboard.dismiss}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubbles-outline" size={34} color="#2563EB" />
              </View>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySub}>
                {isWriteAllowed ? 'Say hello and start the discussion.' : 'Messages will appear here once the discussion starts.'}
              </Text>
            </Pressable>
          ) : (
            <FlatList
              ref={flatListRef}
              data={rows}
              inverted
              keyExtractor={(r) => r.key}
              renderItem={renderRow}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              onScroll={onScroll}
              scrollEventThrottle={64}
              onEndReached={loadOlder}
              onScrollToIndexFailed={onScrollToIndexFailed}
              onEndReachedThreshold={0.4}
              initialNumToRender={20}
              maxToRenderPerBatch={15}
              windowSize={11}
              removeClippedSubviews={Platform.OS === 'android'}
              maintainVisibleContentPosition={{ minIndexForVisible: 1, autoscrollToTopThreshold: 120 }}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={<TypingIndicator typingUsers={typingUsers} />}
              ListFooterComponent={
                loadingOlder ? (
                  <View style={styles.olderLoader}><ActivityIndicator size="small" color="#64748B" /></View>
                ) : !hasMore && messages.length > 0 ? (
                  <View style={styles.dateWrap}><Text style={styles.startPill}>Start of the conversation</Text></View>
                ) : undefined
              }
            />
          )}

          {searchOpen && (
            <View style={styles.searchOverlay}>
              {searchQuery.trim().length < 2 ? (
                <Text style={styles.searchHint}>Type at least 2 letters to search this chat</Text>
              ) : searching ? (
                <ActivityIndicator style={{ marginTop: 24 }} color="#2563EB" />
              ) : searchResults.length === 0 ? (
                <Text style={styles.searchHint}>No messages found</Text>
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={(m) => `s_${m._id}`}
                  keyboardShouldPersistTaps="handled"
                  ListHeaderComponent={<Text style={styles.searchCount}>{searchResults.length}{searchResults.length >= 50 ? '+' : ''} results</Text>}
                  renderItem={({ item: r }) => (
                    <TouchableOpacity
                      style={styles.searchItem}
                      onPress={() => { const id = r._id; closeSearch(); jumpToMessage(id); }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={styles.searchItemName} numberOfLines={1}>{displayNameFor(r)}</Text>
                        <Text style={styles.searchItemDate}>{dayLabel(new Date(r.createdAt))}, {formatTime(r.createdAt)}</Text>
                      </View>
                      <Text style={styles.searchItemText} numberOfLines={2}>{r.text}</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}

          {showJump && !searchOpen && (
            <TouchableOpacity style={styles.jumpBtn} onPress={() => scrollToLatest()} activeOpacity={0.85}>
              <Ionicons name="chevron-down" size={22} color="#334155" />
              {unseenCount > 0 && (
                <View style={styles.jumpBadge}><Text style={styles.jumpBadgeText}>{unseenCount > 99 ? '99+' : unseenCount}</Text></View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {isWriteAllowed ? (
          <View style={styles.composer}>
            {(replyingTo || editingMessage) && (
              <View style={[styles.contextBar, editingMessage && styles.contextBarEdit]}>
                <Ionicons
                  name={editingMessage ? 'create-outline' : 'arrow-undo'}
                  size={16}
                  color={editingMessage ? '#B45309' : '#2563EB'}
                  style={{ marginRight: 8 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contextTitle, editingMessage && { color: '#B45309' }]} numberOfLines={1}>
                    {editingMessage ? 'Edit message' : `Replying to ${displayNameFor(replyingTo!)}`}
                  </Text>
                  <Text style={styles.contextText} numberOfLines={1}>{(editingMessage || replyingTo)!.text}</Text>
                </View>
                <TouchableOpacity
                  hitSlop={10}
                  onPress={() => {
                    if (editingMessage) { setEditingMessage(null); setInputText(''); } else setReplyingTo(null);
                  }}
                >
                  <Ionicons name="close-circle" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Message"
                placeholderTextColor="#94A3B8"
                value={inputText}
                onChangeText={handleTextChange}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
                onPress={handleSendOrUpdate}
                disabled={!inputText.trim()}
                activeOpacity={0.8}
              >
                <Ionicons name={editingMessage ? 'checkmark' : 'send'} size={18} color="#FFFFFF" style={!editingMessage && { marginLeft: 2 }} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.viewOnlyFooter}>
            <Ionicons name="lock-closed-outline" size={15} color="#92400E" />
            <Text style={styles.viewOnlyFooterText}>Only committee members can send messages in this group.</Text>
          </View>
        )}
        {Platform.OS === 'ios' && iosKeyboardSpace > 0 && <View style={{ height: iosKeyboardSpace }} />}
      </KeyboardAvoidingView>

      {/* Long-press actions */}
      <Modal visible={!!actionMessage} transparent animationType="fade" onRequestClose={() => setActionMessage(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setActionMessage(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            {actionMessage && (
              <View style={styles.sheetPreview}>
                <Text style={styles.sheetPreviewName} numberOfLines={1}>{displayNameFor(actionMessage)}</Text>
                <Text style={styles.sheetPreviewText} numberOfLines={3}>{actionMessage.text}</Text>
              </View>
            )}
            {actions.length === 0 ? (
              <Text style={styles.sheetEmpty}>No actions available for this message.</Text>
            ) : actions.map((a) => (
              <TouchableOpacity
                key={a.key}
                style={styles.sheetItem}
                onPress={() => { setActionMessage(null); a.onPress(); }}
              >
                <Ionicons name={a.icon} size={20} color={a.danger ? '#DC2626' : '#334155'} />
                <Text style={[styles.sheetItemText, a.danger && { color: '#DC2626' }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  // header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  backButton: { padding: 4, marginRight: 2 },
  groupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  headerSubtitle: { fontSize: 12, color: '#64748B', marginTop: 1 },
  headerSubtitleTyping: { color: '#16A34A', fontWeight: '600' },
  viewOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  viewOnlyBadgeText: { fontSize: 11, fontWeight: '700', color: '#B45309' },

  // chat area
  chatArea: { flex: 1, backgroundColor: '#EEF2F7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 10, paddingVertical: 10, flexGrow: 1 },
  olderLoader: { paddingVertical: 14 },

  dateWrap: { alignItems: 'center', marginVertical: 10 },
  datePill: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  startPill: {
    fontSize: 11.5,
    color: '#64748B',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: 'hidden',
  },

  // message rows
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 2 },
  msgRowGroupEnd: { marginBottom: 6 },
  msgRowHighlight: { backgroundColor: 'rgba(37,99,235,0.14)', borderRadius: 10 },
  swipeIcon: {
    position: 'absolute',
    left: 4,
    top: 0,
    bottom: 0,
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkMe: { color: '#FFFFFF', textDecorationLine: 'underline', fontWeight: '600' },
  linkOther: { color: '#2563EB', textDecorationLine: 'underline' },
  headerIconBtn: { padding: 6, marginLeft: 4 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    marginLeft: 4,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#0F172A', paddingVertical: 0 },
  searchOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', zIndex: 5 },
  searchHint: { textAlign: 'center', color: '#64748B', fontSize: 13.5, marginTop: 28, paddingHorizontal: 24 },
  searchCount: { fontSize: 12, fontWeight: '600', color: '#64748B', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  searchItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  searchItemName: { fontSize: 13, fontWeight: '700', color: '#2563EB', flexShrink: 1, marginRight: 8 },
  searchItemDate: { fontSize: 11.5, color: '#94A3B8' },
  searchItemText: { fontSize: 14, color: '#334155', marginTop: 3, lineHeight: 19 },
  msgRowMe: { justifyContent: 'flex-end', paddingLeft: 48 },
  msgRowOther: { justifyContent: 'flex-start', paddingRight: 48 },
  avatarSlot: { width: 32, marginRight: 6, alignSelf: 'flex-start' },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', includeFontPadding: false },

  bubble: {
    maxWidth: '100%',
    minWidth: 76,
    paddingHorizontal: 11,
    paddingTop: 7,
    paddingBottom: 6,
    borderRadius: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 1.5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  bubbleMe: { backgroundColor: '#2563EB' },
  bubbleOther: { backgroundColor: '#FFFFFF' },
  bubbleMeFirst: { borderTopRightRadius: 4 },
  bubbleOtherFirst: { borderTopLeftRadius: 4 },

  senderHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 2 },
  senderName: { fontSize: 12.5, fontWeight: '700', flexShrink: 1 },
  senderDesignation: { fontSize: 11, color: '#94A3B8', flexShrink: 1 },

  quote: { borderLeftWidth: 3, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 5, marginTop: 2 },
  quoteMe: { backgroundColor: 'rgba(255,255,255,0.16)', borderLeftColor: '#BFDBFE' },
  quoteOther: { backgroundColor: '#F1F5F9', borderLeftColor: '#2563EB' },
  quoteSender: { fontSize: 11.5, fontWeight: '700', color: '#2563EB', marginBottom: 1 },
  quoteText: { fontSize: 12.5, color: '#475569', lineHeight: 17 },

  msgText: { fontSize: 15, lineHeight: 21, flexShrink: 1 },
  msgTextMe: { color: '#FFFFFF' },
  msgTextOther: { color: '#0F172A' },
  bodyRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' },
  deletedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 1, flexShrink: 1 },
  deletedText: { fontSize: 14, fontStyle: 'italic', color: '#94A3B8' },

  meta: {
    marginLeft: 'auto',
    paddingLeft: 10,
    paddingTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: { fontSize: 10.5, color: '#94A3B8' },
  metaTextMe: { color: 'rgba(255,255,255,0.78)' },
  retryBtn: { marginLeft: 6, marginBottom: 6, padding: 4 },

  // typing
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 38, marginTop: 4, marginBottom: 4 },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderTopLeftRadius: 4,
  },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#64748B' },
  typingLabel: { fontSize: 12, color: '#64748B', maxWidth: 200 },

  // empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155' },
  emptySub: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 4, lineHeight: 18 },

  // jump to latest
  jumpBtn: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  jumpBadge: {
    position: 'absolute',
    top: -6,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jumpBadgeText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' },

  // composer
  composer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  contextBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  contextBarEdit: { backgroundColor: '#FFFBEB', borderLeftColor: '#D97706' },
  contextTitle: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  contextText: { fontSize: 12.5, color: '#475569', marginTop: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: '#F1F5F9',
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 11 : 9,
    paddingBottom: Platform.OS === 'ios' ? 11 : 9,
    fontSize: 15,
    color: '#0F172A',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#CBD5E1' },

  viewOnlyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#FDE68A',
  },
  viewOnlyFooterText: { fontSize: 12.5, color: '#92400E', fontWeight: '500', flexShrink: 1, textAlign: 'center' },

  // action sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sheetHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', marginBottom: 10 },
  sheetPreview: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 6 },
  sheetPreviewName: { fontSize: 12, fontWeight: '700', color: '#2563EB', marginBottom: 2 },
  sheetPreviewText: { fontSize: 14, color: '#334155', lineHeight: 19 },
  sheetEmpty: { fontSize: 13, color: '#64748B', textAlign: 'center', paddingVertical: 16 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 4 },
  sheetItemText: { fontSize: 15.5, color: '#0F172A', fontWeight: '500' },
});
