import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, Modal, Platform, StatusBar, Animated, Linking, TextInput, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import MapView, { Marker } from 'react-native-maps';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';

const API_URL = 'https://anytime-help.onrender.com/api';

const SkeletonDetail = () => {
  const animatedValue = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(animatedValue, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, [animatedValue]);

  return (
    <Animated.View style={[{ padding: 20 }, { opacity: animatedValue }]}>
      <View style={{ width: '60%', height: 28, backgroundColor: '#E5E7EB', borderRadius: 8, marginBottom: 20 }} />
      <View style={{ width: '100%', height: 60, backgroundColor: '#E5E7EB', borderRadius: 12, marginBottom: 20 }} />
      <View style={{ width: '100%', height: 120, backgroundColor: '#E5E7EB', borderRadius: 16, marginBottom: 20 }} />
      <View style={{ width: '100%', height: 200, backgroundColor: '#E5E7EB', borderRadius: 16 }} />
    </Animated.View>
  );
};

export default function ComplaintDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  
  const [complaint, setComplaint] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  useEffect(() => {
    fetchComplaintDetails();
  }, [id]);

  const fetchComplaintDetails = async () => {
    if (!id) return;
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.get(`${API_URL}/complaints/${id}`, {
        headers: { 'x-auth-token': token }
      });
      
      if (res.data) {
        setComplaint(res.data);
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Complaint not found' });
      }
    } catch (error) {
      console.error('Fetch task error:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not load details' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      t('resident.deleteComplaint', 'Delete Complaint'),
      t('resident.deleteConfirm', 'Are you sure you want to delete this complaint?'),
      [
        { text: t('staff.cancel', 'Cancel'), style: 'cancel' },
        { 
          text: t('resident.deleteBtn', 'Delete'), 
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const token = await SecureStore.getItemAsync('userToken');
              await axios.delete(`${API_URL}/complaints/${id}`, {
                headers: { 'x-auth-token': token }
              });
              Toast.show({ type: 'success', text1: 'Deleted', text2: 'Complaint removed successfully' });
              router.replace('/member/my-complaints');
            } catch (error) {
              console.error('Delete error', error);
              Toast.show({ type: 'error', text1: 'Error', text2: 'Could not delete complaint.' });
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setIsReplying(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.post(`${API_URL}/complaints/${id}/reply`, { text: replyText }, {
        headers: { 'x-auth-token': token }
      });
      setComplaint(res.data);
      setReplyText('');
      Toast.show({ type: 'success', text1: 'Success', text2: 'Reply sent successfully!' });
    } catch (err: any) {
      console.error(err);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to send reply' });
    } finally {
      setIsReplying(false);
    }
  };

  const parseResolutionData = (afterImageStr: string | null) => {
    if (!afterImageStr) return null;
    try {
      const parsed = JSON.parse(afterImageStr);
      return parsed; // { uri, location: { latitude, longitude } }
    } catch(e) {
      return { uri: afterImageStr, location: null };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.navigate('/member/my-complaints')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading Details...</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView style={{ flex: 1 }}>
          <SkeletonDetail />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!complaint) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.navigate('/member/my-complaints')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={{ fontSize: 16, color: '#64748B' }}>Complaint not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const step = (complaint.status === 'RESOLVED' || complaint.status === 'DONE') ? 2 : (complaint.status === 'IN_PROGRESS' ? 1 : 0);
  const statusBadgeStyle = step === 0 ? styles.badgePending : (step === 1 ? styles.badgeInProgress : styles.badgeResolved);
  const statusTextStyle = step === 0 ? styles.badgeTextPending : (step === 1 ? styles.badgeTextInProgress : styles.badgeTextResolved);
  const statusLabel = step === 0 ? t('staff.pending', 'Pending') : (step === 1 ? t('staff.inProgress', 'In Progress') : t('staff.resolved', 'Resolved'));
  const statusIcon = step === 0 ? 'time-outline' : (step === 1 ? 'construct-outline' : 'checkmark-circle-outline');
  
  const resolutionData = parseResolutionData(complaint.after_image);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.navigate('/member/my-complaints')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Title and Badge */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t(`categories.${complaint.title}`, { defaultValue: complaint.title })}</Text>
          <View style={[styles.statusBadge, statusBadgeStyle]}>
            <Ionicons name={statusIcon as any} size={14} color={statusTextStyle.color} style={{ marginRight: 4 }} />
            <Text style={[styles.statusBadgeText, statusTextStyle]}>{statusLabel}</Text>
          </View>
        </View>

        {/* Location */}
        <View style={styles.locationContainer}>
          <Ionicons name="location" size={20} color="#1D4ED8" />
          <Text style={styles.locationText}>{complaint.location || complaint.address}</Text>
        </View>

        {/* Reported By */}
        {complaint.user?.name ? (
          <View style={[styles.locationContainer, { marginTop: 8, backgroundColor: '#F8FAFC' }]}>
            <Ionicons name="person" size={20} color="#475569" />
            <Text style={[styles.locationText, { color: '#475569' }]}>
              Reported by: {complaint.user.name}
            </Text>
          </View>
        ) : null}
        
        {complaint.assigned_staff ? (
          <View style={[styles.locationContainer, { marginTop: 8, backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="person-circle" size={22} color="#16A34A" />
            <Text style={[styles.locationText, { color: '#16A34A', fontWeight: '600', marginLeft: 6 }]}>
              Handled by: {complaint.assigned_staff.name}
            </Text>
          </View>
        ) : null}

        {/* Description */}
        {complaint.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{complaint.description}</Text>
          </View>
        ) : null}

        {/* Timeline / Progress Tracker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Progress</Text>
          <View style={styles.trackerWrapper}>
            <View style={styles.trackerBackgroundLine}>
              <View 
                style={[
                  styles.trackerFillLine, 
                  { 
                    width: step === 2 ? '100%' : (step === 1 ? '50%' : '10%'),
                    backgroundColor: step === 0 ? '#F59E0B' : (step === 1 ? '#2563EB' : '#10B981')
                  }
                ]} 
              />
            </View>
            <View style={styles.trackerNodesRow}>
              {[
                { key: 'PENDING', label: t('staff.pending', 'Pending'), icon: 'time' },
                { key: 'IN_PROGRESS', label: t('staff.inProgress', 'In Progress'), icon: 'construct' },
                { key: 'RESOLVED', label: t('staff.resolved', 'Resolved'), icon: 'checkmark-circle' }
              ].map((stepObj, idx) => {
                const isNodeActive = step >= idx;
                const isCurrentNode = step === idx;
                const dotColor = isNodeActive
                  ? (idx === 0 ? '#F59E0B' : (idx === 1 ? '#2563EB' : '#10B981'))
                  : '#E2E8F0';

                return (
                  <View key={stepObj.key} style={styles.trackerNodeCol}>
                    <View style={[styles.trackerDot, { backgroundColor: dotColor }, isCurrentNode && styles.trackerDotCurrent]}>
                      <Ionicons 
                        name={stepObj.icon as any} 
                        size={12} 
                        color={isNodeActive ? '#FFFFFF' : '#94A3B8'} 
                      />
                    </View>
                    <Text 
                      style={[
                        styles.trackerLabel,
                        isCurrentNode && { color: dotColor, fontWeight: '700' },
                        isNodeActive && !isCurrentNode && { color: '#475569' }
                      ]}
                    >
                      {stepObj.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Initial Issue Photo */}
        {complaint.before_image ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Issue Photo</Text>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setFullScreenImage(complaint.before_image)} style={styles.imageWrapper}>
              <Image source={{ uri: complaint.before_image }} style={styles.photoImage} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Resolution Proof */}
        {resolutionData ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resolution Details</Text>
            
            {resolutionData.note ? (
              <View style={{ marginBottom: 16, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 4 }}>Staff Description:</Text>
                <Text style={{ fontSize: 14, color: '#334155', lineHeight: 20 }}>{resolutionData.note}</Text>
              </View>
            ) : null}

            {resolutionData.uri && (
              <TouchableOpacity activeOpacity={0.8} onPress={() => setFullScreenImage(resolutionData.uri)} style={styles.imageWrapper}>
                <Image source={{ uri: resolutionData.uri }} style={styles.photoImage} />
              </TouchableOpacity>
            )}
            
            {resolutionData.location && (
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 8 }}>Resolved at Location:</Text>
                
                {resolutionData.address ? (
                  <Text style={{ fontSize: 14, color: '#111827', fontWeight: '500', marginBottom: 12 }}>
                    {resolutionData.address}
                  </Text>
                ) : null}

                <View style={{ width: '100%', height: 160, borderRadius: 12, overflow: 'hidden' }}>
                  <MapView
                    style={{ width: '100%', height: '100%' }}
                    initialRegion={{
                      latitude: resolutionData.location.latitude,
                      longitude: resolutionData.location.longitude,
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                  >
                    <Marker coordinate={resolutionData.location} pinColor="green" />
                  </MapView>
                </View>
                
                <TouchableOpacity 
                  style={[styles.actionBtnPrimary, { marginTop: 12, backgroundColor: '#10B981', flexDirection: 'row', justifyContent: 'center' }]}
                  onPress={() => {
                    const url = Platform.select({
                      ios: `maps:0,0?q=${resolutionData.location.latitude},${resolutionData.location.longitude}`,
                      android: `google.navigation:q=${resolutionData.location.latitude},${resolutionData.location.longitude}`
                    });
                    if (url) Linking.openURL(url);
                  }}
                >
                  <Ionicons name="navigate" size={18} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.actionBtnPrimaryText}>Start Navigation</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : null}

        {/* Replies Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Replies & Updates</Text>
          {(!complaint.replies || complaint.replies.length === 0) ? (
            <Text style={{ color: '#64748B', fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginTop: 10, marginBottom: 20 }}>
              No replies yet.
            </Text>
          ) : (
            <View style={{ marginTop: 12, marginBottom: 20 }}>
              {complaint.replies.map((reply: any, idx: number) => (
                <View key={idx} style={{ 
                  backgroundColor: reply.role === 'Admin' || reply.role === 'Staff' ? '#F0FDF4' : '#F8FAFC',
                  borderLeftWidth: 3,
                  borderLeftColor: reply.role === 'Admin' || reply.role === 'Staff' ? '#16A34A' : '#94A3B8',
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 12
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontWeight: '600', color: reply.role === 'Admin' || reply.role === 'Staff' ? '#16A34A' : '#334155', fontSize: 13 }}>
                      {reply.role}
                    </Text>
                    <Text style={{ color: '#94A3B8', fontSize: 11 }}>
                      {new Date(reply.created_at).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={{ color: '#334155', fontSize: 14, lineHeight: 20 }}>{reply.text}</Text>
                </View>
              ))}
            </View>
          )}

          {complaint.status !== 'DONE' && complaint.status !== 'RESOLVED' && (
            <View style={{ marginTop: 8 }}>
              <TextInput
                style={{
                  backgroundColor: '#F1F5F9',
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 14,
                  minHeight: 80,
                  color: '#1E293B',
                  textAlignVertical: 'top'
                }}
                placeholder="Type your reply here..."
                placeholderTextColor="#94A3B8"
                multiline
                value={replyText}
                onChangeText={setReplyText}
              />
              <TouchableOpacity 
                style={[styles.actionBtnPrimary, { marginTop: 12, opacity: !replyText.trim() ? 0.5 : 1 }]} 
                onPress={handleReply}
                disabled={!replyText.trim() || isReplying}
              >
                {isReplying ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.actionBtnPrimaryText}>Send Reply</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Delete Button */}
        {complaint.status === 'PENDING' && (
          <TouchableOpacity 
            style={styles.deleteButton} 
            onPress={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.deleteButtonText}>{t('resident.deleteBtn', 'Delete Complaint')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        
        <View style={{ height: 40 }} />
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Full Screen Image Modal */}
      <Modal visible={!!fullScreenImage} transparent={true} animationType="fade" onRequestClose={() => setFullScreenImage(null)}>
        <View style={styles.fullScreenImageContainer}>
          <TouchableOpacity style={styles.closeImageBtn} onPress={() => setFullScreenImage(null)}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {fullScreenImage && <Image source={{ uri: fullScreenImage }} style={styles.fullScreenImage} resizeMode="contain" />}
        </View>
      </Modal>

      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 20, 
    paddingVertical: 16, 
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20 },
  
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', flex: 1, marginRight: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  badgePending: { backgroundColor: '#FEF3C7' },
  badgeInProgress: { backgroundColor: '#EFF6FF' },
  badgeResolved: { backgroundColor: '#ECFDF5' },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextPending: { color: '#D97706' },
  badgeTextInProgress: { color: '#2563EB' },
  badgeTextResolved: { color: '#059669' },
  
  locationContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  locationText: { fontSize: 14, color: '#334155', marginLeft: 8, flex: 1, fontWeight: '500' },
  
  section: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  descriptionText: { fontSize: 15, color: '#475569', lineHeight: 22 },
  
  trackerWrapper: { paddingVertical: 12, paddingHorizontal: 4, marginTop: 4 },
  trackerBackgroundLine: { position: 'absolute', top: 22, left: 32, right: 32, height: 3, backgroundColor: '#E2E8F0', borderRadius: 2 },
  trackerFillLine: { height: '100%', borderRadius: 2 },
  trackerNodesRow: { flexDirection: 'row', justifyContent: 'space-between' },
  trackerNodeCol: { width: 75, alignItems: 'center' },
  trackerDot: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  trackerDotCurrent: { transform: [{ scale: 1.2 }] },
  trackerLabel: { fontSize: 11, fontWeight: '600', color: '#94A3B8', marginTop: 8, textAlign: 'center' },
  
  imageWrapper: { width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F1F5F9' },
  photoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  
  actionBtnPrimary: { height: 50, borderRadius: 12, alignItems: 'center' },
  actionBtnPrimaryText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

  deleteButton: { flexDirection: 'row', backgroundColor: '#EF4444', height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  deleteButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  
  fullScreenImageContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullScreenImage: { width: '100%', height: '100%' },
  closeImageBtn: { position: 'absolute', top: Platform.OS === 'android' ? 40 : 60, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
});
