import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// App-styled replacement for React Native's Alert.alert() and the global alert().
// Never use the phone's default system dialog in the app: call AppAlert.alert() instead.
// Same signature as Alert.alert, so it is a drop-in swap:
//
//   AppAlert.alert('Delete message?', 'It will be deleted for everyone.', [
//     { text: 'Cancel', style: 'cancel' },
//     { text: 'Delete', style: 'destructive', onPress: doDelete },
//   ]);
//
// <AppAlertHost /> is mounted once in app/_layout.tsx.

export type AppAlertButton = {
  text?: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type AlertOptions = { cancelable?: boolean; onDismiss?: () => void };

type AlertRequest = {
  id: number;
  title: string;
  message?: string;
  buttons: AppAlertButton[];
  options?: AlertOptions;
};

let nextId = 1;
let queue: AlertRequest[] = [];
let notify: (() => void) | null = null;

export const AppAlert = {
  alert(title: string, message?: string, buttons?: AppAlertButton[], options?: AlertOptions) {
    queue = [...queue, {
      id: nextId++,
      title: title || '',
      message,
      buttons: buttons && buttons.length ? buttons : [{ text: 'OK' }],
      options,
    }];
    notify?.();
  },
};

type Tone = { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string };

const BLUE: Tone = { icon: 'information-circle', color: '#2563EB', bg: '#DBEAFE' };
const RED: Tone = { icon: 'alert-circle', color: '#DC2626', bg: '#FEE2E2' };
const GREEN: Tone = { icon: 'checkmark-circle', color: '#16A34A', bg: '#DCFCE7' };
const AMBER: Tone = { icon: 'lock-closed', color: '#D97706', bg: '#FEF3C7' };

const toneFor = (req: AlertRequest): Tone => {
  const t = req.title.toLowerCase();
  if (req.buttons.some(b => b.style === 'destructive')) return { ...RED, icon: 'trash' };
  if (/success|done|posted|saved/.test(t)) return GREEN;
  if (/permission/.test(t)) return AMBER;
  if (/error|could not|cannot|failed|not sent|unavailable|not found|denied/.test(t)) return RED;
  return BLUE;
};

export function AppAlertHost() {
  const [, force] = useState(0);

  useEffect(() => {
    notify = () => force(n => n + 1);
    if (queue.length) notify();
    return () => { notify = null; };
  }, []);

  const current = queue[0];
  if (!current) return null;

  const finish = (button?: AppAlertButton) => {
    queue = queue.slice(1);
    force(n => n + 1);
    // Run the handler after the dialog closes so a follow-up alert can open cleanly
    setTimeout(() => button?.onPress?.(), 0);
  };

  const cancelButton = current.buttons.find(b => b.style === 'cancel');
  const canDismiss = current.options?.cancelable ?? (!!cancelButton || current.buttons.length === 1);
  const dismiss = () => {
    if (!canDismiss) return;
    if (cancelButton || current.buttons.length === 1) finish(cancelButton || current.buttons[0]);
    else { finish(); current.options?.onDismiss?.(); }
  };

  const tone = toneFor(current);
  const stacked = current.buttons.length > 2;
  // Cancel goes first (left) when side by side, last when stacked
  const ordered = stacked
    ? [...current.buttons.filter(b => b.style !== 'cancel'), ...current.buttons.filter(b => b.style === 'cancel')]
    : [...current.buttons.filter(b => b.style === 'cancel'), ...current.buttons.filter(b => b.style !== 'cancel')];

  return (
    <Modal key={current.id} visible transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={[styles.iconCircle, { backgroundColor: tone.bg }]}>
            <Ionicons name={tone.icon} size={30} color={tone.color} />
          </View>
          {!!current.title && <Text style={styles.title}>{current.title}</Text>}
          {!!current.message && <Text style={styles.message}>{current.message}</Text>}

          <View style={[styles.buttons, stacked && styles.buttonsStacked]}>
            {ordered.map((b, i) => {
              const isCancel = b.style === 'cancel';
              const isDanger = b.style === 'destructive';
              const filled = !isCancel;
              const bg = isDanger ? '#DC2626' : '#2563EB';
              return (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.85}
                  onPress={() => finish(b)}
                  style={[
                    styles.button,
                    !stacked && styles.buttonFlex,
                    filled ? { backgroundColor: bg } : styles.buttonOutline,
                  ]}
                >
                  <Text style={[styles.buttonText, { color: filled ? '#FFFFFF' : '#334155' }]} numberOfLines={1}>
                    {b.text || 'OK'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: '#FFFFFF', borderRadius: 20, paddingTop: 24, paddingHorizontal: 20, paddingBottom: 20, alignItems: 'center', elevation: 12, shadowColor: '#0F172A', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  message: { fontSize: 14.5, lineHeight: 21, color: '#475569', textAlign: 'center', marginTop: 8 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 22, width: '100%' },
  buttonsStacked: { flexDirection: 'column' },
  button: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  buttonFlex: { flex: 1 },
  buttonOutline: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1' },
  buttonText: { fontSize: 15, fontWeight: '700' },
});
