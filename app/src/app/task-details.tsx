import React, { useState, useEffect } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, StatusBar, ActivityIndicator, Modal, Platform, Linking, TextInput, Share, KeyboardAvoidingView } from 'react-native';
import { AppAlert } from '../components/AppAlert';
import ZoomableImage from '../components/ZoomableImage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useGlobalSearchParams } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';

const API_URL = 'https://api.anytimehelp.co.in/api';

// Design tokens (Staff app design: Anytime Help Design System)
const C = {
  bg: '#F4F6FA',
  ink: '#0B1020',
  ink1: '#1F2637',
  ink2: '#2B3245',
  ink3: '#475069',
  muted: '#6B7489',
  line: '#E6E9F0',
  line2: '#EEF1F6',
  field: '#DCE1EA',
  primary: '#2F6FED',
  pending: '#D97706',
  progress: '#2F6FED',
  resolved: '#16A34A',
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'PENDING', color: C.pending },
  IN_PROGRESS: { label: 'IN PROGRESS', color: C.progress },
  RESOLVED: { label: 'RESOLVED', color: C.resolved },
  DONE: { label: 'RESOLVED', color: C.resolved },
};

const PRIORITY_META: Record<string, [string, string]> = {
  High: ['#FFE4E1', '#C2311E'],
  Urgent: ['#FFE4E1', '#C2311E'],
  Medium: ['#DCE8FF', '#1A3FB8'],
  Low: ['#EEF0F4', '#475069'],
};

// after_image holds JSON { uri, note, resolved_at, resolved_by } (older tasks: a plain image URL)
const parseResolutionData = (afterImageStr: string | null | undefined) => {
  if (!afterImageStr) return null;
  try {
    return JSON.parse(afterImageStr);
  } catch (e) {
    return { uri: afterImageStr, location: null };
  }
};

// Older resolution replies end with a "Location noted · ..." line; it is hidden
const LOC_PREFIX = 'Location noted · ';

const formatTime = (d: Date) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

// Staff names are saved as "Prince (Sushant Lok 2 (Block C))": show only the person's name
const cleanName = (name?: string) => {
  let n = String(name || '');
  const cut = n.indexOf('(');
  if (cut > 0) n = n.slice(0, cut);
  return n.replace(/[()[\]{}|]/g, ' ').replace(/\s+/g, ' ').trim();
};

// Toast text that says why a request failed (no internet, server down, or the server's own message)
const describeError = (err: any, fallback: string) => {
  const status = err?.response?.status;
  if (!err?.response) return `${fallback}: no internet or server not reachable`;
  if (status === 404) return `${fallback}: task not found (it may be in another area or deleted)`;
  if (status === 502 || status === 503 || status === 504) return `${fallback}: server is restarting, try again in a minute`;
  const msg = err.response.data?.message || err.response.data?.msg;
  return msg ? `${fallback} (${status}): ${msg}` : `${fallback} (${status})`;
};

export default function TaskDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useGlobalSearchParams();
  const { t } = useTranslation();

  const [complaint, setComplaint] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [fullTextModal, setFullTextModal] = useState<{ title: string; text: string } | null>(null);

  // Sheets
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [resolveSheetVisible, setResolveSheetVisible] = useState(false);

  // Resolve: after-work photo + optional note
  const [resolvePhoto, setResolvePhoto] = useState<string | null>(null);
  const [staffNote, setStaffNote] = useState('');
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);

  // Replies
  const [replyText, setReplyText] = useState('');
  const [replyImage, setReplyImage] = useState<string | null>(null);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const [isReplying, setIsReplying] = useState(false);

  useEffect(() => {
    fetchComplaintDetails();
  }, [id]);

  // Logged-in staff (for "You" on own replies and "by <name>" on the resolution)
  useEffect(() => {
    SecureStore.getItemAsync('userData').then((s) => {
      if (!s) return;
      try {
        const u = JSON.parse(s);
        setMe({ id: String(u._id || u.id || ''), name: cleanName(u.name) });
      } catch (e) {}
    });
  }, []);

  const fetchComplaintDetails = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setComplaint(null);
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.get(`${API_URL}/complaints/${id}`, { headers: { 'x-auth-token': token } });
      if (res.data) {
        setComplaint(res.data);
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Task not found in your list' });
      }
    } catch (err: any) {
      console.error('Fetch complaint details error:', err);
      Toast.show({ type: 'error', text1: 'Error', text2: describeError(err, 'Could not fetch task details') });
    } finally {
      setLoading(false);
    }
  };

  // ---------- Status ----------
  const handleUpdateStatus = async (newStatus: string) => {
    if (updating) return;
    try {
      setUpdating(newStatus);
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.patch(`${API_URL}/complaints/${id}`, { status: newStatus }, { headers: { 'x-auth-token': token } });
      setComplaint(res.data);
      setStatusModalVisible(false);
      Toast.show({ type: 'success', text1: 'Status Updated', text2: `Task marked as ${newStatus.replace('_', ' ')}` });
    } catch (err) {
      console.error('Update status error:', err);
      Toast.show({ type: 'error', text1: 'Update Failed', text2: 'Could not update status' });
    } finally {
      setUpdating(null);
    }
  };

  const openResolveSheet = () => {
    setStatusModalVisible(false);
    setResolvePhoto(null);
    setResolveSheetVisible(true);
  };

  const takeResolvePhoto = async () => {
    if (resolvePhoto) {
      setResolvePhoto(null);
      return;
    }
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        AppAlert.alert('Permission needed', 'Camera permission is required to take the after-work photo.');
        return;
      }
      setIsTakingPhoto(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setResolvePhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Toast.show({ type: 'error', text1: 'Camera Error', text2: 'Could not capture photo' });
    } finally {
      setIsTakingPhoto(false);
    }
  };

  const submitResolve = async () => {
    if (!resolvePhoto) {
      Toast.show({ type: 'error', text1: 'Photo required', text2: 'Take an after-work photo to resolve' });
      return;
    }
    try {
      setUpdating('DONE');
      const token = await SecureStore.getItemAsync('userToken');
      const headers = { 'x-auth-token': token };
      const after_image = JSON.stringify({
        uri: resolvePhoto,
        note: staffNote.trim(),
        resolved_at: new Date().toISOString(),
        resolved_by: me?.name || '',
      });
      const res = await axios.patch(`${API_URL}/complaints/${id}`, { status: 'DONE', after_image }, { headers });
      let latest = res.data;

      // Also post it in Replies & Updates (photo + note), which notifies the resident
      try {
        const replyRes = await axios.post(`${API_URL}/complaints/${id}/reply`, { text: staffNote.trim(), image: resolvePhoto }, { headers });
        if (replyRes.data) latest = replyRes.data;
      } catch (e) {
        console.log('Resolution reply error:', e);
      }

      setComplaint(latest);
      setResolveSheetVisible(false);
      setResolvePhoto(null);
      setStaffNote('');
      const code = latest?.complaint_id || `#AH-${String(latest?._id || '').slice(-5).toUpperCase()}`;
      const who = latest?.user?.name;
      Toast.show({ type: 'success', text1: `${code} resolved`, text2: who ? `After-work photo sent to ${who}` : 'After-work photo sent to the resident' });
    } catch (err) {
      console.error('Resolve error:', err);
      Toast.show({ type: 'error', text1: 'Update Failed', text2: 'Could not resolve the task' });
    } finally {
      setUpdating(null);
    }
  };

  // ---------- Replies ----------
  const pickReplyImage = async (source: 'camera' | 'gallery') => {
    try {
      const perm = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        AppAlert.alert('Permission Denied', source === 'camera' ? 'Camera permission is required to capture photos.' : 'Gallery permission is required to select photos.');
        return;
      }
      setIsPhotoLoading(true);
      const opts = { mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3] as [number, number], quality: 0.5, base64: true };
      const result = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setReplyImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (e) {
      console.log('Error picking reply photo:', e);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not add photo' });
    } finally {
      setIsPhotoLoading(false);
    }
  };

  const chooseReplyPhoto = () => {
    if (replyImage) {
      setReplyImage(null);
      return;
    }
    AppAlert.alert('Add photo', 'Take a new photo or pick one from the gallery.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Gallery', onPress: () => pickReplyImage('gallery') },
      { text: 'Camera', onPress: () => pickReplyImage('camera') },
    ]);
  };

  const handleReply = async () => {
    if ((!replyText.trim() && !replyImage) || isReplying) return;
    setIsReplying(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.post(`${API_URL}/complaints/${id}/reply`, { text: replyText.trim(), image: replyImage }, { headers: { 'x-auth-token': token } });
      setComplaint(res.data);
      setReplyText('');
      setReplyImage(null);
      Toast.show({ type: 'success', text1: 'Reply sent', text2: 'The resident has been notified' });
    } catch (err: any) {
      console.error(err);
      Toast.show({ type: 'error', text1: 'Error', text2: describeError(err, 'Failed to send reply') });
    } finally {
      setIsReplying(false);
    }
  };

  // ---------- Render helpers ----------
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity accessibilityLabel="Back" onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={24} color={C.ink} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Task Details</Text>
      <View style={{ width: 44 }} />
    </View>
  );

  if (loading || !complaint) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        {renderHeader()}
        <View style={styles.centerContainer}>
          {loading ? <ActivityIndicator size="large" color={C.primary} /> : (
            <>
              <Text style={styles.errorText}>Task not found.</Text>
              <TouchableOpacity onPress={fetchComplaintDetails} style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: C.primary }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Try again</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const resolutionData = parseResolutionData(complaint.after_image);
  const isResolved = complaint.status === 'DONE' || complaint.status === 'RESOLVED';
  const st = STATUS_META[complaint.status] || { label: String(complaint.status || '').replace('_', ' '), color: C.muted };
  const pr = PRIORITY_META[complaint.priority] || PRIORITY_META.Low;
  const code = complaint.complaint_id || `#AH-${complaint._id?.slice(-5).toUpperCase()}`;
  const title = t(`categories.${complaint.title}`, { defaultValue: complaint.title });
  const statusLabel = isResolved ? 'Resolved' : complaint.status === 'IN_PROGRESS' ? 'In Progress' : 'Pending';
  const shareText = [`${code} · ${title} (${statusLabel})`, complaint.description].filter(Boolean).join('\n');
  const phone = complaint.user?.phone_number;

  // "Resolved today, 11:34 AM · by Prince" in the resolution proof
  const proofMeta = (() => {
    if (!resolutionData) return '';
    const parts: string[] = [];
    if (resolutionData.resolved_at) {
      const d = new Date(resolutionData.resolved_at);
      const isToday = d.toDateString() === new Date().toDateString();
      parts.push(`Resolved ${isToday ? 'today' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${formatTime(d)}`);
    }
    if (resolutionData.resolved_by) parts.push(`by ${resolutionData.resolved_by}`);
    return parts.join(' · ');
  })();

  const callResident = () => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => AppAlert.alert('Notice', 'Could not initiate call on this device.'));
  };

  const whatsappResident = () => {
    if (!phone) return;
    const digits = phone.replace(/\D/g, '');
    const finalPhone = digits.length === 10 ? `91${digits}` : digits;
    const msg = encodeURIComponent(`Hello, this is regarding task "${title}" (${code})...`);
    Linking.openURL(`whatsapp://send?phone=${finalPhone}&text=${msg}`).catch(() => AppAlert.alert('Error', 'WhatsApp is not installed on this device.'));
  };

  const shareOptions = [
    {
      label: 'WhatsApp', icon: 'logo-whatsapp' as const, bg: '#E3F7EA', fg: '#16A34A',
      onPress: () => Linking.openURL(`whatsapp://send?text=${encodeURIComponent(shareText)}`).catch(() => AppAlert.alert('Error', 'WhatsApp is not installed on this device.')),
    },
    {
      label: 'SMS', icon: 'chatbox-ellipses-outline' as const, bg: '#E3ECFF', fg: C.primary,
      onPress: () => Linking.openURL(`sms:${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(shareText)}`).catch(() => AppAlert.alert('Notice', 'Could not open messages on this device.')),
    },
    {
      label: 'More', icon: 'share-outline' as const, bg: '#F0F2F6', fg: C.ink3,
      onPress: async () => {
        try {
          await Share.share({ message: shareText, title: `${code} · ${title}` });
        } catch (e: any) {
          console.log('Share complaint error:', e);
          Toast.show({ type: 'error', text1: 'Could not open share', text2: e?.message || 'Share is not available on this device' });
        }
      },
    },
  ];

  const statusOptions = [
    { key: 'PENDING', label: 'Pending', icon: 'time-outline' as const, color: C.pending },
    { key: 'IN_PROGRESS', label: 'In Progress', icon: 'construct-outline' as const, color: C.progress },
    { key: 'DONE', label: 'Resolved (Done)', icon: 'checkmark-circle-outline' as const, color: C.resolved },
  ];

  const bottomPad = Math.max(insets.bottom, 10) + 12;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      {renderHeader()}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 + bottomPad, gap: 14 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {complaint.is_escalated && (
          <View style={styles.escalatedBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.escalatedIcon}>
                <Ionicons name="flame" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.escalatedTitle}>URGENT: TASK ESCALATED</Text>
                <Text style={styles.escalatedBy}>
                  Escalated by Member: {complaint.escalated_by_name || complaint.escalated_by?.name || 'Member'}
                </Text>
              </View>
            </View>
            {(complaint.escalated_at || complaint.escalated_by_phone || complaint.escalated_by?.phone_number || complaint.escalated_by?.phone) && (
              <View style={styles.escalatedMeta}>
                {complaint.escalated_at && (
                  <Text style={styles.escalatedMetaText}>
                    Escalated At: {new Date(complaint.escalated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </Text>
                )}
                {(complaint.escalated_by_phone || complaint.escalated_by?.phone_number || complaint.escalated_by?.phone) && (
                  <Text style={[styles.escalatedMetaText, { fontWeight: '700', marginTop: 3 }]}>
                    Member Phone: {complaint.escalated_by_phone || complaint.escalated_by?.phone_number || complaint.escalated_by?.phone}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Main details */}
        <View style={styles.card}>
          <View style={styles.rowCenter}>
            <View style={styles.idPill}>
              <Ionicons name="pricetag-outline" size={13} color="#3B3FC4" />
              <Text style={styles.idPillText}>{code}</Text>
            </View>
            {complaint.created_at ? (
              <Text style={styles.dateText}>
                {new Date(complaint.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            ) : null}
          </View>

          <View style={styles.rowCenter}>
            {complaint.priority ? (
              <View style={[styles.prPill, { backgroundColor: pr[0] }]}>
                <Text style={[styles.prPillText, { color: pr[1] }]}>{complaint.priority}</Text>
              </View>
            ) : <View />}
            <View style={styles.statusWrap}>
              <View style={[styles.statusDot, { backgroundColor: st.color }]} />
              <Text style={[styles.statusCaps, { color: st.color }]}>{st.label}</Text>
            </View>
          </View>

          <Text style={styles.title}>{title}</Text>

          {complaint.description ? (
            <View style={styles.block}>
              <Text style={styles.label}>Description</Text>
              <Text style={styles.bodyText}>{complaint.description}</Text>
            </View>
          ) : null}

          {complaint.user && (
            <View style={styles.block}>
              <Text style={styles.label}>Reported By</Text>
              <View style={{ gap: 2 }}>
                <Text style={styles.reporterName}>{complaint.user.name}</Text>
                {complaint.user.address ? <Text style={styles.reporterAddr}>{complaint.user.address}</Text> : null}
              </View>
              {phone ? (
                <View style={styles.phoneRow}>
                  <Text style={styles.phoneText}>{phone}</Text>
                  <TouchableOpacity accessibilityLabel="Call" onPress={callResident} style={[styles.squareBtn, { backgroundColor: '#E3ECFF' }]}>
                    <Ionicons name="call" size={18} color={C.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityLabel="WhatsApp" onPress={whatsappResident} style={[styles.squareBtn, { backgroundColor: '#E3F7EA' }]}>
                    <Ionicons name="logo-whatsapp" size={18} color="#16A34A" />
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityLabel="Share complaint" onPress={() => setShareSheetVisible(true)} style={[styles.squareBtn, { backgroundColor: '#F0F2F6' }]}>
                    <Ionicons name="share-outline" size={18} color={C.ink3} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}

          {complaint.before_image ? (
            <View style={styles.block}>
              <Text style={styles.label}>Issue Photo</Text>
              <TouchableOpacity activeOpacity={0.85} onPress={() => setFullScreenImage(complaint.before_image)} style={[styles.photo, { height: 170 }]}>
                <Image source={{ uri: complaint.before_image }} style={styles.photoImg} resizeMode="cover" />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Resolution proof (after the task is resolved) */}
          {isResolved && resolutionData && (resolutionData.uri || resolutionData.note) ? (
            <View style={styles.proofBox}>
              <Text style={styles.proofTitle}>Resolution proof</Text>
              {resolutionData.uri ? (
                <TouchableOpacity activeOpacity={0.85} onPress={() => setFullScreenImage(resolutionData.uri)} style={[styles.photo, { height: 150, borderRadius: 12 }]}>
                  <Image source={{ uri: resolutionData.uri }} style={styles.photoImg} resizeMode="cover" />
                </TouchableOpacity>
              ) : null}
              {resolutionData.note ? <Text style={styles.bodyText}>{resolutionData.note}</Text> : null}
              {proofMeta ? <Text style={styles.proofMeta}>{proofMeta}</Text> : null}
            </View>
          ) : null}
        </View>

        {/* Replies & Updates */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Replies &amp; Updates</Text>
          {(!complaint.replies || complaint.replies.length === 0) ? (
            <Text style={styles.noReplies}>No replies yet.</Text>
          ) : (
            complaint.replies.map((reply: any, idx: number) => {
              const fromTeam = reply.role === 'Admin' || reply.role === 'Staff';
              const bar = fromTeam ? '#0E9F6E' : C.primary;
              const replyUserId = String(reply.user?._id || reply.user || '');
              const isMine = !!me?.id && replyUserId === me.id;
              const who = isMine ? 'You' : `${reply.user?.role === 'Member' ? 'Member' : reply.role}${cleanName(reply.user?.name) ? ` - ${cleanName(reply.user?.name)}` : ''}`;
              // Hide the "Location noted · ..." line older resolution replies carry
              const bodyText = String(reply.text || '').split('\n').filter((l) => !l.startsWith(LOC_PREFIX)).join('\n').trim();
              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.85}
                  onPress={() => bodyText ? setFullTextModal({ title: 'Reply', text: bodyText }) : reply.image ? setFullScreenImage(reply.image) : null}
                  style={[styles.reply, { backgroundColor: fromTeam ? '#F2FAF6' : '#F5F8FF', borderLeftColor: bar }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                    <Text style={[styles.replyWho, { color: bar }]} numberOfLines={1}>{who}</Text>
                    <Text style={styles.replyWhen}>{reply.created_at ? new Date(reply.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</Text>
                  </View>
                  {reply.image ? (
                    <TouchableOpacity activeOpacity={0.85} onPress={() => setFullScreenImage(reply.image)} style={[styles.photo, { height: 130, borderRadius: 10 }]}>
                      <Image source={{ uri: reply.image }} style={styles.photoImg} resizeMode="cover" />
                    </TouchableOpacity>
                  ) : null}
                  {bodyText ? <Text style={styles.replyText} numberOfLines={4}>{bodyText}</Text> : null}
                </TouchableOpacity>
              );
            })
          )}

          {!isResolved && (
            <>
              {replyImage ? (
                <View style={styles.replyPreview}>
                  <Image source={{ uri: replyImage }} style={styles.replyPreviewImg} />
                  <TouchableOpacity accessibilityLabel="Remove photo" onPress={() => setReplyImage(null)} style={styles.replyPreviewRemove}>
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : null}
              <View style={styles.replyRow}>
                <TouchableOpacity
                  accessibilityLabel="Add photo"
                  onPress={chooseReplyPhoto}
                  disabled={isPhotoLoading || isReplying}
                  style={[styles.replyCam, replyImage ? { backgroundColor: C.primary, borderColor: C.primary } : null]}
                >
                  {isPhotoLoading
                    ? <ActivityIndicator size="small" color={C.primary} />
                    : <Ionicons name="camera-outline" size={19} color={replyImage ? '#FFFFFF' : C.primary} />}
                </TouchableOpacity>
                <TextInput
                  style={styles.replyInput}
                  placeholder="Type your reply here..."
                  placeholderTextColor="#8A92A6"
                  value={replyText}
                  onChangeText={setReplyText}
                  multiline
                />
                <TouchableOpacity
                  accessibilityLabel="Send reply"
                  onPress={handleReply}
                  disabled={(!replyText.trim() && !replyImage) || isReplying}
                  style={[styles.replySend, (!replyText.trim() && !replyImage) && { opacity: 0.5 }]}
                >
                  {isReplying ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send" size={18} color="#FFFFFF" />}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Bottom bar: share + update status */}
      <View style={[styles.bottomBar, { paddingBottom: bottomPad }]}>
        <TouchableOpacity accessibilityLabel="Share complaint" onPress={() => setShareSheetVisible(true)} style={styles.bottomShare}>
          <Ionicons name="share-outline" size={20} color={C.ink} />
        </TouchableOpacity>
        {isResolved ? (
          <View style={styles.resolvedBanner}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#067A52" />
            <Text style={styles.resolvedBannerText}>This task has been resolved</Text>
          </View>
        ) : (
          <TouchableOpacity activeOpacity={0.85} onPress={() => setStatusModalVisible(true)} style={styles.bottomPrimary} disabled={!!updating}>
            {updating ? <ActivityIndicator color="#FFFFFF" /> : (
              <>
                <Text style={styles.bottomPrimaryText}>Update status</Text>
                <Ionicons name="chevron-down" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Update status: centre dialog */}
      <Modal animationType="fade" transparent visible={statusModalVisible} onRequestClose={() => setStatusModalVisible(false)}>
        <View style={styles.dialogWrap}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setStatusModalVisible(false)} />
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Update Status</Text>
            <Text style={styles.dialogSub} numberOfLines={1}>{code} · {title}</Text>
            {statusOptions.map((o) => {
              const current = complaint.status === o.key || (o.key === 'DONE' && isResolved);
              return (
                <TouchableOpacity
                  key={o.key}
                  activeOpacity={0.8}
                  disabled={!!updating}
                  onPress={() => {
                    if (current) { setStatusModalVisible(false); return; }
                    if (o.key === 'DONE') { openResolveSheet(); return; }
                    handleUpdateStatus(o.key);
                  }}
                  style={[styles.dialogOption, current && { backgroundColor: '#F5F8FF' }]}
                >
                  {updating === o.key
                    ? <ActivityIndicator size="small" color={o.color} />
                    : <Ionicons name={o.icon} size={22} color={o.color} />}
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={styles.dialogOptionText}>{o.label}</Text>
                    {o.key === 'DONE' && !current ? (
                      <Text style={styles.dialogOptionNote}>Needs an after-work photo</Text>
                    ) : null}
                  </View>
                  {current && <Ionicons name="checkmark" size={20} color={C.primary} />}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity onPress={() => setStatusModalVisible(false)} style={styles.dialogCancel}>
              <Text style={styles.dialogCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Share complaint: bottom sheet */}
      <Modal animationType="slide" transparent visible={shareSheetVisible} onRequestClose={() => setShareSheetVisible(false)}>
        <View style={[styles.sheetWrap, { backgroundColor: 'transparent' }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShareSheetVisible(false)} />
          <View style={[styles.sheet, styles.sheetLifted, { paddingBottom: bottomPad + 6 }]}>
            <View style={styles.sheetHead}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.sheetTitle}>Share complaint</Text>
                <Text style={styles.sheetSub}>Send the details to a colleague or the RWA</Text>
              </View>
              <TouchableOpacity accessibilityLabel="Close" onPress={() => setShareSheetVisible(false)} style={styles.sheetClose}>
                <Ionicons name="close" size={18} color={C.ink} />
              </TouchableOpacity>
            </View>
            <View style={styles.shareTextBox}>
              <Text style={styles.shareText}>{shareText}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {shareOptions.map((o) => (
                <TouchableOpacity
                  key={o.label}
                  activeOpacity={0.85}
                  onPress={async () => {
                    // Open the share target right away, inside the tap (some phones and the web
                    // ignore a share started later), then close our sheet
                    await o.onPress();
                    setShareSheetVisible(false);
                  }}
                  style={styles.shareOpt}
                >
                  <View style={[styles.shareOptIcon, { backgroundColor: o.bg }]}>
                    <Ionicons name={o.icon} size={19} color={o.fg} />
                  </View>
                  <Text style={styles.shareOptText}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Mark as resolved: bottom sheet (after-work photo + note) */}
      <Modal animationType="slide" transparent visible={resolveSheetVisible} onRequestClose={() => setResolveSheetVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={[styles.sheetWrap, { backgroundColor: 'transparent' }]}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setResolveSheetVisible(false)} />
            <View style={[styles.sheet, styles.sheetLifted, { paddingBottom: bottomPad + 6, maxHeight: '92%' }]}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>
                <View style={styles.sheetHead}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.sheetTitle}>Mark as resolved</Text>
                    <Text style={styles.sheetSub}>Add an after-work photo of the finished work.</Text>
                  </View>
                  <TouchableOpacity accessibilityLabel="Close" onPress={() => setResolveSheetVisible(false)} style={styles.sheetClose}>
                    <Ionicons name="close" size={18} color={C.ink} />
                  </TouchableOpacity>
                </View>

                {resolvePhoto ? (
                  <TouchableOpacity activeOpacity={0.85} onPress={takeResolvePhoto} style={[styles.photoDrop, styles.photoDropOn]}>
                    <Ionicons name="checkmark" size={34} color={C.primary} />
                    <Text style={[styles.photoDropTitle, { color: C.primary }]}>Photo added · tap to remove</Text>
                    <Text style={styles.photoDropSub}>Sent to the resident with your update</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity activeOpacity={0.85} onPress={takeResolvePhoto} disabled={isTakingPhoto} style={styles.photoDrop}>
                    {isTakingPhoto ? <ActivityIndicator color={C.primary} /> : <Ionicons name="camera-outline" size={34} color={C.muted} />}
                    <Text style={styles.photoDropTitle}>Take after-work photo</Text>
                    <Text style={styles.photoDropSub}>Required to resolve the task</Text>
                  </TouchableOpacity>
                )}

                <View style={{ gap: 8 }}>
                  <Text style={styles.fieldLabel}>What did you fix?</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
                    placeholder="e.g. Replaced the fuse, power is back in F block"
                    placeholderTextColor="#8A92A6"
                    value={staffNote}
                    onChangeText={setStaffNote}
                    multiline
                  />
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={submitResolve}
                  disabled={updating === 'DONE'}
                  style={[styles.resolveBtn, { backgroundColor: resolvePhoto ? C.resolved : '#A7D8BC' }]}
                >
                  {updating === 'DONE' ? <ActivityIndicator color="#FFFFFF" /> : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      <Text style={styles.resolveBtnText}>Mark resolved</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Full screen image */}
      <Modal visible={!!fullScreenImage} transparent animationType="fade" onRequestClose={() => setFullScreenImage(null)}>
        <View style={styles.fullScreenImageContainer}>
          <TouchableOpacity accessibilityLabel="Close" style={styles.closeImageBtn} onPress={() => setFullScreenImage(null)}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {fullScreenImage && <ZoomableImage uri={fullScreenImage} />}
        </View>
      </Modal>

      {/* Full reply text */}
      <Modal visible={!!fullTextModal} transparent animationType="fade" onRequestClose={() => setFullTextModal(null)}>
        <View style={styles.dialogWrap}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setFullTextModal(null)} />
          <View style={[styles.dialog, { maxHeight: '80%', paddingBottom: 18 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Text style={[styles.dialogTitle, { flex: 1, textAlign: 'left', marginBottom: 0 }]}>{fullTextModal?.title}</Text>
              <TouchableOpacity accessibilityLabel="Close" onPress={() => setFullTextModal(null)} style={styles.sheetClose}>
                <Ionicons name="close" size={18} color={C.ink} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.bodyText}>{fullTextModal?.text}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: C.line2 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.ink },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#E5484D', fontWeight: '600' },

  escalatedBox: { backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#EF4444', borderRadius: 18, padding: 14 },
  escalatedIcon: { backgroundColor: '#EF4444', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  escalatedTitle: { fontSize: 15, fontWeight: '800', color: '#B91C1C', letterSpacing: 0.4 },
  escalatedBy: { fontSize: 13, fontWeight: '700', color: '#991B1B', marginTop: 2 },
  escalatedMeta: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#FCA5A5' },
  escalatedMetaText: { fontSize: 12, color: '#991B1B', fontWeight: '500' },

  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 16, gap: 12 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  idPill: { height: 30, paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#EEF1FF', borderWidth: 1, borderColor: '#DCE1FA', flexDirection: 'row', alignItems: 'center', gap: 5 },
  idPillText: { fontSize: 14, fontWeight: '800', color: '#3B3FC4' },
  dateText: { fontSize: 13, color: C.muted },
  prPill: { height: 28, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center' },
  prPillText: { fontSize: 13, fontWeight: '700' },
  statusWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  statusCaps: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  title: { fontSize: 22, fontWeight: '800', color: C.ink, letterSpacing: -0.4 },
  block: { gap: 8, marginTop: 4 },
  label: { fontSize: 15, fontWeight: '800', color: C.ink3 },
  bodyText: { fontSize: 15, lineHeight: 23, color: C.ink1 },
  reporterName: { fontSize: 15, fontWeight: '700', color: C.ink },
  reporterAddr: { fontSize: 13, color: C.muted },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  phoneText: { flex: 1, fontSize: 15, fontWeight: '700', color: C.ink, fontVariant: ['tabular-nums'] },
  squareBtn: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', borderRadius: 16, overflow: 'hidden', backgroundColor: '#E2E8F0' },
  photoImg: { width: '100%', height: '100%' },

  proofBox: { marginTop: 4, padding: 14, borderRadius: 16, backgroundColor: '#F6FBF8', borderWidth: 1, borderColor: '#CFEBDD', gap: 10 },
  proofTitle: { fontSize: 15, fontWeight: '800', color: C.ink },
  proofMeta: { fontSize: 12, color: C.ink3 },

  cardHeading: { fontSize: 18, fontWeight: '800', color: C.ink },
  noReplies: { fontSize: 13, color: C.muted },
  reply: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderLeftWidth: 3, gap: 6 },
  replyWho: { flex: 1, fontSize: 14, fontWeight: '800' },
  replyWhen: { fontSize: 11, color: C.muted },
  replyText: { fontSize: 14, lineHeight: 21, color: C.ink1 },
  replyPreview: { alignSelf: 'flex-start' },
  replyPreviewImg: { width: 96, height: 96, borderRadius: 12, borderWidth: 1.5, borderColor: C.primary },
  replyPreviewRemove: { position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: '#E5484D', alignItems: 'center', justifyContent: 'center' },
  replyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  replyCam: { width: 46, height: 46, borderRadius: 14, borderWidth: 1, borderColor: '#C7D5FA', backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center' },
  replyInput: { flex: 1, minHeight: 46, maxHeight: 120, borderRadius: 14, borderWidth: 1, borderColor: C.field, backgroundColor: '#F8F9FC', paddingHorizontal: 14, paddingTop: 13, paddingBottom: 12, fontSize: 14, color: C.ink },
  replySend: { width: 46, height: 46, borderRadius: 14, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12, paddingHorizontal: 16, flexDirection: 'row', gap: 10 },
  bottomShare: { width: 52, height: 52, borderRadius: 16, borderWidth: 1, borderColor: C.field, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  bottomPrimary: { flex: 1, height: 52, borderRadius: 16, backgroundColor: C.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  bottomPrimaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  resolvedBanner: { flex: 1, height: 52, borderRadius: 16, backgroundColor: '#E8F8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  resolvedBannerText: { color: '#067A52', fontSize: 15, fontWeight: '800' },

  dialogWrap: { flex: 1, backgroundColor: 'rgba(11,16,32,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  dialog: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 26, paddingTop: 20, paddingHorizontal: 18, paddingBottom: 8 },
  dialogTitle: { textAlign: 'center', fontSize: 18, fontWeight: '800', color: C.ink, marginBottom: 6 },
  dialogSub: { textAlign: 'center', fontSize: 12, color: C.muted, marginBottom: 8 },
  dialogOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#F0F2F6', borderRadius: 10 },
  dialogOptionText: { fontSize: 16, fontWeight: '600', color: C.ink },
  dialogOptionNote: { fontSize: 11, color: C.muted },
  dialogCancel: { height: 54, alignItems: 'center', justifyContent: 'center' },
  dialogCancelText: { fontSize: 16, fontWeight: '600', color: C.muted },

  sheetWrap: { flex: 1, backgroundColor: 'rgba(11,16,32,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 18, paddingHorizontal: 20, gap: 14 },
  // No dark backdrop: a thin border and soft shadow keep the sheet apart from the page
  sheetLifted: { borderWidth: 1, borderBottomWidth: 0, borderColor: C.line, shadowColor: C.ink, shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: C.ink, letterSpacing: -0.2 },
  sheetSub: { fontSize: 13, color: C.muted, lineHeight: 18 },
  sheetClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F2F6', alignItems: 'center', justifyContent: 'center' },
  shareTextBox: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#F6F8FC', borderWidth: 1, borderColor: C.line },
  shareText: { fontSize: 13, lineHeight: 20, color: C.ink2 },
  shareOpt: { flex: 1, height: 84, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareOptIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  shareOptText: { fontSize: 12, fontWeight: '700', color: C.ink },

  photoDrop: { height: 150, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#C9D2E3', backgroundColor: '#FAFBFD', alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoDropOn: { borderColor: '#9DB5F5', backgroundColor: '#F5F8FF' },
  photoDropTitle: { fontSize: 14, fontWeight: '800', color: C.ink3 },
  photoDropSub: { fontSize: 12, color: C.muted },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: C.ink2 },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: C.field, backgroundColor: '#F8F9FC', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.ink },
  resolveBtn: { height: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  resolveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  fullScreenImageContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  closeImageBtn: { position: 'absolute', top: Platform.OS === 'android' ? 40 : 60, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
});
