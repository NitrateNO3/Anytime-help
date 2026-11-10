import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Share, Platform, RefreshControl,
  TextInput, Alert, KeyboardAvoidingView, Keyboard, Animated, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';

const API_URL = 'https://anytime-help.onrender.com/api';

type ReactionType = 'like' | 'love';

// Height kept free at the bottom for the app's floating tab bar
const TAB_BAR_SPACE = 92;

interface OfficialPost {
  _id: string;
  text: string;
  image_url: string;
  createdAt: string;
  counts: Record<ReactionType, number>;
  my_reactions: ReactionType[];
}

export interface OfficialProfileData {
  _id: string;
  name: string;
  designation: string;
  ward: string;
  bio?: string;
  verified: boolean;
  followers_count: number;
  is_following: boolean;
}

interface Props {
  official: OfficialProfileData;
  initials: string;
  avatarBg: string;
  avatarFg: string;
  metaText: string;
  followLoading: boolean;
  refreshTick: number; // bumped by the parent when a live post change arrives
  liveReaction: { postId: string; counts: Partial<Record<ReactionType, number>>; at: number } | null;
  onBack: () => void;
  onToggleFollow: () => void;
}

const REACTION_ICONS: { type: ReactionType; icon: string; activeIcon: string; color: string; tint: string }[] = [
  { type: 'like', icon: 'thumbs-up-outline', activeIcon: 'thumbs-up', color: '#2563EB', tint: '#EFF6FF' },
  { type: 'love', icon: 'heart-outline', activeIcon: 'heart', color: '#E11D48', tint: '#FFF1F2' },
];

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'TODAY';
  if (d.toDateString() === yest.toDateString()) return 'YESTERDAY';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' }).toUpperCase();
};

const timeAgo = (iso: string) => {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

// Like / heart button: flips instantly with a small bounce
function ReactionButton({ config, active, count, onPress }: {
  config: typeof REACTION_ICONS[number];
  active: boolean;
  count: number;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    scale.setValue(0.75);
    Animated.spring(scale, { toValue: 1, friction: 3, tension: 220, useNativeDriver: true }).start();
    onPress();
  };
  return (
    <Pressable
      onPress={handlePress}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
      style={[styles.reactPill, active && { borderColor: config.color, backgroundColor: config.tint }]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={(active ? config.activeIcon : config.icon) as any} size={18} color={active ? config.color : '#334155'} />
      </Animated.View>
      <Text style={[styles.reactCount, active && { color: config.color }]}>{count}</Text>
    </Pressable>
  );
}

// Post body: double-tap anywhere on it to heart it (with a pop), like Instagram / X
function PostCard({ post, onDoubleTap }: { post: OfficialPost; onDoubleTap: () => void }) {
  const lastTap = useRef(0);
  const pop = useRef(new Animated.Value(0)).current;

  const handlePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      onDoubleTap();
      pop.setValue(0);
      Animated.sequence([
        Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
        Animated.timing(pop, { toValue: 0, duration: 250, delay: 350, useNativeDriver: true }),
      ]).start();
    } else {
      lastTap.current = now;
    }
  };

  return (
    <Pressable onPress={handlePress} style={styles.card}>
      {!!post.image_url && (
        <Image source={{ uri: post.image_url }} style={styles.cardImage} resizeMode="cover" />
      )}
      {!!post.text && <Text style={styles.cardText}>{post.text}</Text>}
      <Text style={styles.cardTime}>{timeAgo(post.createdAt)}</Text>
      <Animated.View
        pointerEvents="none"
        style={[styles.popHeart, {
          opacity: pop,
          transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.15] }) }],
        }]}
      >
        <Ionicons name="heart" size={84} color="#E11D48" />
      </Animated.View>
    </Pressable>
  );
}

export default function OfficialProfile({
  official, initials, avatarBg, avatarFg, metaText, followLoading, refreshTick, liveReaction, onBack, onToggleFollow,
}: Props) {
  const [posts, setPosts] = useState<OfficialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Composer: only for the official themself (login number matches) or Super Admin
  const [canPost, setCanPost] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftImage, setDraftImage] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  // The floating tab bar hides while the keyboard is open, so only leave room for it otherwise
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'more' = 'initial') => {
    if (mode === 'more') setLoadingMore(true);
    try {
      const before = mode === 'more' && posts.length ? `&before=${encodeURIComponent(posts[posts.length - 1].createdAt)}` : '';
      const res = await axios.get(`${API_URL}/officials/${official._id}/posts?limit=20${before}`);
      const list: OfficialPost[] = res.data?.posts || [];
      setPosts(prev => (mode === 'more'
        ? [...prev, ...list.filter(p => !prev.some(x => x._id === p._id))]
        : mergeFromServer(list, prev)));
      setHasMore(!!res.data?.has_more);
      setCanPost(!!res.data?.can_post);
    } catch (err) {
      console.log('Error loading official posts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [official._id, posts]);

  useEffect(() => {
    setLoading(true);
    load('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [official._id]);

  useEffect(() => {
    if (refreshTick > 0) load('refresh');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  /* ---------- Reactions, X / WhatsApp style ----------
   * - A tap flips the button on screen instantly; the network is never waited on.
   * - The server is told the FINAL state ("liked = true/false"), not "toggle", and
   *   only after taps settle (debounced), so 5 quick taps send one correct request.
   * - While this user has an unsynced change on a post, nothing from the server
   *   (refreshes, live counts from others) may overwrite their own reaction.
   */
  const postsRef = useRef<OfficialPost[]>([]);
  postsRef.current = posts;
  // Unsynced intents: postId -> { like?: true|false, love?: true|false }
  const intents = useRef<Record<string, Partial<Record<ReactionType, boolean>>>>({});
  const inflight = useRef<Record<string, number>>({});
  const flushTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const hasPending = (postId: string) =>
    Object.keys(intents.current[postId] || {}).length > 0 || (inflight.current[postId] || 0) > 0;

  // Server data may replace a post only when the user has nothing pending on it
  const mergeFromServer = useCallback((incoming: OfficialPost[], prev: OfficialPost[]) =>
    incoming.map(sp => {
      if (!hasPending(sp._id)) return sp;
      const local = prev.find(p => p._id === sp._id);
      return local ? { ...sp, counts: local.counts, my_reactions: local.my_reactions } : sp;
    }), []);

  const setLocalReaction = (postId: string, type: ReactionType, on: boolean) => {
    setPosts(prev => prev.map(p => {
      if (p._id !== postId) return p;
      const had = p.my_reactions.includes(type);
      if (had === on) return p;
      return {
        ...p,
        my_reactions: on ? [...p.my_reactions, type] : p.my_reactions.filter(r => r !== type),
        counts: { ...p.counts, [type]: Math.max(0, (p.counts[type] || 0) + (on ? 1 : -1)) },
      };
    }));
  };

  const sendReaction = async (postId: string, type: ReactionType, on: boolean, attempt = 1): Promise<void> => {
    inflight.current[postId] = (inflight.current[postId] || 0) + 1;
    try {
      const res = await axios.post(`${API_URL}/officials/posts/${postId}/react`, { type, on });
      inflight.current[postId] -= 1;
      // Synced, unless the user changed it again meanwhile
      if (intents.current[postId]?.[type] === on) delete intents.current[postId][type];
      if (!hasPending(postId) && res.data?.counts) {
        setPosts(prev => prev.map(p => (p._id === postId ? { ...p, counts: res.data.counts, my_reactions: res.data.my_reactions || [] } : p)));
      }
    } catch {
      inflight.current[postId] -= 1;
      if (intents.current[postId]?.[type] !== on) return; // superseded by a newer tap
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 800 * attempt));
        if (intents.current[postId]?.[type] === on) return sendReaction(postId, type, on, attempt + 1);
        return;
      }
      // Give up: undo on screen, like X does when offline
      delete intents.current[postId][type];
      setLocalReaction(postId, type, !on);
    }
  };

  const flush = (postId: string) => {
    delete flushTimers.current[postId];
    const pending = { ...(intents.current[postId] || {}) };
    (Object.keys(pending) as ReactionType[]).forEach(type => sendReaction(postId, type, !!pending[type]));
  };

  const toggleReaction = (postId: string, type: ReactionType, forceOn?: boolean) => {
    const post = postsRef.current.find(p => p._id === postId);
    if (!post) return;
    const on = forceOn ?? !post.my_reactions.includes(type);
    if (forceOn && post.my_reactions.includes(type)) return; // double-tap never un-likes
    intents.current[postId] = { ...(intents.current[postId] || {}), [type]: on };
    setLocalReaction(postId, type, on);
    if (flushTimers.current[postId]) clearTimeout(flushTimers.current[postId]);
    flushTimers.current[postId] = setTimeout(() => flush(postId), 450);
  };

  // Send anything still queued if the user leaves the page
  useEffect(() => () => {
    Object.keys(flushTimers.current).forEach(id => { clearTimeout(flushTimers.current[id]); flush(id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Someone else reacted: refresh counts only, and never while this user has a pending change
  useEffect(() => {
    if (!liveReaction || hasPending(liveReaction.postId)) return;
    setPosts(prev => prev.map(p => (p._id === liveReaction.postId ? { ...p, counts: { ...p.counts, ...liveReaction.counts } } : p)));
  }, [liveReaction]);

  const pickImage = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', fromCamera ? 'Camera access is required.' : 'Photo library access is required.');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, base64: true };
    const result = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!result.canceled && result.assets?.[0]?.base64) {
      setDraftImage(`data:${result.assets[0].mimeType || 'image/jpeg'};base64,${result.assets[0].base64}`);
    }
  };

  const choosePhoto = () => {
    Alert.alert('Add photo', undefined, [
      { text: 'Camera', onPress: () => pickImage(true) },
      { text: 'Gallery', onPress: () => pickImage(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submitPost = async () => {
    if (posting || (!draft.trim() && !draftImage)) return;
    setPosting(true);
    try {
      const res = await axios.post(`${API_URL}/officials/${official._id}/posts`, {
        text: draft.trim(),
        ...(draftImage ? { image: draftImage } : {}),
      });
      if (res.data?._id) setPosts(prev => (prev.some(p => p._id === res.data._id) ? prev : [res.data, ...prev]));
      setDraft('');
      setDraftImage(null);
    } catch (err: any) {
      Alert.alert('Could not post', err.response?.data?.msg || 'Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const deletePost = (post: OfficialPost) => {
    Alert.alert('Delete update?', 'It will be removed for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await axios.delete(`${API_URL}/officials/posts/${post._id}`);
            setPosts(prev => prev.filter(p => p._id !== post._id));
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.msg || 'Could not delete');
          }
        },
      },
    ]);
  };

  const sharePost = async (post: OfficialPost) => {
    const who = `${official.name}${official.designation ? ` (${official.designation}${official.ward ? `, Ward ${official.ward}` : ''})` : ''}`;
    const message = [`📢 ${who}`, post.text, post.image_url ? `Photo: ${post.image_url}` : '', 'Shared via Anytime Help']
      .filter(Boolean).join('\n\n');
    try {
      await Share.share({ message, title: who });
    } catch {
      Alert.alert('Could not share', 'Please try again.');
    }
  };

  const renderItem = ({ item, index }: { item: OfficialPost; index: number }) => {
    const label = dayLabel(item.createdAt);
    const showDay = index === 0 || dayLabel(posts[index - 1].createdAt) !== label;
    return (
      <View>
        {showDay && (
          <View style={styles.dayPill}><Text style={styles.dayText}>{label}</Text></View>
        )}
        <PostCard post={item} onDoubleTap={() => toggleReaction(item._id, 'love', true)} />
        <View style={styles.reactRow}>
          {REACTION_ICONS.map(r => (
            <ReactionButton
              key={r.type}
              config={r}
              active={item.my_reactions.includes(r.type)}
              count={item.counts[r.type] || 0}
              onPress={() => toggleReaction(item._id, r.type)}
            />
          ))}
          <TouchableOpacity
            style={styles.reactPill}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            onPress={() => sharePost(item)}
          >
            <Ionicons name="share-social-outline" size={17} color="#334155" />
            <Text style={styles.reactCount}>Share</Text>
          </TouchableOpacity>
          {canPost && (
            <TouchableOpacity style={[styles.reactPill, { marginLeft: 'auto' }]} activeOpacity={0.7} onPress={() => deletePost(item)}>
              <Ionicons name="trash-outline" size={15} color="#DC2626" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
          <Text style={[styles.avatarText, { color: avatarFg }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1, marginHorizontal: 10 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{official.name}</Text>
            {official.verified && <Ionicons name="checkmark-circle" size={16} color="#2563EB" style={{ marginLeft: 4 }} />}
          </View>
          <Text style={styles.meta} numberOfLines={1}>{metaText}</Text>
        </View>
        <TouchableOpacity
          style={[styles.followBtn, official.is_following ? styles.followingBtn : styles.notFollowingBtn]}
          onPress={onToggleFollow}
          disabled={followLoading}
          activeOpacity={0.7}
        >
          {followLoading ? <ActivityIndicator size="small" color="#2563EB" /> : (
            <Text style={[styles.followText, { color: official.is_following ? '#0F172A' : '#2563EB' }]}>
              {official.is_following ? 'Following' : '+ Follow'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => p._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load('refresh'); }} colors={['#2563EB']} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (hasMore && !loadingMore) load('more'); }}
          ListHeaderComponent={
            official.bio ? <Text style={styles.bio}>{official.bio}</Text> : <View style={{ height: 8 }} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="newspaper-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No updates yet</Text>
              <Text style={styles.emptyText}>Updates from {official.name} will appear here.</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#2563EB" style={{ marginVertical: 16 }} /> : <View style={{ height: canPost ? 20 : 110 }} />}
        />
      )}

      {/* Composer: only the official themself (or Super Admin) sees this */}
      {canPost && (
        <View style={[styles.composer, { marginBottom: keyboardOpen ? 0 : TAB_BAR_SPACE }]}>
          {!!draftImage && (
            <View style={styles.draftImageWrap}>
              <Image source={{ uri: draftImage }} style={styles.draftImage} />
              <TouchableOpacity style={styles.draftImageRemove} onPress={() => setDraftImage(null)}>
                <Ionicons name="close-circle" size={22} color="#0F172A" />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.composerRow}>
            <TouchableOpacity style={styles.composerIcon} onPress={choosePhoto} activeOpacity={0.7}>
              <Ionicons name="image-outline" size={22} color="#2563EB" />
            </TouchableOpacity>
            <TextInput
              style={styles.composerInput}
              placeholder="Post an update for your followers…"
              placeholderTextColor="#94A3B8"
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={3000}
            />
            <TouchableOpacity
              style={[styles.composerSend, (!draft.trim() && !draftImage) && { opacity: 0.4 }]}
              disabled={posting || (!draft.trim() && !draftImage)}
              onPress={submitPost}
              activeOpacity={0.8}
            >
              {posting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send" size={18} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#EEF1F8' },
  header: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    paddingHorizontal: 12, paddingTop: Platform.OS === 'android' ? 12 : 8, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2, marginRight: 10,
  },
  avatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800', fontSize: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '800', color: '#0F172A', flexShrink: 1 },
  meta: { fontSize: 12, color: '#64748B', marginTop: 1 },
  followBtn: { height: 34, borderRadius: 17, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', minWidth: 84 },
  followingBtn: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  notFollowingBtn: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  followText: { fontSize: 13, fontWeight: '700' },
  listContent: { paddingHorizontal: 12, paddingTop: 4 },
  bio: { textAlign: 'center', color: '#475569', fontSize: 12.5, lineHeight: 18, paddingHorizontal: 20, marginVertical: 14 },
  dayPill: { alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4, marginVertical: 10 },
  dayText: { fontSize: 11, fontWeight: '800', color: '#334155', letterSpacing: 0.5 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 8, paddingBottom: 10,
    shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  cardImage: { width: '100%', aspectRatio: 16 / 9, borderRadius: 14, backgroundColor: '#E2E8F0', marginBottom: 8 },
  cardText: { fontSize: 14.5, color: '#0F172A', lineHeight: 21, paddingHorizontal: 4 },
  cardTime: { alignSelf: 'flex-end', fontSize: 11, color: '#94A3B8', marginTop: 6, marginRight: 4 },
  reactRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 6, paddingHorizontal: 2 },
  reactPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF', borderRadius: 16,
    paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1, borderColor: '#E2E8F0',
  },
  reactCount: { fontSize: 12.5, fontWeight: '700', color: '#334155' },
  popHeart: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  composer: {
    backgroundColor: '#FFFFFF', marginHorizontal: 10, borderRadius: 22, padding: 6,
    shadowColor: '#0F172A', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end' },
  composerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  composerInput: { flex: 1, maxHeight: 110, minHeight: 40, fontSize: 14.5, color: '#0F172A', paddingHorizontal: 6, paddingTop: 10, paddingBottom: 10 },
  composerSend: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  draftImageWrap: { alignSelf: 'flex-start', margin: 6 },
  draftImage: { width: 90, height: 90, borderRadius: 12, backgroundColor: '#E2E8F0' },
  draftImageRemove: { position: 'absolute', top: -8, right: -8, backgroundColor: '#FFFFFF', borderRadius: 11 },
  empty: { alignItems: 'center', marginTop: 50, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155', marginTop: 10 },
  emptyText: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 4 },
});
