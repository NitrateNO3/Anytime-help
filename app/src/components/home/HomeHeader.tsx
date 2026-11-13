// Home header shared by Resident and Member:
// - HomeHeader: blue hero (brand, bell, avatar, location, search, edge-to-edge banner slider)
// - CompactHomeHeader: white bar that fades in once the hero scrolls away
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, FlatList, Dimensions, Platform, StatusBar as RNStatusBar, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Toast from 'react-native-toast-message';

const API_URL = 'https://anytime-help.onrender.com/api';
const BLUE = '#2347E0';
// Banner height follows the image shape so nothing gets cropped
const DEFAULT_RATIO = 16 / 9;
const MIN_RATIO = 1.2;   // never taller than this
const MAX_RATIO = 3.5;   // never thinner than this
const TOP_PAD = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) + 8 : 48;

const comingSoon = () =>
  Toast.show({ type: 'info', text1: 'Coming soon', text2: 'This feature will be live shortly.', position: 'bottom', visibilityTime: 2000 });

export const initialsOf = (name?: string, fallback = 'U') =>
  (name || fallback).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// Area (RWA) name for the location line, fetched once per app session
let areaCache: { name: string; city: string } | null = null;
function useAreaInfo() {
  const [area, setArea] = useState(areaCache);
  useEffect(() => {
    if (areaCache) return;
    axios.get(`${API_URL}/areas/current`)
      .then(res => {
        if (res.data?.name) {
          areaCache = { name: res.data.name, city: res.data.city || '' };
          setArea(areaCache);
        }
      })
      .catch(() => {});
  }, []);
  return area;
}

interface Banner { _id?: string; url: string; title?: string; link?: string; duration?: number }

interface HeaderProps {
  user: any;
  portalLabel: string;
  unreadCount: number;
  banners: Banner[];
  onBell: () => void;
  onAvatar: () => void;
  onBannerPress: (b: Banner) => void;
  // Lets a screen wrap the avatar (e.g. in a tutorial step)
  wrapAvatar?: (node: React.ReactElement) => React.ReactElement;
  // Extra content under the location line (e.g. Member ID badges)
  extra?: React.ReactNode;
}

export default function HomeHeader({ user, portalLabel, unreadCount, banners, onBell, onAvatar, onBannerPress, wrapAvatar, extra }: HeaderProps) {
  const area = useAreaInfo();
  const width = Dimensions.get('window').width;
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Banner>>(null);
  const [ratio, setRatio] = useState(DEFAULT_RATIO);

  // Read the first banner's real size; all slides use that height and 'contain',
  // so banners of a different shape are letterboxed instead of cut
  const firstUrl = banners[0]?.url;
  useEffect(() => {
    if (!firstUrl) return;
    let alive = true;
    Image.getSize(firstUrl, (w, h) => {
      if (alive && w > 0 && h > 0) setRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, w / h)));
    }, () => {});
    return () => { alive = false; };
  }, [firstUrl]);
  const bannerH = Math.round(width / ratio);

  // Auto-advance using each banner's own duration (seconds, default 4)
  useEffect(() => {
    if (banners.length < 2) return;
    const secs = Number(banners[index]?.duration) > 0 ? Number(banners[index].duration) : 4;
    const t = setTimeout(() => {
      const next = index >= banners.length - 1 ? 0 : index + 1;
      listRef.current?.scrollToOffset({ offset: next * width, animated: true });
      setIndex(next);
    }, secs * 1000);
    return () => clearTimeout(t);
  }, [banners, index, width]);

  useEffect(() => { if (index >= banners.length) setIndex(0); }, [banners.length, index]);

  const addressLine = [
    [user?.house_no || user?.room_number, user?.block ? `Block ${user.block}` : ''].filter(Boolean).join(', '),
    [user?.phase, area?.city].filter(Boolean).join(', '),
  ].filter(Boolean).join(' · ');

  const avatar = (
    <TouchableOpacity style={s.avatar} onPress={onAvatar} activeOpacity={0.8}>
      <Text style={s.avatarText}>{initialsOf(user?.name)}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={s.hero}>
      <View style={s.glow} />
      <View style={s.topRow}>
        <View style={s.logoBox}>
          <Image source={require('../../../assets/images/logo.png')} style={{ width: 38, height: 38 }} resizeMode="contain" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.brand}>ANYTIME HELP</Text>
          <View style={s.portalPill}><Text style={s.portalText}>{portalLabel}</Text></View>
        </View>
        <TouchableOpacity style={s.bell} onPress={onBell} activeOpacity={0.8}>
          <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
          {unreadCount > 0 && <View style={s.bellDot} />}
        </TouchableOpacity>
        {wrapAvatar ? wrapAvatar(avatar) : avatar}
      </View>

      <View style={s.locRow}>
        <Ionicons name="location-sharp" size={20} color="#FFFFFF" style={{ marginTop: 1 }} />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={s.locTitle} numberOfLines={1}>{area?.name || user?.phase || 'Your society'}</Text>
          {!!addressLine && <Text style={s.locSub} numberOfLines={1}>{addressLine}</Text>}
        </View>
      </View>

      {!!extra && <View style={s.extra}>{extra}</View>}

      <TouchableOpacity style={s.search} activeOpacity={0.85} onPress={comingSoon}>
        <Ionicons name="search" size={20} color="rgba(255,255,255,0.85)" />
        <Text style={s.searchText} numberOfLines={1}>Search 'doctor', 'grocery', 'salon'…</Text>
      </TouchableOpacity>

      {banners.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <FlatList
            ref={listRef}
            data={banners}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(b, i) => b._id || `hb-${i}`}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={e => setIndex(Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.x / width), banners.length - 1)))}
            renderItem={({ item }) => (
              <TouchableOpacity activeOpacity={0.92} onPress={() => onBannerPress(item)} style={{ width, height: bannerH }}>
                <Image source={{ uri: item.url }} style={StyleSheet.absoluteFill} resizeMode="contain" />
                <View style={s.adTag}><Text style={s.adTagText}>AD</Text></View>
              </TouchableOpacity>
            )}
          />
          {banners.length > 1 && (
            <View style={s.dots}>
              {banners.map((_, i) => <View key={i} style={[s.dot, i === index && s.dotOn]} />)}
            </View>
          )}
        </View>
      )}
      {banners.length === 0 && <View style={{ height: 16 }} />}
    </View>
  );
}

/* Compact white header shown after the hero scrolls out of view */
export function CompactHomeHeader({ user, opacity, visible, onAvatar }: {
  user: any;
  opacity: Animated.AnimatedInterpolation<number>;
  visible: boolean;
  onAvatar: () => void;
}) {
  return (
    <Animated.View style={[s.compact, { opacity }]} pointerEvents={visible ? 'auto' : 'none'}>
      <Image source={require('../../../assets/images/logo.png')} style={{ width: 36, height: 36 }} resizeMode="contain" />
      <TouchableOpacity style={s.compactSearch} activeOpacity={0.8} onPress={comingSoon}>
        <Ionicons name="search" size={18} color="#475569" />
        <Text style={s.compactSearchText} numberOfLines={1}>Search 'doctor', 'grocery'…</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.compactAvatar} onPress={onAvatar} activeOpacity={0.8}>
        <Text style={s.compactAvatarText}>{initialsOf(user?.name)}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: BLUE, paddingTop: TOP_PAD, overflow: 'hidden' },
  glow: { position: 'absolute', top: -80, right: -60, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.06)' },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  logoBox: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', letterSpacing: 0.6 },
  portalPill: { alignSelf: 'flex-start', marginTop: 3, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  portalText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '800', letterSpacing: 1 },
  bell: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  bellDot: { position: 'absolute', top: 10, right: 11, width: 9, height: 9, borderRadius: 5, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: BLUE },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#1D4ED8', fontSize: 16, fontWeight: '900' },

  locRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, marginTop: 16 },
  locTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  extra: { paddingHorizontal: 16, marginTop: 12 },
  locSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 },

  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 14, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(15,23,80,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 16,
  },
  searchText: { flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 15 },

  adTag: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(15,23,42,0.55)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  adTagText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, paddingVertical: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotOn: { width: 20, backgroundColor: '#FFFFFF' },

  compact: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', paddingTop: TOP_PAD, paddingBottom: 10, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9', elevation: 3,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6,
  },
  compactSearch: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 22,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14,
  },
  compactSearchText: { flex: 1, color: '#64748B', fontSize: 14 },
  compactAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center' },
  compactAvatarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
