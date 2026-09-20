import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, StatusBar, ActivityIndicator, Alert, Modal, Platform, Linking, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function TaskDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
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
  const mapRef = React.useRef<MapView>(null);

  // Status Modal State
  const [statusModalVisible, setStatusModalVisible] = useState(false);

  useEffect(() => {
    fetchComplaintDetails();
    initStaffLocation();
  }, [id]);

  const initStaffLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setStaffLocationObj(coords);
        setStaffMapRegion({
          ...coords,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });
        fetchReadableAddress(coords.latitude, coords.longitude);
      }
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
      const token = await SecureStore.getItemAsync('userToken');
      // Fetching all complaints since the live server doesn't have the /:id route yet
      const res = await axios.get(`${API_URL}/complaints`, {
        headers: { 'x-auth-token': token }
      });
      
      const complaintsArray = Array.isArray(res.data) ? res.data : (res.data.complaints || []);
      const found = complaintsArray.find((c: any) => c._id === id);
      
      if (found) {
        setComplaint(found);
        
        // Attempt to geocode complaint location
        if (found.location || found.address) {
          try {
            const locStr = found.address || found.location;
            // Check if it's already coords string (from raise.tsx sometimes it falls back to lat,lng)
            if (locStr.match(/^[\d\.-]+,\s*[\d\.-]+$/)) {
               const parts = locStr.split(',');
               setComplaintCoords({ latitude: parseFloat(parts[0]), longitude: parseFloat(parts[1]) });
            } else {
               const geocoded = await Location.geocodeAsync(locStr);
               if (geocoded && geocoded.length > 0) {
                 setComplaintCoords({ latitude: geocoded[0].latitude, longitude: geocoded[0].longitude });
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
      if (newStatus === 'DONE' && staffLocationObj) {
         const existingResData = parseResolutionData(complaint.after_image);
         updatePayload.after_image = JSON.stringify({
            uri: existingResData ? existingResData.uri : null,
            location: {
                latitude: staffLocationObj.latitude,
                longitude: staffLocationObj.longitude
            },
            address: staffLocationAddress,
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

  const handleTakePhoto = async () => {
    if (!staffLocationObj) {
       Alert.alert('Location Required', 'Please wait for your location to load or ensure location services are enabled.');
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
            location: {
                latitude: staffLocationObj.latitude,
                longitude: staffLocationObj.longitude
            },
            address: staffLocationAddress,
            note: staffNote.trim()
        });
        
        uploadPhoto(payload);
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
        <View style={styles.card}>
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

          <Text style={styles.cardTitle}>{complaint.title}</Text>
          
          <View style={styles.locationContainer}>
            <Ionicons name="location" size={20} color="#1D4ED8" />
            <Text style={styles.cardLocation}>{complaint.location}</Text>
          </View>
          
          {complaintCoords && (
             <View style={{ marginBottom: 20 }}>
               <View style={{ width: '100%', height: 180, borderRadius: 12, overflow: 'hidden' }}>
                  <MapView
                     style={{ width: '100%', height: '100%' }}
                     initialRegion={{
                        latitude: complaintCoords.latitude,
                        longitude: complaintCoords.longitude,
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005
                     }}
                  >
                     <Marker coordinate={complaintCoords} />
                  </MapView>
               </View>
               <TouchableOpacity 
                 style={[styles.actionBtnPrimary, { marginTop: 12, backgroundColor: '#10B981', flexDirection: 'row', justifyContent: 'center' }]}
                 onPress={() => {
                   const url = Platform.select({
                     ios: `maps:0,0?q=${complaintCoords.latitude},${complaintCoords.longitude}`,
                     android: `google.navigation:q=${complaintCoords.latitude},${complaintCoords.longitude}`
                   });
                   if (url) Linking.openURL(url);
                 }}
               >
                 <Ionicons name="navigate" size={18} color="#FFF" style={{ marginRight: 8 }} />
                 <Text style={styles.actionBtnPrimaryText}>Start Navigation</Text>
               </TouchableOpacity>
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

          <View style={[styles.section, { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' }]}>
            <Text style={styles.sectionTitle}>{resolutionData ? 'Resolved at Location' : 'Your Current Location'}</Text>
            {!resolutionData && (
              <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
                This location will be saved when you upload a resolution photo. You can drag the map to adjust it if needed.
              </Text>
            )}
            
            <View style={{ width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
              <MapView
                ref={mapRef}
                style={{ width: '100%', height: '100%' }}
                region={staffMapRegion}
                onRegionChangeComplete={(region) => {
                  if (complaint.status !== 'DONE') {
                    setStaffMapRegion(region);
                    setStaffLocationObj({ latitude: region.latitude, longitude: region.longitude });
                    fetchReadableAddress(region.latitude, region.longitude);
                  }
                }}
              >
                  {staffLocationObj && (
                    <Marker coordinate={staffLocationObj} pinColor="red" />
                  )}
                </MapView>
              </View>
              
              {staffLocationAddress ? (
                <Text style={{ fontSize: 13, color: '#111827', fontWeight: '500', textAlign: 'center', marginTop: 12 }}>
                  {staffLocationAddress}
                </Text>
              ) : null}
          </View>
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
