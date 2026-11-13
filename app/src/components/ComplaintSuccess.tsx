// Full-screen "Complaint filed successfully" flow shown after a complaint is raised
// (Resident and Member). Green screen + check pop → collapses into a header,
// revealing sponsored banners, the complaint summary and next actions.
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Animated, Dimensions, Easing, TouchableOpacity, Image, ScrollView, Share, StatusBar as RNStatusBar,
} from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import useImageRatio from '../utils/useImageRatio';

const API_URL = 'https://anytime-help.onrender.com/api';
const AD_INTERVAL_MS = 3500;

export interface ComplaintSuccessData {
  _id?: string;
  complaint_id?: string;
  category: string;
  subCategory?: string;
  address: string;
}

interface Props {
  visible: boolean;
  data: ComplaintSuccessData | null;
  bannerTarget: 'Resident' | 'Member';
  onHome: () => void;
  onTrack: () => void;
}

export const complaintNumber = (d: { _id?: string; complaint_id?: string } | null) =>
  d?.complaint_id || (d?._id ? `AH-${d._id.slice(-5).toUpperCase()}` : 'AH-—');

export default function ComplaintSuccess({ visible, data, bannerTarget, onHome, onTrack }: Props) {
  const insets = useSafeAreaInsets();
  const { height: screenH, width: screenW } = Dimensions.get('window');
  const headerH = insets.top + 180;

  const pop = useRef(new Animated.Value(0)).current;       // check circle pop-in
  const text = useRef(new Animated.Value(0)).current;      // title fade/slide
  const collapse = useRef(new Animated.Value(0)).current;  // green screen → header
  const reveal = useRef(new Animated.Value(0)).current;    // details slide-up

  const [ads, setAds] = useState<any[]>([]);
  const [adIndex, setAdIndex] = useState(0);
  const adsRef = useRef<ScrollViewInstance>(null);
  const adW = screenW - 32;
  // Ads keep their real shape (no cropping)
  const adRatio = useImageRatio(ads[0]?.url);

  useEffect(() => {
    if (!visible) return;
    pop.setValue(0); text.setValue(0); collapse.setValue(0); reveal.setValue(0);
    const seq = Animated.sequence([
      Animated.delay(250),
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 80, useNativeDriver: false }),
      Animated.timing(text, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.delay(1100),
      Animated.timing(collapse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
      Animated.timing(reveal, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]);
    seq.start();
    return () => seq.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Sponsored banners (same ones admins upload for the Home slider)
  useEffect(() => {
    if (!visible) return;
    axios.get(`${API_URL}/staff-banners?target=${bannerTarget}`)
      .then(res => { if (Array.isArray(res.data)) setAds(res.data.filter((b: any) => b?.url)); })
      .catch(() => {});
  }, [visible, bannerTarget]);

  useEffect(() => {
    if (!visible || ads.length < 2) return;
    const id = setInterval(() => {
      setAdIndex(prev => {
        const next = (prev + 1) % ads.length;
        adsRef.current?.scrollTo({ x: next * adW, animated: true });
        return next;
      });
    }, AD_INTERVAL_MS);
    return () => clearInterval(id);
  }, [visible, ads.length, adW]);

  if (!visible || !data) return null;

  const number = complaintNumber(data);
  const team = data.category || 'concerned';
  const categoryLine = [data.category, data.subCategory].filter(Boolean).join(' · ');

  const panelHeight = collapse.interpolate({ inputRange: [0, 1], outputRange: [screenH + 40, headerH] });
  const panelRadius = collapse.interpolate({ inputRange: [0, 1], outputRange: [0, 28] });
  const checkScale = Animated.multiply(
    pop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }),
    collapse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.62] }),
  );
  const titleSize = collapse.interpolate({ inputRange: [0, 1], outputRange: [24, 20] });

  const share = () => {
    Share.share({ message: `Complaint ${number} — ${categoryLine}\n${data.address}` }).catch(() => {});
  };

  return (
    <Modal visible animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onHome}>
      <RNStatusBar barStyle="light-content" />
      <View style={s.root}>
        {/* Details revealed under the collapsed header */}
        <Animated.View
          style={[s.body, {
            paddingTop: headerH + 14,
            opacity: reveal,
            transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
          }]}
        >
          <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }} showsVerticalScrollIndicator={false}>
            {ads.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <View style={s.adHead}>
                  <Text style={s.adLabel}>SPONSORED</Text>
                  <Text style={s.adCount}>{adIndex + 1}/{ads.length}</Text>
                </View>
                <ScrollView
                  ref={adsRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={e => setAdIndex(Math.round(e.nativeEvent.contentOffset.x / adW))}
                  style={{ borderRadius: 16 }}
                >
                  {ads.map((a, i) => (
                    <View key={a._id || i} style={[s.ad, { width: adW, height: Math.round(adW / adRatio) }]}>
                      <Image source={{ uri: a.url }} style={StyleSheet.absoluteFill} resizeMode="contain" />
                      <View style={s.adTag}><Text style={s.adTagText}>AD</Text></View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={s.card}>
              <View style={s.cardTop}>
                <View>
                  <Text style={s.cardSmall}>Complaint no.</Text>
                  <Text style={s.cardNo}>{number}</Text>
                </View>
                <TouchableOpacity style={s.copyBtn} onPress={share} activeOpacity={0.7}>
                  <Text style={s.copyText}>Share</Text>
                </TouchableOpacity>
              </View>
              <Row label="Category" value={categoryLine || '—'} />
              <Row label="Location" value={data.address || '—'} />
              <Row label="Status" value={`Pending · assigned to ${team}`} />
            </View>
          </ScrollView>
        </Animated.View>

        {/* Green panel: full screen first, then shrinks into the header */}
        <Animated.View
          style={[s.panel, {
            height: panelHeight,
            borderBottomLeftRadius: panelRadius,
            borderBottomRightRadius: panelRadius,
            paddingTop: insets.top,
          }]}
        >
          <View style={[s.blob, { top: -70, left: -60, width: 200, height: 200 }]} />
          <View style={[s.blob, { bottom: -60, right: -50, width: 220, height: 220 }]} />
          <Animated.View style={[s.checkRing, { opacity: pop, transform: [{ scale: checkScale }] }]}>
            <View style={s.checkCircle}>
              <Ionicons name="checkmark" size={46} color="#16A34A" />
            </View>
          </Animated.View>
          <Animated.View
            style={{
              alignItems: 'center',
              paddingHorizontal: 20,
              opacity: text,
              transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }}
          >
            <Animated.Text style={[s.title, { fontSize: titleSize }]}>Complaint filed successfully</Animated.Text>
            <Text style={s.sub}>{number} · Sent to the {team} team</Text>
          </Animated.View>
        </Animated.View>

        {/* Actions */}
        <Animated.View style={[s.actions, { paddingBottom: 16 + insets.bottom, opacity: reveal }]} pointerEvents="box-none">
          <TouchableOpacity style={s.homeBtn} onPress={onHome} activeOpacity={0.8}>
            <Text style={s.homeText}>Back to home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.trackBtn} onPress={onTrack} activeOpacity={0.85}>
            <Text style={s.trackText}>Track complaint</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  panel: {
    position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#22C55E',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)' },
  checkRing: {
    width: 104, height: 104, borderRadius: 52, backgroundColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  checkCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFFFFF', fontWeight: '900', textAlign: 'center', letterSpacing: -0.4 },
  sub: { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: '600', marginTop: 6, textAlign: 'center' },

  body: { flex: 1, paddingHorizontal: 16 },
  adHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  adLabel: { fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 1 },
  adCount: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  ad: { height: 160, borderRadius: 16, overflow: 'hidden', backgroundColor: '#E2E8F0' },
  adTag: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  adTagText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },

  card: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#EEF2F7', padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardSmall: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  cardNo: { fontSize: 20, fontWeight: '900', color: '#1D4ED8', marginTop: 2, letterSpacing: 0.3 },
  copyBtn: { backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  copyText: { color: '#1D4ED8', fontWeight: '800', fontSize: 12.5 },
  row: { flexDirection: 'row', paddingVertical: 6 },
  rowLabel: { width: 82, fontSize: 13, color: '#64748B' },
  rowValue: { flex: 1, fontSize: 13, color: '#0F172A', fontWeight: '700', lineHeight: 18 },

  actions: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 12,
    paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#F8FAFC',
  },
  homeBtn: {
    flex: 1, height: 52, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center',
  },
  homeText: { color: '#0F172A', fontWeight: '800', fontSize: 15 },
  trackBtn: { flex: 1, height: 52, borderRadius: 16, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  trackText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
