import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Modal, ActivityIndicator, Image, Animated, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

export default function StaffRaiseComplaint() {
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
  const [cameraLoading, setCameraLoading] = useState(false);
  const [galleryLoading, setGalleryLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;

  // Address State
  const [address, setAddress] = useState<string>('');

  useEffect(() => {
    const loadSavedUserData = async () => {
      try {
        const stored = await SecureStore.getItemAsync('userData');
        if (stored) {
          const u = JSON.parse(stored);
          if (Array.isArray(u.assigned_locations) && u.assigned_locations.length > 0) {
            const loc = u.assigned_locations[0];
            const blk = loc.blocks && loc.blocks.length > 0 && !loc.blocks.includes('ALL') ? ` Block ${loc.blocks[0]}` : '';
            setAddress(`${loc.phase || ''}${blk}`.trim());
          } else if (u.phase) {
            setAddress(`${u.phase}${u.block ? ', Block ' + u.block : ''}`);
          } else if (u.address) {
            setAddress(u.address);
          }
        }
      } catch (e) {
        console.log('Error loading staff address:', e);
      }
    };
    loadSavedUserData();
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
        router.navigate('/staff');
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
    proceedToStep2(mainTitle, finalSubTitle);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission Denied: Camera access is required to take a photo.');
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
      alert('Permission Denied: Photo library access is required.');
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
      setErrorMessage(t('raise.descriptionRequired', { defaultValue: 'Please provide a brief description of the grievance.' }));
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

      setSuccessModalVisible(true);
    } catch (err: any) {
      console.log('Staff submission error:', err.message);
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
              if (step === 2) setStep(1);
              else router.navigate('/staff');
            }} 
            style={styles.backButton}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {step === 1 ? t('raise.grievanceCategory', { defaultValue: 'Select Category' }) : t('raise.lodgeGrievance', { defaultValue: 'Report / Raise Issue' })}
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
                  activeOpacity={0.75}
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
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
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
                <Text style={styles.formSectionTitle}>{t('raise.grievanceLocation', { defaultValue: 'Location of Issue' })}</Text>
              </View>
              <View style={styles.formSectionContent}>
                <Text style={[styles.label, { marginTop: 0 }]}>
                  {t('raise.addressLabel') || 'Location / Address'} <Text style={{ color: '#EF4444' }}>*</Text>
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
                    numberOfLines={2}
                    textAlignVertical="top"
                  />
                  {address ? (
                    <TouchableOpacity onPress={() => setAddress('')} style={{ padding: 4 }}>
                      <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text style={styles.addressHelpText}>
                  {t('raise.addressHelp') || 'Specify the exact block, pole no., house no., or street landmark.'}
                </Text>
              </View>
            </View>

            {/* Grievance Details Section */}
            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <Text style={styles.formSectionTitle}>{t('raise.grievanceDetails', { defaultValue: 'Issue Details' })}</Text>
              </View>
              <View style={styles.formSectionContent}>
                <Text style={[styles.label, { marginTop: 0 }]}>{t('raise.grievanceCategory')}</Text>
                <View style={styles.badgeReadonly}>
                  <Text style={styles.badgeReadonlyText}>{category}</Text>
                </View>

                {subCategory ? (
                  <>
                    <Text style={styles.label}>{t('raise.subCategoriesTitle')}</Text>
                    <View style={styles.badgeReadonly}>
                      <Text style={styles.badgeReadonlyText}>{subCategory}</Text>
                    </View>
                  </>
                ) : null}

                <Text style={styles.label}>{t('raise.grievanceDetails')} <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput
                  style={styles.textArea}
                  multiline
                  numberOfLines={4}
                  placeholder={t('raise.descriptionPlaceholder', { defaultValue: 'Describe what needs to be fixed...' })}
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
                            <Text style={styles.photoAddBtnText}>{t('raise.camera')} <Text style={{ color: '#EF4444' }}>*</Text></Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.photoAddBtn} onPress={pickFromGallery} disabled={cameraLoading || galleryLoading}>
                        {galleryLoading ? (
                          <ActivityIndicator size="small" color="#3B82F6" />
                        ) : (
                          <>
                            <Ionicons name="image" size={20} color="#3B82F6" style={{ marginRight: 6 }} />
                            <Text style={styles.photoAddBtnText}>{t('raise.gallery')} <Text style={{ color: '#EF4444' }}>*</Text></Text>
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
                    <Text style={styles.subCategoryText}>{localizedTitle}</Text>
                    <Ionicons name="arrow-forward" size={20} color="#111827" />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* Success Modal */}
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
                router.replace('/staff');
              }}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal animationType="fade" transparent={true} visible={errorModalVisible}>
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContainer}>
            <View style={[styles.successIconCircle, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="alert-circle" size={40} color="#EF4444" />
            </View>
            <Text style={styles.successModalTitle}>Notice</Text>
            <Text style={styles.successModalText}>{errorMessage}</Text>
            <TouchableOpacity 
              style={[styles.doneBtn, { backgroundColor: '#EF4444' }]} 
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={styles.doneBtnText}>Okay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1D4ED8' },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#1D4ED8',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  categoryInfo: { flex: 1 },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  subCategoryCount: {
    fontSize: 13,
    color: '#64748B',
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
  },
  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  formSectionHeader: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  formSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formSectionContent: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 6,
    marginTop: 12,
  },
  addressInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 10,
    minHeight: 56,
  },
  addressInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    padding: 0,
    lineHeight: 20,
  },
  addressHelpText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  badgeReadonly: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignSelf: 'flex-start',
  },
  badgeReadonlyText: {
    color: '#1D4ED8',
    fontWeight: '600',
    fontSize: 14,
  },
  textArea: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#1E293B',
    minHeight: 90,
  },
  charCount: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 4,
  },
  photosContainer: {
    marginTop: 6,
    marginBottom: 16,
  },
  photoAddBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
  },
  photoAddBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  imagePreviewContainer: {
    position: 'relative',
    width: '100%',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  bottomSheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  subCategoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  subCategoryText: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '500',
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successModalContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  successModalText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  doneBtn: {
    width: '100%',
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
