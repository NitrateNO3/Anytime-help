// Home search (Resident and Member): one box that searches
// - app shortcuts (raise complaint, directory, settings, ...)
// - RWA directory contacts
// - your complaints (server search by title / ID / address)
// - announcements
// - residents (Member portal only)
// - partner hospitals and local businesses shown on home
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Linking, BackHandler, Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { HOSPITALS, BUSINESSES } from './ResidentHomeExtras';

const API_URL = 'https://api.anytimehelp.co.in/api';

type Portal = 'resident' | 'member';

interface Shortcut { label: string; icon: string; route: string; keys: string; color: string; bg: string }

const shortcutsFor = (p: Portal): Shortcut[] => {
  const list: Shortcut[] = [
    { label: 'Lodge Grievance', icon: 'megaphone-outline', route: `/${p}-raise`, keys: 'raise new complaint problem issue grievance shikayat report', color: '#EF4444', bg: '#FEE2E2' },
    { label: 'My Complaints', icon: 'document-text-outline', route: `/${p}-complaints`, keys: 'complaints status track pending resolved shikayat', color: '#059669', bg: '#D1FAE5' },
    { label: 'Announcements', icon: 'notifications-outline', route: `/${p}-announcements`, keys: 'notice announcement news update suchna', color: '#2563EB', bg: '#DBEAFE' },
    { label: 'Directory', icon: 'call-outline', route: `/${p}-directory`, keys: 'directory contact rwa committee phone number helpline', color: '#D97706', bg: '#FEF3C7' },
  ];
  if (p === 'member') {
    list.push({ label: 'Residents', icon: 'people-outline', route: '/member-residents', keys: 'residents members people neighbours flat house', color: '#7C3AED', bg: '#EDE9FE' });
  }
  list.push(
    { label: 'Chats', icon: 'chatbubbles-outline', route: `/${p}/chats`, keys: 'chat message group baat', color: '#0D9488', bg: '#CCFBF1' },
    { label: 'Community', icon: 'globe-outline', route: `/${p}/community`, keys: 'community post feed social', color: '#0891B2', bg: '#CFFAFE' },
    { label: 'Edit Profile', icon: 'person-outline', route: `/${p}/edit-profile`, keys: 'profile name address phone edit account', color: '#475569', bg: '#F1F5F9' },
    { label: 'Settings', icon: 'settings-outline', route: `/${p}/settings`, keys: 'settings language logout tutorial account', color: '#475569', bg: '#F1F5F9' },
    { label: 'Help & Support', icon: 'help-circle-outline', route: `/${p}/support`, keys: 'help support contact feedback', color: '#475569', bg: '#F1F5F9' },
    { label: 'Privacy Policy', icon: 'shield-checkmark-outline', route: `/${p}/privacy`, keys: 'privacy policy terms', color: '#475569', bg: '#F1F5F9' },
    { label: 'About', icon: 'information-circle-outline', route: `/${p}/about`, keys: 'about app version', color: '#475569', bg: '#F1F5F9' },
  );
  return list;
};


// Extra words people type for each kind of place
const HOSPITAL_KEYS = 'doctor hospital clinic medical health treatment';
const BUSINESS_KEYS: Record<string, string> = {
  Grocery: 'grocery kirana store shop vegetables ration',
  Pharmacy: 'pharmacy chemist medicine medical store dawai',
  Food: 'food tiffin meal khana restaurant',
  Salon: 'salon parlour parlor haircut spa beauty',
  Services: 'services repair home',
};

const comingSoon = () =>
  Toast.show({ type: 'info', text1: 'Coming soon', text2: 'Booking from the app will be live shortly.', position: 'bottom', visibilityTime: 2000 });

const norm = (v: any) => String(v ?? '').toLowerCase();
// Every typed word must appear somewhere in the text
const matches = (text: string, q: string) => {
  const hay = norm(text);
  return q.split(/\s+/).filter(Boolean).every(w => hay.includes(w));
};

const openWhatsApp = (phone?: string) => {
  let n = String(phone || '').replace(/\D/g, '');
  if (!n) return;
  if (n.length === 10) n = '91' + n;
  Linking.openURL(`whatsapp://send?phone=${n}`).catch(() => Linking.openURL(`https://wa.me/${n}`).catch(() => {}));
};
const openCall = (phone?: string) => {
  const n = String(phone || '').replace(/[^\d+]/g, '');
  if (n) Linking.openURL(`tel:${n}`).catch(() => {});
};

export default function HomeSearchScreen({ portal }: { portal: Portal }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  const [contacts, setContacts] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [residents, setResidents] = useState<any[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);

  const shortcuts = useMemo(() => shortcutsFor(portal), [portal]);
  const home = `/${portal}`;

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        router.back();
        return true;
      });
      return () => sub.remove();
    }, [])
  );

  // Directory and announcements are small lists: load once, filter on the phone
  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync('userToken');
      const headers = { 'x-auth-token': token || '' };
      axios.get(`${API_URL}/directory`, { headers })
        .then(r => setContacts(Array.isArray(r.data) ? r.data : []))
        .catch(() => {});
      axios.get(`${API_URL}/announcements`, { headers })
        .then(r => setAnnouncements(Array.isArray(r.data) ? r.data : []))
        .catch(() => {});
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  // Complaints (and residents for members) are searched on the server
  useEffect(() => {
    if (debounced.length < 2) {
      setComplaints([]);
      setResidents([]);
      return;
    }
    let alive = true;
    setRemoteLoading(true);
    (async () => {
      const token = await SecureStore.getItemAsync('userToken');
      const headers = { 'x-auth-token': token || '' };
      const jobs: Promise<any>[] = [
        axios.get(`${API_URL}/complaints`, { headers, params: { page: 1, limit: 5, search: debounced } })
          .then(r => { if (alive) setComplaints(r.data?.complaints || (Array.isArray(r.data) ? r.data : [])); })
          .catch(() => { if (alive) setComplaints([]); }),
      ];
      if (portal === 'member') {
        jobs.push(
          axios.get(`${API_URL}/users/residents`, { headers, params: { page: 1, limit: 5, search: debounced } })
            .then(r => { if (alive) setResidents(r.data?.residents || []); })
            .catch(() => { if (alive) setResidents([]); })
        );
      }
      await Promise.all(jobs);
      if (alive) setRemoteLoading(false);
    })();
    return () => { alive = false; };
  }, [debounced, portal]);

  const q = norm(debounced);

  const res = useMemo(() => {
    if (!q) return null;
    return {
      shortcuts: shortcuts.filter(s => matches(`${s.label} ${s.keys}`, q)),
      contacts: contacts.filter(c => matches(`${c.name} ${c.role || ''} ${c.designation || ''} ${c.phone || ''}`, q)).slice(0, 6),
      announcements: announcements.filter(a => matches(`${a.title} ${a.message}`, q)).slice(0, 5),
      hospitals: HOSPITALS.filter(h => matches(`${h.name} ${h.tags} ${h.place} ${HOSPITAL_KEYS}`, q)),
      businesses: BUSINESSES.filter(b => matches(`${b.name} ${b.cat} ${b.meta} ${BUSINESS_KEYS[b.cat] || ''}`, q)),
    };
  }, [q, shortcuts, contacts, announcements]);

  const total = res
    ? res.shortcuts.length + res.contacts.length + res.announcements.length + res.hospitals.length + res.businesses.length + complaints.length + residents.length
    : 0;

  const go = (route: string) => {
    Keyboard.dismiss();
    router.push(route as any);
  };

  return (
    <SafeAreaView style={st.safe} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />
      {/* Status bar height from safe-area insets so the bar never slides under it */}
      <View style={[st.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace(home as any))} style={st.back} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={st.box}>
          <Ionicons name="search" size={18} color="#64748B" style={{ marginRight: 8 }} />
          <TextInput
            style={st.input}
            placeholder="Search doctor, grocery, complaint, contact..."
            placeholderTextColor="#94A3B8"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity style={st.clear} onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!res ? (
          <>
            <Text style={st.section}>Quick links</Text>
            <View style={st.grid}>
              {shortcuts.slice(0, 8).map(s => (
                <TouchableOpacity key={s.route} style={st.gridItem} onPress={() => go(s.route)} activeOpacity={0.8}>
                  <View style={[st.gridIcon, { backgroundColor: s.bg }]}>
                    <Ionicons name={s.icon as any} size={22} color={s.color} />
                  </View>
                  <Text style={st.gridLabel} numberOfLines={2}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            {res.shortcuts.length > 0 && (
              <Group title="Go to">
                {res.shortcuts.map(s => (
                  <Row key={s.route} icon={s.icon} iconColor={s.color} iconBg={s.bg} title={s.label} onPress={() => go(s.route)} chevron />
                ))}
              </Group>
            )}

            {res.contacts.length > 0 && (
              <Group title="Directory">
                {res.contacts.map(c => (
                  <Row
                    key={c._id || c.phone || c.name}
                    icon="person-outline" iconColor="#D97706" iconBg="#FEF3C7"
                    title={c.name}
                    sub={[c.role || c.designation, c.phone].filter(Boolean).join(' · ')}
                    onPress={() => openCall(c.phone)}
                    right={c.phone ? (
                      <TouchableOpacity style={st.wa} onPress={() => openWhatsApp(c.phone)} activeOpacity={0.8}>
                        <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    ) : null}
                  />
                ))}
              </Group>
            )}

            {complaints.length > 0 && (
              <Group title={portal === 'member' ? 'Complaints' : 'My complaints'}>
                {complaints.map(c => (
                  <Row
                    key={c._id}
                    icon="document-text-outline" iconColor="#059669" iconBg="#D1FAE5"
                    title={c.title || 'Complaint'}
                    sub={[c.complaint_id || `#AH-${String(c._id || '').slice(-5).toUpperCase()}`, statusText(c.status), c.address].filter(Boolean).join(' · ')}
                    onPress={() => go(`/${portal}-complaint-details?id=${c._id}`)}
                    chevron
                  />
                ))}
              </Group>
            )}

            {residents.length > 0 && (
              <Group title="Residents">
                {residents.map(r => (
                  <Row
                    key={r._id || r.id}
                    icon="home-outline" iconColor="#7C3AED" iconBg="#EDE9FE"
                    title={r.name}
                    sub={[r.address, r.phase].filter(Boolean).join(' · ')}
                    onPress={() => openCall(r.phone_number)}
                    right={r.phone_number ? (
                      <TouchableOpacity style={st.wa} onPress={() => openWhatsApp(r.phone_number)} activeOpacity={0.8}>
                        <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    ) : null}
                  />
                ))}
              </Group>
            )}

            {res.announcements.length > 0 && (
              <Group title="Announcements">
                {res.announcements.map(a => (
                  <Row
                    key={a._id || a.id}
                    icon="notifications-outline" iconColor="#2563EB" iconBg="#DBEAFE"
                    title={a.title}
                    sub={a.message}
                    onPress={() => go(`/${portal}-announcements`)}
                    chevron
                  />
                ))}
              </Group>
            )}

            {res.hospitals.length > 0 && (
              <Group title="Partner hospitals">
                {res.hospitals.map(h => (
                  <Row key={h.name} icon={h.icon} iconColor={h.fg} iconBg={h.bg} title={h.name} sub={`${h.tags} · ${h.place}`} onPress={comingSoon} badge={h.off} />
                ))}
              </Group>
            )}

            {res.businesses.length > 0 && (
              <Group title="Local businesses">
                {res.businesses.map(b => (
                  <Row key={b.name} icon={b.icon} iconColor={b.fg} iconBg={b.bg} title={b.name} sub={`${b.meta} · ${b.km}`} onPress={comingSoon} />
                ))}
              </Group>
            )}

            {remoteLoading && <ActivityIndicator color="#1C6A66" style={{ marginVertical: 16 }} />}

            {!remoteLoading && total === 0 && (
              <View style={st.empty}>
                <View style={st.emptyIcon}><Ionicons name="search-outline" size={34} color="#94A3B8" /></View>
                <Text style={st.emptyTitle}>No results for "{debounced}"</Text>
                <Text style={st.emptySub}>Try a different word, like a name, complaint ID or service.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const statusText = (s?: string) => {
  const v = String(s || '').toUpperCase();
  if (v === 'PENDING') return 'Pending';
  if (v === 'IN_PROGRESS') return 'In progress';
  if (v === 'RESOLVED' || v === 'DONE') return 'Resolved';
  return '';
};

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={st.section}>{title}</Text>
      <View style={st.card}>{children}</View>
    </View>
  );
}

function Row({ icon, iconColor, iconBg, title, sub, onPress, right, chevron, badge }: {
  icon: string; iconColor: string; iconBg: string; title: string; sub?: string;
  onPress: () => void; right?: React.ReactNode; chevron?: boolean; badge?: string;
}) {
  return (
    <TouchableOpacity style={st.row} onPress={onPress} activeOpacity={0.75}>
      <View style={[st.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.rowTitle} numberOfLines={1}>{title}</Text>
        {!!sub && <Text style={st.rowSub} numberOfLines={1}>{sub}</Text>}
      </View>
      {!!badge && <View style={st.badge}><Text style={st.badgeText}>{badge}</Text></View>}
      {!!right && <View style={st.rowRight}>{right}</View>}
      {chevron && <View style={st.chevron}><Ionicons name="chevron-forward" size={18} color="#CBD5E1" /></View>}
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  box: {
    flex: 1, flexDirection: 'row', alignItems: 'center', height: 46, borderRadius: 12,
    backgroundColor: '#F1F5F9', paddingHorizontal: 12,
  },
  input: { flex: 1, minWidth: 0, fontSize: 15, color: '#0F172A', paddingVertical: 0, paddingHorizontal: 0, includeFontPadding: false },
  clear: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  body: { padding: 16, paddingBottom: 60 },
  section: { fontSize: 13, fontWeight: '700', color: '#64748B', letterSpacing: 0.3, marginBottom: 10, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  gridItem: { width: '25%', alignItems: 'center', paddingHorizontal: 4 },
  gridIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  gridLabel: { fontSize: 12, fontWeight: '600', color: '#334155', textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  rowSub: { fontSize: 12.5, color: '#64748B', marginTop: 2 },
  rowRight: { marginLeft: 8 },
  chevron: { width: 20, alignItems: 'flex-end', marginLeft: 6 },
  wa: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center' },
  badge: { backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginRight: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#166534' },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 6, textAlign: 'center' },
  emptySub: { fontSize: 13.5, color: '#64748B', textAlign: 'center', lineHeight: 19 },
});
