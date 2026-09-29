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
import { LinearGradient } from 'expo-linear-gradient';
import { getNextLanguage, getLanguageBadge } from '../utils/localization';

const API_URL = 'https://anytime-help.onrender.com/api';
const { width } = Dimensions.get('window');

// Steps:
// 0: Personal Details (Name, Gender, Phone)
// 1: Property Details (Type, Phase, Block, House No)
// 2: Family Members (Add Family + Details)
// 3: Summary, Terms & Sign Up (Conditional Duplicate Address)

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
  const phasesList = ['Sushant Lok 2 - C,D,E', 'Sushant Lok 2 - F,G', 'Sushant Lok 3'];
  
  const getBlockOptions = () => {
    if (phase === 'Sushant Lok 2 - C,D,E' || phase === 'Sushant Lok 2 Option 1') return ['C, D, E'];
    if (phase === 'Sushant Lok 2 - F,G' || phase === 'Sushant Lok 2 Option 2') return ['F, G'];
    if (phase === 'Sushant Lok 3') return ['A, B, B1, C, D, E, F, G, H'];
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
      toValue: (step / maxStep) * 100,
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
      Animated.timing(slideAnim, { toValue: nextStep > step ? -30 : 30, duration: 150, useNativeDriver: true })
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(nextStep > step ? 30 : -30);
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

  // Custom Animated Input Component for Focus Effects
  const FocusableInput = ({ icon, label, prefix, ...props }: any) => {
    const [isFocused, setIsFocused] = useState(false);
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const borderAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: isFocused ? 1.02 : 1, friction: 5, useNativeDriver: true }),
        Animated.timing(borderAnim, { toValue: isFocused ? 1 : 0, duration: 200, useNativeDriver: false })
      ]).start();
    }, [isFocused]);

    const borderColor = borderAnim.interpolate({ inputRange: [0, 1], outputRange: ['#E2E8F0', '#3B82F6'] });
    const shadowOpacity = borderAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.15] });

    return (
      <View style={styles.inputWrapper}>
        <Text style={styles.label}>{label}</Text>
        <Animated.View style={[styles.inputBox, { borderColor, transform: [{ scale: scaleAnim }], shadowColor: '#3B82F6', shadowOffset: {width: 0, height: 4}, shadowOpacity, shadowRadius: 8, elevation: isFocused ? 4 : 0 }]}>
          {icon && <Ionicons name={icon} size={20} color={isFocused ? "#3B82F6" : "#64748B"} style={styles.inputIcon} />}
          {prefix && <Text style={styles.prefixText}>{prefix}</Text>}
          <TextInput
            style={styles.input}
            placeholderTextColor="#94A3B8"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            {...props}
          />
        </Animated.View>
      </View>
    );
  };

  // Renders
  const renderStep0 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Let's Get Started 👋</Text>
      <Text style={styles.stepSubtitle}>Tell us your basic details to create an account.</Text>
      
      <FocusableInput 
        label={t('register.fullName')}
        icon="person-outline"
        placeholder="John Doe"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />

      <Text style={[styles.label, {marginTop: 8, marginBottom: 8}]}>{t('register.genderLabel')}</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
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
      <Text style={styles.stepTitle}>Property Details 🏠</Text>
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
            <Ionicons name={type === 'Owned' ? 'home' : 'key'} size={24} color={propertyType === type ? '#FFF' : '#3B82F6'} style={{marginBottom: 8}} />
            <Text style={[styles.chipText, propertyType === type && styles.chipTextActive]}>{t('register.' + type.toLowerCase()) || type}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, {marginTop: 24}]}>{t('register.selectPhase')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow: 0, marginBottom: 20}}>
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

      <View style={{marginTop: 20}}>
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
      <Text style={styles.stepTitle}>Family Members 👨‍👩‍👧</Text>
      <Text style={styles.stepSubtitle}>Add a family member to your account (Optional).</Text>
      
      <View style={styles.chipsContainer}>
        <TouchableOpacity activeOpacity={0.8} style={[styles.chip, !addFamily && styles.chipActive]} onPress={() => setAddFamily(false)}>
          <Text style={[styles.chipText, !addFamily && styles.chipTextActive]}>{t('register.no')}</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.8} style={[styles.chip, addFamily && styles.chipActive]} onPress={() => setAddFamily(true)}>
          <Text style={[styles.chipText, addFamily && styles.chipTextActive]}>{t('register.yes')}</Text>
        </TouchableOpacity>
      </View>

      {addFamily && (
        <View style={{marginTop: 24}}>
          <Text style={styles.label}>Relation</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow: 0, marginBottom: 20}}>
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
          <Ionicons name="alert-circle" size={24} color="#D97706" />
          <View style={{marginLeft: 12, flex: 1}}>
            <Text style={styles.warningTitle}>Address Already Exists</Text>
            <Text style={{fontSize: 13, color: '#92400E', marginTop: 4, lineHeight: 18}}>Someone else is registered here. Please specify your relation (e.g. Tenant, Son).</Text>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.stepTitle}>Review & Complete ✅</Text>
          <Text style={styles.stepSubtitle}>Ensure your details are correct before finishing.</Text>
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
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('register.familyLabel')}</Text>
            <Text style={styles.summaryValue}>{familyName} ({t('register.' + familyRelation.toLowerCase()) || familyRelation})</Text>
          </View>
        )}
      </View>

      <TouchableOpacity 
        style={[styles.termsBox, agreedToTerms && {borderColor: '#3B82F6', backgroundColor: '#EFF6FF'}]}
        onPress={() => setAgreedToTerms(!agreedToTerms)}
        activeOpacity={0.7}
      >
        <Ionicons name={agreedToTerms ? "checkbox" : "square-outline"} size={26} color={agreedToTerms ? "#3B82F6" : "#64748B"} />
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
    <View style={{flex: 1, backgroundColor: '#F8FAFC'}}>
      <LinearGradient colors={['#DBEAFE', '#F8FAFC', '#FFFFFF']} style={StyleSheet.absoluteFill} />
      
      {/* Background Orbs for Glassmorphism feel */}
      <View style={{position: 'absolute', top: -100, right: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: '#BFDBFE', opacity: 0.6, transform: [{scale: 1.2}]}} />
      <View style={{position: 'absolute', bottom: -50, left: -100, width: 250, height: 250, borderRadius: 125, backgroundColor: '#93C5FD', opacity: 0.4}} />
      <View style={{position: 'absolute', top: '40%', right: -80, width: 150, height: 150, borderRadius: 75, backgroundColor: '#60A5FA', opacity: 0.2}} />
      
      <Stack.Screen options={{ gestureEnabled: false }} />
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        
        {/* Header */}
        <View style={styles.header}>
          {step > 0 ? (
            <TouchableOpacity onPress={handleBack} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={24} color="#1E293B" />
            </TouchableOpacity>
          ) : (
            <View style={{width: 40}} />
          )}
          
          <TouchableOpacity onPress={toggleLanguage} style={styles.langBtn}>
            <Ionicons name="language" size={16} color="#3B82F6" />
            <Text style={styles.langText}>{getLanguageBadge(i18n.language)}</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Progress Indicator */}
        <View style={styles.progressContainerWrapper}>
          <Text style={styles.progressText}>Step {step + 1} of {maxStep + 1}</Text>
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
              {!loading && <Ionicons name="checkmark-circle" size={22} color="#FFF" style={{marginLeft: 8}} />}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              activeOpacity={0.8}
              style={[styles.primaryBtn, isNextDisabled() && styles.disabledBtn]} 
              onPress={handleNext}
              disabled={isNextDisabled()}
            >
              <Text style={styles.primaryBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" style={{marginLeft: 8}} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
  iconBtn: { padding: 10, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  langBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#DBEAFE', shadowColor: '#3B82F6', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  langText: { color: '#1D4ED8', fontWeight: '700', fontSize: 13, marginLeft: 6 },
  
  progressContainerWrapper: { paddingHorizontal: 24, marginBottom: 12 },
  progressContainer: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 3 },
  progressText: { fontSize: 13, color: '#64748B', fontWeight: '700', marginBottom: 8, letterSpacing: 0.5 },
  
  contentArea: { flex: 1, paddingHorizontal: 24, paddingBottom: 20 },
  stepContainer: { flex: 1, paddingTop: 10 },
  stepTitle: { fontSize: 32, fontWeight: '800', color: '#0F172A', marginBottom: 8, letterSpacing: -0.5 },
  stepSubtitle: { fontSize: 16, color: '#475569', marginBottom: 32, lineHeight: 24, fontWeight: '500' },
  
  label: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 8, marginLeft: 4, letterSpacing: 0.2 },
  inputWrapper: { marginBottom: 20 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 16, height: 60, paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  prefixText: { fontSize: 16, color: '#334155', marginRight: 8, fontWeight: '600' },
  input: { flex: 1, height: '100%', fontSize: 16, color: '#0F172A', fontWeight: '600' },
  
  chipsContainer: { flexDirection: 'row', gap: 16 },
  chip: { flex: 1, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 24, padding: 20, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  chipText: { fontSize: 16, fontWeight: '700', color: '#475569' },
  chipTextActive: { color: '#FFFFFF' },

  smallChip: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 20, marginRight: 12 },
  smallChipActive: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  smallChipText: { fontSize: 15, fontWeight: '700', color: '#475569' },
  smallChipTextActive: { color: '#1D4ED8' },

  gridContainer: { flexDirection: 'column', gap: 12 },
  gridItem: { width: '100%', backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  gridItemActive: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  gridItemText: { fontSize: 16, fontWeight: '700', color: '#475569' },
  gridItemTextActive: { color: '#1D4ED8' },

  summaryCard: { backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 24, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  summaryLabel: { fontSize: 15, color: '#64748B', fontWeight: '600' },
  summaryValue: { fontSize: 15, color: '#0F172A', fontWeight: '700', maxWidth: '65%', textAlign: 'right' },
  
  termsBox: { flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 20, borderWidth: 1.5, borderColor: '#E2E8F0' },
  termsText: { flex: 1, fontSize: 14, color: '#475569', marginLeft: 16, lineHeight: 22, fontWeight: '500' },

  warningBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', padding: 16, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: '#FDE68A' },
  warningTitle: { fontSize: 16, fontWeight: '800', color: '#92400E' },

  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 10 : 24, paddingTop: 16, backgroundColor: 'transparent' },
  primaryBtn: { backgroundColor: '#0F172A', height: 60, borderRadius: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 },
  disabledBtn: { backgroundColor: '#94A3B8', shadowOpacity: 0, elevation: 0 },
  primaryBtnText: { color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  
  loginLinkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  loginHintText: { color: '#64748B', fontSize: 15, fontWeight: '500' },
  loginLink: { color: '#0F172A', fontSize: 15, fontWeight: '800' }
});
