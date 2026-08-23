import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, Modal, FlatList, StatusBar, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function RaiseComplaint() {
  const router = useRouter();
  const { t } = useTranslation();
  const [category, setCategory] = useState('Plumbing');
  const [subCategory, setSubCategory] = useState('Water Leakage');
  const [location, setLocation] = useState('Block A - 2nd Floor');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [allowAI, setAllowAI] = useState(true);
  const [loading, setLoading] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const categories = ['Plumbing', 'Electrical', 'Cleaning', 'Security', 'Maintenance', 'Pest Control', 'Others'];

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], // Strict typing for expo-image-picker
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5, // Compress for Base64
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSubmit = async () => {
    if (!description) {
      setErrorMessage(t('raise.errorDesc') || 'Please provide a description.');
      setErrorModalVisible(true);
      return;
    }

    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      // For now we mock the department ID until we wire up dynamic categories
      const mockDepartmentId = '60d5ecb8b392d700153ee123'; // Replace with real ID later

      await axios.post(
        `${API_URL}/complaints`,
        {
          title: category,
          description,
          location,
          category,
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
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('raise.title')}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="close" size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <Text style={styles.label}>{t('raise.category')}</Text>
          <TouchableOpacity 
            style={styles.dropdown}
            onPress={() => setCategoryModalVisible(true)}
          >
            <Text style={styles.dropdownText}>{category}</Text>
            <Ionicons name="chevron-down" size={20} color="#6B7280" />
          </TouchableOpacity>

          <Text style={styles.label}>{t('raise.location')}</Text>
          <TextInput
            style={[styles.textArea, { minHeight: 52, padding: 12 }]}
            placeholder={t('raise.locationPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={location}
            onChangeText={setLocation}
          />

          <Text style={styles.label}>{t('raise.description')}</Text>
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
              <TouchableOpacity style={styles.photoAddBtn} onPress={pickImage}>
                <Ionicons name="camera-outline" size={32} color="#9CA3AF" />
              </TouchableOpacity>
            )}
            {!image && <View style={styles.photoPlaceholder} />}
          </View>

          <TouchableOpacity 
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.submitBtnText}>Submitting...</Text>
              </View>
            ) : (
              <Text style={styles.submitBtnText}>Submit Complaint</Text>
            )}
          </TouchableOpacity>


        </ScrollView>
      </KeyboardAvoidingView>

      {/* Category Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={categoryModalVisible}
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setCategoryModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={categories}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[
                    styles.categoryOption,
                    category === item && styles.categoryOptionSelected
                  ]}
                  onPress={() => {
                    setCategory(item);
                    setCategoryModalVisible(false);
                  }}
                >
                  <Text style={[
                    styles.categoryOptionText,
                    category === item && styles.categoryOptionTextSelected
                  ]}>{item}</Text>
                  {category === item && (
                    <Ionicons name="checkmark-circle" size={20} color="#000" />
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Success Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={successModalVisible}
      >
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContainer}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={40} color="#10B981" />
            </View>
            <Text style={styles.successModalTitle}>Success!</Text>
            <Text style={styles.successModalText}>Your complaint has been submitted successfully. We will look into it shortly.</Text>
            <TouchableOpacity 
              style={styles.doneBtn} 
              onPress={() => {
                setSuccessModalVisible(false);
                setCategory('Plumbing');
                setLocation('');
                setDescription('');
                setImage(null);
                setAllowAI(true);
                router.push({ pathname: '/resident', params: { tab: 'Complaints' } } as any);
              }}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Error Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={errorModalVisible}
        onRequestClose={() => setErrorModalVisible(false)}
      >
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
  safeArea: { flex: 1, backgroundColor: '#FCFDF6' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 20 : 50) : 60, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  iconBtn: { padding: 4 },
  scrollContent: { padding: 20, paddingBottom: 150 },
  label: { fontSize: 14, fontWeight: '600', color: '#4B5563', marginBottom: 8, marginTop: 16 },
  dropdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, height: 52 },
  dropdownText: { fontSize: 16, color: '#111827' },
  textArea: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, fontSize: 16, color: '#111827', minHeight: 120 },
  photosContainer: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 24 },
  photoAddBtn: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  photoPlaceholder: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#F3F4F6' },
  imagePreviewContainer: { position: 'relative', width: 80, height: 80 },
  previewImage: { width: 80, height: 80, borderRadius: 12 },
  removeImageBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: '#EF4444', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  submitBtn: { backgroundColor: '#1D4ED8', borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center', shadowColor: '#1D4ED8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  
  // Custom Success Modal Styles
  successModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  successModalContainer: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  successIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successModalTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 },
  successModalText: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  doneBtn: { width: '100%', paddingVertical: 16, borderRadius: 16, backgroundColor: '#1D4ED8', alignItems: 'center' },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  categoryOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  categoryOptionSelected: { backgroundColor: 'rgba(225, 242, 30, 0.1)', paddingHorizontal: 12, borderRadius: 12, borderBottomWidth: 0 },
  categoryOptionText: { fontSize: 16, color: '#4B5563', fontWeight: '500' },
  categoryOptionTextSelected: { color: '#111827', fontWeight: '700' }
});
