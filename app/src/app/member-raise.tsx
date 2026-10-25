import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, Modal, ActivityIndicator, Image, Animated, BackHandler, Linking, StatusBar as RNStatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { getLocalizedCategoryTitle, getLocalizedSubCategoryTitle } from '../utils/localization';
import { io } from 'socket.io-client';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function MemberRaiseComplaint() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  
  const [categoriesData, setCategoriesData] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [step, setStep] = useState(1); // 1 = Categories, 2 = Form Details
  const [selectedMainCategory, setSelectedMainCategory] = useState<any>(null);
  
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
  const slideAnim = useRef(new Animated.Value(400)).current;

  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeAccepted, setNoticeAccepted] = useState(false);
  const [pendingSubCategory, setPendingSubCategory] = useState<any>(null);

  // Address State
  const [address, setAddress] = useState<string>('');

  useEffect(() => {
    const loadSavedAddress = async () => {
      try {
        const stored = await SecureStore.getItemAsync('userData');
        if (stored) {
          const u = JSON.parse(stored);
          if (u.address) {
            setAddress(u.address);
          } else if (u.phase) {
            setAddress(`${u.phase}${u.block ? ', Block ' + u.block : ''}${u.house_no ? ', House ' + u.house_no : ''}`);
          }
        }
      } catch (e) {
        console.log('Error loading user address:', e);
      }
    };
    loadSavedAddress();
  }, []);

  const stepRef = useRef(step);
  stepRef.current = step;

  useFocusEffect(
    useCallback(() => {
      fetchCategories();

      const onBackPress = () => {
        if (stepRef.current === 2) {
          setStep(1);
          return true;
        }
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/member' as any);
        }
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [])
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
    if (!cat.subCategories || cat.subCategories.length === 0) {
      proceedToStep2(cat.title, '');
      return;
    }
    slideAnim.setValue(400);
    setShowModal(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
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

  const proceedToStep2 = (catTitle: string, subCatTitle: string) => {
    setCategory(catTitle);
    setSubCategory(subCatTitle);
    setShowModal(false);
    slideAnim.setValue(400);
    setStep(2);
  };

  const selectSubCategory = (sub: string, localizedTitle?: string) => {
    const mainTitle = selectedMainCategory?.title;
    const finalSubTitle = localizedTitle || sub;

    if (mainTitle === 'Street light') {
      setPendingSubCategory({ catTitle: mainTitle, subCatTitle: finalSubTitle });
      setNoticeAccepted(false);
      setShowModal(false);
      slideAnim.setValue(400);
      setTimeout(() => {
        setShowNoticeModal(true);
      }, 100);
      return;
    }

    proceedToStep2(mainTitle, finalSubTitle);
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
    if (!address || !address.trim()) {
      setErrorMessage(t('raise.addressRequired') || 'Please enter the location or address of the grievance.');
      setErrorModalVisible(true);
      return;
    }

    if (!image) {
      setErrorMessage('Please provide a photo of the issue.');
      setErrorModalVisible(true);
      return;
    }

    if (!description || description.trim().length < 5) {
      setErrorMessage(t('raise.descriptionRequired', { defaultValue: 'Please provide a brief description of the issue.' }));
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
          description: description.trim(),
          location: address.trim(),
          address: address.trim(),
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
      const msg = err.response?.data?.msg || err.response?.data?.message;
      
      if (errorCode === 'DUPLICATE_GROUPED' || errorCode === 'DUPLICATE_EXISTS') {
        setErrorMessage(msg);
      } else {
        setErrorMessage(msg || t('raise.errorSubmit') || 'Could not submit complaint. Please try again.');
      }
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <StatusBar style="light" />

        {/* Header */}
        <View style={styles.headerBar}>
          <TouchableOpacity 
            onPress={() => {
              if (step === 2) {
                setStep(1);
              } else {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/member' as any);
                }
              }
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
            {/* Address / Location Section */}
            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <Text style={styles.formSectionTitle}>{t('raise.grievanceLocation')}</Text>
              </View>
              <View style={styles.formSectionContent}>
                <Text style={[styles.label, { marginTop: 0 }]}>
                  {t('raise.addressLabel') || 'Address / Location'} <Text style={{ color: '#EF4444' }}>*</Text>
                </Text>
                <View style={styles.addressInputContainer}>
                  <Ionicons name="location-sharp" size={20} color="#3B82F6" style={{ marginTop: 2, marginRight: 8 }} />
                  <TextInput
                    style={styles.addressInput}
                    placeholder={t('raise.addressPlaceholder') || 'Enter house/flat no., block, street or landmark'}
                    placeholderTextColor="#9CA3AF"
                    value={address}
                    onChangeText={setAddress}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                  {address ? (
                    <TouchableOpacity onPress={() => setAddress('')} style={{ padding: 4 }}>
                      <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text style={styles.addressHelpText}>
                  {t('raise.addressHelp') || 'Please specify the exact house/flat no., tower, block or street.'}
                </Text>
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

                <Text style={styles.label}>{t('raise.grievanceDetails')} <Text style={{color: '#EF4444'}}>*</Text></Text>
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
        animationType="fade"
        transparent={true}
        visible={showModal}
        onRequestClose={closeBottomSheet}
      >
        <View style={styles.bottomSheetOverlay}>
          <TouchableOpacity 
            style={{ flex: 1 }} 
            activeOpacity={1} 
            onPress={closeBottomSheet} 
          />
          <Animated.View style={[styles.bottomSheetContainer, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>{t('raise.subCategoriesTitle')}</Text>
              <TouchableOpacity onPress={closeBottomSheet} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }} keyboardShouldPersistTaps="always" bounces={false}>
              {selectedMainCategory?.subCategories?.map((sub: string, index: number) => {
                const localizedTitle = getLocalizedSubCategoryTitle(selectedMainCategory, sub, i18n.language) || t(`categories.${sub}`, { defaultValue: sub });
                return (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.subCategoryItem}
                    activeOpacity={0.6}
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
        </View>
      </Modal>

      {/* Success Confirmation Modal */}
      <Modal animationType="fade" transparent={true} visible={successModalVisible}>
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContainer}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={40} color="#0F172A" />
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
                router.replace({ pathname: '/member/my-complaints', params: { view: 'mine' } } as any);
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
              Please raise the request with {category?.toLowerCase().includes('electricity') ? 'DHBVN' : 'MCG'} for the required action. If the matter remains unresolved, SLERWA will take it up with the appropriate higher authorities within {category?.toLowerCase().includes('electricity') ? 'DHBVN' : 'MCG'} to help ensure the work is addressed.
            </Text>
            
            <TouchableOpacity 
              style={[styles.doneBtn, { backgroundColor: '#F59E0B', marginBottom: 12 }]} 
              onPress={() => {
                setOtherModalVisible(false);
                setStep(1);
                setDescription('');
                setImage(null);
                Linking.openURL(category?.toLowerCase().includes('electricity') ? 'https://www.dhbvn.org.in/web/portal/home' : 'https://www.slerwa.in/');
              }}
            >
              <Text style={styles.doneBtnText}>Proceed to {category?.toLowerCase().includes('electricity') ? 'DHBVN' : 'MCG'} Website</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.doneBtn, { backgroundColor: '#F3F4F6' }]} 
              onPress={() => {
                setOtherModalVisible(false);
                setStep(1);
                setDescription('');
                setImage(null);
                router.replace({ pathname: '/member/my-complaints', params: { view: 'mine' } } as any);
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
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ? RNStatusBar.currentHeight + 8 : 24) : 20, 
    paddingBottom: 14, 
    backgroundColor: '#0F172A',
    elevation: 4,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 1,
  },
  backButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', flex: 1 },
  
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
  bottomSheetContainer: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 30, maxHeight: '80%', zIndex: 10, elevation: 10 },
  bottomSheetHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bottomSheetTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  subCategoryItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  subCategoryText: { fontSize: 15, color: '#1E293B', fontWeight: '500', flex: 1, paddingRight: 16 },

  formContainer: { flex: 1, padding: 16 },
  formSection: { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9' },
  formSectionHeader: { backgroundColor: '#1E3A8A', padding: 16 },
  formSectionTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  formSectionContent: { padding: 16, backgroundColor: '#FFFFFF' },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 16 },
  addressInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    minHeight: 84,
  },
  addressInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    lineHeight: 20,
    paddingTop: 0,
    paddingBottom: 0,
    minHeight: 60,
  },
  addressHelpText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
  },
  readOnlyInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 14 },
  readOnlyText: { fontSize: 15, color: '#1E293B', fontWeight: '600' },
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
