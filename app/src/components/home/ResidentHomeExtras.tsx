// Static (UI-only) Home sections: offers, sponsored ads and
// local businesses. Data here is placeholder content until the backend exists.
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';

const comingSoon = () =>
  Toast.show({ type: 'info', text1: 'Coming soon', text2: 'This feature will be live shortly.', position: 'bottom', visibilityTime: 2000 });

/* ------------------------------ Shared ------------------------------ */

function SectionHead({ title, right, eyebrow }: { title: string; right?: string; eyebrow?: string }) {
  return (
    <View style={s.head}>
      <View style={{ flex: 1 }}>
        {!!eyebrow && <Text style={s.eyebrow}>{eyebrow}</Text>}
        <Text style={s.headTitle}>{title}</Text>
      </View>
      {!!right && <Text style={s.headRight}>{right}</Text>}
    </View>
  );
}

/* ------------------------------ Partner promo ------------------------------ */

// Partner offer cards (e.g. a partner hospital). Universal: the Super Admin
// adds them in the admin panel (Partner Promo); the home screen fetches them.
export type PartnerPromo = {
  _id: string;
  partnerName?: string;
  title: string;
  description?: string;
  points?: string[];
  phone?: string;
  buttonText?: string;
  url?: string;
};

const callNumber = (phone: string) => {
  const tel = phone.replace(/[^\d+]/g, '');
  if (!tel) return;
  Linking.openURL(`tel:${tel}`).catch(() =>
    Toast.show({ type: 'error', text1: 'Could not start the call', text2: phone, position: 'bottom' })
  );
};

// The original Artemis card, shown while the Super Admin has added no promos
function DefaultArtemisCard() {
  return (
    <View style={s.promo}>
      <View style={s.promoRing} />
      <View style={s.promoDot} />
      <View style={s.promoBadge}>
        <View style={s.promoBadgeIcon}>
          <Ionicons name="add" size={14} color="#1D4ED8" />
        </View>
        <View>
          <Text style={s.promoBadgeSmall}>IN PARTNERSHIP WITH</Text>
          <Text style={s.promoBadgeBig}>ARTEMIS HOSPITALS</Text>
        </View>
      </View>
      <Text style={s.promoTitle}>Book hospital visits &{'\n'}save up to 25%</Text>
      <Text style={s.promoSub}>
        Exclusive rates at Artemis Hospitals, Gurugram, and other partners for residents and their families.
      </Text>
      <View style={s.promoChips}>
        {['Up to 25% off', 'Priority OPD slots', 'Family covered'].map(c => (
          <View key={c} style={s.promoChip}>
            <Ionicons name="checkmark" size={13} color="#FFFFFF" />
            <Text style={s.promoChipText}>{c}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity style={s.promoBtn} activeOpacity={0.85} onPress={comingSoon}>
        <Ionicons name="calendar-outline" size={18} color="#1D4ED8" />
        <Text style={s.promoBtnText}>Book at Artemis</Text>
      </TouchableOpacity>
    </View>
  );
}

// promos === null: still loading (render nothing so the default never flashes)
export function PartnerPromoCard({ promos }: { promos: PartnerPromo[] | null }) {
  if (promos === null) return null;
  if (promos.length === 0) return <DefaultArtemisCard />;
  return (
    <>
      {promos.map(p => (
        <View key={p._id} style={s.promo}>
          <View style={s.promoRing} />
          {!!p.url && <Image source={{ uri: p.url }} style={s.promoImage} resizeMode="cover" />}
          {!!p.partnerName && (
            <View style={s.promoBadge}>
              <View style={s.promoBadgeIcon}>
                <Ionicons name="add" size={14} color="#1D4ED8" />
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={s.promoBadgeSmall}>IN PARTNERSHIP WITH</Text>
                <Text style={s.promoBadgeBig} numberOfLines={1}>{p.partnerName.toUpperCase()}</Text>
              </View>
            </View>
          )}
          <Text style={s.promoTitle}>{p.title}</Text>
          {!!p.description && <Text style={s.promoSub}>{p.description}</Text>}
          {!!p.points?.length && (
            <View style={s.promoChips}>
              {p.points.map(c => (
                <View key={c} style={s.promoChip}>
                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                  <Text style={s.promoChipText}>{c}</Text>
                </View>
              ))}
            </View>
          )}
          {!!p.phone && (
            <TouchableOpacity style={s.promoBtn} activeOpacity={0.85} onPress={() => callNumber(p.phone!)}>
              <Ionicons name="call-outline" size={18} color="#1D4ED8" />
              <Text style={s.promoBtnText}>{p.buttonText || 'Call to book'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </>
  );
}

/* ------------------------------ Why residents love ------------------------------ */

// Universal section edited by the Super Admin (admin: Why Residents Love).
export type HomePerks = {
  enabled?: boolean;
  title?: string;
  perks?: { big: string; sub: string; icon: string; theme: string }[];
};

// Same keys and colours as the admin panel (admin-web/src/pages/HomePerks.tsx)
const PERK_THEMES: Record<string, { bg: string; fg: string }> = {
  green: { bg: '#ECFDF5', fg: '#047857' },
  yellow: { bg: '#FEF9C3', fg: '#A16207' },
  pink: { bg: '#FCE7F3', fg: '#BE185D' },
  blue: { bg: '#EEF2FF', fg: '#1E40AF' },
  purple: { bg: '#F3E8FF', fg: '#7E22CE' },
  orange: { bg: '#FFEDD5', fg: '#C2410C' },
  teal: { bg: '#CCFBF1', fg: '#0F766E' },
  red: { bg: '#FEE2E2', fg: '#B91C1C' },
};

// data === null: still loading, render nothing
export function WhyResidentsLove({ data }: { data: HomePerks | null }) {
  if (!data || data.enabled === false) return null;
  const perks = (data.perks || []).filter(p => p.big || p.sub);
  if (perks.length === 0) return null;
  return (
    <View style={s.section}>
      <SectionHead title={data.title || 'Why residents love Anytime Help'} />
      <View style={s.perkGrid}>
        {perks.map((p, i) => {
          const c = PERK_THEMES[p.theme] || PERK_THEMES.green;
          return (
            <View key={`${i}-${p.big}`} style={[s.perk, { backgroundColor: c.bg }]}>
              <View style={s.perkIcon}><Ionicons name={(p.icon || 'star-outline') as any} size={18} color={c.fg} /></View>
              <Text style={[s.perkBig, { color: c.fg }]}>{p.big}</Text>
              <Text style={s.perkSub}>{p.sub}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ------------------------------ Sponsored ------------------------------ */

const ADS = [
  { title: 'Trinara Cookies & Namkeen', sub: '100% pure vegetarian · Free home delivery', icon: 'cafe-outline', colors: ['#FEF3C7', '#FDE68A'] as const, fg: '#92400E' },
  { title: 'Explore Europe', sub: 'Holiday packages from ₹89,999', icon: 'airplane-outline', colors: ['#DBEAFE', '#BFDBFE'] as const, fg: '#1E40AF' },
  { title: 'FitZone Gym', sub: 'First month at ₹999 for residents', icon: 'barbell-outline', colors: ['#DCFCE7', '#BBF7D0'] as const, fg: '#166534' },
];

export function SponsoredAds() {
  return (
    <View style={s.section}>
      <Text style={[s.eyebrow, { marginBottom: 8 }]}>SPONSORED</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
        {ADS.map(a => (
          <TouchableOpacity key={a.title} activeOpacity={0.9} onPress={comingSoon}>
            <LinearGradient colors={a.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.ad}>
              <View style={s.adTag}><Text style={s.adTagText}>AD</Text></View>
              <Ionicons name={a.icon as any} size={42} color={a.fg} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[s.adTitle, { color: a.fg }]} numberOfLines={2}>{a.title}</Text>
                <Text style={s.adSub} numberOfLines={2}>{a.sub}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

/* ------------------------------ Local businesses ------------------------------ */

const FILTERS = [
  { key: 'All', icon: 'grid-outline' },
  { key: 'Grocery', icon: 'basket-outline' },
  { key: 'Pharmacy', icon: 'medical-outline' },
  { key: 'Salon', icon: 'cut-outline' },
  { key: 'Food', icon: 'restaurant-outline' },
  { key: 'Services', icon: 'construct-outline' },
] as const;

export const BUSINESSES = [
  { name: 'Fresh Basket Supermart', cat: 'Grocery', meta: 'Grocery · Open till 10 PM', offer: '10% off on orders above ₹500', km: '0.6 km', rating: '4.4', icon: 'basket-outline', bg: '#FEF3C7', fg: '#92400E' },
  { name: 'Wellness Plus Pharmacy', cat: 'Pharmacy', meta: 'Pharmacy · Open 24×7', offer: '12% off on medicines', km: '0.4 km', rating: '4.6', icon: 'medical-outline', bg: '#DCFCE7', fg: '#166534' },
  { name: 'Ghar Ka Khana Tiffins', cat: 'Food', meta: 'Home-style tiffin · Lunch & dinner', offer: 'First week at ₹99 per meal', km: '0.8 km', rating: '4.7', icon: 'restaurant-outline', bg: '#FFE4E6', fg: '#9F1239' },
  { name: 'Studio Glow Salon', cat: 'Salon', meta: 'Salon & spa · Open till 9 PM', offer: 'Flat ₹200 off your first visit', km: '1.1 km', rating: '4.5', icon: 'cut-outline', bg: '#FCE7F3', fg: '#9D174D' },
  { name: 'PressPro Laundry', cat: 'Services', meta: 'Laundry & dry clean · Pickup 8 AM – 8 PM', offer: '20% off dry cleaning', km: '0.5 km', rating: '4.3', icon: 'shirt-outline', bg: '#DBEAFE', fg: '#1E3A8A' },
  { name: 'FixIt Home Services', cat: 'Services', meta: 'Electrician · Plumber · AC · Same-day visits', offer: 'Visit charge waived', km: '1.4 km', rating: '4.5', icon: 'build-outline', bg: '#E2E8F0', fg: '#1E293B' },
] as const;

export function LocalBusinesses() {
  const [filter, setFilter] = useState<string>('All');
  const list = filter === 'All' ? BUSINESSES : BUSINESSES.filter(b => b.cat === filter);

  return (
    <View style={s.section}>
      <SectionHead eyebrow="EXPLORE" title="Local businesses near you" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.hScroll, { gap: 8 }]} style={{ marginBottom: 14 }}>
        {FILTERS.map(f => {
          const on = filter === f.key;
          return (
            <TouchableOpacity key={f.key} style={[s.chip, on && s.chipOn]} activeOpacity={0.8} onPress={() => setFilter(f.key)}>
              <Ionicons name={f.icon as any} size={15} color={on ? '#FFFFFF' : '#334155'} />
              <Text style={[s.chipText, on && { color: '#FFFFFF' }]}>{f.key}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {list.map(b => (
        <TouchableOpacity key={b.name} style={s.biz} activeOpacity={0.9} onPress={comingSoon}>
          <View style={[s.bizTop, { backgroundColor: b.bg }]}>
            <View style={s.bizCircle} />
            <View style={s.verified}>
              <Ionicons name="checkmark" size={12} color="#0F172A" />
              <Text style={s.verifiedText}>Verified</Text>
            </View>
            <View style={s.kmTag}><Text style={s.kmText}>{b.km}</Text></View>
            <Ionicons name={b.icon as any} size={46} color={b.fg} />
            <LinearGradient colors={['transparent', 'rgba(15,23,42,0.55)']} style={s.bizShade}>
              <Ionicons name="pricetag-outline" size={14} color="#FFFFFF" />
              <Text style={s.bizOffer} numberOfLines={1}>{b.offer}</Text>
            </LinearGradient>
          </View>
          <View style={s.bizBody}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={s.bizName} numberOfLines={1}>{b.name}</Text>
              <Text style={s.bizMeta} numberOfLines={1}>{b.meta}</Text>
            </View>
            <View style={s.rating}><Text style={s.ratingText}>{b.rating}</Text><Ionicons name="star" size={10} color="#FFFFFF" /></View>
          </View>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={s.listCta} activeOpacity={0.8} onPress={comingSoon}>
        <Text style={s.listCtaText}>Own a business nearby? List it on Anytime Help</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ------------------------------ Footer ------------------------------ */

export function HomeFooter() {
  return (
    <View style={s.footer}>
      <Text style={s.footerBig}>Your society,{'\n'}simplified.</Text>
      <Text style={s.footerSmall}>Anytime Help · Developed by Quenchmark</Text>
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginBottom: 26 },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 },
  eyebrow: { fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 1 },
  headTitle: { fontSize: 19, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
  headRight: { fontSize: 13, color: '#64748B', fontWeight: '600', marginBottom: 2 },
  hScroll: { gap: 12, paddingRight: 16 },

  rating: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#16A34A', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  ratingText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },

  promo: { backgroundColor: '#1D4ED8', borderRadius: 26, padding: 20, marginBottom: 26, overflow: 'hidden' },
  promoRing: { position: 'absolute', right: -60, top: -10, width: 220, height: 220, borderRadius: 110, borderWidth: 28, borderColor: 'rgba(255,255,255,0.06)' },
  promoDot: { position: 'absolute', right: 70, top: 96, width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF' },
  promoImage: { width: '100%', height: 150, borderRadius: 16, marginBottom: 14, backgroundColor: 'rgba(255,255,255,0.12)' },
  promoBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 6, paddingLeft: 6, paddingRight: 14, gap: 8, marginBottom: 14 },
  promoBadgeIcon: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center' },
  promoBadgeSmall: { fontSize: 9, fontWeight: '700', color: '#475569', letterSpacing: 0.6 },
  promoBadgeBig: { fontSize: 14, fontWeight: '900', color: '#0F172A', letterSpacing: 0.3 },
  promoTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', lineHeight: 31, letterSpacing: -0.5 },
  promoSub: { color: '#DBEAFE', fontSize: 13.5, lineHeight: 20, marginTop: 8 },
  promoChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  promoChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  promoChipText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  promoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 16, height: 52, marginTop: 18 },
  promoBtnText: { color: '#1D4ED8', fontSize: 16, fontWeight: '800' },

  perkGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  perk: { width: '48.3%', borderRadius: 20, padding: 14, minHeight: 138 },
  perkIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  perkBig: { fontSize: 19, fontWeight: '900', letterSpacing: -0.3 },
  perkSub: { fontSize: 12.5, color: '#334155', marginTop: 6, lineHeight: 18 },

  ad: { width: 290, height: 150, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center' },
  adTag: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  adTagText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  adTitle: { fontSize: 17, fontWeight: '900', lineHeight: 21 },
  adSub: { fontSize: 12.5, color: '#334155', marginTop: 4, lineHeight: 17 },

  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  chipOn: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  chipText: { fontSize: 13.5, fontWeight: '700', color: '#334155' },
  biz: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#EEF2F7', overflow: 'hidden', marginBottom: 14 },
  bizTop: { height: 150, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bizCircle: { position: 'absolute', right: -40, top: -40, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.35)' },
  verified: { position: 'absolute', top: 10, left: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  verifiedText: { fontSize: 11, fontWeight: '800', color: '#0F172A' },
  kmTag: { position: 'absolute', top: 10, right: 12, backgroundColor: '#334155', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  kmText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' },
  bizShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 52, flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: 14, paddingBottom: 10 },
  bizOffer: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '800', flex: 1 },
  bizBody: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  bizName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  bizMeta: { fontSize: 12.5, color: '#64748B', marginTop: 3 },
  listCta: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#93C5FD', backgroundColor: '#F8FAFF', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 2 },
  listCtaText: { color: '#1E40AF', fontWeight: '800', fontSize: 13.5 },

  footer: { paddingTop: 8, paddingBottom: 12 },
  footerBig: { fontSize: 36, fontWeight: '900', color: '#CBD5E1', lineHeight: 40, letterSpacing: -1 },
  footerSmall: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginTop: 6 },
});
