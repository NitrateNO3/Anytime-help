import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, Animated, Dimensions, TextInput, ActivityIndicator, Platform, KeyboardAvoidingView, Pressable, StatusBar, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { io, Socket } from 'socket.io-client';
import { socketAuth } from '../utils/socketAuth';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import VerifiedBadge from './VerifiedBadge';
import Toast from 'react-native-toast-message';

const API_URL = 'https://api.anytimehelp.co.in/api';
const SOCKET_URL = 'https://api.anytimehelp.co.in';

const STORY_DURATION_MS = 5000;

// Shared across every StoriesBar instance and remount (per signed-in token)
// Where the signed-in user may post: their staff categories and/or their own official page
export interface PostTarget { kind: 'category' | 'official' | 'channel'; id: string; label: string }

let storiesCache: { token: string; groups: StoryGroup[]; postable: PostTarget[] } | null = null;

// Lets other screens ask every mounted StoriesBar to refetch (e.g. after following
// an official, whose status is shown to followers only)
const refreshListeners = new Set<() => void>();
export const refreshStoriesBar = () => refreshListeners.forEach(fn => fn());
const TEXT_BG_COLORS = ['#2563EB', '#16A34A', '#DC2626', '#9333EA', '#EA580C', '#0F172A', '#DB2777', '#0891B2'];
const CAT_PALETTE = [
  { bg: '#ECFDF5', fg: '#059669' }, { bg: '#EFF6FF', fg: '#2563EB' }, { bg: '#FEF3C7', fg: '#D97706' },
  { bg: '#F5F3FF', fg: '#7C3AED' }, { bg: '#FCE7F3', fg: '#DB2777' }, { bg: '#ECFEFF', fg: '#0891B2' },
];

export interface StoryItem {
  _id: string;
  category: string;
  author_name: string;
  media_type: 'image' | 'text';
  media_url: string;
  caption: string;
  bg_color: string;
  createdAt: string;
  // Area official page stories can be pinned past 24 hours
  pinned?: boolean;
  pinned_until?: string | null;
  seen: boolean;
  is_mine: boolean;
  liked?: boolean;
  view_count?: number;
  like_count?: number;
}

export interface StoryGroup {
  key?: string;
  // 'area' = the area's own official page: always first, blue tick
  kind?: 'category' | 'official' | 'channel' | 'area';
  pinned?: boolean;
  official_id?: string;
  section_id?: string;
  verified?: boolean;
  category: string;
  title_hi?: string;
  title_hinglish?: string;
  image?: string;
  has_unseen: boolean;
  stories: StoryItem[];
}

const paletteFor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return CAT_PALETTE[Math.abs(h) % CAT_PALETTE.length];
};

const timeAgo = (iso: string) => {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / (24 * 60))}d ago`;
};

// Blue tick on officials, channels and the area's official page
const showsTick = (g: { kind?: StoryGroup['kind']; verified?: boolean }) =>
  (g.kind === 'official' || g.kind === 'channel' || g.kind === 'area') && !!g.verified;

function CategoryAvatar({ group, size }: { group: { category: string; image?: string; kind?: StoryGroup['kind'] }; size: number }) {
  // Area official page shows the app logo
  if (group.kind === 'area') {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <Image source={require('../../assets/images/logo.png')} style={{ width: size * 0.82, height: size * 0.82 }} resizeMode="contain" />
      </View>
    );
  }
  const pal = paletteFor(group.category);
  if (group.image) {
    return <Image source={{ uri: group.image }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: pal.bg }} />;
  }
  const initials = group.category.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: pal.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: pal.fg, fontWeight: '800', fontSize: size * 0.32 }}>{initials || '?'}</Text>
    </View>
  );
}

interface StoriesBarProps {
  title?: string;
  style?: any;
  // 'staff': the staff app Community row (always shows "My status", locked without the
  // admin's permission; no heading)
  variant?: 'default' | 'staff';
  myInitials?: string;
}

export default function StoriesBar({ title = 'Status', style, variant = 'default', myInitials = '' }: StoriesBarProps) {
  const { i18n } = useTranslation();
  // Start from the last fetched stories so the row never flashes a loader when a
  // screen is re-entered; fresh data is fetched silently in the background.
  const [groups, setGroups] = useState<StoryGroup[]>(() => storiesCache?.groups || []);
  const [postable, setPostable] = useState<PostTarget[]>(() => storiesCache?.postable || []);
  const [loaded, setLoaded] = useState(!!storiesCache);
  const [viewerStart, setViewerStart] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const catLabel = useCallback((g: { category: string; title_hi?: string; title_hinglish?: string }) => {
    if (i18n.language === 'hi' && g.title_hi) return g.title_hi;
    if (i18n.language === 'hinglish' && g.title_hinglish) return g.title_hinglish;
    return g.category;
  }, [i18n.language]);

  const fetchStories = useCallback(async () => {
    try {
      const token = (await SecureStore.getItemAsync('userToken')) || '';
      // Cache belongs to another account (logout / login): don't show it
      if (storiesCache && storiesCache.token !== token) {
        storiesCache = null;
        setGroups([]);
        setPostable([]);
      }
      const res = await axios.get(`${API_URL}/stories`);
      const nextGroups = Array.isArray(res.data?.groups) ? res.data.groups : [];
      const nextPostable: PostTarget[] = [
        ...(Array.isArray(res.data?.postable_officials) ? res.data.postable_officials : [])
          .map((o: any) => ({ kind: 'official' as const, id: String(o._id), label: o.name })),
        ...(Array.isArray(res.data?.postable_channels) ? res.data.postable_channels : [])
          .map((c: any) => ({ kind: 'channel' as const, id: String(c._id), label: c.name })),
        ...(Array.isArray(res.data?.postable_categories) ? res.data.postable_categories : [])
          .map((c: string) => ({ kind: 'category' as const, id: c, label: c })),
      ];
      storiesCache = { token, groups: nextGroups, postable: nextPostable };
      setGroups(nextGroups);
      setPostable(nextPostable);
    } catch (err) {
      console.log('Error fetching stories:', err);
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchStories(); }, [fetchStories]));

  useEffect(() => {
    refreshListeners.add(fetchStories);
    return () => { refreshListeners.delete(fetchStories); };
  }, [fetchStories]);

  // Keep the cache in step with local changes (e.g. stories marked as seen)
  useEffect(() => {
    if (storiesCache) storiesCache = { ...storiesCache, groups, postable };
  }, [groups, postable]);

  useEffect(() => {
    const socket = io(SOCKET_URL, { ...socketAuth, transports: ['websocket', 'polling'], reconnection: true });
    socketRef.current = socket;
    socket.on('story_changed', () => fetchStories());
    return () => { socket.disconnect(); };
  }, [fetchStories]);

  const canPost = postable.length > 0;
  const myStories = groups.flatMap(g => g.stories.filter(s => s.is_mine));

  // Show nothing (no heading, no spinner) until we know there is something to show:
  // the bar appears only once the caller may post or there are active stories.
  if (!loaded) return null;
  if (variant !== 'staff' && !canPost && groups.length === 0) return null;

  const markSeenLocally = (storyId: string) => {
    setGroups(prev => prev.map(g => {
      if (!g.stories.some(s => s._id === storyId)) return g;
      const stories = g.stories.map(s => (s._id === storyId ? { ...s, seen: true } : s));
      return { ...g, stories, has_unseen: stories.some(s => !s.seen && !s.is_mine) };
    }));
  };

  // Fresh view / like counts of an own story, kept so reopening it shows the real numbers
  const setCountsLocally = (storyId: string, views: number, likes: number) => {
    setGroups(prev => prev.map(g => {
      if (!g.stories.some(s => s._id === storyId)) return g;
      return { ...g, stories: g.stories.map(s => (s._id === storyId ? { ...s, view_count: views, like_count: likes } : s)) };
    }));
  };

  const markLikedLocally = (storyId: string, liked: boolean) => {
    setGroups(prev => prev.map(g => {
      if (!g.stories.some(s => s._id === storyId)) return g;
      return { ...g, stories: g.stories.map(s => (s._id === storyId ? { ...s, liked, seen: true } : s)) };
    }));
  };

  const overlays = (
    <>
      {viewerStart !== null && groups[viewerStart] && (
        <StoryViewer
          groups={groups}
          startGroup={viewerStart}
          catLabel={catLabel}
          onSeen={markSeenLocally}
          onLiked={markLikedLocally}
          onCounts={setCountsLocally}
          onDeleted={fetchStories}
          onClose={() => setViewerStart(null)}
        />
      )}
      {composerOpen && (
        <StoryComposer
          targets={postable}
          onClose={() => setComposerOpen(false)}
          onPosted={() => { setComposerOpen(false); fetchStories(); }}
        />
      )}
    </>
  );

  // Staff app Community row: "My status" first, then a ring per category with stories
  if (variant === 'staff') {
    const badge = !canPost
      ? { bg: '#9AA1B2', icon: 'lock-closed' as const }
      : myStories.length > 0
        ? { bg: '#16A34A', icon: 'checkmark' as const }
        : { bg: '#2F6FED', icon: 'add' as const };
    return (
      <View style={style}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sRow}>
          <TouchableOpacity
            style={styles.sItem}
            activeOpacity={0.8}
            accessibilityLabel="My status"
            onPress={() => canPost
              ? setComposerOpen(true)
              : Toast.show({ type: 'info', text1: 'No access', text2: 'Ask your RWA admin for this access' })}
          >
            <View style={styles.sMine}>
              <Text style={styles.sMineText}>{myInitials || 'ME'}</Text>
              <View style={[styles.sBadge, { backgroundColor: badge.bg }]}>
                <Ionicons name={badge.icon} size={12} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.sLabel} numberOfLines={1}>My status</Text>
          </TouchableOpacity>

          {groups.map((g, idx) => (
            <TouchableOpacity key={g.key || g.category} style={styles.sItem} activeOpacity={0.8} onPress={() => setViewerStart(idx)}>
              <View style={[styles.sRing, { borderColor: g.has_unseen ? '#2F6FED' : '#C9CED9' }]}>
                <CategoryAvatar group={g} size={51} />
              </View>
              <View style={styles.sLabelRow}>
                <Text style={[styles.sLabel, { flexShrink: 1 }]} numberOfLines={1}>{catLabel(g)}</Text>
                {showsTick(g) && <VerifiedBadge size={11} style={{ marginLeft: 2 }} />}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {overlays}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{title}</Text>
        {groups.length > 0 && <Text style={styles.hint}>Tap to view</Text>}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {canPost && (
          <TouchableOpacity style={styles.item} activeOpacity={0.8} onPress={() => setComposerOpen(true)}>
            <View style={[styles.ring, { borderColor: '#CBD5E1', borderStyle: 'dashed' }]}>
              <View style={styles.addInner}>
                <Ionicons name="camera" size={24} color="#2563EB" />
              </View>
              <View style={styles.plusBadge}>
                <Ionicons name="add" size={14} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.itemTitle} numberOfLines={1}>My Story</Text>
            <Text style={styles.itemSub} numberOfLines={1}>
              {myStories.length > 0 ? `${myStories.length} active` : 'Add update'}
            </Text>
          </TouchableOpacity>
        )}


        {groups.map((g, idx) => (
          <TouchableOpacity key={g.key || g.category} style={styles.item} activeOpacity={0.8} onPress={() => setViewerStart(idx)}>
            <View style={[styles.ring, { borderColor: g.has_unseen ? '#2563EB' : '#CBD5E1' }]}>
              <CategoryAvatar group={g} size={56} />
              {g.has_unseen && (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{g.stories.filter(s => !s.seen && !s.is_mine).length}</Text>
                </View>
              )}
            </View>
            <View style={styles.itemTitleRow}>
              <Text style={[styles.itemTitle, { marginTop: 0, flexShrink: 1 }]} numberOfLines={1}>{catLabel(g)}</Text>
              {showsTick(g) && <VerifiedBadge size={12} style={{ marginLeft: 2 }} />}
            </View>
            <Text style={styles.itemSub} numberOfLines={1}>{g.pinned ? 'Pinned' : timeAgo(g.stories[g.stories.length - 1].createdAt)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {overlays}
    </View>
  );
}

/* ------------------------------ Viewer ------------------------------ */

function StoryViewer({ groups, startGroup, catLabel, onSeen, onLiked, onCounts, onDeleted, onClose }: {
  groups: StoryGroup[];
  startGroup: number;
  catLabel: (g: StoryGroup) => string;
  onSeen: (id: string) => void;
  onLiked: (id: string, liked: boolean) => void;
  onCounts: (id: string, views: number, likes: number) => void;
  onDeleted: () => void;
  onClose: () => void;
}) {
  // Snapshot groups so live refreshes don't reshuffle the viewer mid-play
  const [snap] = useState(groups);
  const [gi, setGi] = useState(startGroup);
  const [si, setSi] = useState(() => {
    const first = snap[startGroup].stories.findIndex(s => !s.seen && !s.is_mine);
    return first >= 0 ? first : 0;
  });
  const [mediaReady, setMediaReady] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const pausedAt = useRef(0);
  const isPaused = useRef(false);
  const anim = useRef<Animated.CompositeAnimation | null>(null);

  const group = snap[gi];
  const story = group?.stories[si];

  const goNext = useCallback(() => {
    if (!group) return;
    if (si < group.stories.length - 1) setSi(si + 1);
    else if (gi < snap.length - 1) { setGi(gi + 1); setSi(0); }
    else onClose();
  }, [gi, si, group, snap.length, onClose]);

  const goPrev = () => {
    if (si > 0) setSi(si - 1);
    else if (gi > 0) { const pg = snap[gi - 1]; setGi(gi - 1); setSi(pg.stories.length - 1); }
    else { progress.setValue(0); runFrom(0); }
  };

  const runFrom = (from: number) => {
    anim.current?.stop();
    anim.current = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION_MS * (1 - from),
      useNativeDriver: false,
    });
    anim.current.start(({ finished }) => { if (finished) goNext(); });
  };

  // New story: reset bar, mark seen, wait for image before starting
  useEffect(() => {
    if (!story) return;
    anim.current?.stop();
    isPaused.current = false;
    progress.setValue(0);
    setMediaReady(story.media_type === 'text');
    if (!story.seen && !story.is_mine) {
      axios.post(`${API_URL}/stories/${story._id}/view`).catch(() => {});
      onSeen(story._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gi, si]);

  useEffect(() => {
    if (mediaReady) runFrom(0);
    return () => anim.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaReady, gi, si]);

  // "Viewed by" sheet (author only); counts refreshed from the sheet's fetch
  const [viewersFor, setViewersFor] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  const applyCounts = (id: string, views: number, likes: number) => {
    setViewCounts(prev => ({ ...prev, [id]: views }));
    setLikeCounts(prev => ({ ...prev, [id]: likes }));
    onCounts(id, views, likes);
  };

  // Own story: the list's counts can be old (views aren't pushed live), so
  // fetch the real numbers every time it is shown
  useEffect(() => {
    if (!story?.is_mine) return;
    let alive = true;
    const id = story._id;
    axios.get(`${API_URL}/stories/${id}/viewers`)
      .then(res => {
        if (!alive) return;
        const views = Number(res.data?.count ?? (res.data?.viewers || []).length) || 0;
        const likes = Number(res.data?.like_count ?? 0) || 0;
        applyCounts(id, views, likes);
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?._id]);

  // Like state per story, starting from what the server said (viewer works on a snapshot)
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const heartScale = useRef(new Animated.Value(1)).current;
  const isLiked = (s: StoryItem) => likedMap[s._id] ?? !!s.liked;

  const toggleLike = () => {
    if (!story || story.is_mine) return;
    const next = !isLiked(story);
    const id = story._id;
    setLikedMap(prev => ({ ...prev, [id]: next }));
    onLiked(id, next);
    if (next) {
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1.35, friction: 3, useNativeDriver: true }),
        Animated.spring(heartScale, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
    }
    axios.post(`${API_URL}/stories/${id}/like`, { like: next }).catch(() => {
      // Roll back if the server refused
      setLikedMap(prev => ({ ...prev, [id]: !next }));
      onLiked(id, !next);
    });
  };

  const pause = () => {
    isPaused.current = true;
    anim.current?.stop();
    progress.stopAnimation(v => { pausedAt.current = v; });
  };
  // Pressable fires onPressOut after every tap too, so only resume a real pause
  const resume = () => {
    if (!isPaused.current) return;
    isPaused.current = false;
    if (mediaReady) runFrom(pausedAt.current);
  };

  // Delete confirmation is drawn INSIDE the story viewer (WhatsApp-style); an app-level
  // alert would open behind this Modal and only show after leaving the story
  const [deleteAsk, setDeleteAsk] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const confirmDelete = () => {
    pause();
    setDeleteError('');
    setDeleteAsk(true);
  };

  const cancelDelete = () => {
    if (deleting) return;
    setDeleteAsk(false);
    resume();
  };

  const doDelete = async () => {
    if (!story || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await axios.delete(`${API_URL}/stories/${story._id}`);
      onDeleted();
      onClose();
    } catch (err: any) {
      setDeleteError(err.response?.data?.msg || 'Could not delete story. Please try again.');
      setDeleting(false);
    }
  };

  if (!group || !story) return null;
  const { width } = Dimensions.get('window');

  return (
    <Modal
      visible
      animationType="fade"
      // Back closes the "Viewed by" sheet first, then the story
      onRequestClose={() => {
        if (deleteAsk) cancelDelete();
        else if (viewersFor) { setViewersFor(null); resume(); }
        else onClose();
      }}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <StatusBar barStyle="light-content" />
      <View style={[styles.viewer, story.media_type === 'text' && { backgroundColor: story.bg_color || '#2563EB' }]}>
        {story.media_type === 'image' ? (
          <Image
            source={{ uri: story.media_url }}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
            onLoad={() => setMediaReady(true)}
            onError={() => setMediaReady(true)}
          />
        ) : (
          <View style={styles.textStoryWrap}>
            <Text style={styles.textStory}>{story.caption}</Text>
          </View>
        )}
        {!mediaReady && <ActivityIndicator size="large" color="#FFFFFF" style={StyleSheet.absoluteFill} />}

        {/* Tap zones: left = previous, right = next, hold = pause */}
        <View style={styles.tapZones}>
          <Pressable style={{ flex: 1 }} onPress={goPrev} onLongPress={pause} onPressOut={resume} delayLongPress={200} />
          <Pressable style={{ flex: 2 }} onPress={goNext} onLongPress={pause} onPressOut={resume} delayLongPress={200} />
        </View>

        {/* Top: progress bars + header */}
        <View style={styles.viewerTop} pointerEvents="box-none">
          <View style={styles.bars}>
            {group.stories.map((s, i) => (
              <View key={s._id} style={styles.barTrack}>
                <Animated.View
                  style={[styles.barFill, {
                    width: i < si ? '100%' : i > si ? '0%'
                      : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  }]}
                />
              </View>
            ))}
          </View>
          <View style={styles.viewerHeader}>
            <CategoryAvatar group={group} size={38} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.viewerTitle, { flexShrink: 1 }]} numberOfLines={1}>{catLabel(group)}</Text>
                {showsTick(group) && <VerifiedBadge size={14} style={{ marginLeft: 4 }} />}
              </View>
              <Text style={styles.viewerSub} numberOfLines={1}>
                {group.kind === 'area'
                  ? (story.pinned ? 'Pinned' : timeAgo(story.createdAt))
                  : <>{story.author_name ? `${story.author_name} • ` : ''}{timeAgo(story.createdAt)}</>}
              </Text>
            </View>
            {story.is_mine && (
              <TouchableOpacity onPress={confirmDelete} style={styles.viewerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={styles.viewerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom: caption (photo stories) + "Viewed by" (own stories) */}
        <View style={[styles.viewerBottom, { paddingBottom: 36 + insets.bottom }]} pointerEvents="box-none">
          {story.media_type === 'image' && !!story.caption && (
            <Text pointerEvents="none" style={[styles.caption, { maxWidth: width - 32 }]}>{story.caption}</Text>
          )}
          {story.is_mine && (
            <TouchableOpacity
              style={styles.viewsPill}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              onPress={() => { pause(); setViewersFor(story._id); }}
            >
              <Ionicons name="chevron-up" size={16} color="#FFFFFF" />
              <Ionicons name="eye-outline" size={16} color="#FFFFFF" />
              <Text style={styles.viewsText}>{viewCounts[story._id] ?? story.view_count ?? 0}</Text>
              <Ionicons name="heart" size={15} color="#F43F5E" style={{ marginLeft: 6 }} />
              <Text style={styles.viewsText}>{likeCounts[story._id] ?? story.like_count ?? 0}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Like (everyone except the author) */}
        {!story.is_mine && (
          <TouchableOpacity
            style={[styles.likeBtn, { bottom: 32 + insets.bottom }]}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={toggleLike}
          >
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Ionicons
                name={isLiked(story) ? 'heart' : 'heart-outline'}
                size={30}
                color={isLiked(story) ? '#F43F5E' : '#FFFFFF'}
              />
            </Animated.View>
          </TouchableOpacity>
        )}
      </View>

      {viewersFor && (
        <ViewersSheet
          storyId={viewersFor}
          onCount={(n, likes) => applyCounts(viewersFor, n, likes)}
          onClose={() => { setViewersFor(null); resume(); }}
        />
      )}

      {deleteAsk && (
        <View style={styles.delLayer}>
          <Pressable style={StyleSheet.absoluteFill} onPress={cancelDelete} />
          <View style={styles.delCard}>
            <Text style={styles.delTitle}>Delete this story?</Text>
            <Text style={styles.delMsg}>It will be removed for everyone.</Text>
            {!!deleteError && <Text style={styles.delError}>{deleteError}</Text>}
            <View style={styles.delBtns}>
              <TouchableOpacity onPress={cancelDelete} disabled={deleting} style={styles.delBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.delCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={doDelete} disabled={deleting} style={styles.delBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                {deleting ? <ActivityIndicator color="#DC2626" /> : <Text style={styles.delConfirm}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
}

/* ------------------------------ "Viewed by" sheet (author only) ------------------------------ */

interface StoryViewerRow { _id: string; name: string; role: string; place: string; at: string | null; liked?: boolean }

const formatViewTime = (iso: string | null) => {
  if (!iso) return 'Earlier';
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === yest.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${time}`;
};

function ViewersSheet({ storyId, onCount, onClose }: {
  storyId: string;
  onCount: (views: number, likes: number) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<StoryViewerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Drawn inside the story viewer (not a second Modal): the dim backdrop fades in on
  // its own while only the white sheet slides up, so no black block slides with it.
  const screenH = Dimensions.get('window').height;
  const insets = useSafeAreaInsets();
  const backdrop = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(screenH)).current;
  const closing = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, friction: 9, tension: 70, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(slide, { toValue: screenH, duration: 220, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  useEffect(() => {
    let alive = true;
    axios.get(`${API_URL}/stories/${storyId}/viewers`)
      .then(res => {
        if (!alive) return;
        const list: StoryViewerRow[] = res.data?.viewers || [];
        setRows(list);
        onCount(list.length, list.filter(v => v.liked).length);
      })
      .catch(err => { if (alive) setError(err.response?.data?.msg || 'Could not load viewers'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId]);

  return (
    <View style={styles.sheetLayer}>
      <Animated.View style={[styles.sheetBackdrop, { opacity: backdrop }]}>
        <Pressable style={{ flex: 1 }} onPress={close} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { paddingBottom: 20 + insets.bottom, transform: [{ translateY: slide }] }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>
            {loading ? 'Viewed by' : `Viewed by ${rows.length}`}
          </Text>
          <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#334155" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#2563EB" style={{ marginVertical: 30 }} />
        ) : error ? (
          <Text style={styles.sheetEmpty}>{error}</Text>
        ) : rows.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 30 }}>
            <Ionicons name="eye-off-outline" size={34} color="#CBD5E1" />
            <Text style={styles.sheetEmpty}>No views yet</Text>
          </View>
        ) : (
          <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.55 }} contentContainerStyle={{ paddingBottom: 24 }}>
            {rows.map(r => {
              const pal = paletteFor(r.name || '?');
              const initials = (r.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
              return (
                <View key={r._id} style={styles.viewerRow}>
                  <View style={[styles.viewerAvatar, { backgroundColor: pal.bg }]}>
                    <Text style={{ color: pal.fg, fontWeight: '800', fontSize: 14 }}>{initials || '?'}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.viewerName} numberOfLines={1}>{r.name}</Text>
                    <Text style={styles.viewerTime} numberOfLines={1}>
                      {formatViewTime(r.at)}{r.place ? ` · ${r.place}` : ''}
                    </Text>
                  </View>
                  {r.liked && <Ionicons name="heart" size={20} color="#F43F5E" style={{ marginLeft: 8 }} />}
                </View>
              );
            })}
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

/* ------------------------------ Composer ------------------------------ */

// Icon + one-line hint for each place a story can be shared to
const targetMeta = (tg: PostTarget): { icon: keyof typeof Ionicons.glyphMap; hint: string } => {
  if (tg.kind === 'official') return { icon: 'person-circle', hint: 'Your official page' };
  if (tg.kind === 'channel') return { icon: 'megaphone', hint: 'Channel · whole area' };
  return { icon: 'briefcase', hint: 'Your department' };
};

function StoryComposer({ targets, onClose, onPosted }: {
  targets: PostTarget[];
  onClose: () => void;
  onPosted: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [targetIdx, setTargetIdx] = useState(0);
  const target = targets[targetIdx];
  const [mode, setMode] = useState<'image' | 'text'>('image');
  const [image, setImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [bg, setBg] = useState(TEXT_BG_COLORS[0]);
  const [posting, setPosting] = useState(false);
  // Shown inside this screen: an app-level alert would open behind the Modal
  const [notice, setNotice] = useState('');

  const pick = async (fromCamera: boolean) => {
    setNotice('');
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      setNotice(fromCamera ? 'Allow camera access in Settings to take a photo.' : 'Allow photo access in Settings to choose a photo.');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, base64: true, allowsEditing: true };
    const result = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!result.canceled && result.assets?.[0]?.base64) {
      const mime = result.assets[0].mimeType || 'image/jpeg';
      setImage(`data:${mime};base64,${result.assets[0].base64}`);
    }
  };

  const canSubmit = !!target && (mode === 'image' ? !!image : caption.trim().length > 0);

  const submit = async () => {
    if (!canSubmit || posting) return;
    setPosting(true);
    setNotice('');
    try {
      await axios.post(`${API_URL}/stories`, {
        ...(target.kind === 'official' ? { official: target.id }
          : target.kind === 'channel' ? { section: target.id }
            : { category: target.id }),
        caption: caption.trim(),
        ...(mode === 'image' ? { image } : { bg_color: bg }),
      });
      onPosted();
    } catch (err: any) {
      setNotice(err.response?.data?.msg || 'Could not share the story. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const audience = target?.kind === 'channel' || target?.kind === 'category'
    ? 'Everyone in your area can see this for 24 hours'
    : 'Your followers can see this for 24 hours';

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView style={cs.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={[cs.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={onClose} style={cs.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={cs.title}>New story</Text>
            <Text style={cs.subtitle}>Disappears after 24 hours</Text>
          </View>
          <View style={cs.segment}>
            {(['image', 'text'] as const).map(m => {
              const on = mode === m;
              return (
                <TouchableOpacity key={m} onPress={() => setMode(m)} style={[cs.segBtn, on && cs.segBtnOn]} activeOpacity={0.85}>
                  <Ionicons name={m === 'image' ? 'image-outline' : 'text'} size={15} color={on ? '#0B1220' : '#CBD5E1'} />
                  <Text style={[cs.segText, on && cs.segTextOn]}>{m === 'image' ? 'Photo' : 'Text'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Share to */}
        <View style={cs.section}>
          <Text style={cs.label}>SHARE TO</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
            {targets.map((tg, i) => {
              const on = targetIdx === i;
              const meta = targetMeta(tg);
              return (
                <TouchableOpacity key={tg.kind + tg.id} onPress={() => setTargetIdx(i)} style={[cs.target, on && cs.targetOn]} activeOpacity={0.85}>
                  <View style={[cs.targetIcon, on && cs.targetIconOn]}>
                    <Ionicons name={meta.icon} size={18} color={on ? '#FFFFFF' : '#93C5FD'} />
                  </View>
                  <View style={{ marginLeft: 10, maxWidth: 150 }}>
                    <Text style={cs.targetName} numberOfLines={1}>{tg.label}</Text>
                    <Text style={cs.targetHint} numberOfLines={1}>{meta.hint}</Text>
                  </View>
                  {on && <Ionicons name="checkmark-circle" size={18} color="#60A5FA" style={{ marginLeft: 10 }} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Canvas */}
        <View style={[cs.canvas, mode === 'text' && { backgroundColor: bg, borderColor: 'transparent' }]}>
          {mode === 'image' ? (
            image ? (
              <>
                <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="contain" />
                <View style={cs.canvasActions}>
                  <TouchableOpacity style={cs.chipBtn} onPress={() => pick(false)} activeOpacity={0.85}>
                    <Ionicons name="swap-horizontal" size={15} color="#FFFFFF" />
                    <Text style={cs.chipBtnText}>Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={cs.chipBtn} onPress={() => setImage(null)} activeOpacity={0.85}>
                    <Ionicons name="trash-outline" size={15} color="#FFFFFF" />
                    <Text style={cs.chipBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={cs.empty}>
                <View style={cs.emptyIcon}>
                  <Ionicons name="images-outline" size={34} color="#93C5FD" />
                </View>
                <Text style={cs.emptyTitle}>Add a photo</Text>
                <Text style={cs.emptySub}>Share a notice, an update or a moment with your community.</Text>
                <TouchableOpacity style={cs.primaryBtn} onPress={() => pick(true)} activeOpacity={0.9}>
                  <Ionicons name="camera-outline" size={19} color="#FFFFFF" />
                  <Text style={cs.primaryBtnText}>Take photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={cs.secondaryBtn} onPress={() => pick(false)} activeOpacity={0.85}>
                  <Ionicons name="image-outline" size={19} color="#E2E8F0" />
                  <Text style={cs.secondaryBtnText}>Choose from gallery</Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            <>
              <TextInput
                style={cs.textInput}
                placeholder="Type your update"
                placeholderTextColor="rgba(255,255,255,0.65)"
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={700}
                autoFocus
              />
              <Text style={cs.counter}>{caption.length}/700</Text>
            </>
          )}
        </View>

        {mode === 'text' && (
          <View style={cs.swatches}>
            {TEXT_BG_COLORS.map(c => (
              <TouchableWithoutFeedback key={c} onPress={() => setBg(c)}>
                <View style={[cs.swatchRing, bg === c && cs.swatchRingOn]}>
                  <View style={[cs.swatch, { backgroundColor: c }]} />
                </View>
              </TouchableWithoutFeedback>
            ))}
          </View>
        )}

        {!!notice && (
          <View style={cs.notice}>
            <Ionicons name="alert-circle" size={16} color="#FCA5A5" />
            <Text style={cs.noticeText}>{notice}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={[cs.footer, { paddingBottom: insets.bottom + 14 }]}>
          <View style={cs.audience}>
            <Ionicons name="eye-outline" size={14} color="#94A3B8" />
            <Text style={cs.audienceText} numberOfLines={1}>{audience}</Text>
          </View>
          <View style={cs.footerRow}>
            {mode === 'image' ? (
              <View style={cs.captionBox}>
                <Ionicons name="create-outline" size={18} color="#94A3B8" />
                <TextInput
                  style={cs.captionInput}
                  placeholder="Add a caption"
                  placeholderTextColor="#64748B"
                  value={caption}
                  onChangeText={setCaption}
                  maxLength={700}
                />
              </View>
            ) : <View style={{ flex: 1 }} />}
            <TouchableOpacity
              style={[cs.shareBtn, !canSubmit && cs.shareBtnOff]}
              disabled={!canSubmit || posting}
              onPress={submit}
              activeOpacity={0.9}
            >
              {posting ? <ActivityIndicator color="#FFFFFF" /> : (
                <>
                  <Text style={[cs.shareText, !canSubmit && { color: '#64748B' }]}>Share</Text>
                  <Ionicons name="arrow-forward" size={17} color={canSubmit ? '#FFFFFF' : '#64748B'} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const cs = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B1220' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFFFFF', fontSize: 19, fontWeight: '800', letterSpacing: -0.2 },
  subtitle: { color: '#94A3B8', fontSize: 12.5, marginTop: 1 },
  segment: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 3 },
  segBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9 },
  segBtnOn: { backgroundColor: '#FFFFFF' },
  segText: { color: '#CBD5E1', fontSize: 13, fontWeight: '700' },
  segTextOn: { color: '#0B1220' },

  section: { paddingLeft: 16, marginBottom: 14 },
  label: { color: '#64748B', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  target: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingLeft: 9, paddingRight: 14, borderRadius: 14,
    backgroundColor: '#111A2E', borderWidth: 1, borderColor: '#1E293B',
  },
  targetOn: { borderColor: '#3B82F6', backgroundColor: '#13254A' },
  targetIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(59,130,246,0.14)', alignItems: 'center', justifyContent: 'center' },
  targetIconOn: { backgroundColor: '#2563EB' },
  targetName: { color: '#F1F5F9', fontSize: 14, fontWeight: '700' },
  targetHint: { color: '#94A3B8', fontSize: 11.5, marginTop: 1 },

  canvas: {
    flex: 1, marginHorizontal: 16, borderRadius: 20, backgroundColor: '#111A2E', borderWidth: 1, borderColor: '#1E293B',
    overflow: 'hidden', justifyContent: 'center',
  },
  canvasActions: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 8 },
  chipBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(15,23,42,0.7)', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 16 },
  chipBtnText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  empty: { alignItems: 'center', paddingHorizontal: 28 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(59,130,246,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  emptySub: { color: '#94A3B8', fontSize: 13.5, textAlign: 'center', marginTop: 6, lineHeight: 19, marginBottom: 22 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch', height: 50, borderRadius: 14, backgroundColor: '#2563EB',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch', height: 50, borderRadius: 14, marginTop: 10,
    borderWidth: 1, borderColor: '#334155',
  },
  secondaryBtnText: { color: '#E2E8F0', fontSize: 15, fontWeight: '700' },
  textInput: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', textAlign: 'center', padding: 24, lineHeight: 34 },
  counter: { position: 'absolute', bottom: 10, right: 14, color: 'rgba(255,255,255,0.7)', fontSize: 11.5, fontWeight: '600' },
  swatches: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 14 },
  swatchRing: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  swatchRingOn: { borderColor: '#FFFFFF' },
  swatch: { width: 24, height: 24, borderRadius: 12 },

  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 12, backgroundColor: 'rgba(220,38,38,0.14)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.35)',
  },
  noticeText: { flex: 1, color: '#FECACA', fontSize: 13 },

  footer: { paddingHorizontal: 16, paddingTop: 12 },
  audience: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  audienceText: { flex: 1, color: '#94A3B8', fontSize: 12 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  captionBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 50, borderRadius: 14, paddingHorizontal: 14,
    backgroundColor: '#111A2E', borderWidth: 1, borderColor: '#1E293B',
  },
  captionInput: { flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 0 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 50, paddingHorizontal: 20, borderRadius: 14, backgroundColor: '#2563EB' },
  shareBtnOff: { backgroundColor: '#1E293B' },
  shareText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});


const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  // Staff variant (Community row)
  sRow: { gap: 14, paddingRight: 8 },
  sItem: { width: 66, alignItems: 'center', gap: 6 },
  sMine: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center' },
  sMineText: { color: '#2F6FED', fontSize: 18, fontWeight: '800' },
  sBadge: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  sRing: { width: 62, height: 62, borderRadius: 31, borderWidth: 2.5, padding: 3, alignItems: 'center', justifyContent: 'center' },
  sLabelRow: { flexDirection: 'row', alignItems: 'center', maxWidth: 66 },
  sLabel: { fontSize: 11, fontWeight: '700', color: '#0B1020', textAlign: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  heading: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  hint: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  row: { paddingRight: 8, gap: 14 },
  item: { width: 72, alignItems: 'center' },
  ring: {
    width: 66, height: 66, borderRadius: 33, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center',
  },
  addInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  plusBadge: {
    position: 'absolute', right: -1, bottom: -1, width: 22, height: 22, borderRadius: 11, backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF',
  },
  countBadge: {
    position: 'absolute', right: -2, bottom: -2, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF', paddingHorizontal: 4,
  },
  countText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, maxWidth: 72 },
  itemTitle: { marginTop: 6, fontSize: 12, fontWeight: '700', color: '#0F172A', maxWidth: 72 },
  itemSub: { fontSize: 10, color: '#64748B', maxWidth: 72 },

  viewer: { flex: 1, backgroundColor: '#000000' },
  textStoryWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  textStory: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', textAlign: 'center', lineHeight: 38 },
  tapZones: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  viewerTop: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: (StatusBar.currentHeight || 40) + 6, paddingHorizontal: 10 },
  bars: { flexDirection: 'row', gap: 4 },
  barTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  barFill: { height: 3, backgroundColor: '#FFFFFF' },
  viewerHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  viewerTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  viewerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  viewerBtn: { padding: 6, marginLeft: 6 },
  viewerBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 36, paddingHorizontal: 16, alignItems: 'center' },
  caption: {
    color: '#FFFFFF', fontSize: 16, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, overflow: 'hidden',
  },
  sheetLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  sheetBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' },
  // Bottom padding (safe-area inset added inline) keeps the sheet white down to the screen edge
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18,
    minHeight: 180,
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', marginTop: 8, marginBottom: 6 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  sheetEmpty: { textAlign: 'center', color: '#64748B', marginTop: 8, marginBottom: 20, fontSize: 14 },
  viewerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  viewerAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  viewerName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  viewerTime: { fontSize: 12.5, color: '#64748B', marginTop: 2 },
  viewsPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  viewsText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  delLayer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32,
  },
  delCard: { width: '100%', maxWidth: 340, backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 10 },
  delTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  delMsg: { fontSize: 14, color: '#475569', marginTop: 8, lineHeight: 20 },
  delError: { fontSize: 13, color: '#DC2626', marginTop: 10 },
  delBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  delBtn: { minWidth: 76, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
  delCancel: { fontSize: 15, fontWeight: '700', color: '#2563EB' },
  delConfirm: { fontSize: 15, fontWeight: '800', color: '#DC2626' },
  likeBtn: {
    position: 'absolute', right: 18, width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
  },

});
