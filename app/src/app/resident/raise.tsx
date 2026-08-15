import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, Modal, FlatList } from 'react-native';
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
      Alert.alert(t('raise.errorTitle'), t('raise.errorDesc'));
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
      
      Alert.alert(t('raise.successTitle'), t('raise.successDesc'), [
        { text: 'OK', onPress: () => router.push('/resident' as any) }
      ]);
    } catch (err: any) {
      console.error(err);
      Alert.alert(t('raise.errorTitle'), t('raise.errorSubmit'));
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

        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          
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
            <TouchableOpacity style={styles.photoAddBtn} onPress={pickImage}>
              {image ? (
                <Ionicons name="checkmark-circle" size={32} color="#10B981" />
              ) : (
                <Ionicons name="camera-outline" size={32} color="#9CA3AF" />
              )}
            </TouchableOpacity>
            <View style={styles.photoPlaceholder} />
          </View>

          <View style={styles.checkboxContainer}>
            <TouchableOpacity 
              style={[styles.checkbox, allowAI && styles.checkboxActive]}
              onPress={() => setAllowAI(!allowAI)}
            >
              {allowAI && <Ionicons name="checkmark" size={16} color="#000" />}
            </TouchableOpacity>
            <Text style={styles.checkboxLabel}>{t('raise.allowAI')}</Text>
          </View>

          <TouchableOpacity 
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitBtnText}>{loading ? t('raise.submitting') : t('raise.submit')}</Text>
          </TouchableOpacity>

          {/* Padding for bottom tabs if visible */}
          <View style={{ height: 100 }} />
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FCFDF6' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  iconBtn: { padding: 4 },
  container: { padding: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#4B5563', marginBottom: 8, marginTop: 16 },
  dropdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, height: 52 },
  dropdownText: { fontSize: 16, color: '#111827' },
  textArea: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, fontSize: 16, color: '#111827', minHeight: 120 },
  photosContainer: { flexDirection: 'row', gap: 12 },
  photoAddBtn: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  photoPlaceholder: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#F3F4F6' },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 32 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#E1F21E', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  checkboxActive: { backgroundColor: '#E1F21E' },
  checkboxLabel: { fontSize: 15, color: '#4B5563', fontWeight: '500' },
  submitBtn: { backgroundColor: '#E1F21E', borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center', shadowColor: '#E1F21E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitBtnText: { color: '#000', fontSize: 18, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  categoryOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  categoryOptionSelected: { backgroundColor: 'rgba(225, 242, 30, 0.1)', paddingHorizontal: 12, borderRadius: 12, borderBottomWidth: 0 },
  categoryOptionText: { fontSize: 16, color: '#4B5563', fontWeight: '500' },
  categoryOptionTextSelected: { color: '#111827', fontWeight: '700' }
});
