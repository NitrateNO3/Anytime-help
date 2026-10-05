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
  
  const [addFamily, setAddFamily] = useState(false);
  const [familyRelation, setFamilyRelation] = useState('');
  const [customRelation, setCustomRelation] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [familyPhone, setFamilyPhone] = useState('');

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isDuplicateAddress, setIsDuplicateAddress] = useState(false);
  const [relation, setRelation] = useState('');
  const [loading, setLoading] = useState(false);

  // Constants
  const propertyTypes = ['Owned', 'Rented'];
  const phasesList = ['Sushant Lok 2', 'Sushant Lok 3'];
  
  const getBlockOptions = () => {
    if (phase === 'Sushant Lok 2') return ['C', 'D', 'E', 'F', 'G'];
    if (phase === 'Sushant Lok 3') return ['A', 'B', 'B1', 'C', 'D', 'E', 'F', 'G', 'H'];
    return [];
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
        }
      } catch (e) {}
    };
    loadDraft();
  }, []);

  useEffect(() => {
    const saveDraft = async () => {
      const draft = { name, phoneNumber, gender, propertyType, phase, block, houseNo };
      await AsyncStorage.setItem('register_draft', JSON.stringify(draft));
    };
    saveDraft();
  }, [name, phoneNumber, gender, propertyType, phase, block, houseNo]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: ((step + 1) / (maxStep + 1)) * 100,
      duration: 350,
      useNativeDriver: false
    }).start();
  }, [step]);

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
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
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

  const handleNext = () => {
    if (step === 0) {
      if (!name || !phoneNumber || phoneNumber.length < 10 || !gender) {
        Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter all personal details' });
        return;
      }
    } else if (step === 1) {
      if (!propertyType || !phase || !block || !houseNo) {
        Toast.show({ type: 'error', text1: 'Missing Details', text2: 'Please complete all property details' });
        return;
      }
    } else if (step === 2) {
      if (addFamily) {
        if (!familyRelation || !familyName || !familyPhone || familyPhone.length < 10 || (familyRelation === 'Other' && !customRelation)) {
          Toast.show({ type: 'error', text1: 'Missing Details', text2: 'Please fill in family details correctly' });
          return;
        }
      }
    }
    
    if (step < maxStep) goToStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) goToStep(step - 1);
  };

  const handleRegister = async () => {
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
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      let addressParts = [];
      if (houseNo) addressParts.push(`House/Flat: ${houseNo}`);
      if (phase) addressParts.push(phase);
      if (block) addressParts.push(`Block ${block}`);
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
        role: 'Resident',
        address: combinedAddress,
        property_type: propertyType,
        relation: isDuplicateAddress ? relation : propertyType,
        phase,
        family_members,
        gender
      };

      const res = await axios.post(`${API_URL}/auth/register`, payload);
      const { token, user } = res.data;
      
      await SecureStore.setItemAsync('userToken', token);
      await SecureStore.setItemAsync('userData', JSON.stringify(user));
      await AsyncStorage.removeItem('register_draft'); 

      try {
        const { registerForPushNotificationsAsync, sendPushTokenToBackend } = await import('../services/pushNotifications');
        const pushToken = await registerForPushNotificationsAsync();
        if (pushToken) await sendPushTokenToBackend(pushToken);
      } catch (pushErr) {}

      isCompleteRef.current = true;
      Toast.show({ type: 'success', text1: 'Welcome', text2: 'Account created successfully!' });
      router.replace('/login');
    } catch (err: any) {
      const errorCode = err.response?.data?.error_code;
      if (errorCode === 'DUPLICATE_ADDRESS') {
        setIsDuplicateAddress(true);
        Toast.show({ type: 'info', text1: 'Address Taken', text2: 'Someone is already registered here. Please specify your relation.' });
      } else {
        Toast.show({ type: 'error', text1: 'Registration Failed', text2: err.response?.data?.msg || 'Please try again.' });
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
  const renderStep0 = () => (
    <View style={styles.stepContainer}>
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

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Property Details</Text>
      <Text style={styles.stepSubtitle}>Where is your property located?</Text>
      
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

      <Text style={styles.label}>{t('register.selectPhase')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow: 0, marginBottom: 24}}>
        {phasesList.map((p) => (
          <TouchableOpacity 
            key={p}
            activeOpacity={0.7}
            style={[styles.smallChip, phase === p && styles.smallChipActive]}
            onPress={() => { setPhase(p); setBlock(''); }}
          >
            <Text style={[styles.smallChipText, phase === p && styles.smallChipTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {phase ? (
        <>
          <Text style={styles.label}>{t('register.selectBlock')}</Text>
          <View style={styles.gridContainer}>
            {getBlockOptions().map((b) => (
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
      ) : null}

      <View style={{marginTop: 8}}>
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

  const renderStep2 = () => (
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

  const renderStep3 = () => (
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
          <Text style={styles.summaryLabel}>{t('register.addressLabel')}</Text>
          <Text style={styles.summaryValue}>{houseNo}, Block {block}, {phase} ({t('register.' + propertyType.toLowerCase()) || propertyType})</Text>
        </View>
        {addFamily && (
          <View style={[styles.summaryRow, { marginBottom: 0 }]}>
            <Text style={styles.summaryLabel}>{t('register.familyLabel')}</Text>
            <Text style={styles.summaryValue}>{familyName} ({t('register.' + familyRelation.toLowerCase()) || familyRelation})</Text>
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

  const getStepContent = () => {
    switch (step) {
      case 0: return renderStep0();
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      default: return renderStep0();
    }
  };

  const isNextDisabled = () => {
    if (step === 0) return !name || phoneNumber.length < 10 || !gender;
    if (step === 1) return !propertyType || !phase || !block || !houseNo;
    if (step === 2) return addFamily && (!familyRelation || !familyName || familyPhone.length < 10);
    if (step === 3) return !agreedToTerms || (isDuplicateAddress && !relation);
    return false;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
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
        {step === maxStep ? (
          <TouchableOpacity 
            activeOpacity={0.8}
            style={[styles.primaryBtn, isNextDisabled() && styles.disabledBtn]} 
            onPress={handleRegister}
            disabled={isNextDisabled() || loading}
          >
            <Text style={styles.primaryBtnText}>{loading ? 'Setting up...' : 'Complete Registration'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            activeOpacity={0.8}
            style={[styles.primaryBtn, isNextDisabled() && styles.disabledBtn]} 
            onPress={handleNext}
            disabled={isNextDisabled()}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
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
  
  termsBox: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1.5, borderColor: '#F1F5F9' },
  termsText: { flex: 1, fontSize: 13, color: '#475569', marginLeft: 12, lineHeight: 20 },

  warningBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1.5, borderColor: '#FEE2E2' },
  warningTitle: { fontSize: 15, fontWeight: '700', color: '#991B1B' },

  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 24 : 32, paddingTop: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F8FAFC' },
  primaryBtn: { backgroundColor: '#2563EB', height: 56, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  disabledBtn: { backgroundColor: '#94A3B8' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  
  loginLinkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  loginHintText: { color: '#64748B', fontSize: 14 },
  loginLink: { color: '#2563EB', fontSize: 14, fontWeight: '600' }
});
