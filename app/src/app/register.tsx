import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, StatusBar, ImageBackground, TouchableWithoutFeedback, Keyboard, Image, FlatList, Dimensions, Animated, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = 'https://anytime-help.onrender.com/api';
const bgImage = require('../../assets/images/electrician-review-response-templates-featured.webp');
const { width } = Dimensions.get('window');

export default function RegisterScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [propertyTypeModalVisible, setPropertyTypeModalVisible] = useState(false);
  const propertyTypes = ['Owned', 'Rented'];
  
  const [houseNo, setHouseNo] = useState('');
  
  const [phase, setPhase] = useState('');
  const [phaseModalVisible, setPhaseModalVisible] = useState(false);
  const phasesList = ['Sushant Lok 2 Option 1', 'Sushant Lok 2 Option 2', 'Sushant Lok 3'];

  const [block, setBlock] = useState('');
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  
  const getBlockOptions = () => {
    if (phase === 'Sushant Lok 2 Option 1') return ['C, D, E'];
    if (phase === 'Sushant Lok 2 Option 2') return ['F, G'];
    if (phase === 'Sushant Lok 3') return ['A, B, B1, C, D, E, F, G, H'];
    return [];
  };

  const [relation, setRelation] = useState('');
  const [isDuplicateAddress, setIsDuplicateAddress] = useState(false);
  const [loading, setLoading] = useState(false);

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);

  const [banners, setBanners] = React.useState<any[]>([]);
  const flatListRef = React.useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [loadingBanners, setLoadingBanners] = React.useState(true);

  // Fetch Banners
  React.useEffect(() => {
    const fetchBanners = async () => {
      try {
        const res = await axios.get(`${API_URL}/banners`);
        setBanners(res.data);
      } catch (err) {
        console.error('Error fetching banners', err);
      } finally {
        setLoadingBanners(false);
      }
    };
    fetchBanners();
  }, []);

  // Auto-scroll Banners
  React.useEffect(() => {
    if (banners.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prevIndex) => {
          const nextIndex = prevIndex === banners.length - 1 ? 0 : prevIndex + 1;
          flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
          return nextIndex;
        });
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [banners]);

  const toggleLanguage = async () => {
    const newLang = i18n.language === 'en' ? 'hi' : 'en';
    await i18n.changeLanguage(newLang);
    await AsyncStorage.setItem('user-language', newLang);
  };

  const handleRegister = async () => {
    if (!name || !phoneNumber || phoneNumber.length < 10 || !propertyType || !houseNo || !phase || !block) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please fill all required fields' });
      return;
    }

    if (isDuplicateAddress && !relation) {
      Toast.show({ type: 'error', text1: 'Relation Required', text2: 'Please specify your relation to this address' });
      return;
    }

    if (!agreedToTerms) {
      Toast.show({ type: 'error', text1: 'Terms Required', text2: 'Please agree to the Terms and Conditions to register' });
      return;
    }

    setLoading(true);

    try {
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      let addressParts = [];
      if (houseNo) addressParts.push(`House/Flat: ${houseNo}`);
      if (phase) addressParts.push(phase);
      if (block) addressParts.push(`Block ${block}`);
      if (propertyType) addressParts.push(`(${propertyType})`);
      const combinedAddress = addressParts.join(', ');

      const payload: any = { 
        name, 
        phone_number: formattedPhone, 
        role: 'Resident',
        address: combinedAddress,
        property_type: propertyType,
        relation: isDuplicateAddress ? relation : propertyType,
        phase
      };

      const res = await axios.post(`${API_URL}/auth/register`, payload);
      const { token, user } = res.data;
      
      // Save token securely
      await SecureStore.setItemAsync('userToken', token);
      await SecureStore.setItemAsync('userData', JSON.stringify(user));

      Toast.show({ type: 'success', text1: 'Welcome', text2: 'Account created successfully!' });
      router.replace('/resident');
    } catch (err: any) {
      const errorCode = err.response?.data?.error_code;
      if (errorCode === 'DUPLICATE_ADDRESS') {
        setIsDuplicateAddress(true);
        Toast.show({ type: 'info', text1: 'Address Already Registered', text2: 'Please specify your relation to this address.' });
      } else {
        Toast.show({ type: 'error', text1: 'Registration Failed', text2: err.response?.data?.msg || err.message || 'Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <View style={styles.imageContainer}>
        {loadingBanners ? (
          <View style={[styles.bgImage, { backgroundColor: '#1E40AF' }]}>
            <LinearGradient
              colors={['rgba(0, 0, 0, 0.5)', 'rgba(30, 64, 175, 0.5)', 'rgba(30, 64, 175, 0.85)', '#1E40AF']}
              style={styles.gradient}
            />
          </View>
        ) : banners.length > 0 ? (
          <FlatList
            ref={flatListRef}
            data={banners}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <View style={{ width, height: '100%' }}>
                <Image source={{ uri: item.url }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={15} />
                <Image source={{ uri: item.url }} style={{ width: '100%', height: '100%', transform: [{ translateY: -30 }] }} resizeMode="contain" />
                <LinearGradient
                  colors={['rgba(0, 0, 0, 0.5)', 'rgba(30, 64, 175, 0.5)', 'rgba(30, 64, 175, 0.85)', '#1E40AF']}
                  style={[StyleSheet.absoluteFill]}
                />
              </View>
            )}
          />
        ) : (
          <ImageBackground source={bgImage} style={styles.bgImage} resizeMode="cover">
            <LinearGradient
              colors={['rgba(0, 0, 0, 0.5)', 'rgba(30, 64, 175, 0.5)', 'rgba(30, 64, 175, 0.85)', '#1E40AF']}
              style={styles.gradient}
            />
          </ImageBackground>
        )}
      </View>

      <SafeAreaView style={styles.safeArea}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.langToggleContainer}>
            <TouchableOpacity onPress={toggleLanguage} style={styles.langToggle}>
              <Ionicons name="language-outline" size={16} color="#FFF" style={{marginRight: 6}} />
              <Text style={styles.langToggleText}>{i18n.language === 'en' ? 'हिंदी' : 'EN'}</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.mainContent, isDuplicateAddress && { paddingTop: 60 }]}>
            {/* Header / Hero */}
            <View style={[styles.heroSection, isDuplicateAddress && { marginBottom: 15, marginTop: 10 }]}>
              <View style={styles.badgeContainer}>
                <Ionicons name="shield-checkmark" size={14} color="#F59E0B" />
                <Text style={styles.badgeText}>RWA APPROVED</Text>
              </View>
              <View style={[styles.iconCircle, isDuplicateAddress && { width: 90, height: 90, marginBottom: 20 }]}>
                <Image 
                  source={require('../../assets/images/logo.png')} 
                  style={{width: isDuplicateAddress ? 80 : 100, height: isDuplicateAddress ? 80 : 100, transform: [{ translateY: isDuplicateAddress ? 5 : 15 }]}} 
                  resizeMode="cover" 
                />
              </View>
              <Text style={[styles.title, isDuplicateAddress && { fontSize: 24, marginBottom: 4 }]}>{t('register.title') || 'Create Account'}</Text>
              <Text style={[styles.subtitle, isDuplicateAddress && { fontSize: 14 }]}>{t('register.subtitle') || 'Join Anytime Help Community'}</Text>
            </View>

            <View style={[styles.formCard, isDuplicateAddress && { paddingTop: 20, paddingHorizontal: 20 }]}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
              <View style={[styles.inputContainer, isDuplicateAddress && { height: 50, marginBottom: 12 }]}>
                <Ionicons name="person-outline" size={20} color="#555" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('register.fullName') || 'Full Name'}
                  placeholderTextColor="#777"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={[styles.inputContainer, isDuplicateAddress && { height: 50, marginBottom: 12 }]}>
                <Ionicons name="call-outline" size={20} color="#555" style={styles.inputIcon} />
                <Text style={{fontSize: 16, color: '#333', marginRight: 8}}>+91</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('register.phonePlaceholder') || 'Phone Number'}
                  placeholderTextColor="#777"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  editable={!isDuplicateAddress}
                />
              </View>

              {/* Property Type Dropdown */}
              <TouchableOpacity 
                style={[styles.inputContainer, isDuplicateAddress && { height: 50, marginBottom: 12 }]} 
                onPress={() => !isDuplicateAddress && setPropertyTypeModalVisible(true)}
              >
                <Ionicons name="home-outline" size={20} color="#555" style={styles.inputIcon} />
                <Text style={{ flex: 1, fontSize: 14, color: propertyType ? '#333' : '#777', alignSelf: 'center' }}>
                  {propertyType || 'Property Type (Owned/Rented)*'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#777" />
              </TouchableOpacity>

              <View style={[styles.inputContainer, isDuplicateAddress && { height: 50, marginBottom: 12 }]}>
                <Ionicons name="business-outline" size={20} color="#555" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="House / Flat No.*"
                  placeholderTextColor="#777"
                  value={houseNo}
                  onChangeText={(text) => {
                    setHouseNo(text);
                    if (isDuplicateAddress) setIsDuplicateAddress(false);
                  }}
                  editable={!isDuplicateAddress}
                />
              </View>

              {/* Phase Dropdown */}
              <TouchableOpacity 
                style={[styles.inputContainer, isDuplicateAddress && { height: 50, marginBottom: 12 }]} 
                onPress={() => !isDuplicateAddress && setPhaseModalVisible(true)}
              >
                <Ionicons name="map-outline" size={20} color="#555" style={styles.inputIcon} />
                <Text style={{ flex: 1, fontSize: 14, color: phase ? '#333' : '#777', alignSelf: 'center' }}>
                  {phase || 'Phase (Entity / Group)*'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#777" />
              </TouchableOpacity>

              {/* Block Dropdown */}
              <TouchableOpacity 
                style={[styles.inputContainer, { marginBottom: 12 }, isDuplicateAddress && { height: 45, marginBottom: 8 }]} 
                onPress={() => {
                  if (!isDuplicateAddress) {
                    if (!phase) {
                      Toast.show({ type: 'info', text1: 'Select Phase', text2: 'Please select a phase first' });
                      return;
                    }
                    setBlockModalVisible(true);
                  }
                }}
              >
                <Ionicons name="location-outline" size={20} color="#555" style={styles.inputIcon} />
                <Text style={{ flex: 1, fontSize: 14, color: block ? '#333' : '#777', alignSelf: 'center' }}>
                  {block || 'Block*'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#777" />
              </TouchableOpacity>

              {isDuplicateAddress && (
                <View style={[styles.inputContainer, { height: 50, marginBottom: 12 }]}>
                  <Ionicons name="people-outline" size={20} color="#555" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Your Relation (e.g., Tenant, Family)"
                    placeholderTextColor="#777"
                    value={relation}
                    onChangeText={setRelation}
                  />
                </View>
              )}

              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
                <TouchableOpacity onPress={() => setAgreedToTerms(!agreedToTerms)} style={{ marginRight: 8 }}>
                  <Ionicons name={agreedToTerms ? "checkbox" : "square-outline"} size={24} color={agreedToTerms ? "#1D4ED8" : "#777"} />
                </TouchableOpacity>
                <Text style={{ color: '#555', fontSize: 13, flex: 1 }}>
                  I agree to the {' '}
                  <Text style={{ color: '#1D4ED8', fontWeight: 'bold' }} onPress={() => setTermsModalVisible(true)}>
                    Terms and Conditions
                  </Text>
                </Text>
              </View>

              <TouchableOpacity 
                style={[styles.registerBtn, isDuplicateAddress && { height: 50, marginTop: 8, marginBottom: 16 }, loading && styles.registerBtnDisabled]} 
                onPress={handleRegister}
                disabled={loading}
              >
                <Text style={styles.registerBtnText}>{loading ? (t('register.creating') || 'Creating...') : (t('register.signup') || 'Sign Up')}</Text>
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={styles.footerText}>{t('register.alreadyHave') || 'Already have an account? '}</Text>
                <TouchableOpacity onPress={() => router.push('/login' as any)}>
                  <Text style={styles.footerLink}>{t('register.loginHere') || 'Log In Here'}</Text>
                </TouchableOpacity>
              </View>
              </ScrollView>
            </View>
            </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </SafeAreaView>

      {/* Property Type Modal */}
      <Modal animationType="fade" transparent={true} visible={propertyTypeModalVisible} onRequestClose={() => setPropertyTypeModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPropertyTypeModalVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Property Type</Text>
              <TouchableOpacity onPress={() => setPropertyTypeModalVisible(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
            </View>
            <FlatList
              data={propertyTypes}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.categoryOption, propertyType === item && styles.categoryOptionSelected]}
                  onPress={() => { setPropertyType(item); setPropertyTypeModalVisible(false); }}
                >
                  <Text style={[styles.categoryOptionText, propertyType === item && styles.categoryOptionTextSelected]}>{item}</Text>
                  {propertyType === item && <Ionicons name="checkmark-circle" size={20} color="#1D4ED8" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Phase Modal */}
      <Modal animationType="fade" transparent={true} visible={phaseModalVisible} onRequestClose={() => setPhaseModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPhaseModalVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Phase</Text>
              <TouchableOpacity onPress={() => setPhaseModalVisible(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
            </View>
            <FlatList
              data={phasesList}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.categoryOption, phase === item && styles.categoryOptionSelected]}
                  onPress={() => { setPhase(item); setBlock(''); setPhaseModalVisible(false); }}
                >
                  <Text style={[styles.categoryOptionText, phase === item && styles.categoryOptionTextSelected]}>{item}</Text>
                  {phase === item && <Ionicons name="checkmark-circle" size={20} color="#1D4ED8" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Block Modal */}
      <Modal animationType="fade" transparent={true} visible={blockModalVisible} onRequestClose={() => setBlockModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setBlockModalVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Block</Text>
              <TouchableOpacity onPress={() => setBlockModalVisible(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
            </View>
            <FlatList
              data={getBlockOptions()}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.categoryOption, block === item && styles.categoryOptionSelected]}
                  onPress={() => { setBlock(item); setBlockModalVisible(false); }}
                >
                  <Text style={[styles.categoryOptionText, block === item && styles.categoryOptionTextSelected]}>Block {item}</Text>
                  {block === item && <Ionicons name="checkmark-circle" size={20} color="#1D4ED8" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Terms and Conditions Modal */}
      <Modal animationType="fade" transparent={true} visible={termsModalVisible} onRequestClose={() => setTermsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Terms and Conditions</Text>
              <TouchableOpacity onPress={() => setTermsModalVisible(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
            </View>
            <ScrollView style={{ paddingRight: 8 }} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#333' }}>1. Introduction</Text>
              <Text style={{ fontSize: 14, color: '#555', marginBottom: 16, lineHeight: 20 }}>
                Welcome to Anytime Help. By registering and using our app, you agree to comply with the rules and guidelines set forth for our residential community.
              </Text>
              
              <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#333' }}>2. Account Responsibility</Text>
              <Text style={{ fontSize: 14, color: '#555', marginBottom: 16, lineHeight: 20 }}>
                You must provide accurate and complete information during registration. You are responsible for all activities that occur under your account. Do not share your login credentials with non-residents.
              </Text>

              <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#333' }}>3. Acceptable Use</Text>
              <Text style={{ fontSize: 14, color: '#555', marginBottom: 16, lineHeight: 20 }}>
                The Anytime Help platform is intended for raising valid complaints, accessing community announcements, and utilizing the directory. Abuse of the complaint system or posting inappropriate content is strictly prohibited.
              </Text>

              <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#333' }}>4. Privacy</Text>
              <Text style={{ fontSize: 14, color: '#555', marginBottom: 16, lineHeight: 20 }}>
                Your personal details (name, phone number, address) will be securely stored and used solely for community management purposes. It will not be shared with third parties without your consent.
              </Text>

              <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#333' }}>5. Modifications</Text>
              <Text style={{ fontSize: 14, color: '#555', marginBottom: 30, lineHeight: 20 }}>
                We reserve the right to modify these terms at any time. Continued use of the app constitutes acceptance of any changes.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E40AF', // Blue theme
  },
  imageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  bgImage: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 40 : 20, 
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  langToggleContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 65 : (StatusBar.currentHeight ? StatusBar.currentHeight + 15 : 45),
    right: 20,
    zIndex: 10,
  },
  langToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E40AF', // Solid blue
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3B82F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  langToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 5, 
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7', // Soft gold background
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8, // Reduced gap between badge and logo
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  badgeText: {
    color: '#D97706', // Darker gold text
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginLeft: 6,
  },
  iconCircle: {
    width: 80,
    height: 80,
    backgroundColor: '#FFFFFF',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4, 
    marginBottom: 15,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    overflow: 'hidden',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#EFF6FF',
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: '#DBEAFE', // Light blue card
    borderRadius: 30, // Rounded all corners
    padding: 20,
    paddingTop: 20,
    flex: 1,
    minHeight: 350,
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FBF9', // Almost white
    borderRadius: 30, // Changed from 12 to 30 for pill shape
    marginBottom: 10,
    paddingHorizontal: 16, // Increased padding slightly
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  eyeIcon: {
    padding: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: '#333',
    paddingVertical: 0,
  },
  registerBtn: {
    backgroundColor: '#1D4ED8', // Dark blue button
    borderRadius: 30, // Changed from 12 to 30 for pill shape
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
    marginBottom: 10,
  },
  registerBtnDisabled: {
    opacity: 0.7,
  },
  registerBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingBottom: 5,
  },
  footerText: {
    color: '#555',
    fontSize: 14,
  },
  footerLink: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: '50%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  categoryOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  categoryOptionSelected: { backgroundColor: 'rgba(29, 78, 216, 0.1)', paddingHorizontal: 12, borderRadius: 12, borderBottomWidth: 0 },
  categoryOptionText: { fontSize: 16, color: '#4B5563', fontWeight: '500' },
  categoryOptionTextSelected: { color: '#1D4ED8', fontWeight: '700' }
});
