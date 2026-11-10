import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, Animated,
  Dimensions, TextInput, ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
  Pressable, StatusBar, TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { io, Socket } from 'socket.io-client';
import { socketAuth } from '../utils/socketAuth';
import * as SecureStore from 'expo-secure-store';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

const STORY_DURATION_MS = 5000;

// Shared across every StoriesBar instance and remount (per signed-in token)
// Where the signed-in user may post: their staff categories and/or their own official page
export interface PostTarget { kind: 'category' | 'official'; id: string; label: string }

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
  seen: boolean;
  is_mine: boolean;
  view_count?: number;
}

export interface StoryGroup {
  key?: string;
  kind?: 'category' | 'official';
  official_id?: string;
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
  return `${Math.floor(mins / 60)}h ago`;
};

function CategoryAvatar({ group, size }: { group: { category: string; image?: string }; size: number }) {
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
}

export default function StoriesBar({ title = 'Status', style }: StoriesBarProps) {
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

  // Nothing to show for a resident when no stories are active
  if (loaded && !canPost && groups.length === 0) return null;

  const markSeenLocally = (storyId: string) => {
    setGroups(prev => prev.map(g => {
      if (!g.stories.some(s => s._id === storyId)) return g;
      const stories = g.stories.map(s => (s._id === storyId ? { ...s, seen: true } : s));
      return { ...g, stories, has_unseen: stories.some(s => !s.seen && !s.is_mine) };
    }));
  };

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

        {!loaded && <ActivityIndicator style={{ marginLeft: 12 }} color="#2563EB" />}

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
              {g.kind === 'official' && g.verified && <Ionicons name="checkmark-circle" size={12} color="#2563EB" style={{ marginLeft: 2 }} />}
            </View>
            <Text style={styles.itemSub} numberOfLines={1}>{timeAgo(g.stories[g.stories.length - 1].createdAt)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {viewerStart !== null && groups[viewerStart] && (
        <StoryViewer
          groups={groups}
          startGroup={viewerStart}
          catLabel={catLabel}
          onSeen={markSeenLocally}
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
    </View>
  );
}

/* ------------------------------ Viewer ------------------------------ */

function StoryViewer({ groups, startGroup, catLabel, onSeen, onDeleted, onClose }: {
  groups: StoryGroup[];
  startGroup: number;
  catLabel: (g: StoryGroup) => string;
  onSeen: (id: string) => void;
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

  const confirmDelete = () => {
    pause();
    Alert.alert('Delete story?', 'This story will be removed for everyone.', [
      { text: 'Cancel', style: 'cancel', onPress: resume },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await axios.delete(`${API_URL}/stories/${story!._id}`);
            onDeleted();
            onClose();
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.msg || 'Could not delete story');
            resume();
          }
        },
      },
    ]);
  };

  if (!group || !story) return null;
  const { width } = Dimensions.get('window');

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
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
              <Text style={styles.viewerTitle} numberOfLines={1}>{catLabel(group)}</Text>
              <Text style={styles.viewerSub} numberOfLines={1}>
                {story.author_name ? `${story.author_name} • ` : ''}{timeAgo(story.createdAt)}
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

        {/* Bottom: caption (photo stories) + views (own stories) */}
        <View style={styles.viewerBottom} pointerEvents="none">
          {story.media_type === 'image' && !!story.caption && (
            <Text style={[styles.caption, { maxWidth: width - 32 }]}>{story.caption}</Text>
          )}
          {story.is_mine && (
            <View style={styles.viewsPill}>
              <Ionicons name="eye-outline" size={16} color="#FFFFFF" />
              <Text style={styles.viewsText}>{story.view_count ?? 0} views</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

/* ------------------------------ Composer (Staff) ------------------------------ */

function StoryComposer({ targets, onClose, onPosted }: {
  targets: PostTarget[];
  onClose: () => void;
  onPosted: () => void;
}) {
  const [targetIdx, setTargetIdx] = useState(0);
  const target = targets[targetIdx];
  const [mode, setMode] = useState<'image' | 'text'>('image');
  const [image, setImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [bg, setBg] = useState(TEXT_BG_COLORS[0]);
  const [posting, setPosting] = useState(false);

  const pick = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', fromCamera ? 'Camera access is required.' : 'Photo library access is required.');
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
    try {
      await axios.post(`${API_URL}/stories`, {
        ...(target.kind === 'official' ? { official: target.id } : { category: target.id }),
        caption: caption.trim(),
        ...(mode === 'image' ? { image } : { bg_color: bg }),
      });
      onPosted();
    } catch (err: any) {
      Alert.alert('Could not post', err.response?.data?.msg || 'Please try again.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0F172A' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.composerHeader}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.composerTitle}>New Story</Text>
          <View style={styles.modeSwitch}>
            {(['image', 'text'] as const).map(m => (
              <TouchableOpacity key={m} onPress={() => setMode(m)} style={[styles.modeBtn, mode === m && styles.modeBtnActive]}>
                <Ionicons name={m === 'image' ? 'image' : 'text'} size={16} color={mode === m ? '#0F172A' : '#FFFFFF'} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Only the user's own staff categories / own official page */}
        <View style={styles.catPickerWrap}>
          <Text style={styles.catPickerLabel}>Post in</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
            {targets.map((tg, i) => (
              <TouchableOpacity key={tg.kind + tg.id} onPress={() => setTargetIdx(i)} style={[styles.catChip, targetIdx === i && styles.catChipActive]}>
                <Text style={[styles.catChipText, targetIdx === i && styles.catChipTextActive]}>
                  {tg.kind === 'official' ? `As ${tg.label}` : tg.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={[styles.preview, mode === 'text' && { backgroundColor: bg }]}>
          {mode === 'image' ? (
            image ? (
              <>
                <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="contain" />
                <TouchableOpacity style={styles.removeImg} onPress={() => setImage(null)}>
                  <Ionicons name="close-circle" size={30} color="#FFFFFF" />
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.pickRow}>
                <TouchableOpacity style={styles.pickBtn} onPress={() => pick(true)}>
                  <Ionicons name="camera" size={30} color="#FFFFFF" />
                  <Text style={styles.pickText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pickBtn} onPress={() => pick(false)}>
                  <Ionicons name="images" size={30} color="#FFFFFF" />
                  <Text style={styles.pickText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            <TextInput
              style={styles.textInputBig}
              placeholder="Type an update…"
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={700}
              autoFocus
            />
          )}
        </View>

        {mode === 'text' && (
          <View style={styles.swatches}>
            {TEXT_BG_COLORS.map(c => (
              <TouchableWithoutFeedback key={c} onPress={() => setBg(c)}>
                <View style={[styles.swatch, { backgroundColor: c }, bg === c && styles.swatchActive]} />
              </TouchableWithoutFeedback>
            ))}
          </View>
        )}

        <View style={styles.composerFooter}>
          {mode === 'image' ? (
            <TextInput
              style={styles.captionInput}
              placeholder="Add a caption…"
              placeholderTextColor="#94A3B8"
              value={caption}
              onChangeText={setCaption}
              maxLength={700}
            />
          ) : <View style={{ flex: 1 }}><Text style={styles.footerNote}>Visible to everyone for 24 hours</Text></View>}
          <TouchableOpacity style={[styles.sendBtn, !canSubmit && { opacity: 0.4 }]} disabled={!canSubmit || posting} onPress={submit}>
            {posting ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="send" size={20} color="#FFFFFF" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
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
  viewsPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  viewsText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  composerHeader: {
    flexDirection: 'row', alignItems: 'center', paddingTop: (StatusBar.currentHeight || 40) + 10, paddingHorizontal: 16, paddingBottom: 12,
  },
  composerTitle: { flex: 1, color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginLeft: 14 },
  modeSwitch: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 18, padding: 3 },
  modeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
  modeBtnActive: { backgroundColor: '#FFFFFF' },
  catPickerWrap: { paddingLeft: 16, marginBottom: 12 },
  catPickerLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  catChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  catChipText: { color: '#E2E8F0', fontWeight: '600', fontSize: 13 },
  catChipTextActive: { color: '#FFFFFF' },
  preview: { flex: 1, marginHorizontal: 16, borderRadius: 18, backgroundColor: '#1E293B', overflow: 'hidden', justifyContent: 'center' },
  pickRow: { flexDirection: 'row', justifyContent: 'center', gap: 28 },
  pickBtn: { alignItems: 'center', justifyContent: 'center', width: 110, height: 110, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)' },
  pickText: { color: '#FFFFFF', marginTop: 8, fontWeight: '700' },
  removeImg: { position: 'absolute', top: 10, right: 10 },
  textInputBig: { color: '#FFFFFF', fontSize: 26, fontWeight: '700', textAlign: 'center', padding: 24 },
  swatches: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 12 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: '#FFFFFF', transform: [{ scale: 1.15 }] },
  composerFooter: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 28, gap: 10 },
  captionInput: { flex: 1, backgroundColor: '#1E293B', color: '#FFFFFF', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 },
  footerNote: { color: '#94A3B8', fontSize: 12 },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
});
