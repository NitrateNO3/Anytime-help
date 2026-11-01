import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  StatusBar, 
  Keyboard, 
  Dimensions, 
  Animated, 
  BackHandler,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useNavigation, Stack } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getNextLanguage, getLanguageBadge } from '../utils/localization';
import LocationPickerModal from '../components/LocationPickerModal';

const API_URL = 'https://anytime-help.onrender.com/api';

const FocusableInput = ({ icon, label, prefix, ...props }: any) => {
  const [isFocused, setIsFocused] = useState(false);
  
  return (
    <View style={styles.inputWrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputBox, isFocused && styles.inputBoxFocused]}>
        {icon && <Ionicons name={icon} size={20} color={isFocused ? "#2563EB" : "#94A3B8"} style={styles.inputIcon} />}
        {prefix && <Text style={styles.prefixText}>{prefix}</Text>}
        <TextInput
          style={styles.input}
          placeholderTextColor="#94A3B8"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
      </View>
    </View>
  );
};

export default function RegisterScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();
  
  // Step 0: Location (Front Dropdowns: State -> City -> Area -> Pincode)
  // Step 1: Personal Details (Name, Gender, Phone)
  // Step 2: Property Details (Status, Block, House No)
  // Step 3: Family Members (Optional)
  // Step 4: Review Details & Send OTP
  // Step 5: Verify OTP & Register
  const [step, setStep] = useState(0);
  const maxStep = 5; 
  const isCompleteRef = useRef(false);

  // Location State (Front Dropdown Selection)
  const [locationHierarchy, setLocationHierarchy] = useState<any[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedPincode, setSelectedPincode] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');

  // Location Picker Modal State
  const [pickerModal, setPickerModal] = useState<{
    visible: boolean;
    type: 'state' | 'city' | 'area' | null;
    title: string;
    placeholder: string;
    options: any[];
    selectedValue: string;
    iconName: keyof typeof Ionicons.glyphMap;
  }>({
    visible: false,
    type: null,
    title: '',
    placeholder: '',
    options: [],
    selectedValue: '',
    iconName: 'location-outline'
  });

  // Personal Details State
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [gender, setGender] = useState('');
  
  // Property Details State
  const [propertyType, setPropertyType] = useState('Owned');
  const [phase, setPhase] = useState('');
  const [block, setBlock] = useState('C');
  const [customBlock, setCustomBlock] = useState('');
  const [houseNo, setHouseNo] = useState('');
  
  // Family Members State
  const [addFamily, setAddFamily] = useState(false);
  const [familyRelation, setFamilyRelation] = useState('');
  const [customRelation, setCustomRelation] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [familyPhone, setFamilyPhone] = useState('');

  // Review & OTP State
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isDuplicateAddress, setIsDuplicateAddress] = useState(false);
  const [relation, setRelation] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [timer, setTimer] = useState(0);

  // Constants
  const propertyTypes = ['Owned', 'Rented'];

  const getBlockOptions = () => {
    const areaLower = (selectedArea || phase).toLowerCase();
    if (areaLower.includes('sushant lok 2')) return ['C', 'D', 'E', 'F', 'G'];
    if (areaLower.includes('sushant lok 3')) return ['A', 'B', 'B1', 'C', 'D', 'E', 'F', 'G', 'H'];
    return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'Other'];
  };

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Fetch Location Hierarchy from Backend
  useEffect(() => {
    const fetchLocations = async () => {
      setLoadingLocations(true);
      try {
        const res = await axios.get(`${API_URL}/locations/hierarchy`);
        if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
          setLocationHierarchy(res.data.data);
        } else {
          // If admin hasn't added locations or empty DB, provide default fallback
          setLocationHierarchy([
            {
              state: 'Haryana',
              cities: [
                {
                  city: 'Gurugram',
                  areas: [
                    { _id: 'sl2', area: 'Sushant Lok 2', pincode: '122002' },
                    { _id: 'sl3', area: 'Sushant Lok 3', pincode: '122003' }
                  ]
                }
              ]
            }
          ]);
        }
      } catch (err) {
        // Fallback default hierarchy
        setLocationHierarchy([
          {
            state: 'Haryana',
            cities: [
              {
                city: 'Gurugram',
                areas: [
                  { _id: 'sl2', area: 'Sushant Lok 2', pincode: '122002' },
                  { _id: 'sl3', area: 'Sushant Lok 3', pincode: '122003' }
                ]
              }
            ]
          }
        ]);
      } finally {
        setLoadingLocations(false);
      }
    };

    fetchLocations();
  }, []);

  // Compute Options for Dropdowns
  const stateOptions = useMemo(() => {
    return locationHierarchy.map(item => ({
      label: item.state,
      value: item.state,
      sublabel: `${item.cities?.length || 0} Cities available`
    }));
  }, [locationHierarchy]);

  const cityOptions = useMemo(() => {
    if (!selectedState) return [];
    const stateObj = locationHierarchy.find(
      s => s.state?.toLowerCase() === selectedState.toLowerCase()
    );
    if (!stateObj || !Array.isArray(stateObj.cities)) return [];
    return stateObj.cities.map((c: any) => ({
      label: c.city,
      value: c.city,
      sublabel: `${c.areas?.length || 0} Areas / Communities`
    }));
  }, [locationHierarchy, selectedState]);

  const areaOptions = useMemo(() => {
    if (!selectedState || !selectedCity) return [];
    const stateObj = locationHierarchy.find(
      s => s.state?.toLowerCase() === selectedState.toLowerCase()
    );
    if (!stateObj || !Array.isArray(stateObj.cities)) return [];
    const cityObj = stateObj.cities.find(
      (c: any) => c.city?.toLowerCase() === selectedCity.toLowerCase()
    );
    if (!cityObj || !Array.isArray(cityObj.areas)) return [];
    return cityObj.areas.map((a: any) => ({
      label: a.area,
      value: a.area,
      sublabel: a.pincode ? `Pincode: ${a.pincode}` : undefined,
      extra: a
    }));
  }, [locationHierarchy, selectedState, selectedCity]);

  // Persist & Load Draft
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draft = await AsyncStorage.getItem('register_draft');
        if (draft) {
          const parsed = JSON.parse(draft);
          if (parsed.selectedState) setSelectedState(parsed.selectedState);
          if (parsed.selectedCity) setSelectedCity(parsed.selectedCity);
          if (parsed.selectedArea) setSelectedArea(parsed.selectedArea);
          if (parsed.selectedPincode) setSelectedPincode(parsed.selectedPincode);
          if (parsed.selectedLocationId) setSelectedLocationId(parsed.selectedLocationId);
          if (parsed.name) setName(parsed.name);
          if (parsed.phoneNumber) setPhoneNumber(parsed.phoneNumber);
          if (parsed.gender) setGender(parsed.gender);
          if (parsed.propertyType) setPropertyType(parsed.propertyType);
          if (parsed.phase) setPhase(parsed.phase);
          if (parsed.block) setBlock(parsed.block);
          if (parsed.houseNo) setHouseNo(parsed.houseNo);
        }
      } catch (e) {}
    };
    loadDraft();
  }, []);

  useEffect(() => {
    const saveDraft = async () => {
      const draft = { 
        selectedState,
        selectedCity,
        selectedArea,
        selectedPincode,
        selectedLocationId,
        name, 
        phoneNumber, 
        gender, 
        propertyType, 
        phase: phase || selectedArea, 
        block, 
        houseNo 
      };
      await AsyncStorage.setItem('register_draft', JSON.stringify(draft));
    };
    saveDraft();
  }, [selectedState, selectedCity, selectedArea, selectedPincode, selectedLocationId, name, phoneNumber, gender, propertyType, phase, block, houseNo]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: ((step + 1) / (maxStep + 1)) * 100,
      duration: 350,
      useNativeDriver: false
    }).start();
  }, [step]);

  // Step 5 OTP Countdown Timer
  useEffect(() => {
    let interval: any = null;
    if (step === 5 && timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, timer]);

  useEffect(() => {
    const backAction = () => {
      if (step > 0) {
        handleBack();
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [step]);

  useEffect(() => {
    const unsubscribe = (navigation as any).addListener('beforeRemove', (e: any) => {
      if (step > 0 && !isCompleteRef.current) {
        e.preventDefault();
        handleBack();
      }
    });
    return unsubscribe;
  }, [navigation, step]);

  const goToStep = (nextStep: number) => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: nextStep > step ? -20 : 20, duration: 150, useNativeDriver: true })
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(nextStep > step ? 20 : -20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true })
      ]).start();
    });
  };

  const openPicker = (
    type: 'state' | 'city' | 'area',
    title: string,
    placeholder: string,
    options: any[],
    selectedValue: string,
    iconName: keyof typeof Ionicons.glyphMap
  ) => {
    setPickerModal({
      visible: true,
      type,
      title,
      placeholder,
      options,
      selectedValue,
      iconName
    });
  };

  const handlePickerSelect = (option: any) => {
    if (pickerModal.type === 'state') {
      setSelectedState(option.value);
      setSelectedCity('');
      setSelectedArea('');
      setSelectedPincode('');
      setSelectedLocationId('');
    } else if (pickerModal.type === 'city') {
      setSelectedCity(option.value);
      setSelectedArea('');
      setSelectedPincode('');
      setSelectedLocationId('');
    } else if (pickerModal.type === 'area') {
      setSelectedArea(option.value);
      setPhase(option.value);
      if (option.extra?.pincode) {
        setSelectedPincode(option.extra.pincode);
      }
      if (option.extra?._id) {
        setSelectedLocationId(option.extra._id);
      }
    }
  };

  const handleSendRegisterOTP = async (isResend = false) => {
    if (!agreedToTerms) {
      Toast.show({ type: 'error', text1: 'Terms Required', text2: 'Please agree to the terms to continue' });
      return;
    }

    if (isDuplicateAddress && !relation) {
      Toast.show({ type: 'error', text1: 'Relation Required', text2: 'Please specify your relation' });
      return;
    }

    setLoading(true);
    try {
      const activeBlock = block === 'Other' && customBlock ? customBlock : block;
      let addressParts = [];
      if (houseNo) addressParts.push(`House/Flat: ${houseNo}`);
      if (activeBlock) addressParts.push(`Block ${activeBlock}`);
      if (selectedArea || phase) addressParts.push(selectedArea || phase);
      if (selectedCity) addressParts.push(selectedCity);
      if (selectedState) addressParts.push(selectedState);
      if (selectedPincode) addressParts.push(selectedPincode);
      if (propertyType) addressParts.push(`(${propertyType})`);
      const combinedAddress = addressParts.join(', ');

      const res = await axios.post(`${API_URL}/auth/send-otp`, {
        phone_number: phoneNumber,
        type: 'register',
        role: 'Resident',
        address: combinedAddress,
        relation: isDuplicateAddress ? relation : propertyType
      });

      setTimer(60);
      if (!isResend) {
        goToStep(5);
      }
      Toast.show({
        type: 'success',
        text1: 'OTP Sent',
        text2: res.data.msg || `Verification code sent to +91 ${phoneNumber}`
      });
      if (res.data.dev_otp) {
        setVerificationCode(res.data.dev_otp);
      }
    } catch (err: any) {
      const errorCode = err.response?.data?.error_code;
      if (errorCode === 'DUPLICATE_ADDRESS') {
        setIsDuplicateAddress(true);
        Toast.show({ type: 'info', text1: 'Address Taken', text2: 'Someone is already registered here. Please specify your relation.' });
      } else {
        Toast.show({ type: 'error', text1: 'Failed to send OTP', text2: err.response?.data?.msg || err.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (step === 0) {
      // Step 0: Front Location Selection
      if (!selectedState || !selectedCity || !selectedArea) {
        Toast.show({ 
          type: 'error', 
          text1: 'Location Required', 
          text2: t('register.locationRequired') || 'Please select your State, City, and Area to proceed' 
        });
        return;
      }
      setPhase(selectedArea);
    } else if (step === 1) {
      // Step 1: Personal Details
      if (!name.trim() || !phoneNumber || phoneNumber.length < 10 || !gender) {
        Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter all personal details' });
        return;
      }
    } else if (step === 2) {
      // Step 2: Property Details
      const activeBlock = block === 'Other' && customBlock ? customBlock : block;
      if (!propertyType || !activeBlock || !houseNo.trim()) {
        Toast.show({ type: 'error', text1: 'Missing Details', text2: 'Please complete all property details' });
        return;
      }
    } else if (step === 3) {
      // Step 3: Family Members
      if (addFamily) {
        if (!familyRelation || !familyName || !familyPhone || familyPhone.length < 10 || (familyRelation === 'Other' && !customRelation)) {
          Toast.show({ type: 'error', text1: 'Missing Details', text2: 'Please fill in family details correctly' });
          return;
        }
        if (familyPhone.replace(/^\+91/, '').trim() === phoneNumber.replace(/^\+91/, '').trim()) {
          Toast.show({ type: 'error', text1: 'Invalid Phone Number', text2: 'Family member phone cannot be the same as your phone number' });
          return;
        }
      }
    } else if (step === 4) {
      // Step 4: Review & Terms -> trigger OTP send
      handleSendRegisterOTP();
      return;
    }
    
    if (step < maxStep) goToStep(step + 1);
  };

  const handleBack = () => {
    if (step === 0) {
      router.replace('/login' as any);
    } else {
      goToStep(step - 1);
    }
  };

  const handleRegister = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter a valid 6-digit OTP' });
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      const activeBlock = block === 'Other' && customBlock ? customBlock : block;
      
      let addressParts = [];
      if (houseNo) addressParts.push(`House/Flat: ${houseNo}`);
      if (activeBlock) addressParts.push(`Block ${activeBlock}`);
      if (selectedArea) addressParts.push(selectedArea);
      if (selectedCity) addressParts.push(selectedCity);
      if (selectedState) addressParts.push(selectedState);
      if (selectedPincode) addressParts.push(selectedPincode);
      if (propertyType) addressParts.push(`(${propertyType})`);
      const combinedAddress = addressParts.join(', ');

      const family_members = [];
      if (addFamily && familyRelation && familyName && familyPhone) {
        family_members.push({
          relation: familyRelation === 'Other' ? customRelation : familyRelation,
          name: familyName,
          phone_number: familyPhone.startsWith('+') ? familyPhone : `+91${familyPhone}`
        });
      }

      const payload: any = { 
        name, 
        phone_number: formattedPhone, 
        otp: verificationCode.trim(),
        role: 'Resident',
        address: combinedAddress,
        property_type: propertyType,
        relation: isDuplicateAddress ? relation : propertyType,
        phase: selectedArea || phase,
        block: activeBlock,
        house_no: houseNo,
        state: selectedState,
        city: selectedCity,
        area: selectedArea,
        pincode: selectedPincode,
        location_id: selectedLocationId || undefined,
        family_members, 
        gender 
      };

      const res = await axios.post(`${API_URL}/auth/register`, payload);
      
      // CRITICAL: Clear tokens and draft
      await SecureStore.deleteItemAsync('userToken').catch(() => {});
      await SecureStore.deleteItemAsync('userData').catch(() => {});
      await AsyncStorage.removeItem('register_draft'); 

      isCompleteRef.current = true;
      Toast.show({ 
        type: 'success', 
        text1: 'Registration Successful', 
        text2: res.data.msg || (t('register.regSuccessMsg') || 'Account created! Please login.') 
      });

      // Redirect user to login with prefilled phone number
      router.replace({ 
        pathname: '/login' as any, 
        params: { prefillPhone: phoneNumber, registered: '1' } 
      });
    } catch (err: any) {
      const errorCode = err.response?.data?.error_code;
      if (errorCode === 'DUPLICATE_ADDRESS') {
        setIsDuplicateAddress(true);
        goToStep(4);
        Toast.show({ type: 'info', text1: 'Address Taken', text2: 'Someone is already registered here. Please specify your relation.' });
      } else {
        Toast.show({ 
          type: 'error', 
          text1: 'Registration Failed', 
          text2: err.response?.data?.msg || err.message || 'Invalid OTP. Please try again.' 
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguage = async () => {
    const newLang = getNextLanguage(i18n.language);
    await i18n.changeLanguage(newLang);
    await AsyncStorage.setItem('user-language', newLang);
  };

  // ================= STEP RENDERS =================

  // STEP 0: Front Location Selection (State, City, Area, Pincode)
  const renderStep0 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.frontLocationHeader}>
        <View style={styles.locationIconWrap}>
          <Ionicons name="location" size={28} color="#2563EB" />
        </View>
        <Text style={styles.stepTitle}>
          {t('register.selectLocationTitle') || 'Select Your Area & City'}
        </Text>
        <Text style={styles.stepSubtitle}>
          {t('register.selectLocationSub') || 'Choose your state, city, and area before filling registration details.'}
        </Text>
      </View>

      {loadingLocations ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={{ marginTop: 12, color: '#64748B', fontSize: 14 }}>Loading areas & cities...</Text>
        </View>
      ) : (
        <View style={{ marginTop: 8 }}>
          {/* 1. STATE DROPDOWN */}
          <Text style={styles.label}>{t('register.stateLabel') || '1. State'}</Text>
          <TouchableOpacity
            style={styles.dropdownBtn}
            onPress={() => openPicker(
              'state', 
              t('register.selectState') || 'Select State',
              'Search state...',
              stateOptions, 
              selectedState, 
              'earth-outline'
            )}
            activeOpacity={0.8}
          >
            <View style={styles.dropdownLeft}>
              <Ionicons name="earth-outline" size={20} color={selectedState ? "#2563EB" : "#94A3B8"} style={styles.dropdownIcon} />
              <Text style={[styles.dropdownValue, !selectedState && styles.dropdownPlaceholder]}>
                {selectedState || (t('register.selectState') || 'Select State')}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color="#94A3B8" />
          </TouchableOpacity>

          {/* 2. CITY DROPDOWN */}
          <Text style={styles.label}>{t('register.cityLabel') || '2. City'}</Text>
          <TouchableOpacity
            style={[styles.dropdownBtn, !selectedState && styles.dropdownDisabled]}
            disabled={!selectedState}
            onPress={() => openPicker(
              'city', 
              t('register.selectCity') || 'Select City',
              'Search city...',
              cityOptions, 
              selectedCity, 
              'business-outline'
            )}
            activeOpacity={0.8}
          >
            <View style={styles.dropdownLeft}>
              <Ionicons name="business-outline" size={20} color={selectedCity ? "#2563EB" : "#94A3B8"} style={styles.dropdownIcon} />
              <Text style={[styles.dropdownValue, !selectedCity && styles.dropdownPlaceholder]}>
                {selectedCity || (!selectedState ? 'Choose State First' : (t('register.selectCity') || 'Select City'))}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color="#94A3B8" />
          </TouchableOpacity>

          {/* 3. AREA / SOCIETY DROPDOWN */}
          <Text style={styles.label}>{t('register.areaLabel') || '3. Area / Society'}</Text>
          <TouchableOpacity
            style={[styles.dropdownBtn, !selectedCity && styles.dropdownDisabled]}
            disabled={!selectedCity}
            onPress={() => openPicker(
              'area', 
              t('register.selectArea') || 'Select Area / Society',
              'Search area / society...',
              areaOptions, 
              selectedArea, 
              'location-outline'
            )}
            activeOpacity={0.8}
          >
            <View style={styles.dropdownLeft}>
              <Ionicons name="location-outline" size={20} color={selectedArea ? "#2563EB" : "#94A3B8"} style={styles.dropdownIcon} />
              <Text style={[styles.dropdownValue, !selectedArea && styles.dropdownPlaceholder]}>
                {selectedArea || (!selectedCity ? 'Choose City First' : (t('register.selectArea') || 'Select Area / Society'))}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color="#94A3B8" />
          </TouchableOpacity>

          {/* 4. PINCODE DISPLAY */}
          {selectedArea && selectedPincode ? (
            <View style={styles.pincodeCard}>
              <View style={styles.pincodeIconCircle}>
                <Ionicons name="mail-outline" size={18} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pincodeTitle}>
                  {t('register.pincodeLabel') || 'Postal Pincode'}
                </Text>
                <Text style={styles.pincodeNumber}>{selectedPincode}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
            </View>
          ) : null}

          {/* Location Selected Confirmation Banner */}
          {selectedState && selectedCity && selectedArea ? (
            <View style={styles.selectedBanner}>
              <Ionicons name="checkmark-done-circle" size={22} color="#16A34A" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedBannerTitle}>Community Selected</Text>
                <Text style={styles.selectedBannerText}>
                  {selectedArea}, {selectedCity}, {selectedState} {selectedPincode ? `(${selectedPincode})` : ''}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );

  // STEP 1: Personal Details
  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      {/* Location Badge Pill at top of step 1 so user can change if needed */}
      {selectedArea ? (
        <View style={styles.locationPill}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Ionicons name="location" size={16} color="#2563EB" style={{ marginRight: 6 }} />
            <Text style={styles.locationPillText} numberOfLines={1}>
              {selectedArea}, {selectedCity} {selectedPincode ? `(${selectedPincode})` : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={() => goToStep(0)}>
            <Text style={styles.locationPillChange}>{t('register.changeLocation') || 'Change'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Text style={styles.stepTitle}>Create Account</Text>
      <Text style={styles.stepSubtitle}>Enter your personal details to get started.</Text>
      
      <FocusableInput 
        label={t('register.fullName')}
        icon="person-outline"
        placeholder="e.g. John Doe"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />

      <Text style={styles.label}>{t('register.genderLabel')}</Text>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
        {['Male', 'Female'].map((gen) => (
          <TouchableOpacity
            key={gen}
            activeOpacity={0.7}
            style={[styles.smallChip, { flex: 1, alignItems: 'center' }, gender === gen && styles.smallChipActive]}
            onPress={() => setGender(gen)}
          >
            <Text style={[styles.smallChipText, gender === gen && styles.smallChipTextActive]}>
              {t('register.' + gen.toLowerCase()) || gen}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FocusableInput 
        label={t('register.phonePlaceholder').replace(' (+91)', '')}
        icon="call-outline"
        prefix="+91"
        placeholder="9876543210"
        keyboardType="phone-pad"
        maxLength={10}
        value={phoneNumber}
        onChangeText={setPhoneNumber}
      />
    </View>
  );

  // STEP 2: Property Details
  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Property Details</Text>
      <Text style={styles.stepSubtitle}>Where is your property located?</Text>

      {/* Selected Area Header */}
      <View style={styles.areaDisplayCard}>
        <Ionicons name="business" size={20} color="#2563EB" />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>Selected Area</Text>
          <Text style={{ fontSize: 15, color: '#0F172A', fontWeight: '700' }}>{selectedArea || phase || 'Anytime Help Area'}</Text>
        </View>
      </View>
      
      <Text style={styles.label}>Property Status</Text>
      <View style={styles.chipsContainer}>
        {propertyTypes.map((type) => (
          <TouchableOpacity 
            key={type}
            activeOpacity={0.8}
            style={[styles.chip, propertyType === type && styles.chipActive]}
            onPress={() => setPropertyType(type)}
          >
            <Ionicons name={type === 'Owned' ? 'home-outline' : 'key-outline'} size={24} color={propertyType === type ? '#2563EB' : '#64748B'} />
            <Text style={[styles.chipText, propertyType === type && styles.chipTextActive]}>{t('register.' + type.toLowerCase()) || type}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>{t('register.selectBlock') || 'Select Block'}</Text>
      <View style={styles.gridContainer}>
        {getBlockOptions().map((b) => (
          <TouchableOpacity 
            key={b}
            activeOpacity={0.7}
            style={[styles.gridItem, block === b && styles.gridItemActive]}
            onPress={() => setBlock(b)}
          >
            <Text style={[styles.gridItemText, block === b && styles.gridItemTextActive]}>
              {b === 'Other' ? 'Other' : `Block ${b}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {block === 'Other' && (
        <FocusableInput 
          label="Enter Custom Block / Wing"
          icon="cube-outline"
          placeholder="e.g. Tower 2, Wing B, Block Z"
          value={customBlock}
          onChangeText={setCustomBlock}
        />
      )}

      <View style={{ marginTop: 8 }}>
        <FocusableInput 
          label={t('register.houseNo')}
          icon="business-outline"
          placeholder="e.g. 102A, 45-B"
          value={houseNo}
          onChangeText={setHouseNo}
          autoCapitalize="characters"
        />
      </View>
    </View>
  );

  // STEP 3: Family Members
  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Family Members</Text>
      <Text style={styles.stepSubtitle}>Add a family member to your account (Optional).</Text>
      
      <View style={styles.chipsContainer}>
        <TouchableOpacity activeOpacity={0.8} style={[styles.chip, {flexDirection: 'row', gap: 8}, !addFamily && styles.chipActive]} onPress={() => setAddFamily(false)}>
          <Ionicons name="close-circle-outline" size={20} color={!addFamily ? '#2563EB' : '#64748B'} />
          <Text style={[styles.chipText, {marginTop: 0}, !addFamily && styles.chipTextActive]}>{t('register.no')}</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.8} style={[styles.chip, {flexDirection: 'row', gap: 8}, addFamily && styles.chipActive]} onPress={() => setAddFamily(true)}>
          <Ionicons name="add-circle-outline" size={20} color={addFamily ? '#2563EB' : '#64748B'} />
          <Text style={[styles.chipText, {marginTop: 0}, addFamily && styles.chipTextActive]}>{t('register.yes')}</Text>
        </TouchableOpacity>
      </View>

      {addFamily && (
        <View style={{marginTop: 16}}>
          <Text style={styles.label}>Relation</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow: 0, marginBottom: 24}}>
            {['Mother', 'Father', 'Brother', 'Sister', 'Other'].map((rel) => (
              <TouchableOpacity 
                key={rel}
                activeOpacity={0.7}
                style={[styles.smallChip, familyRelation === rel && styles.smallChipActive]}
                onPress={() => setFamilyRelation(rel)}
              >
                <Text style={[styles.smallChipText, familyRelation === rel && styles.smallChipTextActive]}>{t('register.' + rel.toLowerCase()) || rel}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {familyRelation === 'Other' && (
            <FocusableInput label={t('register.customRelation')} icon="people-outline" placeholder={t('register.customRelation')} value={customRelation} onChangeText={setCustomRelation} />
          )}

          <FocusableInput label={t('register.theirName')} icon="person-outline" placeholder={t('register.theirName')} value={familyName} onChangeText={setFamilyName} />
          
          <FocusableInput label={t('register.phonePlaceholder').replace(' (+91)', '')} icon="call-outline" prefix="+91" placeholder="9876543210" keyboardType="phone-pad" maxLength={10} value={familyPhone} onChangeText={setFamilyPhone} />
        </View>
      )}
    </View>
  );

  // STEP 4: Review Details & Terms
  const renderStep4 = () => {
    const activeBlock = block === 'Other' && customBlock ? customBlock : block;

    return (
      <View style={styles.stepContainer}>
        {isDuplicateAddress ? (
          <View style={styles.warningBox}>
            <Ionicons name="alert-circle" size={24} color="#DC2626" />
            <View style={{marginLeft: 12, flex: 1}}>
              <Text style={styles.warningTitle}>Address Already Exists</Text>
              <Text style={{fontSize: 14, color: '#991B1B', marginTop: 4, lineHeight: 20}}>Someone else is registered here. Please specify your relation (e.g. Tenant, Son).</Text>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.stepTitle}>Review Details</Text>
            <Text style={styles.stepSubtitle}>Ensure your information is correct before finishing.</Text>
          </>
        )}

        {isDuplicateAddress && (
          <View style={{marginBottom: 20}}>
            <FocusableInput label="Your Relation" icon="people-outline" placeholder="e.g. Family Member, Tenant" value={relation} onChangeText={setRelation} />
          </View>
        )}
        
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('register.nameLabel')}</Text>
            <Text style={styles.summaryValue}>{name}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('register.phoneLabel')}</Text>
            <Text style={styles.summaryValue}>+91 {phoneNumber}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Location:</Text>
            <Text style={styles.summaryValue}>
              {selectedArea || phase}, {selectedCity || ''} {selectedPincode ? `(${selectedPincode})` : ''}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('register.addressLabel')}</Text>
            <Text style={styles.summaryValue}>{houseNo}, Block {activeBlock} ({propertyType})</Text>
          </View>
          {addFamily && (
            <View style={[styles.summaryRow, { marginBottom: 0 }]}>
              <Text style={styles.summaryLabel}>{t('register.familyLabel')}</Text>
              <Text style={styles.summaryValue}>{familyName} ({familyRelation === 'Other' ? customRelation : familyRelation})</Text>
            </View>
          )}
        </View>

        <TouchableOpacity 
          style={[styles.termsBox, agreedToTerms && {borderColor: '#2563EB', backgroundColor: '#EFF6FF'}]}
          onPress={() => setAgreedToTerms(!agreedToTerms)}
          activeOpacity={0.7}
        >
          <Ionicons name={agreedToTerms ? "checkbox" : "square-outline"} size={24} color={agreedToTerms ? "#2563EB" : "#94A3B8"} />
          <Text style={[styles.termsText, agreedToTerms && {color: '#1E3A8A'}]}>
            I agree to the Anytime Help Community Rules and Terms & Conditions.
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // STEP 5: Verify Mobile OTP
  const renderStep5 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('register.verifyMobile') || 'Verify Mobile Number'}</Text>
      <Text style={styles.stepSubtitle}>
        {(t('register.otpSentSubtitle') || 'Enter the 6-digit OTP sent to {{phone}}.').replace('{{phone}}', `+91 ${phoneNumber}`)}
      </Text>

      <View style={styles.phoneBadgeContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="call" size={16} color="#2563EB" style={{ marginRight: 8 }} />
          <Text style={styles.phoneBadgeText}>+91 {phoneNumber}</Text>
        </View>
        <TouchableOpacity 
          onPress={() => goToStep(1)} 
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.editPhoneText}>{t('register.changePhone') || 'Change'}</Text>
        </TouchableOpacity>
      </View>

      <FocusableInput 
        label={t('register.enterOtp') || 'Enter 6-digit OTP'}
        icon="keypad-outline"
        placeholder="123456"
        keyboardType="number-pad"
        maxLength={6}
        value={verificationCode}
        onChangeText={setVerificationCode}
        autoFocus={true}
      />

      <View style={styles.resendRow}>
        {timer > 0 ? (
          <Text style={styles.timerText}>
            {(t('register.resendOtpIn') || 'Resend OTP in {{timer}}s').replace('{{timer}}', timer.toString())}
          </Text>
        ) : (
          <TouchableOpacity onPress={() => handleSendRegisterOTP(true)} disabled={loading}>
            <Text style={styles.resendLink}>{t('register.resendOtp') || 'Resend OTP'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const getStepContent = () => {
    switch (step) {
      case 0: return renderStep0();
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      default: return renderStep0();
    }
  };

  const isNextDisabled = () => {
    if (step === 0) return !selectedState || !selectedCity || !selectedArea;
    if (step === 1) return !name.trim() || phoneNumber.length < 10 || !gender;
    if (step === 2) {
      const activeBlock = block === 'Other' && customBlock ? customBlock : block;
      return !propertyType || !activeBlock || !houseNo.trim();
    }
    if (step === 3) return addFamily && (!familyRelation || !familyName || familyPhone.length < 10);
    if (step === 4) return !agreedToTerms || (isDuplicateAddress && !relation);
    if (step === 5) return verificationCode.length !== 6;
    return false;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={toggleLanguage} style={styles.langBtn}>
          <Ionicons name="language-outline" size={16} color="#475569" />
          <Text style={styles.langText}>{getLanguageBadge(i18n.language)}</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainerWrapper}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressText}>Step {step + 1} of {maxStep + 1}</Text>
          <Text style={{ fontSize: 12, color: '#2563EB', fontWeight: '700' }}>
            {step === 0 ? 'Location' : step === 1 ? 'Personal' : step === 2 ? 'Property' : step === 3 ? 'Family' : step === 4 ? 'Review' : 'Verification'}
          </Text>
        </View>
        <View style={styles.progressContainer}>
          <Animated.View style={[styles.progressBar, {
            width: progressAnim.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%']
            })
          }]} />
        </View>
      </View>

      {/* Main Content Area */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        <ScrollView contentContainerStyle={{flexGrow: 1}} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Animated.View style={[styles.contentArea, {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }]
          }]}>
            {getStepContent()}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer Controls */}
      <View style={styles.footer}>
        {step === maxStep ? (
          <TouchableOpacity 
            activeOpacity={0.8}
            style={[styles.primaryBtn, isNextDisabled() && styles.disabledBtn]} 
            onPress={handleRegister}
            disabled={isNextDisabled() || loading}
          >
            <Text style={styles.primaryBtnText}>
              {loading ? (t('register.creating') || 'Creating Account...') : (t('register.completeRegBtn') || 'Complete Registration')}
            </Text>
          </TouchableOpacity>
        ) : step === 4 ? (
          <TouchableOpacity 
            activeOpacity={0.8}
            style={[styles.primaryBtn, isNextDisabled() && styles.disabledBtn]} 
            onPress={handleNext}
            disabled={isNextDisabled() || loading}
          >
            <Text style={styles.primaryBtnText}>
              {loading ? (t('login.sendingOtp') || 'Sending OTP...') : (t('register.sendOtpBtn') || 'Send OTP & Verify')}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            activeOpacity={0.8}
            style={[styles.primaryBtn, isNextDisabled() && styles.disabledBtn]} 
            onPress={handleNext}
            disabled={isNextDisabled()}
          >
            <Text style={styles.primaryBtnText}>
              {step === 0 
                ? (t('register.continueToRegister') || 'Continue to Register') 
                : (t('register.continueBtn') || 'Continue')}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        )}
        
        {step === 0 && (
          <View style={styles.loginLinkRow}>
            <Text style={styles.loginHintText}>{t('register.alreadyHave')} </Text>
            <TouchableOpacity onPress={() => router.push('/login' as any)}>
              <Text style={styles.loginLink}>{t('register.loginHere')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Reusable Location Picker Modal */}
      <LocationPickerModal
        visible={pickerModal.visible}
        title={pickerModal.title}
        placeholder={pickerModal.placeholder}
        options={pickerModal.options}
        selectedValue={pickerModal.selectedValue}
        iconName={pickerModal.iconName}
        onSelect={handlePickerSelect}
        onClose={() => setPickerModal(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 },
  iconBtn: { padding: 10, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' },
  langBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  langText: { color: '#475569', fontWeight: '600', fontSize: 13, marginLeft: 6 },
  
  progressContainerWrapper: { paddingHorizontal: 24, marginBottom: 24 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressText: { fontSize: 12, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  progressContainer: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#2563EB', borderRadius: 3 },
  
  contentArea: { flex: 1, paddingHorizontal: 24, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  stepTitle: { fontSize: 26, fontWeight: '800', color: '#0F172A', marginBottom: 6, letterSpacing: -0.3 },
  stepSubtitle: { fontSize: 14, color: '#64748B', marginBottom: 24, lineHeight: 21 },

  // Front Location Step Styles
  frontLocationHeader: {
    marginBottom: 8
  },
  locationIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    height: 56,
    paddingHorizontal: 16,
    marginBottom: 18
  },
  dropdownDisabled: {
    opacity: 0.5,
    backgroundColor: '#F1F5F9'
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10
  },
  dropdownIcon: {
    marginRight: 12
  },
  dropdownValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A'
  },
  dropdownPlaceholder: {
    color: '#94A3B8',
    fontWeight: '400'
  },
  pincodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18
  },
  pincodeIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  pincodeTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
    textTransform: 'uppercase'
  },
  pincodeNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 1
  },
  selectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18
  },
  selectedBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
    textTransform: 'uppercase'
  },
  selectedBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1D4ED8',
    marginTop: 2
  },

  // Location Pill on step 1
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#DBEAFE'
  },
  locationPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E40AF'
  },
  locationPillChange: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
    marginLeft: 8,
    textDecorationLine: 'underline'
  },

  areaDisplayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: { marginBottom: 20 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#F1F5F9', borderRadius: 14, height: 56, paddingHorizontal: 16 },
  inputBoxFocused: { borderColor: '#2563EB', backgroundColor: '#FFFFFF' },
  inputIcon: { marginRight: 12 },
  prefixText: { fontSize: 16, color: '#0F172A', marginRight: 8, fontWeight: '600' },
  input: { flex: 1, height: '100%', fontSize: 16, color: '#0F172A', fontWeight: '500' },
  
  chipsContainer: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  chip: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#F1F5F9', borderRadius: 16, paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  chipText: { fontSize: 15, fontWeight: '600', color: '#64748B', marginTop: 10 },
  chipTextActive: { color: '#2563EB' },

  smallChip: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#F1F5F9', borderRadius: 100, marginRight: 10 },
  smallChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  smallChipText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  smallChipTextActive: { color: '#2563EB' },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  gridItem: { width: '31%', backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#F1F5F9', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  gridItemActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  gridItemText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  gridItemTextActive: { color: '#2563EB' },

  summaryCard: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 24 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  summaryLabel: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  summaryValue: { fontSize: 14, color: '#0F172A', fontWeight: '600', maxWidth: '65%', textAlign: 'right' },
  
  termsBox: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1.5, borderColor: '#F1F5F9' },
  termsText: { flex: 1, fontSize: 13, color: '#475569', marginLeft: 12, lineHeight: 20 },

  warningBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1.5, borderColor: '#FEE2E2' },
  warningTitle: { fontSize: 15, fontWeight: '700', color: '#991B1B' },

  phoneBadgeContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#EFF6FF', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1.5, borderColor: '#DBEAFE' },
  phoneBadgeText: { fontSize: 15, fontWeight: '700', color: '#1E40AF' },
  editPhoneText: { fontSize: 13, fontWeight: '700', color: '#2563EB', textDecorationLine: 'underline' },
  resendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8, marginBottom: 20 },
  timerText: { color: '#64748B', fontSize: 14, fontWeight: '500' },
  resendLink: { color: '#2563EB', fontSize: 14, fontWeight: '700' },

  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 24 : 32, paddingTop: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F8FAFC' },
  primaryBtn: { backgroundColor: '#2563EB', height: 56, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  disabledBtn: { backgroundColor: '#94A3B8' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  
  loginLinkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  loginHintText: { color: '#64748B', fontSize: 14 },
  loginLink: { color: '#2563EB', fontSize: 14, fontWeight: '600' }
});
