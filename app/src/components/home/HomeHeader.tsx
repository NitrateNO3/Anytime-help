// Home header shared by Resident and Member:
// - HomeHeader: teal hero (brand, bell, avatar, search, banner slider of text cards or images)
// - CompactHomeHeader: white bar that fades in once the hero scrolls away
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, FlatList, Dimensions, Platform, StatusBar as RNStatusBar, Animated, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { hasOfferPage, rememberOfferBanner, type BannerOffer } from '../../utils/offerBanner';

const API_URL = 'https://api.anytimehelp.co.in/api';
const HERO_TOP = '#0D3346';
const HERO_BOTTOM = '#1C6A66';
const CARD_H = 196;
// Full-bleed hero banner: the picture fills the whole top area (behind the status bar,
// logo and search) at a fixed 9:10 shape, so a 1080 x 1200 image fits every phone
const HERO_RATIO = 10 / 9;
const LIP_H = 24;
const DOTS_H = 26;
const TOP_PAD = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) + 8 : 48;
// Height of the logo row + search bar that sit on top of the banner
const TOP_PART = TOP_PAD + 56 + 18 + 52;


export const initialsOf = (name?: string, fallback = 'U') =>
  (name || fallback).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

interface Banner {
  _id?: string; url: string; title?: string; link?: string; duration?: number;
  // Text card banner (admin 'Text card' type)
  style?: 'image' | 'card'; tag?: string; subtitle?: string; ctaLabel?: string; icon?: string;
  expiresAt?: string | null;
  // Set in the admin panel: tapping opens the offer details page
  offer?: BannerOffer;
}

const isCard = (b: Banner) => b.style === 'card' || !b.url;

// Opens a banner link: web/tel/mail links outside the app, '/path' links inside it
function openBannerLink(link?: string) {
  const l = String(link || '').trim();
  if (!l) return false;
  if (l.startsWith('/')) router.push(l as any);
  else Linking.openURL(/^[a-z]+:/i.test(l) ? l : `https://${l}`).catch(() => {});
  return true;
}

interface HeaderProps {
  user: any;
  portalLabel: string;
  unreadCount: number;
  banners: Banner[];
  onBell: () => void;
  onAvatar: () => void;
  onBannerPress: (b: Banner) => void;
  onSearch: () => void;
  // Who is viewing, shown on the offer details page
  offerFor?: 'residents' | 'members';
  // Lets a screen wrap the avatar (e.g. in a tutorial step)
  wrapAvatar?: (node: React.ReactElement) => React.ReactElement;
}

export default function HomeHeader({ user, portalLabel, unreadCount, banners, onBell, onAvatar, onBannerPress, onSearch, offerFor = 'residents', wrapAvatar }: HeaderProps) {
  const width = Dimensions.get('window').width;
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Banner>>(null);
  const hasBanners = banners.length > 0;
  const heroH = Math.max(Math.round(width * HERO_RATIO), TOP_PART + CARD_H + DOTS_H + LIP_H);

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

  const avatar = (
    <TouchableOpacity style={s.avatar} onPress={onAvatar} activeOpacity={0.8}>
      <Text style={s.avatarText}>{initialsOf(user?.name)}</Text>
    </TouchableOpacity>
  );

  const pressBanner = (b: Banner) => {
    if (hasOfferPage(b)) {
      rememberOfferBanner(b as any);
      router.push({ pathname: '/offer-details', params: { id: b._id!, for: offerFor } } as any);
      return;
    }
    if (openBannerLink(b.link)) return;
    if (b.url) onBannerPress(b);
  };

  const topBar = (
    <>
      <View style={s.topRow}>
        <Image source={require('../../../assets/images/logo.png')} style={{ width: 56, height: 56 }} resizeMode="contain" />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.brand}>ANYTIME HELP</Text>
          <View style={s.portalPill}>
            <Text style={s.portalText}>{portalLabel}</Text>
          </View>
        </View>
        <TouchableOpacity style={s.bell} onPress={onBell} activeOpacity={0.8}>
          <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
          {unreadCount > 0 && <View style={s.bellDot} />}
        </TouchableOpacity>
        {wrapAvatar ? wrapAvatar(avatar) : avatar}
      </View>

      <TouchableOpacity style={s.search} activeOpacity={0.85} onPress={onSearch}>
        <Ionicons name="search" size={20} color="rgba(255,255,255,0.7)" />
        <Text style={s.searchText} numberOfLines={1}>Search 'doctor', 'grocery', 'salon'…</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <LinearGradient
      colors={[HERO_TOP, HERO_BOTTOM]} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }}
      style={[s.hero, hasBanners && { height: heroH, paddingTop: 0 }]}
    >
      {/* Soft rings in the background */}
      <View style={[s.ring, { width: 300, height: 300, borderRadius: 150, top: 90, right: -80 }]} />
      <View style={[s.ring, { width: 170, height: 170, borderRadius: 85, top: 235, right: 0, borderWidth: 14, borderColor: 'rgba(255,255,255,0.05)' }]} />

      {hasBanners ? (
        <>
          {/* Whole-hero slider: every slide covers the full top area and slides as one piece */}
          <FlatList
            ref={listRef}
            data={banners}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={StyleSheet.absoluteFill}
            keyExtractor={(b, i) => b._id || `hb-${i}`}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={e => setIndex(Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.x / width), banners.length - 1)))}
            renderItem={({ item }) => isCard(item) ? (
              <TouchableOpacity activeOpacity={0.92} onPress={() => pressBanner(item)} style={[s.card, { width, height: heroH }]}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  {!!item.tag && (
                    <View style={s.tagPill}><Text style={s.tagText} numberOfLines={1}>{item.tag.toUpperCase()}</Text></View>
                  )}
                  <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
                  {!!item.subtitle && <Text style={s.cardSub} numberOfLines={2}>{item.subtitle}</Text>}
                  {!!item.ctaLabel && (
                    <View style={s.cta}>
                      <Text style={s.ctaText}>{item.ctaLabel}</Text>
                      <Ionicons name="chevron-forward" size={14} color="#0D3346" />
                    </View>
                  )}
                </View>
                <View>
                  <View style={s.tile}>
                    {item.url ? (
                      <Image source={{ uri: item.url }} style={s.tileImg} resizeMode="cover" />
                    ) : (
                      <Ionicons name={(item.icon || 'sparkles-outline') as any} size={46} color="#FFFFFF" />
                    )}
                  </View>
                  <View style={s.cardAd}><Text style={s.adTagText}>AD</Text></View>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity activeOpacity={0.95} onPress={() => pressBanner(item)} style={{ width, height: heroH }}>
                <Image source={{ uri: item.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                {/* Dark fade at the top keeps the logo, bell and search readable on any picture */}
                <LinearGradient
                  colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: TOP_PART + 24 }}
                  pointerEvents="none"
                />
                <View style={s.adTag}><Text style={s.adTagText}>AD</Text></View>
              </TouchableOpacity>
            )}
          />

          {/* Logo row + search float above the slider; empty space passes swipes through */}
          <View style={{ paddingTop: TOP_PAD }} pointerEvents="box-none">
            {topBar}
          </View>

          {banners.length > 1 && (
            <View style={s.dots} pointerEvents="none">
              {banners.map((_, i) => <View key={i} style={[s.dot, i === index && s.dotOn]} />)}
            </View>
          )}

          {/* White sheet edge the page content starts on */}
          <View style={[s.sheetLip, s.sheetLipAbs]} pointerEvents="none" />
        </>
      ) : (
        <>
          {topBar}
          <View style={[s.sheetLip, { marginTop: 22 }]} />
        </>
      )}
    </LinearGradient>
  );
}

/* Compact white header shown after the hero scrolls out of view */
export function CompactHomeHeader({ user, opacity, visible, onAvatar, onSearch }: {
  user: any;
  opacity: Animated.AnimatedInterpolation<number>;
  visible: boolean;
  onAvatar: () => void;
  onSearch: () => void;
}) {
  return (
    <Animated.View style={[s.compact, { opacity }]} pointerEvents={visible ? 'auto' : 'none'}>
      <Image source={require('../../../assets/images/logo.png')} style={{ width: 36, height: 36 }} resizeMode="contain" />
      <TouchableOpacity style={s.compactSearch} activeOpacity={0.8} onPress={onSearch}>
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
  hero: { paddingTop: TOP_PAD, overflow: 'hidden' },
  ring: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)' },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  brand: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', letterSpacing: 0.6 },
  portalPill: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: '#FCD34D', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  portalText: { color: '#78350F', fontSize: 11.5, fontWeight: '900', letterSpacing: 1 },
  bell: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(5,20,30,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  bellDot: { position: 'absolute', top: 10, right: 12, width: 9, height: 9, borderRadius: 5, backgroundColor: '#F87171', borderWidth: 1.5, borderColor: HERO_TOP },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#1D4ED8', fontSize: 16, fontWeight: '900' },

  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 18, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(5,20,30,0.28)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 16,
  },
  searchText: { flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: 15 },

  // Text card banner
  card: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: TOP_PART + 4, paddingBottom: DOTS_H + LIP_H },
  tagPill: { alignSelf: 'flex-start', backgroundColor: '#5EE9C9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  tagText: { color: '#064E3B', fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8 },
  cardTitle: { color: '#FFFFFF', fontSize: 24, lineHeight: 29, fontWeight: '800', letterSpacing: -0.4 },
  cardSub: { color: 'rgba(255,255,255,0.88)', fontSize: 12.5, marginTop: 6 },
  cta: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 2, marginTop: 14,
    backgroundColor: '#EEF2F6', borderRadius: 999, paddingHorizontal: 16, height: 38,
  },
  ctaText: { color: '#0D3346', fontSize: 14, fontWeight: '800' },
  tile: {
    width: 92, height: 100, borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  tileImg: { width: '100%', height: '100%' },
  cardAd: { position: 'absolute', bottom: -10, right: -2, backgroundColor: 'rgba(8,30,40,0.85)', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },

  adTag: { position: 'absolute', bottom: LIP_H + 10, right: 14, backgroundColor: 'rgba(15,23,42,0.55)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  adTagText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  dots: { position: 'absolute', left: 16, bottom: LIP_H + 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotOn: { width: 22, backgroundColor: '#FFFFFF' },
  sheetLip: { height: LIP_H, backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  sheetLipAbs: { position: 'absolute', left: 0, right: 0, bottom: 0 },

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
