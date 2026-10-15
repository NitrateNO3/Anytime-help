import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, Modal, Platform, StatusBar, Animated, Linking, TextInput, KeyboardAvoidingView, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useGlobalSearchParams } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import FreeMapView from '../../components/FreeMapView';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { io } from 'socket.io-client';
import * as ImagePicker from 'expo-image-picker';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

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
  const { id } = useGlobalSearchParams();
  const { t } = useTranslation();
  const scrollViewRef = React.useRef<ScrollView>(null);
  
  const [complaint, setComplaint] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyImage, setReplyImage] = useState<string | null>(null);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [fullTextModal, setFullTextModal] = useState<{title: string, text: string} | null>(null);
  
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [complaintCoords, setComplaintCoords] = useState<{latitude: number, longitude: number} | null>(null);
  const [isEscalating, setIsEscalating] = useState(false);
  const [showAllStaff, setShowAllStaff] = useState(false);

  const handleEscalate = async () => {
    if (!complaint) return;
    if (complaint.is_escalated) {
      Alert.alert(
        'Already Escalated',
        `This complaint was already escalated by ${complaint.escalated_by_name || complaint.escalated_by?.name || 'a member'}. Do you want to de-escalate it?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'De-escalate',
            style: 'destructive',
            onPress: async () => {
              try {
                setIsEscalating(true);
                const token = await SecureStore.getItemAsync('userToken');
                const res = await axios.post(`${API_URL}/complaints/${id}/escalate`, { deescalate: true }, {
                  headers: { 'x-auth-token': token }
                });
                setComplaint(res.data);
                Toast.show({ type: 'success', text1: 'De-escalated', text2: 'Escalation status removed' });
              } catch (err: any) {
                Toast.show({ type: 'error', text1: 'Error', text2: err.response?.data?.message || 'Failed to update' });
              } finally {
                setIsEscalating(false);
              }
            }
          }
        ]
      );
      return;
    }

    Alert.alert(
      'Escalate Complaint',
      'Are you sure you want to escalate this complaint? It will be highlighted in red, pinned to the top of task lists, and notify all staff and admins with your name.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '🔥 Yes, Escalate',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsEscalating(true);
              const token = await SecureStore.getItemAsync('userToken');
              let memberName = '';
              let memberPhone = '';
              try {
                const userDataStr = await SecureStore.getItemAsync('userData');
                if (userDataStr) {
                  const u = JSON.parse(userDataStr);
                  memberName = u.name || '';
                  memberPhone = u.phone_number || u.phone || '';
                }
              } catch (e) {}

              const res = await axios.post(`${API_URL}/complaints/${id}/escalate`, {
                memberName,
                memberPhone
              }, {
                headers: { 'x-auth-token': token }
              });
              setComplaint(res.data);
              Toast.show({ type: 'success', text1: '🔥 Complaint Escalated!', text2: 'Staff and Admins notified.' });
            } catch (err: any) {
              Toast.show({ type: 'error', text1: 'Error', text2: err.response?.data?.message || 'Failed to escalate' });
            } finally {
              setIsEscalating(false);
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    fetchComplaintDetails();
    loadPermissions();

    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.on('user_updated', async (data: any) => {
      const stored = await SecureStore.getItemAsync('userData');
      if (stored) {
        const user = JSON.parse(stored);
        if (user._id === data.userId || user.id === data.userId) {
          user.permissions = data.permissions;
          await SecureStore.setItemAsync('userData', JSON.stringify(user));
          setUserPermissions(data.permissions);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [id]);

  const loadPermissions = async () => {
    try {
      const userDataStr = await SecureStore.getItemAsync('userData');
      if (userDataStr) {
        const user = JSON.parse(userDataStr);
        setUserPermissions(user.permissions || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchComplaintDetails = async () => {
    if (!id) return;
    setLoading(true);
    setComplaint(null);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.get(`${API_URL}/complaints/${id}`, {
        headers: { 'x-auth-token': token }
      });
      
      if (res.data) {
        const found = res.data;
        setComplaint(found);

        // Attempt to geocode complaint location
        if (found.location || found.address) {
          try {
            const locStr = found.address || found.location;
            if (locStr.match(/^[\d\.-]+,\s*[\d\.-]+$/)) {
              const parts = locStr.split(',');
              setComplaintCoords({ latitude: parseFloat(parts[0]), longitude: parseFloat(parts[1]) });
            } else {
              let coordsFound = false;
              try {
                const geocoded = await Location.geocodeAsync(locStr);
                if (geocoded && geocoded.length > 0) {
                  setComplaintCoords({ latitude: geocoded[0].latitude, longitude: geocoded[0].longitude });
                  coordsFound = true;
                }
              } catch(e) {}
              
              if (!coordsFound) {
                try {
                  const geoRes = await axios.get(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locStr)}&format=json&limit=1`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                  });
                  if (geoRes.data && geoRes.data.length > 0) {
                    setComplaintCoords({ latitude: parseFloat(geoRes.data[0].lat), longitude: parseFloat(geoRes.data[0].lon) });
                    coordsFound = true;
                  }
                } catch(e) {}
              }
              
              if (!coordsFound) {
                setComplaintCoords({ latitude: 28.4510, longitude: 77.0784 });
              }
            }
          } catch(e) {
            console.log('Error geocoding:', e);
          }
        }
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

  const handleTakeReplyPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to capture photos.');
        return;
      }
      setIsPhotoLoading(true);
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setReplyImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (e) {
      console.log('Error taking reply photo:', e);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not capture photo' });
    } finally {
      setIsPhotoLoading(false);
    }
  };

  const handlePickReplyImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery permission is required to select photos.');
        return;
      }
      setIsPhotoLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setReplyImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (e) {
      console.log('Error picking reply photo:', e);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not select photo' });
    } finally {
      setIsPhotoLoading(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() && !replyImage) return;
    setIsReplying(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.post(`${API_URL}/complaints/${id}/reply`, { 
        text: replyText.trim(),
        image: replyImage
      }, {
        headers: { 'x-auth-token': token }
      });
      setComplaint(res.data);
      setReplyText('');
      setReplyImage(null);
      Toast.show({ type: 'success', text1: 'Success', text2: 'Reply sent successfully!' });
    } catch (err: any) {
      console.error(err);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to send reply' });
    } finally {
      setIsReplying(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      setShowDropdown(false);
      setUpdating(true);
      const token = await SecureStore.getItemAsync('userToken');
      
      const res = await axios.patch(`${API_URL}/complaints/${id}`, { status: newStatus }, {
        headers: { 'x-auth-token': token }
      });
      
      setComplaint(res.data);
      Toast.show({
        type: 'success',
        text1: 'Status Updated',
        text2: `Complaint marked as ${newStatus.replace('_', ' ')}`
      });
    } catch (err) {
      console.error('Update status error:', err);
      Toast.show({ type: 'error', text1: 'Update Failed', text2: 'Could not update status' });
    } finally {
      setUpdating(false);
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

  const shareComplaintOnWhatsApp = async () => {
    if (!complaint) return;

    const compId = complaint.complaint_id || (complaint._id ? `#AH-${complaint._id.slice(-5).toUpperCase()}` : 'N/A');
    const createdDate = complaint.created_at 
      ? new Date(complaint.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'N/A';
    const createdTime = complaint.created_at 
      ? new Date(complaint.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      : 'N/A';

    let searchQ = complaintCoords ? `${complaintCoords.latitude},${complaintCoords.longitude}` : '';
    const locStr = complaint?.address || complaint?.location || 'N/A';
    if (locStr && !locStr.match(/^[\d\.-]+,\s*[\d\.-]+$/)) {
      searchQ = encodeURIComponent(locStr);
    }
    const mapUrl = searchQ ? `https://www.google.com/maps/search/?api=1&query=${searchQ}` : '';

    const statusMap: Record<string, string> = {
      'PENDING': 'PENDING ⚠️',
      'IN_PROGRESS': 'IN PROGRESS ⏳',
      'DONE': 'RESOLVED ✅',
      'RESOLVED': 'RESOLVED ✅'
    };
    const statusText = statusMap[complaint.status] || complaint.status;

    let text = `📢 *ANYTIME HELP - COMPLAINT DETAILS*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🆔 *Complaint ID:* ${compId}\n`;
    text += `📌 *Issue:* ${complaint.title || 'Complaint'}\n`;
    if (complaint.category) {
      text += `🏷️ *Category:* ${complaint.category}\n`;
    }
    text += `📊 *Status:* ${statusText}\n`;
    text += `⚡ *Priority:* ${complaint.priority || 'Medium'}\n`;
    text += `📅 *Reported Date:* ${createdDate}\n`;
    text += `⏰ *Reported Time:* ${createdTime}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;

    // Resident / Reporter Details
    const residentName = complaint.user?.name || 'Resident';
    const residentPhone = complaint.user?.phone_number || complaint.user?.phone;
    const residentPhase = complaint.phase || complaint.user?.phase;
    const residentRoom = complaint.user?.room_number;

    text += `👤 *Reported By:* ${residentName}\n`;
    if (residentPhone) {
      text += `📞 *Contact Phone:* ${residentPhone}\n`;
    }
    if (residentPhase || residentRoom) {
      text += `🏠 *Unit:* ${[residentPhase, residentRoom ? `Flat/Room ${residentRoom}` : ''].filter(Boolean).join(' - ')}\n`;
    }
    text += `📍 *Location:* ${locStr}\n`;

    // Description
    if (complaint.description) {
      text += `\n📝 *Description:*\n${complaint.description.trim()}\n`;
    }

    // Assigned Staff (phone numbers not included for privacy)
    if (staffMembers && staffMembers.length > 0) {
      text += `\n🛠️ *Assigned Staff:*\n`;
      staffMembers.forEach((s: any) => {
        text += `• ${s.name || 'Staff'}\n`;
      });
    } else if (complaint.assigned_staff?.name) {
      text += `\n🛠️ *Assigned Staff:* ${complaint.assigned_staff.name}\n`;
    }

    // Escalated Details
    if (complaint.is_escalated) {
      text += `\n🔥 *ESCALATED STATUS:*\n`;
      text += `⚠️ *Escalated By:* ${complaint.escalated_by_name || complaint.escalated_by?.name || 'Member'}\n`;
      if (complaint.escalated_at) {
        const escDate = new Date(complaint.escalated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const escTime = new Date(complaint.escalated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        text += `⏰ *Escalated Time:* ${escDate} at ${escTime}\n`;
      }
    }

    // Resolution Details
    if ((complaint.status === 'DONE' || complaint.status === 'RESOLVED') && resolutionData) {
      text += `\n✅ *RESOLUTION:*\n`;
      if (resolutionData.note) {
        text += `📋 *Note:* ${resolutionData.note}\n`;
      }
      if (resolutionData.address) {
        text += `📍 *Resolved At:* ${resolutionData.address}\n`;
      }
    }

    // Map Link
    if (mapUrl) {
      text += `\n🗺️ *Google Maps:* ${mapUrl}\n`;
    }

    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `_Shared from Anytime Help_`;

    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;

    try {
      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
      } else {
        await Linking.openURL(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`).catch(async () => {
          await Share.share({ message: text });
        });
      }
    } catch (err) {
      await Share.share({ message: text });
    }
  };

  const shareLocationOnWhatsApp = shareComplaintOnWhatsApp;

  const shareLocationGeneral = async () => {
    let searchQ = complaintCoords ? `${complaintCoords.latitude},${complaintCoords.longitude}` : '';
    const locStr = complaint?.address || complaint?.location;
    if (locStr && !locStr.match(/^[\d\.-]+,\s*[\d\.-]+$/)) {
      searchQ = encodeURIComponent(locStr);
    }
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${searchQ}`;
    try {
      await Share.share({ 
        message: Platform.OS === 'android' ? `Location for grievance: ${mapUrl}` : 'Location for grievance',
        url: Platform.OS === 'ios' ? mapUrl : undefined
      });
    } catch(e) {}
  };

  const callStaffPhone = (phoneNumber?: string) => {
    if (!phoneNumber) {
      Alert.alert('Phone Unavailable', 'Phone number is not provided for this staff member.');
      return;
    }
    const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate call on this device.');
    });
  };

  const whatsappStaffPhone = (phoneNumber?: string, staffName?: string) => {
    if (!phoneNumber) {
      Alert.alert('Phone Unavailable', 'Phone number is not provided for this staff member.');
      return;
    }
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const compId = complaint?.complaint_id || (complaint?._id ? `#AH-${complaint._id.slice(-5).toUpperCase()}` : '');
    const message = `Hello ${staffName || 'Staff'}, this is regarding complaint "${complaint?.title || ''}" (${compId})...`;
    const whatsappUrl = `whatsapp://send?phone=${finalPhone}&text=${encodeURIComponent(message)}`;
    Linking.openURL(whatsappUrl).catch(() => {
      Alert.alert('Error', 'WhatsApp is not installed on this device.');
    });
  };

  const staffMembers: any[] = React.useMemo(() => {
    if (!complaint) return [];
    let list: any[] = [];
    if (Array.isArray(complaint.assigned_staff_list) && complaint.assigned_staff_list.length > 0) {
      list = complaint.assigned_staff_list;
    } else if (complaint.assigned_staff) {
      list = [{ ...complaint.assigned_staff, is_primary: true }];
    }

    // Filter staff by complaint's phase/address — show Universal staff + matching phase only
    const complaintPhase = (complaint.phase || complaint.user?.phase || '').toLowerCase().trim();
    if (complaintPhase && list.length > 0) {
      const filtered = list.filter((s: any) => {
        const staffPhase = (s.phase || '').toLowerCase();
        return (
          staffPhase.includes('universal') ||
          staffPhase === complaintPhase
        );
      });
      if (filtered.length > 0) return filtered;
    }

    return list;
  }, [complaint]);

  if (loading || (complaint && complaint._id !== id)) {
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
        <TouchableOpacity 
          onPress={shareComplaintOnWhatsApp}
          style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            backgroundColor: '#DCFCE7', 
            paddingHorizontal: 12, 
            paddingVertical: 6, 
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#86EFAC',
            gap: 4
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="logo-whatsapp" size={17} color="#16A34A" />
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#15803D' }}>Share</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}
          keyboardShouldPersistTaps="handled"
        >
        
        {/* ID & Date/Time Badge */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#C7D2FE' }}>
            <Ionicons name="pricetag-outline" size={13} color="#4338CA" style={{ marginRight: 5 }} />
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#4338CA', letterSpacing: 0.5 }}>
              {complaint.complaint_id || `#AH-${complaint._id?.slice(-5).toUpperCase()}`}
            </Text>
          </View>
          {complaint.created_at ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 12, color: '#475569', fontWeight: '600' }}>
                📅 {new Date(complaint.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
              <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 2 }}>
                ⏰ {new Date(complaint.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Escalated Alert Banner */}
        {complaint.is_escalated && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FEF2F2',
            borderWidth: 1.5,
            borderColor: '#EF4444',
            borderRadius: 14,
            padding: 14,
            marginBottom: 16,
            shadowColor: '#EF4444',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 6,
            elevation: 2,
            gap: 10
          }}>
            <View style={{ backgroundColor: '#EF4444', padding: 8, borderRadius: 20 }}>
              <Ionicons name="flame" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#B91C1C', letterSpacing: 0.5 }}>
                ESCALATED COMPLAINT
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#991B1B', marginTop: 2 }}>
                Escalated by: {complaint.escalated_by_name || complaint.escalated_by?.name || 'Member'}
              </Text>
              {complaint.escalated_at && (
                <Text style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>
                  {new Date(complaint.escalated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Title and Badge */}
        <View style={[styles.titleRow, { zIndex: 100, elevation: 10 }]}>
          <Text style={styles.title}>{t(`categories.${complaint.title}`, { defaultValue: complaint.title })}</Text>
          <View style={{ position: 'relative' }}>
            <TouchableOpacity 
              style={[styles.statusBadge, statusBadgeStyle]} 
              onPress={() => {
                if (userPermissions.includes('Change Complaint Status')) {
                  setShowDropdown(!showDropdown);
                }
              }}
              disabled={!userPermissions.includes('Change Complaint Status')}
            >
              <Ionicons name={statusIcon as any} size={14} color={statusTextStyle.color} style={{ marginRight: 4 }} />
              <Text style={[styles.statusBadgeText, statusTextStyle]}>{statusLabel}</Text>
              {userPermissions.includes('Change Complaint Status') && (
                <Ionicons name={showDropdown ? "chevron-up" : "chevron-down"} size={14} color={statusTextStyle.color} style={{ marginLeft: 4 }} />
              )}
            </TouchableOpacity>

            {/* Elegant Dropdown */}
            {showDropdown && (
              <View style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 8,
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                padding: 6,
                width: 160,
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.12,
                shadowRadius: 20,
                elevation: 10,
                borderWidth: 1,
                borderColor: '#F1F5F9',
                zIndex: 999
              }}>
                <TouchableOpacity 
                  style={{ padding: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 2, backgroundColor: complaint.status === 'PENDING' ? '#FFFBEB' : 'transparent' }} 
                  onPress={() => handleUpdateStatus('PENDING')}
                  disabled={updating}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B', marginRight: 10 }} />
                  <Text style={{ fontSize: 14, fontWeight: complaint.status === 'PENDING' ? '700' : '600', color: complaint.status === 'PENDING' ? '#D97706' : '#475569' }}>Pending</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={{ padding: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 2, backgroundColor: complaint.status === 'IN_PROGRESS' ? '#EFF6FF' : 'transparent' }} 
                  onPress={() => handleUpdateStatus('IN_PROGRESS')}
                  disabled={updating}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6', marginRight: 10 }} />
                  <Text style={{ fontSize: 14, fontWeight: complaint.status === 'IN_PROGRESS' ? '700' : '600', color: complaint.status === 'IN_PROGRESS' ? '#2563EB' : '#475569' }}>In Progress</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={{ padding: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: complaint.status === 'RESOLVED' || complaint.status === 'DONE' ? '#ECFDF5' : 'transparent' }} 
                  onPress={() => handleUpdateStatus('DONE')}
                  disabled={updating}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 10 }} />
                  <Text style={{ fontSize: 14, fontWeight: complaint.status === 'RESOLVED' || complaint.status === 'DONE' ? '700' : '600', color: complaint.status === 'RESOLVED' || complaint.status === 'DONE' ? '#059669' : '#475569' }}>Resolved</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Location */}
        <View style={styles.locationContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
            <Ionicons name="location" size={20} color="#0F172A" />
            <Text style={styles.locationText}>{complaint.location || complaint.address}</Text>
          </View>
          <TouchableOpacity 
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              backgroundColor: '#DCFCE7', 
              paddingHorizontal: 10, 
              paddingVertical: 6, 
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#86EFAC'
            }}
            onPress={shareLocationOnWhatsApp}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-whatsapp" size={16} color="#16A34A" style={{ marginRight: 4 }} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#15803D' }}>Share</Text>
          </TouchableOpacity>
        </View>

        {complaintCoords && (
          <View style={{ marginTop: -8, marginBottom: 20 }}>
            <View style={{ width: '100%', height: 180, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' }}>
              <FreeMapView
                latitude={complaintCoords.latitude}
                longitude={complaintCoords.longitude}
                interactive={false}
              />
            </View>
            <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
              <TouchableOpacity 
                style={[styles.actionBtnPrimary, { flex: 1, backgroundColor: '#10B981', flexDirection: 'row', justifyContent: 'center', height: 44, borderRadius: 10 }]}
                onPress={() => {
                  let searchQ = `${complaintCoords.latitude},${complaintCoords.longitude}`;
                  const locStr = complaint.address || complaint.location;
                  if (locStr && !locStr.match(/^[\d\.-]+,\s*[\d\.-]+$/)) {
                    searchQ = encodeURIComponent(locStr);
                  }
                  const url = Platform.select({
                    ios: `maps:0,0?q=${searchQ}`,
                    android: `google.navigation:q=${searchQ}`
                  });
                  if (url) Linking.openURL(url);
                }}
              >
                <Ionicons name="navigate" size={17} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>Navigate</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionBtnPrimary, { flex: 1.4, backgroundColor: '#25D366', flexDirection: 'row', justifyContent: 'center', height: 44, borderRadius: 10 }]}
                onPress={shareLocationOnWhatsApp}
              >
                <Ionicons name="logo-whatsapp" size={18} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionBtnPrimary, { width: 44, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', height: 44, borderRadius: 10 }]}
                onPress={shareLocationGeneral}
              >
                <Ionicons name="share-social" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Escalate Action Button */}
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: complaint.is_escalated ? '#FEF2F2' : '#DC2626',
            borderWidth: complaint.is_escalated ? 1.5 : 0,
            borderColor: '#EF4444',
            paddingVertical: 14,
            borderRadius: 14,
            marginTop: 4,
            marginBottom: 20,
            gap: 8,
            shadowColor: '#DC2626',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: complaint.is_escalated ? 0.05 : 0.25,
            shadowRadius: 8,
            elevation: 3
          }}
          onPress={handleEscalate}
          disabled={isEscalating}
          activeOpacity={0.8}
        >
          {isEscalating ? (
            <ActivityIndicator size="small" color={complaint.is_escalated ? '#DC2626' : '#FFFFFF'} />
          ) : (
            <>
              <Ionicons 
                name={complaint.is_escalated ? "flame" : "flame-outline"} 
                size={20} 
                color={complaint.is_escalated ? '#DC2626' : '#FFFFFF'} 
              />
              <Text style={{
                fontSize: 15,
                fontWeight: '700',
                color: complaint.is_escalated ? '#DC2626' : '#FFFFFF',
                letterSpacing: 0.3
              }}>
                {complaint.is_escalated ? 'Escalated (Tap to manage)' : '🔥 Escalate Complaint'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Reported By */}
        {complaint.user?.name ? (
          <View style={[styles.locationContainer, { marginTop: 8, backgroundColor: '#F8FAFC', alignItems: 'flex-start' }]}>
            <Ionicons name="person" size={20} color="#475569" style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={{ fontSize: 14, color: '#475569', fontWeight: '500' }}>
                Reported by: {complaint.user.name}
              </Text>
              {complaint.user.address ? (
                <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 18 }}>
                  Address: {complaint.user.address}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
        
        {/* Assigned Duty Staff Card */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ backgroundColor: '#EFF6FF', padding: 6, borderRadius: 10 }}>
                <Ionicons name="construct" size={18} color="#2563EB" />
              </View>
              <View>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                  Duty Staff ({staffMembers.length})
                </Text>
              </View>
            </View>
            {staffMembers.length > 0 && (
              <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#15803D' }}>Duty On</Text>
              </View>
            )}
          </View>

          <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 12, marginLeft: 2 }}>
            Assigned for {complaint.category || complaint.title || 'this category'}
          </Text>

          {staffMembers.length === 0 ? (
            <View style={{ backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="time-outline" size={22} color="#D97706" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#B45309' }}>Staff Assignment Pending</Text>
                <Text style={{ fontSize: 12, color: '#92400E', marginTop: 1 }}>
                  Duty staff for {complaint.category || 'this category'} will be assigned shortly.
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {((staffMembers.length <= 2 || showAllStaff) ? staffMembers : staffMembers.slice(0, 2)).map((staff: any, idx: number) => {
                const staffPhone = staff.phone_number || staff.phone;
                const isPrimary = staff.is_primary || (complaint.assigned_staff && (staff._id === complaint.assigned_staff._id || staff._id === complaint.assigned_staff));

                return (
                  <View 
                    key={staff._id || idx} 
                    style={{
                      backgroundColor: isPrimary ? '#F0FDF4' : '#F8FAFC',
                      borderWidth: 1,
                      borderColor: isPrimary ? '#86EFAC' : '#E2E8F0',
                      borderRadius: 12,
                      padding: 10,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.03,
                      shadowRadius: 2,
                      elevation: 1
                    }}
                  >
                    {/* Top Row: Name, Avatar, Phase, Primary Badge */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isPrimary ? '#22C55E' : '#3B82F6', justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                            {(staff.name || 'S').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }} numberOfLines={1}>
                              {staff.name || 'Staff Member'}
                            </Text>
                            {isPrimary ? (
                              <View style={{ backgroundColor: '#15803D', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 4 }}>
                                <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF' }}>ASSIGNED</Text>
                              </View>
                            ) : (
                              <View style={{ backgroundColor: '#E0E7FF', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 4 }}>
                                <Text style={{ fontSize: 9, fontWeight: '700', color: '#3730A3' }}>DUTY</Text>
                              </View>
                            )}
                          </View>
                          <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '500', marginTop: 1 }} numberOfLines={1}>
                            {staff.assigned_category || staff.role || 'Staff'} {staff.phase ? `• ${staff.phase}` : ''}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Phone, Call & WhatsApp hidden for privacy */}
                  </View>
                );
              })}

              {/* Show More / Show Less Toggle Button for multiple staff */}
              {staffMembers.length > 2 && (
                <TouchableOpacity
                  onPress={() => setShowAllStaff(!showAllStaff)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#F1F5F9',
                    paddingVertical: 8,
                    borderRadius: 10,
                    marginTop: 2,
                    gap: 6
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name={showAllStaff ? "chevron-up" : "chevron-down"} size={15} color="#2563EB" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB' }}>
                    {showAllStaff ? 'Show Less' : `View All ${staffMembers.length} Duty Staff (+${staffMembers.length - 2} more)`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Description */}
        {complaint.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <TouchableOpacity onPress={() => setFullTextModal({ title: 'Description', text: complaint.description })}>
              <Text style={styles.descriptionText} numberOfLines={3}>{complaint.description}</Text>
            </TouchableOpacity>
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
              <TouchableOpacity onPress={() => setFullTextModal({ title: 'Staff Description', text: resolutionData.note })} style={{ marginBottom: 16, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 4 }}>Staff Description:</Text>
                <Text style={{ fontSize: 14, color: '#334155', lineHeight: 20 }} numberOfLines={3}>{resolutionData.note}</Text>
              </TouchableOpacity>
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
                  <FreeMapView
                    latitude={resolutionData.location.latitude}
                    longitude={resolutionData.location.longitude}
                    interactive={false}
                  />
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

        {/* WhatsApp Full Share Card */}
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#16A34A',
            paddingVertical: 14,
            paddingHorizontal: 20,
            borderRadius: 14,
            marginBottom: 20,
            shadowColor: '#16A34A',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.2,
            shadowRadius: 6,
            elevation: 3,
            gap: 10
          }}
          onPress={shareComplaintOnWhatsApp}
          activeOpacity={0.85}
        >
          <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 }}>
            Share Full Complaint on WhatsApp
          </Text>
        </TouchableOpacity>

        {/* Replies Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { marginBottom: 4 }]}>Replies & Updates</Text>
          {(!complaint.replies || complaint.replies.length === 0) ? (
            <Text style={{ color: '#64748B', fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginTop: 4, marginBottom: 12 }}>
              No replies yet.
            </Text>
          ) : (
            <View style={{ marginTop: 8, marginBottom: 16 }}>
              {complaint.replies.map((reply: any, idx: number) => (
                <TouchableOpacity key={idx} style={{ 
                  backgroundColor: reply.role === 'Admin' || reply.role === 'Staff' ? '#F0FDF4' : '#F8FAFC',
                  borderLeftWidth: 3,
                  borderLeftColor: reply.role === 'Admin' || reply.role === 'Staff' ? '#16A34A' : '#94A3B8',
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 12
                }} onPress={() => {
                  if (reply.text) {
                    setFullTextModal({ title: 'Reply', text: reply.text });
                  } else if (reply.image) {
                    setFullScreenImage(reply.image);
                  }
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontWeight: '600', color: reply.role === 'Admin' || reply.role === 'Staff' ? '#16A34A' : '#334155', fontSize: 13 }}>
                      {reply.user?.role === 'Member' ? 'Member' : reply.role} {reply.user?.name ? `- ${reply.user.name}` : ''}
                    </Text>
                    <Text style={{ color: '#94A3B8', fontSize: 11 }}>
                      {new Date(reply.created_at).toLocaleString()}
                    </Text>
                  </View>
                  {reply.text ? (
                    <Text style={{ color: '#334155', fontSize: 14, lineHeight: 20 }} numberOfLines={3}>{reply.text}</Text>
                  ) : null}
                  {reply.image ? (
                    <TouchableOpacity 
                      activeOpacity={0.85} 
                      onPress={() => setFullScreenImage(reply.image)}
                      style={{ marginTop: reply.text ? 8 : 4, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0', height: 160, backgroundColor: '#F1F5F9' }}
                    >
                      <Image source={{ uri: reply.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      <View style={{ position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="expand" size={12} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '600' }}>Tap to view</Text>
                      </View>
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {complaint.status !== 'DONE' && complaint.status !== 'RESOLVED' && (
            <View style={{ marginTop: 8 }}>
              {/* Selected Image Preview */}
              {replyImage ? (
                <View style={{ marginBottom: 12, position: 'relative', alignSelf: 'flex-start' }}>
                  <Image source={{ uri: replyImage }} style={{ width: 110, height: 110, borderRadius: 12, borderWidth: 1.5, borderColor: '#3B82F6' }} />
                  <TouchableOpacity 
                    onPress={() => setReplyImage(null)}
                    style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3 }}
                  >
                    <Ionicons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : null}

              <TextInput
                style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  padding: 16,
                  fontSize: 15,
                  minHeight: 100,
                  color: '#1E293B',
                  textAlignVertical: 'top'
                }}
                placeholder="Type your reply here..."
                placeholderTextColor="#94A3B8"
                multiline
                value={replyText}
                onChangeText={setReplyText}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 250);
                }}
              />

              {/* Action Buttons: Camera, Gallery & Send Reply */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 }}
                    onPress={handleTakeReplyPhoto}
                    disabled={isPhotoLoading || isReplying}
                  >
                    {isPhotoLoading ? (
                      <ActivityIndicator size="small" color="#2563EB" />
                    ) : (
                      <>
                        <Ionicons name="camera" size={18} color="#2563EB" style={{ marginRight: 5 }} />
                        <Text style={{ color: '#2563EB', fontWeight: '600', fontSize: 13 }}>Camera</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 }}
                    onPress={handlePickReplyImage}
                    disabled={isPhotoLoading || isReplying}
                  >
                    <Ionicons name="image" size={18} color="#475569" style={{ marginRight: 5 }} />
                    <Text style={{ color: '#475569', fontWeight: '600', fontSize: 13 }}>Gallery</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={[styles.actionBtnPrimary, { flex: 1, marginTop: 0, opacity: (!replyText.trim() && !replyImage) ? 0.5 : 1 }]} 
                  onPress={handleReply}
                  disabled={(!replyText.trim() && !replyImage) || isReplying}
                >
                  {isReplying ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.actionBtnPrimaryText}>Send Reply</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
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

      {/* Full Text Modal */}
      <Modal visible={!!fullTextModal} transparent={true} animationType="fade" onRequestClose={() => setFullTextModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.textModalContainer}>
            <View style={styles.textModalHeader}>
              <Text style={styles.textModalTitle}>{fullTextModal?.title}</Text>
              <TouchableOpacity onPress={() => setFullTextModal(null)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.textModalScroll}>
              <Text style={styles.textModalBody}>{fullTextModal?.text}</Text>
            </ScrollView>
          </View>
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
  
  actionBtnPrimary: { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' },
  actionBtnPrimaryText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

  deleteButton: { flexDirection: 'row', backgroundColor: '#EF4444', height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  deleteButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  
  fullScreenImageContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullScreenImage: { width: '100%', height: '100%' },
  closeImageBtn: { position: 'absolute', top: Platform.OS === 'android' ? 40 : 60, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  textModalContainer: { width: '100%', maxHeight: '80%', backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden' },
  textModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  textModalTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  textModalScroll: { padding: 16 },
  textModalBody: { fontSize: 16, color: '#334155', lineHeight: 24, paddingBottom: 20 },
  statusOptionBtn: { padding: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }
});
