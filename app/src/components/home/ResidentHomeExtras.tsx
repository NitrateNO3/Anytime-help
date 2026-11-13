// Static (UI-only) Home sections: partner hospitals, offers, sponsored ads and
// local businesses. Data here is placeholder content until the backend exists.
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
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

/* ------------------------------ Artemis promo ------------------------------ */

export function PartnerPromoCard() {
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
        Exclusive rates at Artemis Hospitals, Gurugram, and other partners for SLERWA residents and their families.
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

/* ------------------------------ Partner hospitals ------------------------------ */

const HOSPITALS = [
  { name: 'Artemis Hospitals', tags: 'Multi-speciality · Cardiology · Orthopaedics · Paediatrics', place: 'Sector 51, Gurugram', off: '25 % OFF', rating: '4.6', from: '₹750', icon: 'add', bg: '#EFF6FF', fg: '#1D4ED8' },
  { name: 'HappyDent Dental', tags: 'Check-ups & cleaning · Emergency dentistry', place: 'Artemis Hospital Road', off: '20 % OFF', rating: '4.8', from: '₹499', icon: 'happy-outline', bg: '#ECFEFF', fg: '#0891B2' },
  { name: 'Medilane Diagnostics', tags: 'Blood tests · X-ray · Full-body check-ups', place: 'Sector 56 · 2.6 km', off: '25 % OFF', rating: '4.5', from: '₹900', icon: 'flask-outline', bg: '#ECFDF5', fg: '#059669' },
  { name: 'CareFirst Clinic', tags: 'General physician · Vaccination', place: 'Sector 43 · 1.9 km', off: '15 % OFF', rating: '4.7', from: '₹400', icon: 'medkit-outline', bg: '#FDF2F8', fg: '#DB2777' },
] as const;

export function PartnerHospitals() {
  return (
    <View style={s.section}>
      <SectionHead title="Partner hospitals near you" right={`${HOSPITALS.length} partners`} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
        {HOSPITALS.map(h => (
          <View key={h.name} style={s.hospCard}>
            <View style={[s.hospTop, { backgroundColor: h.bg }]}>
              <View style={s.partnerTag}><Text style={s.partnerTagText}>PARTNER</Text></View>
              <View style={[s.hospIcon, { borderColor: h.fg }]}>
                <Ionicons name={h.icon as any} size={28} color={h.fg} />
              </View>
              <View style={s.offTag}>
                <Ionicons name="pricetag-outline" size={12} color="#FFFFFF" />
                <Text style={s.offTagText}>{h.off}</Text>
              </View>
            </View>
            <View style={s.hospBody}>
              <View style={s.rowBetween}>
                <Text style={s.hospName} numberOfLines={1}>{h.name}</Text>
                <View style={s.rating}><Text style={s.ratingText}>{h.rating} ★</Text></View>
              </View>
              <Text style={s.hospTags} numberOfLines={2}>{h.tags}</Text>
              <View style={s.placeRow}>
                <Ionicons name="location-outline" size={14} color="#475569" />
                <Text style={s.placeText} numberOfLines={1}>{h.place}</Text>
              </View>
              <TouchableOpacity style={s.bookBtn} activeOpacity={0.8} onPress={comingSoon}>
                <Text style={s.bookBtnText}>Book · from {h.from}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/* ------------------------------ Partner spotlight ------------------------------ */

export function PartnerSpotlight() {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={comingSoon} style={s.section}>
      <LinearGradient colors={['#CFFAFE', '#E0F2FE', '#F0F9FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.spot}>
        <View style={s.spotIconWrap}>
          <Ionicons name="happy" size={40} color="#0891B2" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.spotBrand}>HappyDent</Text>
          <Text style={s.spotTitle}>Experience your{'\n'}<Text style={{ color: '#0369A1' }}>best smile.</Text></Text>
          <Text style={s.spotSub}>Trusted care for every family</Text>
        </View>
        <View style={s.spotTag}><Text style={s.spotTagText}>PARTNER SPOTLIGHT</Text></View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

/* ------------------------------ Why residents love ------------------------------ */

const PERKS = [
  { big: '25% off', sub: 'Consultations at partner hospitals', icon: 'add-circle-outline', bg: '#EEF2FF', fg: '#1E40AF' },
  { big: '15% off', sub: 'Lab tests, scans and health check-ups', icon: 'flask-outline', bg: '#ECFDF5', fg: '#047857' },
  { big: 'Priority', sub: 'OPD slots kept for residents', icon: 'time-outline', bg: '#FEF9C3', fg: '#A16207' },
  { big: '40+ offers', sub: 'From verified shops near your society', icon: 'pricetag-outline', bg: '#FCE7F3', fg: '#BE185D' },
] as const;

export function WhyResidentsLove() {
  return (
    <View style={s.section}>
      <SectionHead title="Why residents love Anytime Help" />
      <View style={s.perkGrid}>
        {PERKS.map(p => (
          <View key={p.big} style={[s.perk, { backgroundColor: p.bg }]}>
            <View style={s.perkIcon}><Ionicons name={p.icon as any} size={18} color={p.fg} /></View>
            <Text style={[s.perkBig, { color: p.fg }]}>{p.big}</Text>
            <Text style={s.perkSub}>{p.sub}</Text>
          </View>
        ))}
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

const BUSINESSES = [
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
              <Text style={s.verifiedText}>SLERWA verified</Text>
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
            <View style={s.rating}><Text style={s.ratingText}>{b.rating} ★</Text></View>
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
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  promo: { backgroundColor: '#1D4ED8', borderRadius: 26, padding: 20, marginBottom: 26, overflow: 'hidden' },
  promoRing: { position: 'absolute', right: -60, top: -10, width: 220, height: 220, borderRadius: 110, borderWidth: 28, borderColor: 'rgba(255,255,255,0.06)' },
  promoDot: { position: 'absolute', right: 70, top: 96, width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF' },
  promoBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 6, paddingLeft: 6, paddingRight: 14, gap: 8, marginBottom: 14 },
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

  hospCard: { width: 250, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#EEF2F7', overflow: 'hidden' },
  hospTop: { height: 118, alignItems: 'center', justifyContent: 'center' },
  partnerTag: { position: 'absolute', top: 10, right: 10, backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  partnerTagText: { fontSize: 10.5, fontWeight: '900', color: '#0F172A', letterSpacing: 0.4 },
  hospIcon: { width: 50, height: 50, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.6)' },
  offTag: { position: 'absolute', left: 0, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1D4ED8', borderTopRightRadius: 12, borderBottomRightRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  offTagText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  hospBody: { padding: 14 },
  hospName: { flex: 1, fontSize: 15, fontWeight: '800', color: '#0F172A', marginRight: 8 },
  hospTags: { fontSize: 12.5, color: '#64748B', marginTop: 6, lineHeight: 18 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  placeText: { fontSize: 12.5, color: '#334155', flex: 1 },
  rating: { backgroundColor: '#16A34A', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  ratingText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  bookBtn: { marginTop: 12, backgroundColor: '#EEF2FF', borderRadius: 12, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DBEAFE' },
  bookBtnText: { color: '#1E3A8A', fontWeight: '800', fontSize: 13.5 },

  spot: { borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', minHeight: 130, overflow: 'hidden' },
  spotIconWrap: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  spotBrand: { fontSize: 13, fontWeight: '900', color: '#0891B2' },
  spotTitle: { fontSize: 19, fontWeight: '900', color: '#0F172A', lineHeight: 23, marginTop: 2 },
  spotSub: { fontSize: 11.5, color: '#475569', fontWeight: '600', marginTop: 4 },
  spotTag: { position: 'absolute', left: 12, bottom: 10, backgroundColor: '#1E3A8A', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  spotTagText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 },

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
