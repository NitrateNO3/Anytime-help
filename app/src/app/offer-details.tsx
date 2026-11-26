// Offer details: opened by tapping a home header banner that has an offer page.
// Everything on this page comes from the banner's `offer` fields, set in the admin panel.
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking, Share, ActivityIndicator, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { cachedOfferBanner, offerTheme, type OfferBanner } from '../utils/offerBanner';

const API_URL = 'https://api.anytimehelp.co.in/api';
const HERO_H = 236;

const openLink = (router: ReturnType<typeof useRouter>, link?: string) => {
  const l = String(link || '').trim();
  if (!l) return;
  if (l.startsWith('/')) router.push(l as any);
  else Linking.openURL(/^[a-z]+:/i.test(l) ? l : `https://${l}`).catch(() => {});
};

const formatDate = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function OfferDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, for: audience } = useLocalSearchParams<{ id: string; for?: string }>();
  const [banner, setBanner] = useState<OfferBanner | undefined>(() => cachedOfferBanner(id));
  const [loading, setLoading] = useState(!banner);
  const [codeShown, setCodeShown] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!id) { setLoading(false); return; }
    axios.get(`${API_URL}/staff-banners/${id}`)
      .then((res) => { if (alive && res.data?._id) setBanner(res.data); })
      .catch((e) => {
        // Taken down or expired since the home screen loaded
        if (alive && e?.response?.status === 404) setBanner(undefined);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace((audience === 'members' ? '/member' : '/resident') as any);
  };

  const offer = banner?.offer;
  const t = offerTheme(offer?.theme);
  const forLabel = audience === 'members' ? 'for members' : 'for residents';

  const header = (
    <View style={[s.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity style={s.backBtn} onPress={goBack} activeOpacity={0.8} accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={22} color="#0F172A" />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={s.headerTitle}>Offer details</Text>
        <Text style={s.headerSub}>Sponsored · {forLabel}</Text>
      </View>
    </View>
  );

  if (!offer?.enabled || !offer.title) {
    return (
      <View style={s.screen}>
        <StatusBar style="dark" />
        {header}
        <View style={s.empty}>
          {loading ? (
            <ActivityIndicator color="#0F766E" />
          ) : (
            <>
              <Ionicons name="pricetag-outline" size={40} color="#94A3B8" />
              <Text style={s.emptyTitle}>This offer is no longer available</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={goBack} activeOpacity={0.85}>
                <Text style={s.emptyBtnText}>Go back</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  const points = offer.points || [];
  const terms = offer.terms || [];
  const validText = offer.validText || (banner?.expiresAt ? `Valid till ${formatDate(banner.expiresAt)}` : '');
  const hasRating = typeof offer.rating === 'number' && offer.rating > 0;
  const partnerMeta = [offer.partnerVerified ? 'Verified partner' : '', offer.distance || ''].filter(Boolean).join(' · ');
  const isImageBanner = banner?.style !== 'card' && !!banner?.url;
  const ctaLabel = offer.ctaLabel || banner?.ctaLabel || (offer.couponCode ? 'Get code' : offer.phone ? 'Call now' : '');
  const hasCta = !!ctaLabel && !!(offer.couponCode || offer.ctaLink || offer.phone);

  const directions = () => {
    const url = offer.mapLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(offer.address || '')}`;
    Linking.openURL(url).catch(() => {});
  };
  const call = () => offer.phone && Linking.openURL(`tel:${offer.phone.replace(/[\s-]/g, '')}`).catch(() => {});
  const share = () => {
    const lines = [
      offer.title,
      offer.description,
      [offer.partnerName, offer.address].filter(Boolean).join(', '),
      validText,
      offer.ctaLink && /^https?:/i.test(offer.ctaLink) ? offer.ctaLink : '',
      'Shared from the Anytime Help app',
    ].filter(Boolean);
    Share.share({ message: lines.join('\n') }).catch(() => {});
  };
  const pressCta = () => {
    if (offer.couponCode) setCodeShown(true);
    else if (offer.ctaLink) openLink(router, offer.ctaLink);
    else call();
  };

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      {header}

      <ScrollView contentContainerStyle={{ paddingBottom: (hasCta ? 96 : 24) + insets.bottom }} showsVerticalScrollIndicator={false}>
        {/* Hero: the banner itself */}
        {isImageBanner ? (
          <Image source={{ uri: banner!.url }} style={{ width: '100%', height: Math.round(Dimensions.get('window').width * 0.7) }} resizeMode="cover" />
        ) : (
          <LinearGradient colors={t.hero} start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }} style={s.hero}>
            <View style={[s.ring, { width: 240, height: 240, borderRadius: 120, top: -40, right: -70 }]} />
            <View style={{ flex: 1, paddingRight: 12 }}>
              {!!(banner?.tag || offer.tag) && (
                <View style={[s.tagPill, { backgroundColor: t.tagBg }]}>
                  <Text style={[s.tagText, { color: t.tagText }]} numberOfLines={1}>{(banner?.tag || offer.tag || '').toUpperCase()}</Text>
                </View>
              )}
              <Text style={s.heroTitle} numberOfLines={2}>{banner?.title || offer.title}</Text>
              {!!banner?.subtitle && <Text style={s.heroSub} numberOfLines={2}>{banner.subtitle}</Text>}
              {!!banner?.ctaLabel && (
                <View style={s.heroCta}>
                  <Text style={[s.heroCtaText, { color: t.hero[0] }]}>{banner.ctaLabel}</Text>
                  <Ionicons name="chevron-forward" size={13} color={t.hero[0]} />
                </View>
              )}
            </View>
            <View style={s.heroTile}>
              <Ionicons name={(banner?.icon || 'pricetag-outline') as any} size={40} color="#FFFFFF" />
            </View>
          </LinearGradient>
        )}

        <View style={s.sheet}>
          {/* Offer + partner */}
          <View style={s.card}>
            {!!offer.tag && (
              <View style={[s.tagPill, { backgroundColor: t.tagBg }]}>
                <Text style={[s.tagText, { color: t.tagText }]} numberOfLines={1}>{offer.tag.toUpperCase()}</Text>
              </View>
            )}
            <Text style={s.title}>{offer.title}</Text>
            {!!offer.description && <Text style={s.desc}>{offer.description}</Text>}

            {!!offer.partnerName && (
              <View style={s.partnerRow}>
                <View style={[s.partnerIcon, { backgroundColor: t.accent }]}>
                  <Ionicons name={(banner?.icon || 'storefront-outline') as any} size={22} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.partnerName} numberOfLines={1}>{offer.partnerName}</Text>
                  {!!partnerMeta && (
                    <View style={s.partnerMetaRow}>
                      {offer.partnerVerified && <Ionicons name="checkmark" size={13} color="#2563EB" />}
                      <Text style={s.partnerMeta} numberOfLines={1}>{partnerMeta}</Text>
                    </View>
                  )}
                </View>
                {hasRating && (
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={s.ratingPill}>
                      <Text style={s.ratingText}>{offer.rating!.toFixed(1)}</Text>
                      <Ionicons name="star" size={10} color="#FFFFFF" />
                    </View>
                    {!!offer.ratingCount && <Text style={s.ratingCount}>{offer.ratingCount} ratings</Text>}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* What you get */}
          {(points.length > 0 || !!validText) && (
            <View style={s.card}>
              {points.length > 0 && <Text style={s.sectionTitle}>What you get</Text>}
              {points.map((p, i) => (
                <View key={i} style={s.pointRow}>
                  <View style={s.check}><Ionicons name="checkmark" size={13} color="#16A34A" /></View>
                  <Text style={s.pointText}>{p}</Text>
                </View>
              ))}
              {!!validText && (
                <View style={[s.validPill, points.length > 0 && { marginTop: 10 }]}>
                  <Ionicons name="calendar-outline" size={15} color="#92400E" />
                  <Text style={s.validText}>{validText}</Text>
                </View>
              )}
            </View>
          )}

          {/* Location */}
          {(!!offer.address || !!offer.phone) && (
            <View style={s.card}>
              <Text style={s.sectionTitle}>Location</Text>
              {!!offer.address && (
                <View style={s.addressRow}>
                  <Ionicons name="location" size={17} color="#2563EB" />
                  <Text style={s.addressText}>{offer.address}</Text>
                </View>
              )}
              <View style={s.actionsRow}>
                {(!!offer.address || !!offer.mapLink) && (
                  <TouchableOpacity style={[s.actionBtn, s.dirBtn]} onPress={directions} activeOpacity={0.85}>
                    <Ionicons name="navigate-outline" size={16} color="#1D4ED8" />
                    <Text style={[s.actionText, { color: '#1D4ED8' }]}>Directions</Text>
                  </TouchableOpacity>
                )}
                {!!offer.phone && (
                  <TouchableOpacity style={[s.actionBtn, s.callBtn]} onPress={call} activeOpacity={0.85}>
                    <Ionicons name="call-outline" size={16} color="#15803D" />
                    <Text style={[s.actionText, { color: '#15803D' }]}>Call</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.shareBtn} onPress={share} activeOpacity={0.85} accessibilityLabel="Share offer">
                  <Ionicons name="share-outline" size={18} color="#334155" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Terms */}
          <View style={s.terms}>
            {terms.length > 0 && <Text style={s.termsTitle}>Terms</Text>}
            {terms.map((x, i) => <Text key={i} style={s.termText}>• {x}</Text>)}
            <Text style={s.disclaimer}>Sponsored offer · Anytime Help is not responsible for partner services.</Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky action bar */}
      {hasCta && (
        <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={s.bottomLabel} numberOfLines={1}>{codeShown ? 'Show this code at billing' : (offer.footerLabel || 'Resident offer')}</Text>
            <Text style={s.bottomTitle} numberOfLines={1}>{offer.title}</Text>
          </View>
          {codeShown && offer.couponCode ? (
            <View style={[s.codeBox, { borderColor: t.accent }]}>
              <Text style={[s.codeText, { color: t.accent }]} selectable>{offer.couponCode}</Text>
            </View>
          ) : (
            <TouchableOpacity style={[s.ctaBtn, { backgroundColor: t.accent }]} onPress={pressCta} activeOpacity={0.85}>
              <Text style={s.ctaText}>{ctaLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F1F5F9' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#EEF2F6', zIndex: 2,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 1 },

  hero: { height: HERO_H, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 26, overflow: 'hidden' },
  ring: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)' },
  heroTitle: { color: '#FFFFFF', fontSize: 22, lineHeight: 27, fontWeight: '800', letterSpacing: -0.3 },
  heroSub: { color: 'rgba(255,255,255,0.88)', fontSize: 12.5, marginTop: 6 },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 2, marginTop: 12,
    backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 14, height: 34,
  },
  heroCtaText: { fontSize: 13, fontWeight: '800' },
  heroTile: {
    width: 84, height: 92, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },

  sheet: { marginTop: -24, backgroundColor: '#F1F5F9', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 16, gap: 14 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#EEF2F6' },
  tagPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  tagText: { fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
  desc: { fontSize: 14, color: '#475569', marginTop: 6, lineHeight: 20 },

  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  partnerIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  partnerName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  partnerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  partnerMeta: { fontSize: 12.5, color: '#64748B', flexShrink: 1 },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#15803D', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  ratingText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' },
  ratingCount: { fontSize: 11, color: '#64748B', marginTop: 3 },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 5 },
  check: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  pointText: { flex: 1, fontSize: 14.5, color: '#334155', lineHeight: 21 },
  validPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  validText: { fontSize: 14, fontWeight: '700', color: '#92400E' },

  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  addressText: { flex: 1, fontSize: 14.5, color: '#334155', lineHeight: 20 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  actionBtn: { flex: 1, height: 46, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1 },
  dirBtn: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  callBtn: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  actionText: { fontSize: 14.5, fontWeight: '700' },
  shareBtn: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },

  terms: { paddingHorizontal: 4, paddingTop: 4 },
  termsTitle: { fontSize: 14, fontWeight: '800', color: '#334155', marginBottom: 6 },
  termText: { fontSize: 13, color: '#64748B', lineHeight: 21 },
  disclaimer: { fontSize: 11.5, color: '#94A3B8', marginTop: 10, lineHeight: 16 },

  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF2F6',
    elevation: 12, shadowColor: '#0F172A', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 10,
  },
  bottomLabel: { fontSize: 11.5, color: '#64748B' },
  bottomTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 1 },
  ctaBtn: { height: 50, borderRadius: 16, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  codeBox: { height: 50, borderRadius: 16, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', backgroundColor: '#FFFFFF' },
  codeText: { fontSize: 17, fontWeight: '900', letterSpacing: 1.5 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155', textAlign: 'center' },
  emptyBtn: { backgroundColor: '#0F766E', borderRadius: 14, paddingHorizontal: 22, height: 44, alignItems: 'center', justifyContent: 'center' },
  emptyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
