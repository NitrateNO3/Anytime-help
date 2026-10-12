import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, StatusBar, ActivityIndicator, Alert, Modal, Platform, Linking, TextInput, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useGlobalSearchParams } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';
import FreeMapView, { FreeMapViewRef } from '../components/FreeMapView';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function TaskDetailsScreen() {
  const router = useRouter();
  const { id } = useGlobalSearchParams();
  const { t } = useTranslation();
  
  const [complaint, setComplaint] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  
  const [complaintCoords, setComplaintCoords] = useState<{latitude: number, longitude: number} | null>(null);
  
  // Interactive Staff Location State
  const [staffLocationObj, setStaffLocationObj] = useState<{latitude: number, longitude: number} | null>(null);
  const [staffLocationAddress, setStaffLocationAddress] = useState<string>('');
  const [staffNote, setStaffNote] = useState<string>('');
  const [staffMapRegion, setStaffMapRegion] = useState({
    latitude: 28.6139,
    longitude: 77.2090,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  });
  const mapRef = React.useRef<FreeMapViewRef>(null);

  // Status Modal State
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [confirmPhotoPayload, setConfirmPhotoPayload] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [searchNotFound, setSearchNotFound] = useState(false);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const manualInputRef = React.useRef<TextInput>(null);
  const [replyText, setReplyText] = useState('');
  const [replyImage, setReplyImage] = useState<string | null>(null);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [fullTextModal, setFullTextModal] = useState<{title: string, text: string} | null>(null);

  const typingTimer = React.useRef<any>(null);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchNotFound) setSearchNotFound(false);
    
    if (typingTimer.current) clearTimeout(typingTimer.current);
    
    if (text.length > 2) {
      typingTimer.current = setTimeout(async () => {
        try {
          const res = await axios.get(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=5`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          setSuggestions(res.data);
          setShowSuggestions(true);
        } catch (e) {
          setSuggestions([]);
        }
      }, 800);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (item: any) => {
    setSearchQuery(item.display_name);
    setShowSuggestions(false);
    setSearchNotFound(false);
    const coords = { latitude: parseFloat(item.lat), longitude: parseFloat(item.lon) };
    setStaffLocationObj(coords);
    const newReg = { ...coords, latitudeDelta: 0.005, longitudeDelta: 0.005 };
    setStaffMapRegion(newReg);
    mapRef.current?.animateToRegion(coords);
    fetchReadableAddress(coords.latitude, coords.longitude);
  };

  const searchLocationOnMap = async () => {
    if (!searchQuery.trim()) return;
    setIsSearchingLocation(true);
    setSearchNotFound(false);
    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      const results = res.data;
      if (results && results.length > 0) {
        const coords = { latitude: parseFloat(results[0].lat), longitude: parseFloat(results[0].lon) };
        setStaffLocationObj(coords);
        const newReg = { ...coords, latitudeDelta: 0.005, longitudeDelta: 0.005 };
        setStaffMapRegion(newReg);
        mapRef.current?.animateToRegion(coords);
        fetchReadableAddress(coords.latitude, coords.longitude);
        setSearchNotFound(false);
      } else {
        setSearchNotFound(true);
        if (!staffLocationAddress.trim()) {
          setStaffLocationAddress(searchQuery.trim());
        }
        Alert.alert(
          'Location Not Found on Map',
          'Could not find this place on the map. You can type your exact address manually in the "Resolution Address" field below.',
          [
            { 
              text: 'Type Manually', 
              onPress: () => {
                setTimeout(() => manualInputRef.current?.focus(), 300);
              } 
            },
            { text: 'OK' }
          ]
        );
      }
    } catch (e) {
      setSearchNotFound(true);
      if (!staffLocationAddress.trim()) {
        setStaffLocationAddress(searchQuery.trim());
      }
      Alert.alert(
        'Search Notice',
        'Could not search location. You can enter your address manually in the field below.'
      );
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const getCurrentStaffLocation = async () => {
    try {
      setIsLocatingUser(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow location permission in phone settings to fetch your GPS position.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setStaffLocationObj(coords);
      setStaffMapRegion(prev => ({ ...prev, ...coords }));
      mapRef.current?.animateToRegion(coords);
      fetchReadableAddress(coords.latitude, coords.longitude);
      setSearchNotFound(false);
      Toast.show({ type: 'success', text1: 'GPS Located', text2: 'Location updated to current position.' });
    } catch (err) {
      console.log('Error getting current location:', err);
      Alert.alert('GPS Notice', 'Could not get current GPS location. You can enter your address manually below.');
    } finally {
      setIsLocatingUser(false);
    }
  };

  useEffect(() => {
    fetchComplaintDetails();
    initStaffLocation();
  }, [id]);

  const initStaffLocation = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
        if (loc) {
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setStaffLocationObj(coords);
          setStaffMapRegion(prev => ({ ...prev, ...coords }));
          fetchReadableAddress(coords.latitude, coords.longitude);
          return;
        }
      }
      const coords = { latitude: 28.4510, longitude: 77.0784 }; // Default Sushant Lok 2
      setStaffLocationObj(coords);
      setStaffMapRegion({
        ...coords,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
      fetchReadableAddress(coords.latitude, coords.longitude);
    } catch (e) {
      console.log('Error init location:', e);
    }
  };

  const fetchReadableAddress = async (lat: number, lon: number) => {
    try {
      const result = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      if (result && result.length > 0) {
        const addr = result[0];
        const parts = [addr.name || addr.street, addr.city || addr.district, addr.region || addr.subregion, addr.postalCode].filter(Boolean);
        if (parts.length > 0) {
          setStaffLocationAddress(parts.join(', '));
        }
      }
    } catch (err) {
      console.log('Error reverse geocoding:', err);
    }
  };

  const fetchComplaintDetails = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setComplaint(null);
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.get(`${API_URL}/complaints/${id}`, {
        headers: { 'x-auth-token': token }
      });
      
      const found = res.data;
      
      if (found) {
        setComplaint(found);
        
        // Populate existing resolution data if present
        if (found.after_image) {
          const resData = parseResolutionData(found.after_image);
          if (resData) {
            if (resData.location) {
              setStaffLocationObj(resData.location);
              setStaffMapRegion(prev => ({ ...prev, ...resData.location }));
            }
            if (resData.address) {
              setStaffLocationAddress(resData.address);
            }
            if (resData.note) {
              setStaffNote(resData.note);
            }
          }
        }
        
        // Attempt to geocode complaint location
        if (found.location || found.address) {
          try {
            const locStr = found.address || found.location;
            // Check if it's already coords string
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
                    const res = await axios.get(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locStr)}&format=json&limit=1`, {
                      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                    });
                    if (res.data && res.data.length > 0) {
                      setComplaintCoords({ latitude: parseFloat(res.data[0].lat), longitude: parseFloat(res.data[0].lon) });
                      coordsFound = true;
                    }
                  } catch(e) {}
               }
               
               if (!coordsFound) {
                  // Final fallback: default generic location for the society
                  setComplaintCoords({ latitude: 28.4510, longitude: 77.0784 });
               }
            }
          } catch(e) {
            console.log('Geocode error:', e);
          }
        }
        
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Task not found in your list' });
      }
    } catch (err) {
      console.error('Fetch complaint details error:', err);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not fetch task details' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      setStatusModalVisible(false);
      setUpdating(true);
      const token = await SecureStore.getItemAsync('userToken');
      
      let updatePayload: any = { status: newStatus };
      
      // Always save the latest description and location when marking as DONE
      if (newStatus === 'DONE') {
         const existingResData = parseResolutionData(complaint.after_image);
         updatePayload.after_image = JSON.stringify({
            uri: existingResData ? existingResData.uri : null,
            location: staffLocationObj ? {
                latitude: staffLocationObj.latitude,
                longitude: staffLocationObj.longitude
            } : null,
            address: staffLocationAddress.trim(),
            note: staffNote.trim()
         });
      }
      
      const res = await axios.patch(`${API_URL}/complaints/${id}`, updatePayload, {
        headers: { 'x-auth-token': token }
      });
      
      setComplaint(res.data);
      Toast.show({
        type: 'success',
        text1: 'Status Updated',
        text2: `Task marked as ${newStatus.replace('_', ' ')}`
      });
    } catch (err) {
      console.error('Update status error:', err);
      Toast.show({ type: 'error', text1: 'Update Failed', text2: 'Could not update status' });
    } finally {
      setUpdating(false);
    }
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

  const handleTakePhoto = async () => {
    if (!staffLocationObj && !staffLocationAddress.trim()) {
       Alert.alert('Location Required', 'Please select a location on map or enter your address manually.');
       return;
    }

    try {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (cameraStatus !== 'granted') {
        Alert.alert('Permission needed', 'Sorry, we need camera permissions to make this work!');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        
        // Bundle image and selected location
        const payload = JSON.stringify({
            uri: base64Image,
            location: staffLocationObj ? {
                latitude: staffLocationObj.latitude,
                longitude: staffLocationObj.longitude
            } : null,
            address: staffLocationAddress.trim(),
            note: staffNote.trim()
        });
        setConfirmPhotoPayload(payload);
      }
    } catch (error) {
      console.error("Camera error:", error);
      Toast.show({ type: 'error', text1: 'Camera Error', text2: 'Could not capture photo' });
    }
  };

  const uploadPhoto = async (base64Image: string) => {
    try {
      setUpdating(true);
      const token = await SecureStore.getItemAsync('userToken');
      
      const res = await axios.patch(`${API_URL}/complaints/${id}`, 
        { after_image: base64Image }, 
        { headers: { 'x-auth-token': token } }
      );
      
      setComplaint(res.data);
      Toast.show({
        type: 'success',
        text1: 'Photo Uploaded',
        text2: 'Resolution photo attached successfully.'
      });
    } catch (err) {
      console.error('Update photo error:', err);
      Toast.show({ type: 'error', text1: 'Upload Failed', text2: 'Could not upload photo' });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FCFDF6" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Task Details</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1D4ED8" />
        </View>
      </SafeAreaView>
    );
  }

  if (!complaint) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Task Details</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Task not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const parseResolutionData = (afterImageStr: string | null) => {
    if (!afterImageStr) return null;
    try {
      const parsed = JSON.parse(afterImageStr);
      return parsed; // { uri, location: { latitude, longitude } }
    } catch(e) {
      return { uri: afterImageStr, location: null };
    }
  };
  
  const resolutionData = parseResolutionData(complaint.after_image);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FCFDF6" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Task Details</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Escalated Alert Banner for Staff */}
        {complaint.is_escalated && (
          <View style={{
            backgroundColor: '#FEF2F2',
            borderWidth: 1.5,
            borderColor: '#EF4444',
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            shadowColor: '#EF4444',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 8,
            elevation: 3
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ backgroundColor: '#EF4444', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="flame" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#B91C1C', letterSpacing: 0.5 }}>
                  URGENT: TASK ESCALATED
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#991B1B', marginTop: 2 }}>
                  Escalated by Member: {complaint.escalated_by_name || complaint.escalated_by?.name || 'Member'}
                </Text>
              </View>
            </View>
            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#FCA5A5' }}>
              {complaint.escalated_at && (
                <Text style={{ fontSize: 12, color: '#B91C1C', fontWeight: '500' }}>
                  🕒 Escalated At: {new Date(complaint.escalated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </Text>
              )}
              {(complaint.escalated_by_phone || complaint.escalated_by?.phone_number || complaint.escalated_by?.phone) && (
                <Text style={{ fontSize: 12, color: '#991B1B', fontWeight: '600', marginTop: 3 }}>
                  📞 Member Phone: {complaint.escalated_by_phone || complaint.escalated_by?.phone_number || complaint.escalated_by?.phone}
                </Text>
              )}
            </View>
          </View>
        )}

        <View style={styles.card}>
          {/* Complaint ID & Date Tag */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#C7D2FE' }}>
              <Ionicons name="pricetag-outline" size={13} color="#4338CA" style={{ marginRight: 5 }} />
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#4338CA', letterSpacing: 0.5 }}>
                {complaint.complaint_id || `#AH-${complaint._id?.slice(-5).toUpperCase()}`}
              </Text>
            </View>
            {complaint.created_at ? (
              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500' }}>
                {new Date(complaint.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            ) : null}
          </View>

          <View style={styles.cardHeader}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{complaint.priority}</Text>
            </View>
            <Text style={[
              styles.statusText, 
              complaint.status === 'PENDING' ? { color: '#F59E0B' } : 
              complaint.status === 'IN_PROGRESS' ? { color: '#3B82F6' } : { color: '#10B981' }
            ]}>
              ● {complaint.status === 'DONE' ? 'RESOLVED' : complaint.status.replace('_', ' ')}
            </Text>
          </View>

          <Text style={styles.cardTitle}>{t(`categories.${complaint.title}`, { defaultValue: complaint.title })}</Text>
          
          <View style={styles.locationContainer}>
            <Ionicons name="location" size={20} color="#1D4ED8" />
            <Text style={styles.cardLocation}>{complaint.location}</Text>
          </View>
          
          {complaintCoords && (
             <View style={{ marginBottom: 20 }}>
               <View style={{ width: '100%', height: 180, borderRadius: 12, overflow: 'hidden' }}>
                  <FreeMapView
                    latitude={complaintCoords.latitude}
                    longitude={complaintCoords.longitude}
                    interactive={false}
                  />
               </View>
               <View style={{ flexDirection: 'row', marginTop: 12, gap: 12 }}>
                 <TouchableOpacity 
                   style={[styles.actionBtnPrimary, { flex: 1, backgroundColor: '#10B981', flexDirection: 'row', justifyContent: 'center' }]}
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
                   <Ionicons name="navigate" size={18} color="#FFF" style={{ marginRight: 8 }} />
                   <Text style={[styles.actionBtnPrimaryText, { fontSize: 13 }]}>Start Navigation</Text>
                 </TouchableOpacity>
                 <TouchableOpacity 
                   style={[styles.actionBtnPrimary, { flex: 1, backgroundColor: '#3B82F6', flexDirection: 'row', justifyContent: 'center' }]}
                   onPress={async () => {
                     let searchQ = `${complaintCoords.latitude},${complaintCoords.longitude}`;
                     const locStr = complaint.address || complaint.location;
                     if (locStr && !locStr.match(/^[\d\.-]+,\s*[\d\.-]+$/)) {
                       searchQ = encodeURIComponent(locStr);
                     }
                     const url = `https://www.google.com/maps/search/?api=1&query=${searchQ}`;
                     try {
                        await Share.share({ 
                           message: Platform.OS === 'android' ? `Location for task: ${url}` : 'Location for task',
                           url: Platform.OS === 'ios' ? url : undefined
                        });
                     } catch(e) {}
                   }}
                 >
                   <Ionicons name="share-social" size={18} color="#FFF" style={{ marginRight: 8 }} />
                   <Text style={[styles.actionBtnPrimaryText, { fontSize: 13 }]}>Share Location</Text>
                 </TouchableOpacity>
               </View>
             </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descText}>{complaint.description}</Text>
          </View>
          
          {complaint.user && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reported By</Text>
              <Text style={styles.detailText}>{complaint.user.name}</Text>
              {complaint.user.address ? (
                <Text style={[styles.detailText, { fontSize: 14, color: '#6B7280', marginTop: 4 }]}>
                  {complaint.user.address}
                </Text>
              ) : null}
              {complaint.user.phone_number ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 }}>
                  <Text style={[styles.detailText, { fontSize: 16, color: '#111827', fontWeight: '600' }]}>
                    {complaint.user.phone_number}
                  </Text>
                  <TouchableOpacity 
                    style={{ backgroundColor: '#DBEAFE', padding: 8, borderRadius: 8 }}
                    onPress={() => Linking.openURL(`tel:${complaint.user.phone_number}`)}
                  >
                    <Ionicons name="call" size={18} color="#2563EB" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={{ backgroundColor: '#DCFCE7', padding: 8, borderRadius: 8 }}
                    onPress={() => {
                       const phone = complaint.user.phone_number.replace(/\D/g, '');
                       const finalPhone = phone.length === 10 ? `91${phone}` : phone;
                       const compId = complaint.complaint_id || (complaint._id ? `#AH-${complaint._id.slice(-5).toUpperCase()}` : '');
                       Linking.openURL(`whatsapp://send?phone=${finalPhone}&text=Hello, this is regarding task "${complaint.title}" (${compId})...`).catch(() => {
                          Alert.alert('Error', 'WhatsApp is not installed on this device.');
                       });
                    }}
                  >
                    <Ionicons name="logo-whatsapp" size={18} color="#16A34A" />
                    
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={{ backgroundColor: '#F1F5F9', padding: 8, borderRadius: 8 }}
                    onPress={async () => {
                       try {
                         await Share.share({ message: `Contact for task: ${complaint.user.phone_number}` });
                       } catch(e) {}
                    }}
                  >
                    <Ionicons name="share-social" size={18} color="#475569" />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}

          {complaint.before_image ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Issue Photo</Text>
              <TouchableOpacity activeOpacity={0.8} onPress={() => setFullScreenImage(complaint.before_image)} style={styles.imageContainer}>
                <Image source={{ uri: complaint.before_image }} style={styles.cardImage} />
              </TouchableOpacity>
            </View>
          ) : null}

          {resolutionData ? (
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Resolution Photo</Text>
                {complaint.status !== 'DONE' && (
                  <TouchableOpacity onPress={handleTakePhoto} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                    <Ionicons name="camera-reverse-outline" size={16} color="#3B82F6" />
                    <Text style={{ fontSize: 13, color: '#3B82F6', fontWeight: '600', marginLeft: 4 }}>Change Photo</Text>
                  </TouchableOpacity>
                )}
              </View>
              {resolutionData.uri && (
                <TouchableOpacity activeOpacity={0.8} onPress={() => setFullScreenImage(resolutionData.uri)} style={styles.imageContainer}>
                  <Image source={{ uri: resolutionData.uri }} style={styles.cardImage} />
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {complaint.status !== 'DONE' ? (
            <View style={[styles.section, { paddingBottom: 8 }]}>
              <Text style={styles.sectionTitle}>Description (Optional)</Text>
              <TextInput
                style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, fontSize: 14, color: '#111827', minHeight: 80, textAlignVertical: 'top', marginBottom: 12 }}
                placeholder="Explain what was done to resolve this issue..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                value={staffNote}
                onChangeText={setStaffNote}
              />
            </View>
          ) : (
            resolutionData && resolutionData.note ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description</Text>
                <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <Text style={{ fontSize: 14, color: '#334155', lineHeight: 20 }}>{resolutionData.note}</Text>
                </View>
              </View>
            ) : null
          )}

          <View style={[styles.section, { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'visible', zIndex: 10 }]}>
            <Text style={styles.sectionTitle}>{resolutionData ? 'Resolved at Location' : 'Select Resolution Location'}</Text>
            {!resolutionData && (
              <>
                <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
                  Search on map or drag pin. If location is not found, you can type it manually below.
                </Text>

                {/* Search Input Row */}
                <View style={{ width: '100%', marginBottom: 10, zIndex: 999, elevation: 999 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      style={{ flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, height: 44, fontSize: 14, color: '#111827' }}
                      placeholder="Search location (e.g. Sushant Lok 2)"
                      placeholderTextColor="#9CA3AF"
                      value={searchQuery}
                      onChangeText={handleSearchChange}
                      onSubmitEditing={searchLocationOnMap}
                      onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true); }}
                    />
                    <TouchableOpacity 
                      style={{ backgroundColor: '#3B82F6', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' }}
                      onPress={searchLocationOnMap}
                      disabled={isSearchingLocation}
                    >
                      {isSearchingLocation ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="search" size={20} color="#FFF" />}
                    </TouchableOpacity>
                  </View>

                  {showSuggestions && suggestions.length > 0 && (
                    <View style={{ position: 'absolute', top: 48, left: 0, right: 0, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5, zIndex: 20 }}>
                      {suggestions.map((item, idx) => (
                        <TouchableOpacity 
                          key={idx} 
                          style={{ padding: 12, borderBottomWidth: idx === suggestions.length - 1 ? 0 : 1, borderBottomColor: '#F1F5F9' }}
                          onPress={() => handleSelectSuggestion(item)}
                        >
                          <Text style={{ fontSize: 13, color: '#1E293B' }} numberOfLines={2}>{item.display_name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Quick GPS & Enter Manually Buttons */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity 
                    onPress={getCurrentStaffLocation}
                    disabled={isLocatingUser}
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE' }}
                  >
                    {isLocatingUser ? (
                      <ActivityIndicator size="small" color="#2563EB" style={{ marginRight: 6 }} />
                    ) : (
                      <Ionicons name="locate" size={16} color="#2563EB" style={{ marginRight: 6 }} />
                    )}
                    <Text style={{ fontSize: 12, color: '#1E40AF', fontWeight: '600' }}>
                      {isLocatingUser ? 'Fetching GPS...' : 'My Current GPS'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={() => manualInputRef.current?.focus()}
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8 }}
                  >
                    <Ionicons name="create-outline" size={15} color="#475569" style={{ marginRight: 5 }} />
                    <Text style={{ fontSize: 12, color: '#475569', fontWeight: '600' }}>Type Manually</Text>
                  </TouchableOpacity>
                </View>

                {/* Search not found alert card */}
                {searchNotFound && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', padding: 10, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#FDE68A' }}>
                    <Ionicons name="alert-circle" size={18} color="#D97706" style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 12, color: '#92400E', flex: 1, lineHeight: 16 }}>
                      Location map pe nahi mili. Aap neeche diye gaye box me apna exact flat/address manually likh sakte hain.
                    </Text>
                  </View>
                )}
              </>
            )}
            
            <View style={{ width: '100%', height: 220, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
              <FreeMapView
                ref={mapRef}
                latitude={staffLocationObj?.latitude || staffMapRegion.latitude}
                longitude={staffLocationObj?.longitude || staffMapRegion.longitude}
                interactive={complaint.status !== 'DONE'}
                onLocationChange={(coords) => {
                  if (complaint.status !== 'DONE') {
                    setStaffLocationObj(coords);
                    setStaffMapRegion(prev => ({ ...prev, ...coords }));
                    fetchReadableAddress(coords.latitude, coords.longitude);
                  }
                }}
              />
            </View>
              
            {complaint.status !== 'DONE' ? (
              <View style={{ marginTop: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }}>
                    Resolution Address / Location
                  </Text>
                  <Text style={{ fontSize: 11, color: '#2563EB', fontWeight: '600' }}>
                    ✏️ Editable
                  </Text>
                </View>
                
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  backgroundColor: '#FFFFFF', 
                  borderWidth: 1.5, 
                  borderColor: searchNotFound ? '#F59E0B' : '#E2E8F0', 
                  borderRadius: 12, 
                  paddingHorizontal: 12, 
                  paddingVertical: 8,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1
                }}>
                  <Ionicons name="location" size={20} color="#2563EB" style={{ marginRight: 8 }} />
                  <TextInput
                    ref={manualInputRef}
                    style={{ flex: 1, fontSize: 14, color: '#0F172A', minHeight: 38, paddingVertical: 2 }}
                    placeholder="Enter manual address (e.g. Flat 302, Block C, Gate 1)"
                    placeholderTextColor="#94A3B8"
                    value={staffLocationAddress}
                    onChangeText={setStaffLocationAddress}
                    multiline
                  />
                  {staffLocationAddress ? (
                    <TouchableOpacity onPress={() => setStaffLocationAddress('')} style={{ padding: 4 }}>
                      <Ionicons name="close-circle" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 5, marginLeft: 2 }}>
                  Map pe location na mile to yahan apna flat, block ya landmark manually type kar sakte hain.
                </Text>
              </View>
            ) : (
              (resolutionData?.address || staffLocationAddress) ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 14, backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <Ionicons name="location" size={20} color="#10B981" style={{ marginRight: 8, marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>Resolved Address</Text>
                    <Text style={{ fontSize: 14, color: '#0F172A', fontWeight: '500', marginTop: 2 }}>
                      {resolutionData?.address || staffLocationAddress}
                    </Text>
                  </View>
                </View>
              ) : null
            )}
          </View>
        </View>

        {/* Replies & Updates Section */}
        <View style={[styles.card, { marginTop: 16 }]}>
          <Text style={[styles.sectionTitle, { fontSize: 17, marginBottom: 10 }]}>Replies & Updates</Text>
          {(!complaint.replies || complaint.replies.length === 0) ? (
            <Text style={{ color: '#64748B', fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginVertical: 12 }}>
              No replies yet.
            </Text>
          ) : (
            <View style={{ marginBottom: 16 }}>
              {complaint.replies.map((reply: any, idx: number) => (
                <TouchableOpacity key={idx} style={{ 
                  backgroundColor: reply.role === 'Admin' || reply.role === 'Staff' ? '#F0FDF4' : '#F8FAFC',
                  borderLeftWidth: 3,
                  borderLeftColor: reply.role === 'Admin' || reply.role === 'Staff' ? '#16A34A' : '#3B82F6',
                  padding: 12,
                  borderRadius: 10,
                  marginBottom: 12
                }} onPress={() => {
                  if (reply.text) {
                    setFullTextModal({ title: 'Reply', text: reply.text });
                  } else if (reply.image) {
                    setFullScreenImage(reply.image);
                  }
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontWeight: '700', color: reply.role === 'Admin' || reply.role === 'Staff' ? '#16A34A' : '#1D4ED8', fontSize: 13 }}>
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

          {complaint.status !== 'DONE' && (
            <View style={{ marginTop: 4 }}>
              {replyImage ? (
                <View style={{ marginBottom: 12, position: 'relative', alignSelf: 'flex-start' }}>
                  <Image source={{ uri: replyImage }} style={{ width: 110, height: 110, borderRadius: 12, borderWidth: 1.5, borderColor: '#3B82F6' }} />
                  <TouchableOpacity 
                    onPress={() => setReplyImage(null)}
                    style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', elevation: 4 }}
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
                  padding: 14,
                  fontSize: 14,
                  minHeight: 80,
                  color: '#1E293B',
                  textAlignVertical: 'top'
                }}
                placeholder="Reply to member..."
                placeholderTextColor="#94A3B8"
                multiline
                value={replyText}
                onChangeText={setReplyText}
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}
                    onPress={handleTakeReplyPhoto}
                    disabled={isPhotoLoading || isReplying}
                  >
                    {isPhotoLoading ? (
                      <ActivityIndicator size="small" color="#2563EB" />
                    ) : (
                      <>
                        <Ionicons name="camera" size={16} color="#2563EB" style={{ marginRight: 4 }} />
                        <Text style={{ color: '#2563EB', fontWeight: '600', fontSize: 12 }}>Camera</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}
                    onPress={handlePickReplyImage}
                    disabled={isPhotoLoading || isReplying}
                  >
                    <Ionicons name="image" size={16} color="#475569" style={{ marginRight: 4 }} />
                    <Text style={{ color: '#475569', fontWeight: '600', fontSize: 12 }}>Gallery</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={{ backgroundColor: '#1D4ED8', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8, opacity: (!replyText.trim() && !replyImage) ? 0.5 : 1 }}
                  onPress={handleReply}
                  disabled={(!replyText.trim() && !replyImage) || isReplying}
                >
                  {isReplying ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>Send Reply</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed Bottom Action Bar */}
      <View style={styles.bottomBar}>
        {updating ? (
          <ActivityIndicator size="large" color="#1D4ED8" />
        ) : (
          <View style={styles.actionRow}>
            {complaint.status !== 'DONE' && (
              <>
                <TouchableOpacity 
                  style={styles.actionBtnOutline}
                  onPress={() => setStatusModalVisible(true)}
                >
                  <Text style={styles.actionBtnOutlineText}>Update Status</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.actionBtnPrimary}
                  onPress={handleTakePhoto}
                >
                  <Ionicons name="camera" size={20} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.actionBtnPrimaryText}>{complaint.after_image ? 'Update Photo' : 'Add Photo'}</Text>
                </TouchableOpacity>
              </>
            )}
            {complaint.status === 'DONE' && (
              <View style={styles.resolvedBanner}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                <Text style={styles.resolvedBannerText}>This task has been resolved</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Status Selection Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={statusModalVisible}
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setStatusModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Status</Text>
            
            <TouchableOpacity style={styles.modalOption} onPress={() => handleUpdateStatus('PENDING')} disabled={updating}>
              <Ionicons name="time-outline" size={24} color="#F59E0B" />
              <Text style={styles.modalOptionText}>Pending</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.modalOption} onPress={() => handleUpdateStatus('IN_PROGRESS')} disabled={updating}>
              <Ionicons name="construct-outline" size={24} color="#3B82F6" />
              <Text style={styles.modalOptionText}>In Progress</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.modalOption} onPress={() => handleUpdateStatus('DONE')} disabled={updating}>
              <Ionicons name="checkmark-circle-outline" size={24} color="#10B981" />
              <Text style={styles.modalOptionText}>Resolved (Done)</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.modalOption, { borderBottomWidth: 0, marginTop: 8 }]} onPress={() => setStatusModalVisible(false)}>
              <Text style={{ fontSize: 16, color: '#6B7280', fontWeight: '600', textAlign: 'center', width: '100%' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Full Screen Image Modal */}
      <Modal visible={!!fullScreenImage} transparent={true} animationType="fade" onRequestClose={() => setFullScreenImage(null)}>
        <View style={styles.fullScreenImageContainer}>
          <TouchableOpacity style={styles.closeImageBtn} onPress={() => setFullScreenImage(null)}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {fullScreenImage && <Image source={{ uri: fullScreenImage }} style={styles.fullScreenImage} resizeMode="contain" />}
        </View>
      </Modal>

      {/* Confirm Photo Upload Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={!!confirmPhotoPayload}
        onRequestClose={() => setConfirmPhotoPayload(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { alignItems: 'center', paddingVertical: 24 }]}>
            <View style={{ backgroundColor: '#EFF6FF', padding: 16, borderRadius: 50, marginBottom: 16 }}>
              <Ionicons name="cloud-upload" size={36} color="#3B82F6" />
            </View>
            <Text style={[styles.modalTitle, { marginBottom: 8 }]}>Confirm Upload</Text>
            <Text style={{ fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>
              Are you sure you want to upload this resolution photo?
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity 
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' }}
                onPress={() => setConfirmPhotoPayload(null)}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#475569' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#3B82F6', alignItems: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                onPress={() => {
                   const payload = confirmPhotoPayload;
                   setConfirmPhotoPayload(null);
                   if (payload) uploadPhoto(payload);
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>Upload</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full Text Modal */}
      <Modal visible={!!fullTextModal} transparent={true} animationType="fade" onRequestClose={() => setFullTextModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 10 }}>
              <Text style={styles.modalTitle}>{fullTextModal?.title}</Text>
              <TouchableOpacity onPress={() => setFullTextModal(null)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={{ fontSize: 15, color: '#334155', lineHeight: 22 }}>{fullTextModal?.text}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FCFDF6' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FFFFFF' },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  container: { flex: 1 },
  contentContainer: { padding: 20 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#EF4444', fontWeight: '500' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  badge: { backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  badgeText: { fontSize: 13, fontWeight: '700', color: '#B91C1C' },
  statusText: { fontSize: 14, fontWeight: '700' },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 16 },
  locationContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', padding: 12, borderRadius: 12, marginBottom: 20 },
  cardLocation: { fontSize: 15, color: '#1E3A8A', marginLeft: 8, fontWeight: '600', flex: 1 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#4B5563', marginBottom: 8 },
  descText: { fontSize: 15, color: '#111827', lineHeight: 24 },
  detailText: { fontSize: 15, color: '#111827', fontWeight: '500' },
  imageContainer: { width: '100%', height: 200, borderRadius: 16, overflow: 'hidden' },
  cardImage: { width: '100%', height: '100%', backgroundColor: '#F3F4F6' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', padding: 20, borderTopWidth: 1, borderTopColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10 },
  actionRow: { flexDirection: 'row', gap: 12 },
  actionBtnOutline: { flex: 1, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  actionBtnOutlineText: { fontSize: 15, fontWeight: '600', color: '#4B5563' },
  actionBtnPrimary: { flex: 2, flexDirection: 'row', backgroundColor: '#1D4ED8', paddingVertical: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actionBtnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  resolvedBanner: { flex: 1, flexDirection: 'row', backgroundColor: '#ECFDF5', paddingVertical: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8 },
  resolvedBannerText: { fontSize: 15, fontWeight: '700', color: '#065F46' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: 'white', borderRadius: 20, padding: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16, textAlign: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalOptionText: { fontSize: 16, color: '#111827', fontWeight: '500', marginLeft: 12 },
  fullScreenImageContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullScreenImage: { width: '100%', height: '100%' },
  closeImageBtn: { position: 'absolute', top: Platform.OS === 'android' ? 40 : 60, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
});
