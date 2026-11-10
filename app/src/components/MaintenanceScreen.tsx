import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type MaintenanceState = {
  enabled: boolean;
  message?: string;
  ends_at?: string | null;
};

type Props = {
  state: MaintenanceState | null;
  onRetry: () => Promise<void> | void;
};

const DEFAULT_MESSAGE = 'We are doing some scheduled maintenance to make Anytime Help better. Please check back soon.';

const formatEndsAt = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `today at ${time}`;
  const date = d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  return `${date}, ${time}`;
};

// Full-screen blocking screen shown while the admin has Maintenance Mode on.
// Back button does nothing; the screen goes away by itself when maintenance ends.
export default function MaintenanceScreen({ state, onRetry }: Props) {
  const [checking, setChecking] = useState(false);
  if (!state?.enabled) return null;

  const endsAt = formatEndsAt(state.ends_at);

  const retry = async () => {
    setChecking(true);
    try { await onRetry(); } finally { setChecking(false); }
  };

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Ionicons name="construct" size={44} color="#2563EB" />
        </View>
        <Text style={styles.title}>Under Maintenance</Text>
        <Text style={styles.message}>{state.message?.trim() || DEFAULT_MESSAGE}</Text>

        {!!endsAt && (
          <View style={styles.timePill}>
            <Ionicons name="time-outline" size={16} color="#1D4ED8" style={{ marginRight: 6 }} />
            <Text style={styles.timeText}>Expected back {endsAt}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.button} onPress={retry} disabled={checking} activeOpacity={0.85}>
          {checking
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.buttonText}>Check again</Text>}
        </TouchableOpacity>
        <Text style={styles.footer}>Thank you for your patience 🙏</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  iconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 12, textAlign: 'center' },
  message: { fontSize: 15, lineHeight: 23, color: '#475569', textAlign: 'center', marginBottom: 20 },
  timePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 28 },
  timeText: { fontSize: 14, fontWeight: '600', color: '#1D4ED8' },
  button: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14, width: '100%', maxWidth: 320, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  footer: { marginTop: 20, fontSize: 13, color: '#94A3B8' },
});
