import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Share, Platform, RefreshControl,
  TextInput, Alert, KeyboardAvoidingView, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';

const API_URL = 'https://anytime-help.onrender.com/api';

type ReactionType = 'like' | 'love' | 'celebrate';

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
  onBack: () => void;
  onToggleFollow: () => void;
}

const REACTION_ICONS: { type: ReactionType; icon: string; activeIcon: string; color: string }[] = [
  { type: 'like', icon: 'thumbs-up-outline', activeIcon: 'thumbs-up', color: '#2563EB' },
  { type: 'love', icon: 'heart-outline', activeIcon: 'heart', color: '#E11D48' },
  { type: 'celebrate', icon: 'sparkles-outline', activeIcon: 'sparkles', color: '#D97706' },
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

export default function OfficialProfile({
  official, initials, avatarBg, avatarFg, metaText, followLoading, refreshTick, onBack, onToggleFollow,
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
      setPosts(prev => (mode === 'more' ? [...prev, ...list.filter(p => !prev.some(x => x._id === p._id))] : list));
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

  const react = async (post: OfficialPost, type: ReactionType) => {
    // Optimistic toggle
    const had = post.my_reactions.includes(type);
    const optimistic: OfficialPost = {
      ...post,
      my_reactions: had ? post.my_reactions.filter(r => r !== type) : [...post.my_reactions, type],
      counts: { ...post.counts, [type]: Math.max(0, (post.counts[type] || 0) + (had ? -1 : 1)) },
    };
    setPosts(prev => prev.map(p => (p._id === post._id ? optimistic : p)));
    try {
      const res = await axios.post(`${API_URL}/officials/posts/${post._id}/react`, { type });
      setPosts(prev => prev.map(p => (p._id === post._id ? { ...p, ...res.data } : p)));
    } catch {
      setPosts(prev => prev.map(p => (p._id === post._id ? post : p)));
    }
  };

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

  const sharePost = (post: OfficialPost) => {
    const message = [`${official.name}${official.designation ? ` (${official.designation})` : ''}:`, post.text, post.image_url]
      .filter(Boolean).join('\n\n');
    Share.share({ message }).catch(() => {});
  };

  const renderItem = ({ item, index }: { item: OfficialPost; index: number }) => {
    const label = dayLabel(item.createdAt);
    const showDay = index === 0 || dayLabel(posts[index - 1].createdAt) !== label;
    return (
      <View>
        {showDay && (
          <View style={styles.dayPill}><Text style={styles.dayText}>{label}</Text></View>
        )}
        <View style={styles.card}>
          {!!item.image_url && (
            <Image source={{ uri: item.image_url }} style={styles.cardImage} resizeMode="cover" />
          )}
          {!!item.text && <Text style={styles.cardText}>{item.text}</Text>}
          <Text style={styles.cardTime}>{timeAgo(item.createdAt)}</Text>
        </View>
        <View style={styles.reactRow}>
          {REACTION_ICONS.map(r => {
            const active = item.my_reactions.includes(r.type);
            return (
              <TouchableOpacity
                key={r.type}
                style={[styles.reactPill, active && { borderColor: r.color, backgroundColor: `${r.color}12` }]}
                activeOpacity={0.7}
                onPress={() => react(item, r.type)}
              >
                <Ionicons name={(active ? r.activeIcon : r.icon) as any} size={15} color={active ? r.color : '#334155'} />
                <Text style={[styles.reactCount, active && { color: r.color }]}>{item.counts[r.type] || 0}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.reactPill} activeOpacity={0.7} onPress={() => sharePost(item)}>
            <Ionicons name="share-outline" size={15} color="#334155" />
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
    paddingHorizontal: 11, paddingVertical: 6, borderWidth: 1, borderColor: '#E2E8F0',
  },
  reactCount: { fontSize: 12.5, fontWeight: '700', color: '#334155' },
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
