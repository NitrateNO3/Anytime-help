import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Keyboard, Dimensions, Animated, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useNavigation, Stack } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getNextLanguage, getLanguageBadge } from '../utils/localization';
import RegisterTermsModal, { REGISTER_TERMS_VERSION } from '../components/RegisterTermsModal';

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
  
  const [step, setStep] = useState(0);
  // About you -> Select your area -> Your address -> Verify & submit
  const maxStep = 3;
  const isCompleteRef = useRef(false);

  // Form State
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [gender, setGender] = useState('');
  
  const [propertyType, setPropertyType] = useState('');
  const [phase, setPhase] = useState('');
  const [block, setBlock] = useState('');
  const [houseNo, setHouseNo] = useState('');
  const [landmark, setLandmark] = useState('');
  const [areaSearch, setAreaSearch] = useState('');
  

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [isDuplicateAddress, setIsDuplicateAddress] = useState(false);
  const [relation, setRelation] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP Verification State
  const [verificationCode, setVerificationCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [timer, setTimer] = useState(0);

  // Constants
  const propertyTypes = ['Owned', 'Rented'];

  // Areas (societies / clients) and their phases come from the backend, so a
  // new area added by the super admin shows up here without an app update.
  type AreaOption = { _id: string; name: string; city?: string; type?: 'sector' | 'village'; phases: { name: string; blocks: string[] }[] };
  const FALLBACK_PHASES = [
    { name: 'Sushant Lok 2', blocks: ['C', 'D', 'E', 'F', 'G'] },
    { name: 'Sushant Lok 3', blocks: ['A', 'B', 'B1', 'C', 'D', 'E', 'F', 'G', 'H'] },
  ];
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [areaId, setAreaId] = useState('');

  useEffect(() => {
    axios.get(`${API_URL}/areas/public`)
      .then((res) => {
        const list: AreaOption[] = Array.isArray(res.data) ? res.data : [];
        setAreas(list);
        // Only one area: pick it so the user doesn't have to
        if (list.length === 1) setAreaId(list[0]._id);
      })
      .catch(() => setAreas([])); // offline / old backend: fall back to built-in phases
  }, []);

  // Drop a saved selection (e.g. from the draft) that is no longer offered
  useEffect(() => {
    if (areas.length > 0 && areaId && !areas.some((a) => a._id === areaId)) {
      setAreaId(areas.length === 1 ? areas[0]._id : '');
      setPhase('');
      setBlock('');
    }
  }, [areas, areaId]);

  const selectedArea = areas.find((a) => a._id === areaId);
  // If areas couldn't be loaded, keep the original built-in phases
  const phaseOptions = areas.length === 0 ? FALLBACK_PHASES : (selectedArea?.phases || []);

  const getBlockOptions = () =>
    selectedArea?.type === 'village' ? [] : (phaseOptions.find((p) => p.name === phase)?.blocks || []);

  // Every phase / sector / village of every area, as one list to pick from.
  // A phase with blocks is a residential sector; one without blocks is a
  // village (address = optional house no. + landmark). Picking one also
  // picks its area, so many villages can share one area and one admin.
  type LocationOption = { key: string; areaId: string; areaName: string; city: string; phase: string; blocks: string[]; village: boolean };
  const locations: LocationOption[] = areas.length === 0
    ? FALLBACK_PHASES.map((p) => ({ key: p.name, areaId: '', areaName: '', city: '', phase: p.name, blocks: p.blocks, village: false }))
    : areas.flatMap((a) => (a.phases || []).map((p) => ({
        key: `${a._id}:${p.name}`, areaId: a._id, areaName: a.name, city: a.city || '', phase: p.name,
        // Villages-type areas: same form for every village (no blocks)
        blocks: a.type === 'village' ? [] : (p.blocks || []),
        village: a.type === 'village' || !(p.blocks || []).length,
      })));
  const isVillage = (l: LocationOption) => l.village;
  const locationType = (l: LocationOption) => (isVillage(l) ? 'Village' : 'Residential sector');
  const locationSubtitle = (l: LocationOption) =>
    [locationType(l), isVillage(l) ? (l.city || l.areaName) : (l.areaName || l.city)].filter(Boolean).join(' · ');
  const selectedLocation = locations.find((l) => l.phase === phase && (areas.length === 0 || l.areaId === areaId));
  const filteredLocations = locations.filter((l) =>
    !areaSearch.trim() || `${l.phase} ${l.areaName} ${l.city}`.toLowerCase().includes(areaSearch.trim().toLowerCase()));

  const selectLocation = (l: LocationOption) => {
    if (l.areaId !== areaId) setAreaId(l.areaId);
    if (l.phase !== phase) { setPhase(l.phase); setBlock(''); }
  };

  // Address saved on the user, e.g. "House/Flat: 218, Near Shiv Mandir, Ghata, (Owned)"
  const buildAddress = () => {
    const parts: string[] = [];
    if (houseNo.trim()) parts.push(`House/Flat: ${houseNo.trim()}`);
    if (landmark.trim()) parts.push(landmark.trim());
    if (phase) parts.push(phase);
    if (block) parts.push(`Block ${block}`);
    if (propertyType) parts.push(`(${propertyType})`);
    return parts.join(', ');
  };

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Persist & Load Draft
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draft = await AsyncStorage.getItem('register_draft');
        if (draft) {
          const parsed = JSON.parse(draft);
          if (parsed.name) setName(parsed.name);
          if (parsed.phoneNumber) setPhoneNumber(parsed.phoneNumber);
          if (parsed.gender) setGender(parsed.gender);
          if (parsed.propertyType) setPropertyType(parsed.propertyType);
          if (parsed.phase) setPhase(parsed.phase);
          if (parsed.block) setBlock(parsed.block);
          if (parsed.houseNo) setHouseNo(parsed.houseNo);
          if (parsed.landmark) setLandmark(parsed.landmark);
          if (parsed.areaId) setAreaId(parsed.areaId);
        }
      } catch (e) {}
    };
    loadDraft();
  }, []);

  useEffect(() => {
    const saveDraft = async () => {
      const draft = { name, phoneNumber, gender, propertyType, phase, block, houseNo, landmark, areaId };
      await AsyncStorage.setItem('register_draft', JSON.stringify(draft));
    };
    saveDraft();
  }, [name, phoneNumber, gender, propertyType, phase, block, houseNo, landmark, areaId]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: ((step + 1) / (maxStep + 1)) * 100,
      duration: 350,
      useNativeDriver: false
    }).start();
  }, [step]);

  // Step 4 OTP Countdown Timer
  useEffect(() => {
    let interval: any = null;
    if (step === 3 && otpSent && timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, otpSent, timer]);

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
      const res = await axios.post(`${API_URL}/auth/send-otp`, {
        phone_number: phoneNumber,
        type: 'register',
        role: 'Resident',
        address: buildAddress(),
        house_no: houseNo.trim(),
        relation: isDuplicateAddress ? relation : propertyType
      });

      setTimer(60);
      setOtpSent(true);
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
      if (!name.trim() || !phoneNumber || phoneNumber.length < 10 || !gender || !propertyType) {
        Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter all your details' });
        return;
      }
    } else if (step === 1) {
      if (!selectedLocation) {
        Toast.show({ type: 'error', text1: 'Missing Details', text2: 'Please select your area' });
        return;
      }
    } else if (step === 2) {
      // Sectors need block + house no.; village address fields are optional
      if (getBlockOptions().length > 0 && (!block || !houseNo.trim())) {
        Toast.show({ type: 'error', text1: 'Missing Details', text2: 'Please select your block and enter your house no.' });
        return;
      }
    } else if (step === 3) {
      if (otpSent) handleRegister();
      else handleSendRegisterOTP();
      return;
    }

    if (step < maxStep) goToStep(step + 1);
  };

  // Leaving the verify step (back / change details) needs a fresh OTP
  const resetOtp = () => {
    setOtpSent(false);
    setVerificationCode('');
    setTimer(0);
  };

  const handleBack = () => {
    if (step === 3) resetOtp();
    if (step > 0) goToStep(step - 1);
  };

  const handleRegister = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter a valid 6-digit OTP' });
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;

      const payload: any = { 
        name, 
        phone_number: formattedPhone, 
        otp: verificationCode.trim(),
        role: 'Resident',
        address: buildAddress(),
        property_type: propertyType,
        relation: isDuplicateAddress ? relation : propertyType,
        phase,
        block,
        house_no: houseNo.trim(),
        family_members: [], // added later from Settings
        gender,
        terms_accepted: agreedToTerms,
        terms_version: REGISTER_TERMS_VERSION,
        ...(areaId ? { area: areaId } : {})
      };

      const res = await axios.post(`${API_URL}/auth/register`, payload);
      
      // CRITICAL: Do NOT store userToken or userData in SecureStore!
      // This prevents auto-logging in directly after registration.
      await SecureStore.deleteItemAsync('userToken').catch(() => {});
      await SecureStore.deleteItemAsync('userData').catch(() => {});
      await AsyncStorage.removeItem('register_draft'); 

      isCompleteRef.current = true;
      Toast.show({ 
        type: 'success', 
        text1: 'Registration Successful', 
        text2: res.data.msg || (t('register.regSuccessMsg') || 'Account created! Please login.') 
      });

      // Redirect user to the login screen with the registered phone number prefilled
      router.replace({ 
        pathname: '/login' as any, 
        params: { prefillPhone: phoneNumber, registered: '1' } 
      });
    } catch (err: any) {
      const errorCode = err.response?.data?.error_code;
      if (errorCode === 'DUPLICATE_ADDRESS') {
        setIsDuplicateAddress(true);
        resetOtp();
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

  // Renders
  const renderAboutYou = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>About you</Text>
      <Text style={styles.stepSubtitle}>Tell us who you are. This helps your RWA verify you.</Text>

      <FocusableInput
        label={t('register.fullName')}
        icon="person-outline"
        placeholder="e.g. Aarav Mehta"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />

      <Text style={styles.label}>{t('register.genderLabel')}</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
        {['Male', 'Female', 'Other'].map((gen) => (
          <TouchableOpacity
            key={gen}
            activeOpacity={0.7}
            style={[styles.smallChip, { flex: 1, alignItems: 'center', marginRight: 0, paddingHorizontal: 8 }, gender === gen && styles.smallChipActive]}
            onPress={() => setGender(gen)}
          >
            <Text style={[styles.smallChipText, gender === gen && styles.smallChipTextActive]}>
              {t('register.' + gen.toLowerCase(), gen)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FocusableInput
        label={t('register.phonePlaceholder').replace(' (+91)', '')}
        icon="call-outline"
        prefix="+91"
        placeholder="10-digit mobile number"
        keyboardType="phone-pad"
        maxLength={10}
        value={phoneNumber}
        onChangeText={(v: string) => setPhoneNumber(v.replace(/[^0-9]/g, ''))}
      />

      <Text style={styles.label}>Your home is</Text>
      <View style={styles.chipsContainer}>
        {propertyTypes.map((type) => (
          <TouchableOpacity
            key={type}
            activeOpacity={0.8}
            style={[styles.chip, propertyType === type && styles.chipActive]}
            onPress={() => setPropertyType(type)}
          >
            {propertyType === type && (
              <Ionicons name="checkmark-circle" size={20} color="#2563EB" style={styles.chipCheck} />
            )}
            <Ionicons name={type === 'Owned' ? 'home-outline' : 'key-outline'} size={24} color={propertyType === type ? '#2563EB' : '#64748B'} />
            <Text style={[styles.chipText, propertyType === type && styles.chipTextActive]}>{t('register.' + type.toLowerCase(), type)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderSelectArea = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Select your area</Text>
      <Text style={styles.stepSubtitle}>Search or scroll to find where you live.</Text>

      <View style={[styles.inputBox, styles.searchBox]}>
        <Ionicons name="search" size={20} color="#2563EB" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Search area name"
          placeholderTextColor="#94A3B8"
          value={areaSearch}
          onChangeText={setAreaSearch}
          autoCorrect={false}
        />
        {areaSearch.length > 0 && (
          <TouchableOpacity onPress={() => setAreaSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={20} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>AREAS ON ANYTIME HELP</Text>
        <Text style={styles.listHeaderCount}>
          {filteredLocations.length} {filteredLocations.length === 1 ? 'area' : 'areas'}
        </Text>
      </View>

      {filteredLocations.length === 0 ? (
        <View style={styles.emptyList}>
          <Ionicons name="location-outline" size={28} color="#94A3B8" />
          <Text style={styles.emptyListText}>No area found for "{areaSearch.trim()}"</Text>
        </View>
      ) : (
        <View style={styles.locationList}>
          {filteredLocations.map((l, i) => {
            const active = selectedLocation?.key === l.key;
            return (
              <TouchableOpacity
                key={l.key}
                activeOpacity={0.7}
                onPress={() => selectLocation(l)}
                style={[styles.locationRow, i === filteredLocations.length - 1 && { borderBottomWidth: 0 }, active && styles.locationRowActive]}
              >
                <View style={[styles.locationAvatar, active && styles.locationAvatarActive]}>
                  <Text style={[styles.locationAvatarText, active && { color: '#FFFFFF' }]}>{l.phase.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.locationName}>{l.phase}</Text>
                  <Text style={styles.locationSub}>{locationSubtitle(l)}</Text>
                </View>
                <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={active ? '#2563EB' : '#CBD5E1'} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {selectedLocation && (
        <View style={styles.selectedBanner}>
          <Ionicons name="checkmark-circle" size={26} color="#2563EB" />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.selectedBannerTitle}>{selectedLocation.phase} selected</Text>
            <Text style={styles.selectedBannerSub}>
              {isVillage(selectedLocation) ? 'Next: house no. and landmark (optional)' : 'Next: block and house no.'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderAddress = () => {
    const blocks = getBlockOptions();
    const village = blocks.length === 0;
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Your address</Text>
        <Text style={styles.stepSubtitle}>Addresses in {phase} are recorded like this.</Text>

        <View style={styles.areaCard}>
          <View style={styles.areaCardIcon}>
            <Ionicons name={village ? 'home-outline' : 'business-outline'} size={20} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.areaCardTitle}>{phase}</Text>
            <Text style={styles.areaCardSub}>{village ? 'Village address · all fields optional' : 'Residential sector · block and house no.'}</Text>
          </View>
          <TouchableOpacity style={styles.changeBtn} onPress={() => goToStep(1)}>
            <Text style={styles.changeBtnText}>Change</Text>
          </TouchableOpacity>
        </View>

        {!village && (
          <>
            <Text style={styles.label}>{t('register.selectBlock')}</Text>
            <View style={styles.gridContainer}>
              {blocks.map((b) => (
                <TouchableOpacity
                  key={b}
                  activeOpacity={0.7}
                  style={[styles.gridItem, block === b && styles.gridItemActive]}
                  onPress={() => setBlock(b)}
                >
                  <Text style={[styles.gridItemText, block === b && styles.gridItemTextActive]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <FocusableInput
          label={village ? 'House no. (optional)' : t('register.houseNo')}
          icon="business-outline"
          placeholder={village ? 'e.g. 218' : 'e.g. 102A, 45-B'}
          value={houseNo}
          onChangeText={setHouseNo}
          autoCapitalize="characters"
        />

        {village && (
          <FocusableInput
            label="Nearby landmark (optional)"
            icon="navigate-outline"
            placeholder="e.g. Near Shiv Mandir"
            value={landmark}
            onChangeText={setLandmark}
          />
        )}

        <View style={styles.infoNote}>
          <Ionicons name="information-circle-outline" size={18} color="#64748B" />
          <Text style={styles.infoNoteText}>
            These fields are set for {phase} by the Anytime Help admin, so your address matches how your RWA records it.
          </Text>
        </View>
      </View>
    );
  };

  const renderVerify = () => {
    const addressText = [
      houseNo.trim() && (block ? houseNo.trim() : `House ${houseNo.trim()}`),
      landmark.trim(),
      block && `Block ${block}`,
      phase,
    ].filter(Boolean).join(', ');
    const rows: [string, string][] = [
      [t('register.nameLabel', 'Name'), name.trim()],
      [t('register.phoneLabel', 'Mobile'), `+91 ${phoneNumber}`],
      ['Gender', t('register.' + gender.toLowerCase(), gender)],
      ['Home', t('register.' + propertyType.toLowerCase(), propertyType)],
      ['Area', phase],
      [t('register.addressLabel', 'Address'), addressText || '—'],
    ];
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Verify & submit</Text>
        <Text style={styles.stepSubtitle}>Check your details and enter the OTP.</Text>

        {isDuplicateAddress && (
          <>
            <View style={styles.warningBox}>
              <Ionicons name="alert-circle" size={24} color="#DC2626" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.warningTitle}>Address Already Exists</Text>
                <Text style={{ fontSize: 14, color: '#991B1B', marginTop: 4, lineHeight: 20 }}>Someone else is registered here. Please specify your relation (e.g. Tenant, Son).</Text>
              </View>
            </View>
            <FocusableInput label="Your Relation" icon="people-outline" placeholder="e.g. Family Member, Tenant" value={relation} onChangeText={setRelation} />
          </>
        )}

        <View style={styles.summaryCard}>
          {rows.map(([label, value], i) => (
            <View key={label} style={[styles.summaryRow, i === rows.length - 1 && { marginBottom: 0, borderBottomWidth: 0, paddingBottom: 0 }]}>
              <Text style={styles.summaryLabel}>{label}</Text>
              <Text style={styles.summaryValue}>{value}</Text>
            </View>
          ))}
        </View>

        {!otpSent ? (
          <TouchableOpacity
            style={[styles.termsBox, agreedToTerms && { borderColor: '#2563EB', backgroundColor: '#EFF6FF' }]}
            // Ticking requires reading the terms first; un-ticking is always allowed
            onPress={() => (agreedToTerms ? setAgreedToTerms(false) : setShowTerms(true))}
            activeOpacity={0.7}
          >
            <Ionicons name={agreedToTerms ? 'checkbox' : 'square-outline'} size={24} color={agreedToTerms ? '#2563EB' : '#94A3B8'} />
            <Text style={[styles.termsText, agreedToTerms && { color: '#1E3A8A' }]}>
              I have read the{' '}
              <Text style={styles.termsLink} onPress={() => setShowTerms(true)}>Terms of Use and Privacy Consent</Text>
              . I agree to Anytime Help using my contact details, address, and complaint information to map and send my complaint to the relevant RWA chairman or authorised representatives, and to contact me about its resolution.
            </Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text style={styles.label}>
              Enter the 6-digit OTP sent to +91 {phoneNumber.slice(0, 2)}XXXXX{phoneNumber.slice(-3)}
            </Text>
            <View style={[styles.inputBox, styles.otpBox]}>
              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="• • • • • •"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                maxLength={6}
                value={verificationCode}
                onChangeText={(v) => setVerificationCode(v.replace(/[^0-9]/g, ''))}
                autoFocus
              />
            </View>
            <View style={styles.resendRow}>
              <Text style={styles.timerText}>Didn’t get it?</Text>
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
          </>
        )}

        <RegisterTermsModal
          visible={showTerms}
          areaName={phase || selectedArea?.name}
          onClose={() => setShowTerms(false)}
          onAgree={() => {
            setAgreedToTerms(true);
            setShowTerms(false);
          }}
        />
      </View>
    );
  };

  const getStepContent = () => {
    switch (step) {
      case 0: return renderAboutYou();
      case 1: return renderSelectArea();
      case 2: return renderAddress();
      case 3: return renderVerify();
      default: return renderAboutYou();
    }
  };

  const isNextDisabled = () => {
    if (step === 0) return !name.trim() || phoneNumber.length < 10 || !gender || !propertyType;
    if (step === 1) return !selectedLocation;
    if (step === 2) return getBlockOptions().length > 0 && (!block || !houseNo.trim());
    if (step === 3) {
      if (!otpSent) return !agreedToTerms || (isDuplicateAddress && !relation.trim());
      return verificationCode.length !== 6;
    }
    return false;
  };

  const primaryLabel = () => {
    if (step === 1) return selectedLocation ? `Continue with ${selectedLocation.phase}` : 'Select your area';
    if (step === 3) {
      if (loading) return otpSent ? (t('register.creating') || 'Creating Account...') : (t('login.sendingOtp') || 'Sending OTP...');
      return otpSent ? 'Submit for verification' : (t('register.sendOtpBtn') || 'Send OTP & Verify');
    }
    return t('register.continueBtn') || 'Continue';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        {step > 0 ? (
          <TouchableOpacity onPress={handleBack} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
          </TouchableOpacity>
        ) : (
          <View style={{width: 38}} />
        )}
        
        <TouchableOpacity onPress={toggleLanguage} style={styles.langBtn}>
          <Ionicons name="language-outline" size={16} color="#475569" />
          <Text style={styles.langText}>{getLanguageBadge(i18n.language)}</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainerWrapper}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressText}>Step {step + 1} of {maxStep + 1}</Text>
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
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.primaryBtn, isNextDisabled() && styles.disabledBtn]}
          onPress={handleNext}
          disabled={isNextDisabled() || loading}
        >
          <Text style={styles.primaryBtnText}>{primaryLabel()}</Text>
        </TouchableOpacity>

        {step === 0 && (
          <View style={styles.loginLinkRow}>
            <Text style={styles.loginHintText}>{t('register.alreadyHave')} </Text>
            <TouchableOpacity onPress={() => router.push('/login' as any)}>
              <Text style={styles.loginLink}>{t('register.loginHere')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 },
  iconBtn: { padding: 10, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' },
  langBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  langText: { color: '#475569', fontWeight: '600', fontSize: 13, marginLeft: 6 },
  
  progressContainerWrapper: { paddingHorizontal: 24, marginBottom: 32 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  progressText: { fontSize: 12, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  progressContainer: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#2563EB', borderRadius: 3 },
  
  contentArea: { flex: 1, paddingHorizontal: 24, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  stepTitle: { fontSize: 28, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  stepSubtitle: { fontSize: 15, color: '#64748B', marginBottom: 32, lineHeight: 22 },
  
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: { marginBottom: 24 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#F1F5F9', borderRadius: 14, height: 56, paddingHorizontal: 16 },
  inputBoxFocused: { borderColor: '#2563EB', backgroundColor: '#FFFFFF' },
  inputIcon: { marginRight: 12 },
  prefixText: { fontSize: 16, color: '#0F172A', marginRight: 8, fontWeight: '600' },
  input: { flex: 1, height: '100%', fontSize: 16, color: '#0F172A', fontWeight: '500' },
  
  chipsContainer: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  chip: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#F1F5F9', borderRadius: 16, paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  chipText: { fontSize: 15, fontWeight: '600', color: '#64748B', marginTop: 12 },
  chipTextActive: { color: '#2563EB' },

  smallChip: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#F1F5F9', borderRadius: 100, marginRight: 10 },
  smallChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  smallChipText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  smallChipTextActive: { color: '#2563EB' },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
  gridItem: { width: '30%', backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#F1F5F9', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  gridItemActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  gridItemText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  gridItemTextActive: { color: '#2563EB' },

  summaryCard: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 24 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  summaryLabel: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  summaryValue: { fontSize: 14, color: '#0F172A', fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  
  chipCheck: { position: 'absolute', top: 10, right: 10 },
  searchBox: { borderColor: '#BFDBFE', backgroundColor: '#FFFFFF', marginBottom: 20 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  listHeaderText: { fontSize: 12, fontWeight: '700', color: '#475569', letterSpacing: 0.5 },
  listHeaderCount: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  locationList: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  locationRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
  locationRowActive: { backgroundColor: '#EFF6FF' },
  locationAvatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  locationAvatarActive: { backgroundColor: '#2563EB' },
  locationAvatarText: { fontSize: 16, fontWeight: '700', color: '#1D4ED8' },
  locationName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  locationSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
  emptyList: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyListText: { fontSize: 14, color: '#64748B' },
  selectedBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 14, padding: 14 },
  selectedBannerTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  selectedBannerSub: { fontSize: 12, color: '#475569', marginTop: 2 },
  areaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 16, padding: 14, marginBottom: 24 },
  areaCardIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center' },
  areaCardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  areaCardSub: { fontSize: 12, color: '#475569', marginTop: 2 },
  changeBtn: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  changeBtnText: { fontSize: 13, fontWeight: '700', color: '#1D4ED8' },
  infoNote: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, gap: 8 },
  infoNoteText: { flex: 1, fontSize: 13, color: '#475569', lineHeight: 19 },
  otpBox: { justifyContent: 'center', marginBottom: 12 },
  otpInput: { textAlign: 'center', fontSize: 22, letterSpacing: 10, fontWeight: '700' },
  termsBox: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1.5, borderColor: '#F1F5F9' },
  termsText: { flex: 1, fontSize: 13, color: '#475569', marginLeft: 12, lineHeight: 20 },
  termsLink: { color: '#2563EB', fontWeight: '700', textDecorationLine: 'underline' },

  warningBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1.5, borderColor: '#FEE2E2' },
  warningTitle: { fontSize: 15, fontWeight: '700', color: '#991B1B' },

  phoneBadgeContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#EFF6FF', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1.5, borderColor: '#DBEAFE' },
  phoneBadgeText: { fontSize: 15, fontWeight: '700', color: '#1E40AF' },
  editPhoneText: { fontSize: 13, fontWeight: '700', color: '#2563EB', textDecorationLine: 'underline' },
  resendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 20 },
  timerText: { color: '#64748B', fontSize: 14, fontWeight: '500' },
  resendLink: { color: '#2563EB', fontSize: 14, fontWeight: '700' },

  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 24 : 32, paddingTop: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F8FAFC' },
  primaryBtn: { backgroundColor: '#2563EB', height: 56, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  disabledBtn: { backgroundColor: '#94A3B8' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  
  loginLinkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  loginHintText: { color: '#64748B', fontSize: 14 },
  loginLink: { color: '#2563EB', fontSize: 14, fontWeight: '600' }
});
