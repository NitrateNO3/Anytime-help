import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, Modal, StatusBar, ActivityIndicator, Image, Animated, BackHandler, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { getLocalizedCategoryTitle, getLocalizedSubCategoryTitle } from '../../utils/localization';
import { io } from 'socket.io-client';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function RaiseComplaint() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  
  const [categoriesData, setCategoriesData] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [step, setStep] = useState(1); // 1 = Categories, 2 = Form Details
  const [selectedMainCategory, setSelectedMainCategory] = useState<any>(null);
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [otherModalVisible, setOtherModalVisible] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [galleryLoading, setGalleryLoading] = useState(false);
  
  const [showModal, setShowModal] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(400)).current;

  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeAccepted, setNoticeAccepted] = useState(false);
  const [pendingSubCategory, setPendingSubCategory] = useState<any>(null);

  // Location & Map State
  const [locationObj, setLocationObj] = useState<{latitude: number, longitude: number} | null>(null);
  const [locationAddress, setLocationAddress] = useState<string>('');
  const [manualAddress, setManualAddress] = useState<string>('');
  const [mapRegion, setMapRegion] = useState({
    latitude: 28.6139,
    longitude: 77.2090,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  });
  const mapRef = React.useRef<MapView>(null);

  useFocusEffect(
    useCallback(() => {
      fetchCategories();

      const onBackPress = () => {
        if (step === 2) {
          setStep(1);
          return true;
        }
        router.replace('/resident');
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [step])
  );

  useEffect(() => {
    const socket = io(API_URL.replace('/api', ''), { transports: ['websocket', 'polling'] });
    socket.on('categories_updated', () => {
      fetchCategories();
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API_URL}/categories`);
      if (res.data && res.data.length > 0) {
        setCategoriesData(res.data);
      } else {
        // Fallback if no categories in DB yet
        setCategoriesData([]);
      }
    } catch (error) {
      console.log('Error fetching categories:', error);
      setCategoriesData([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const openSubCategories = (cat: any) => {
    setSelectedMainCategory(cat);
    setShowModal(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const closeBottomSheet = () => {
    Animated.timing(slideAnim, {
      toValue: 400,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setShowModal(false);
    });
  };

  const proceedToStep2 = async (catTitle: string, subCatTitle: string) => {
    setCategory(catTitle);
    setSubCategory(subCatTitle);
    closeBottomSheet();
    setStep(2);
    
    // Fetch Location when entering Step 2
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Allow location access to attach it to your complaint.');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude
      };
      setLocationObj(coords);
      setMapRegion({
        ...coords,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
      mapRef.current?.animateToRegion({
        ...coords,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
      
      // Fetch readable address
      fetchReadableAddress(coords.latitude, coords.longitude);
    } catch (e) {
      console.log('Error getting location:', e);
    }
  };

  const selectSubCategory = (sub: string, localizedTitle?: string) => {
    const mainTitle = selectedMainCategory?.title;
    const finalSubTitle = localizedTitle || sub;

    if (mainTitle === 'Street light') {
      setPendingSubCategory({ catTitle: mainTitle, subCatTitle: finalSubTitle });
      setNoticeAccepted(false);
      closeBottomSheet();
      setTimeout(() => {
        setShowNoticeModal(true);
      }, 400); // Wait for the first modal to close
      return;
    }

    proceedToStep2(mainTitle, finalSubTitle);
  };

  const fetchReadableAddress = async (lat: number, lon: number) => {
    try {
      const result = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      if (result && result.length > 0) {
        const addr = result[0];
        const parts = [addr.name || addr.street, addr.city || addr.district, addr.region || addr.subregion, addr.postalCode].filter(Boolean);
        if (parts.length > 0) {
          setLocationAddress(parts.join(', '));
        } else {
          setLocationAddress(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
        }
      }
    } catch (err) {
      console.log('Error reverse geocoding:', err);
      setLocationAddress(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera permissions to make this work!');
      return;
    }
    setCameraLoading(true);
    try {
      let result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (e) {
      console.log('Error taking photo:', e);
    } finally {
      setCameraLoading(false);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need gallery permissions to make this work!');
      return;
    }
    setGalleryLoading(true);
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (e) {
      console.log('Error picking image:', e);
    } finally {
      setGalleryLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!description || description.length < 50) {
      setErrorMessage('Please provide a description of at least 50 characters.');
      setErrorModalVisible(true);
      return;
    }

    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const mockDepartmentId = '60d5ecb8b392d700153ee123';

      await axios.post(
        `${API_URL}/complaints`,
        {
          title: category,
          description,
          location: locationAddress || (locationObj ? `${locationObj.latitude}, ${locationObj.longitude}` : 'N/A'),
          address: manualAddress,
          category,
          subCategory,
          department: mockDepartmentId,
          before_image: image || '',
          priority: 'Medium'
        },
        { headers: { 'x-auth-token': token } }
      );
      
      if (category.toLowerCase() === 'other' || category.toLowerCase() === 'others' || subCategory.toLowerCase() === 'other' || subCategory.toLowerCase() === 'others') {
        setOtherModalVisible(true);
      } else {
        setSuccessModalVisible(true);
      }
    } catch (err: any) {
      console.log('Submission info:', err.message);
      const errorCode = err.response?.data?.error_code;
      const msg = err.response?.data?.msg;
      
      if (errorCode === 'DUPLICATE_GROUPED' || errorCode === 'DUPLICATE_EXISTS') {
        setErrorMessage(msg);
      } else {
        setErrorMessage(t('raise.errorSubmit') || 'Could not submit complaint. Please try again.');
      }
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" backgroundColor="#1D4ED8" />

        {/* Header */}
        <View style={styles.headerBar}>
          <TouchableOpacity 
            onPress={() => {
              if (step === 2) setStep(1);
              else router.replace('/resident');
            }} 
            style={styles.backButton}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {step === 1 ? t('raise.grievanceCategory') : t('raise.lodgeGrievance')}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {step === 1 ? (
          // STEP 1: CATEGORY SELECTION
          <ScrollView 
            style={styles.container} 
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
          >
            {loadingCategories ? (
              <View>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <View key={i} style={styles.categoryCard}>
                    <View style={[styles.iconWrapper, { backgroundColor: '#E5E7EB' }]} />
                    <View style={styles.categoryInfo}>
                      <View style={{ width: '60%', height: 16, backgroundColor: '#E5E7EB', borderRadius: 4, marginBottom: 8 }} />
                      <View style={{ width: '40%', height: 12, backgroundColor: '#E5E7EB', borderRadius: 4 }} />
                    </View>
                  </View>
                ))}
              </View>
            ) : categoriesData.length === 0 ? (
              <Text style={{ textAlign: 'center', marginTop: 40, color: '#6B7280' }}>{t('raise.noCategories')}</Text>
            ) : (
              categoriesData.map((cat, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.categoryCard}
                  onPress={() => openSubCategories(cat)}
                >
                  <View style={[styles.iconWrapper, { backgroundColor: cat.image ? '#F3F4F6' : (cat.bgColor || '#DBEAFE'), overflow: 'hidden' }]}>
                    {cat.image ? (
                      <Image source={{ uri: cat.image }} style={{ width: '100%', height: '100%', borderRadius: 12, resizeMode: 'cover' }} />
                    ) : (
                      <Ionicons name={(cat.icon || 'list') as any} size={28} color={cat.color || '#3B82F6'} />
                    )}
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text style={[styles.categoryTitle, { color: cat.color || '#3B82F6' }]}>
                      {getLocalizedCategoryTitle(cat, i18n.language) || t(`categories.${cat.title}`, { defaultValue: cat.title })}
                    </Text>
                    <Text style={styles.subCategoryCount}>{t('raise.subCategoriesCount', { count: cat.subCategories?.length || 0 })}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        ) : (
          // STEP 2: FORM DETAILS
          <ScrollView 
            style={styles.formContainer} 
            contentContainerStyle={{ paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Map Section */}
            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <Text style={styles.formSectionTitle}>{t('raise.grievanceLocation')}</Text>
              </View>
              <View style={[styles.formSectionContent, { padding: 0, overflow: 'hidden', alignItems: 'center' }]}>
                <Text style={{ textAlign: 'center', fontSize: 12, fontWeight: '700', color: '#6B7280', marginVertical: 12, letterSpacing: 0.5 }}>
                  {t('raise.showingPresentLocation')}
                </Text>
                
                <View style={{ width: '100%', height: 250, position: 'relative' }}>
                  <MapView
                    ref={mapRef}
                    style={{ width: '100%', height: '100%' }}
                    region={mapRegion}
                    onRegionChangeComplete={(region) => {
                      setMapRegion(region);
                      setLocationObj({ latitude: region.latitude, longitude: region.longitude });
                      fetchReadableAddress(region.latitude, region.longitude);
                    }}
                  >
                    {locationObj && (
                      <>
                        <Circle
                          center={locationObj}
                          radius={150}
                          fillColor="rgba(59, 130, 246, 0.15)"
                          strokeColor="#3B82F6"
                          strokeWidth={2}
                        />
                        <Marker coordinate={locationObj} />
                      </>
                    )}
                  </MapView>

                  {/* Zoom Controls Overlay */}
                  <View style={{ position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 }}>
                    <TouchableOpacity 
                      style={{ backgroundColor: 'rgba(209, 213, 219, 0.9)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 }}
                      onPress={() => {
                        const newReg = { ...mapRegion, latitudeDelta: mapRegion.latitudeDelta / 2, longitudeDelta: mapRegion.longitudeDelta / 2 };
                        setMapRegion(newReg);
                        mapRef.current?.animateToRegion(newReg, 500);
                      }}
                    >
                      <Text style={{ color: '#4B5563', fontWeight: '600', fontSize: 14 }}>{t('raise.zoomIn')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={{ backgroundColor: 'rgba(209, 213, 219, 0.9)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 }}
                      onPress={() => {
                        const newReg = { ...mapRegion, latitudeDelta: mapRegion.latitudeDelta * 2, longitudeDelta: mapRegion.longitudeDelta * 2 };
                        setMapRegion(newReg);
                        mapRef.current?.animateToRegion(newReg, 500);
                      }}
                    >
                      <Text style={{ color: '#4B5563', fontWeight: '600', fontSize: 14 }}>{t('raise.zoomOut')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ paddingVertical: 12, width: '100%', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 16 }}>
                  {locationAddress ? (
                    <Text style={{ fontSize: 13, color: '#111827', fontWeight: '500', textAlign: 'center', marginBottom: 4 }}>
                      {locationAddress}
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: 11, color: '#6B7280', marginBottom: 12 }}>
                    {t('raise.tapToMark')}
                  </Text>
                  
                  <TextInput
                    style={[styles.input, { width: '100%', marginBottom: 0, height: 45, backgroundColor: '#F9FAFB' }]}
                    placeholder={t('raise.manualAddress') || 'House/Flat No. & Building (Optional)'}
                    placeholderTextColor="#9CA3AF"
                    value={manualAddress}
                    onChangeText={setManualAddress}
                  />
                </View>
              </View>
            </View>

            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <Text style={styles.formSectionTitle}>{t('raise.grievanceDetails')}</Text>
              </View>
              
              <View style={styles.formSectionContent}>
                <Text style={styles.label}>{t('raise.grievanceCategory')}</Text>
                <View style={styles.readOnlyInput}>
                  <Text style={styles.readOnlyText}>{getLocalizedCategoryTitle(selectedMainCategory, i18n.language) || category}</Text>
                </View>

                <Text style={styles.label}>{t('raise.subCategoriesTitle')}</Text>
                <View style={styles.readOnlyInput}>
                  <Text style={styles.readOnlyText}>{getLocalizedSubCategoryTitle(selectedMainCategory, subCategory, i18n.language) || subCategory}</Text>
                </View>

                <Text style={styles.label}>{t('raise.grievanceDetails')} (Min 50 Character) <Text style={{color: '#EF4444'}}>*</Text></Text>
                <TextInput
                  style={styles.textArea}
                  multiline
                  numberOfLines={4}
                  placeholder={t('raise.descriptionPlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  value={description}
                  onChangeText={setDescription}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{description.length}/250</Text>

                <Text style={styles.label}>{t('raise.addPhotos')}</Text>
                <View style={styles.photosContainer}>
                  {image ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image source={{ uri: image }} style={styles.previewImage} />
                      <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImage(null)}>
                        <Ionicons name="close" size={16} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <TouchableOpacity style={styles.photoAddBtn} onPress={takePhoto} disabled={cameraLoading || galleryLoading}>
                        {cameraLoading ? (
                          <ActivityIndicator size="small" color="#3B82F6" />
                        ) : (
                          <>
                            <Ionicons name="camera" size={20} color="#3B82F6" style={{ marginRight: 6 }} />
                            <Text style={styles.photoAddBtnText}>{t('raise.camera')} <Text style={{color: '#EF4444'}}>*</Text></Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.photoAddBtn} onPress={pickFromGallery} disabled={cameraLoading || galleryLoading}>
                        {galleryLoading ? (
                          <ActivityIndicator size="small" color="#3B82F6" />
                        ) : (
                          <>
                            <Ionicons name="image" size={20} color="#3B82F6" style={{ marginRight: 6 }} />
                            <Text style={styles.photoAddBtnText}>{t('raise.gallery')} <Text style={{color: '#EF4444'}}>*</Text></Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <TouchableOpacity 
                  style={[styles.submitBtn, loading && { opacity: 0.6 }]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitBtnText}>{t('raise.submit')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* Sub Category Bottom Sheet Modal */}
      <Modal
        animationType="none"
        transparent={true}
        visible={showModal}
        onRequestClose={closeBottomSheet}
      >
        <TouchableOpacity 
          style={styles.bottomSheetOverlay} 
          activeOpacity={1} 
          onPress={closeBottomSheet}
        >
          <Animated.View style={[styles.bottomSheetContainer, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>{t('raise.subCategoriesTitle')}</Text>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              {selectedMainCategory?.subCategories?.map((sub: string, index: number) => {
                const localizedTitle = getLocalizedSubCategoryTitle(selectedMainCategory, sub, i18n.language) || t(`categories.${sub}`, { defaultValue: sub });
                return (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.subCategoryItem}
                    onPress={() => selectSubCategory(sub, localizedTitle)}
                  >
                    <Text style={styles.subCategoryText}>
                      {localizedTitle}
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color="#111827" />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Success Confirmation Modal */}
      <Modal animationType="fade" transparent={true} visible={successModalVisible}>
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContainer}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={40} color="#1D4ED8" />
            </View>
            <Text style={styles.successModalTitle}>Success!</Text>
            <Text style={styles.successModalText}>Your grievance has been submitted successfully.</Text>
            <TouchableOpacity 
              style={styles.doneBtn} 
              onPress={() => {
                setSuccessModalVisible(false);
                setStep(1);
                setDescription('');
                setImage(null);
                router.replace('/resident/my-complaints');
              }}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Error Confirmation Modal */}
      <Modal animationType="fade" transparent={true} visible={errorModalVisible}>
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContainer}>
            <View style={[styles.successIconCircle, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="close" size={40} color="#EF4444" />
            </View>
            <Text style={styles.successModalTitle}>Oops!</Text>
            <Text style={styles.successModalText}>{errorMessage}</Text>
            <TouchableOpacity 
              style={[styles.doneBtn, { backgroundColor: '#EF4444' }]} 
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={styles.doneBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Other Category MCG Modal */}
      <Modal animationType="fade" transparent={true} visible={otherModalVisible}>
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContainer}>
            <View style={[styles.successIconCircle, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="information-circle" size={40} color="#D97706" />
            </View>
            <Text style={[styles.successModalTitle, { fontSize: 20 }]}>Information</Text>
            <Text style={[styles.successModalText, { textAlign: 'left', marginBottom: 12 }]}>
              SLERWA is committed to addressing residents’ concerns; however, we currently do not have the necessary infrastructure to undertake this work directly.
            </Text>
            <Text style={[styles.successModalText, { textAlign: 'left', marginBottom: 28 }]}>
              Please raise the request with MCG for the required action. If the matter remains unresolved, SLERWA will take it up with the appropriate higher authorities within MCG to help ensure the work is addressed.
            </Text>
            
            <TouchableOpacity 
              style={[styles.doneBtn, { backgroundColor: '#F59E0B', marginBottom: 12 }]} 
              onPress={() => {
                setOtherModalVisible(false);
                setStep(1);
                setDescription('');
                setImage(null);
                Linking.openURL('https://www.slerwa.in/');
              }}
            >
              <Text style={styles.doneBtnText}>Proceed to MCG Website</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.doneBtn, { backgroundColor: '#F3F4F6' }]} 
              onPress={() => {
                setOtherModalVisible(false);
                setStep(1);
                setDescription('');
                setImage(null);
                router.replace('/resident/my-complaints');
              }}
            >
              <Text style={[styles.doneBtnText, { color: '#4B5563' }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Category Notice Modal */}
      <Modal animationType="fade" transparent={true} visible={showNoticeModal}>
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContainer}>
            <View style={[styles.successIconCircle, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="information-circle" size={40} color="#3B82F6" />
            </View>
            <Text style={[styles.successModalTitle, { fontSize: 18, textAlign: 'center', marginBottom: 12 }]}>
              स्ट्रीट लाइट सूचना
            </Text>
            <ScrollView style={{ maxHeight: 250, marginBottom: 16 }}>
              <Text style={[styles.successModalText, { textAlign: 'left', fontSize: 14, lineHeight: 22 }]}>
                RWA पहले भी अनुरोध कर चुकी है कि स्ट्रीट लाइट से संबंधित किसी भी समस्या के लिए कृपया MCG की साइट पर जाकर शिकायत दर्ज करें और टिकट नंबर प्राप्त करें।{'\n\n'}
                उसके बाद जब आप टिकट नंबर ग्रुप में साझा करेंगे, तो RWA MCG के माध्यम से उस समस्या को ठीक करवाने के लिए आवश्यक कार्रवाई करेगी।{'\n\n'}
                कृपया सहयोग करें और शिकायत पहले MCG में दर्ज करवाएँ। धन्यवाद।
              </Text>
            </ScrollView>
            
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, width: '100%' }}
              onPress={() => setNoticeAccepted(!noticeAccepted)}
              activeOpacity={0.7}
            >
              <Ionicons name={noticeAccepted ? "checkbox" : "square-outline"} size={24} color={noticeAccepted ? "#3B82F6" : "#94A3B8"} />
              <Text style={{ marginLeft: 10, fontSize: 15, color: '#1E293B', flex: 1 }}>मैंने पढ़ लिया है और सहमत हूँ</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 12 }}>
              <TouchableOpacity 
                style={[styles.doneBtn, { backgroundColor: '#F1F5F9', flex: 1 }]} 
                onPress={() => setShowNoticeModal(false)}
              >
                <Text style={[styles.doneBtnText, { color: '#64748B' }]}>रद्द करें</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.doneBtn, { backgroundColor: noticeAccepted ? '#3B82F6' : '#94A3B8', flex: 1 }]} 
                disabled={!noticeAccepted}
                onPress={() => {
                  setShowNoticeModal(false);
                  if (pendingSubCategory) {
                    proceedToStep2(pendingSubCategory.catTitle, pendingSubCategory.subCatTitle);
                  }
                }}
              >
                <Text style={styles.doneBtnText}>आगे बढ़ें</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  headerBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 24) : 20, 
    paddingBottom: 14, 
    backgroundColor: '#1D4ED8',
    elevation: 4,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 1,
  },
  backButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', flex: 1 },
  iconBtn: { padding: 4 },
  
  container: { paddingHorizontal: 16, paddingTop: 16, flex: 1 },
  categoryCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 12, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.04, 
    shadowRadius: 8, 
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  iconWrapper: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  categoryInfo: { flex: 1, justifyContent: 'center' },
  categoryTitle: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2, marginBottom: 4 },
  subCategoryCount: { fontSize: 13, color: '#64748B', fontWeight: '500' },

  bottomSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  bottomSheetContainer: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 30, maxHeight: '80%' },
  bottomSheetHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  bottomSheetTitle: { fontSize: 18, fontWeight: '700', color: '#1D4ED8' },
  subCategoryItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  subCategoryText: { fontSize: 15, color: '#1E293B', fontWeight: '500', flex: 1, paddingRight: 16 },

  formContainer: { flex: 1, padding: 16 },
  formSection: { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9' },
  formSectionHeader: { backgroundColor: '#1E3A8A', padding: 16 },
  formSectionTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  formSectionContent: { padding: 16, backgroundColor: '#FFFFFF' },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 16 },
  readOnlyInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 14 },
  readOnlyText: { fontSize: 15, color: '#1E293B', fontWeight: '600' },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 14, height: 48, fontSize: 15, color: '#1E293B' },
  textArea: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 14, fontSize: 15, color: '#1E293B', minHeight: 120, textAlignVertical: 'top' },
  charCount: { textAlign: 'right', fontSize: 12, color: '#94A3B8', marginTop: 4 },
  
  photosContainer: { marginTop: 4, marginBottom: 24 },
  photoAddBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#93C5FD', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16 },
  photoAddBtnText: { color: '#2563EB', fontSize: 14, fontWeight: '700' },
  imagePreviewContainer: { position: 'relative', width: 80, height: 80 },
  previewImage: { width: 80, height: 80, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  removeImageBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: '#EF4444', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  
  submitBtn: { backgroundColor: '#2563EB', borderRadius: 14, height: 50, justifyContent: 'center', alignItems: 'center', marginTop: 16, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  
  successModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  successModalContainer: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  successIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successModalTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 },
  successModalText: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  doneBtn: { width: '100%', paddingVertical: 16, borderRadius: 16, backgroundColor: '#2563EB', alignItems: 'center' },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

