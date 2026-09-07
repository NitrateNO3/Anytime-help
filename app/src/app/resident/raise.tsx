import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, Modal, StatusBar, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function RaiseComplaint() {
  const router = useRouter();
  const { t } = useTranslation();
  
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
  const [imageLoading, setImageLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchCategories();
    }, [])
  );

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
    setBottomSheetVisible(true);
  };

  const selectSubCategory = (sub: string) => {
    setCategory(selectedMainCategory.title);
    setSubCategory(sub);
    setBottomSheetVisible(false);
    setStep(2);
  };

  const pickImage = () => {
    Alert.alert(
      "Add Photo",
      "Choose how you want to add a photo",
      [
        {
          text: "Take Photo",
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Sorry, we need camera permissions to make this work!');
              return;
            }
            setImageLoading(true);
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
              setImageLoading(false);
            }
          }
        },
        {
          text: "Choose from Gallery",
          onPress: async () => {
            setImageLoading(true);
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
              setImageLoading(false);
            }
          }
        },
        { text: "Cancel", style: "cancel" }
      ]
    );
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
          location: 'N/A', // Location removed from UI as per request
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
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {
            if (step === 2) setStep(1);
            else router.back();
          }} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {step === 1 ? 'GRIEVANCE CATEGORY' : 'LODGE GRIEVANCE'}
          </Text>
          <View style={{ width: 28 }} />
        </View>

        {step === 1 ? (
          // STEP 1: CATEGORY SELECTION
          <ScrollView 
            style={styles.container} 
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
          >
            {loadingCategories ? (
              <ActivityIndicator size="large" color="#1D4ED8" style={{ marginTop: 40 }} />
            ) : categoriesData.length === 0 ? (
              <Text style={{ textAlign: 'center', marginTop: 40, color: '#6B7280' }}>No categories available yet.</Text>
            ) : (
              categoriesData.map((cat, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.categoryCard}
                  onPress={() => openSubCategories(cat)}
                >
                  <View style={[styles.iconWrapper, { backgroundColor: cat.bgColor || '#DBEAFE' }]}>
                    <Ionicons name={(cat.icon || 'list') as any} size={28} color={cat.color || '#3B82F6'} />
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text style={[styles.categoryTitle, { color: cat.color || '#3B82F6' }]}>{cat.title}</Text>
                    <Text style={styles.subCategoryCount}>{cat.subCategories?.length || 0} SUB-CATEGORIES</Text>
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
            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <Text style={styles.formSectionTitle}>Grievance Details</Text>
              </View>
              
              <View style={styles.formSectionContent}>
                <Text style={styles.label}>Grievance Category</Text>
                <View style={styles.readOnlyInput}>
                  <Text style={styles.readOnlyText}>{category}</Text>
                </View>

                <Text style={styles.label}>Grievance Sub Categories</Text>
                <View style={styles.readOnlyInput}>
                  <Text style={styles.readOnlyText}>{subCategory}</Text>
                </View>

                <Text style={styles.label}>Grievance Details(Min 50 Character) <Text style={{color: '#EF4444'}}>*</Text></Text>
                <TextInput
                  style={styles.textArea}
                  multiline
                  numberOfLines={4}
                  placeholder="Describe the issue in detail..."
                  placeholderTextColor="#9CA3AF"
                  value={description}
                  onChangeText={setDescription}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{description.length}/250</Text>

                <Text style={styles.label}>Grievance photo</Text>
                <View style={styles.photosContainer}>
                  {image ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image source={{ uri: image }} style={styles.previewImage} />
                      <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImage(null)}>
                        <Ionicons name="close" size={16} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.photoAddBtn} onPress={pickImage} disabled={imageLoading}>
                      {imageLoading ? (
                        <ActivityIndicator size="small" color="#3B82F6" />
                      ) : (
                        <Text style={styles.photoAddBtnText}>CLICK PHOTO <Text style={{color: '#EF4444'}}>*</Text></Text>
                      )}
                    </TouchableOpacity>
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
                    <Text style={styles.submitBtnText}>SUBMIT</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* Sub Category Bottom Sheet Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={bottomSheetVisible}
        onRequestClose={() => setBottomSheetVisible(false)}
      >
        <TouchableOpacity 
          style={styles.bottomSheetOverlay} 
          activeOpacity={1} 
          onPress={() => setBottomSheetVisible(false)}
        >
          <View style={styles.bottomSheetContainer}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Grievance Sub Categories</Text>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {selectedMainCategory?.subCategories?.map((sub: string, index: number) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.subCategoryItem}
                  onPress={() => selectSubCategory(sub)}
                >
                  <Text style={styles.subCategoryText}>{sub}</Text>
                  <Ionicons name="arrow-forward" size={20} color="#111827" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
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
                router.push({ pathname: '/resident', params: { tab: 'Complaints' } } as any);
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EFF6FF' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 30) : 40, 
    backgroundColor: '#1D4ED8',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', letterSpacing: 1 },
  iconBtn: { padding: 4 },
  
  container: { paddingHorizontal: 16, paddingTop: 16, flex: 1 },
  categoryCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFFFFF', 
    borderRadius: 8, 
    padding: 16, 
    marginBottom: 12, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 2, 
    elevation: 2 
  },
  iconWrapper: { width: 56, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  categoryInfo: { flex: 1, justifyContent: 'center' },
  categoryTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  subCategoryCount: { fontSize: 12, color: '#6B7280', fontWeight: '600' },

  bottomSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  bottomSheetContainer: { backgroundColor: '#FDFBF7', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 30 },
  bottomSheetHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  bottomSheetTitle: { fontSize: 18, fontWeight: '700', color: '#1D4ED8' },
  subCategoryItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  subCategoryText: { fontSize: 15, color: '#111827', fontWeight: '500', flex: 1, paddingRight: 16 },

  formContainer: { flex: 1, padding: 16 },
  formSection: { backgroundColor: '#FFFFFF', borderRadius: 8, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  formSectionHeader: { backgroundColor: '#1E3A8A', padding: 16 },
  formSectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  formSectionContent: { padding: 16, backgroundColor: '#FAF9F6' },
  label: { fontSize: 13, fontWeight: '600', color: '#4B5563', marginBottom: 6, marginTop: 16 },
  readOnlyInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, padding: 14 },
  readOnlyText: { fontSize: 15, color: '#111827', fontWeight: '600' },
  textArea: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, padding: 14, fontSize: 15, color: '#111827', minHeight: 120 },
  charCount: { textAlign: 'right', fontSize: 12, color: '#6B7280', marginTop: 4 },
  
  photosContainer: { marginTop: 4, marginBottom: 24 },
  photoAddBtn: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#3B82F6', borderRadius: 6, paddingVertical: 14, paddingHorizontal: 20, alignSelf: 'flex-start' },
  photoAddBtnText: { color: '#3B82F6', fontSize: 14, fontWeight: '700' },
  imagePreviewContainer: { position: 'relative', width: 80, height: 80 },
  previewImage: { width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB' },
  removeImageBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: '#EF4444', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  
  submitBtn: { backgroundColor: '#3B82F6', borderRadius: 24, height: 50, justifyContent: 'center', alignItems: 'center', marginTop: 12, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  
  successModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  successModalContainer: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  successIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successModalTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 },
  successModalText: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  doneBtn: { width: '100%', paddingVertical: 16, borderRadius: 16, backgroundColor: '#3B82F6', alignItems: 'center' },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

