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

const TOTAL_STEPS = 6; 
// 0: Name & Phone
// 1: Property Type
// 2: Phase & Block
// 3: House No
// 4: Add Family Member
// 5: Terms & Sign Up
// 6: Duplicate Address Relation (Conditional)

export default function RegisterScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();
  
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(5); // Becomes 6 if duplicate address
  const isCompleteRef = useRef(false);

  // Form State
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [gender, setGender] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [phase, setPhase] = useState('');
  const [block, setBlock] = useState('');
  const [houseNo, setHouseNo] = useState('');
  
  // Family Member State
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

  // Update progress bar
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (step / maxStep) * 100,
      duration: 300,
      useNativeDriver: false
    }).start();
  }, [step, maxStep]);

  // Back Button Handler (Android)
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

  // Router Back Swipe/Header Intercept
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (step > 0 && !isCompleteRef.current) {
        // Prevent default behavior of leaving the screen
        e.preventDefault();
        // Go back 1 step
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
        Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter a valid name and phone number' });
        return;
      }
    } else if (step === 1) {
      if (!propertyType) return;
    } else if (step === 2) {
      if (!phase || !block) {
        Toast.show({ type: 'error', text1: 'Selection Required', text2: 'Please select phase and block' });
        return;
      }
    } else if (step === 3) {
      if (!houseNo) {
        Toast.show({ type: 'error', text1: 'Required', text2: 'Please enter house/flat number' });
        return;
      }
    } else if (step === 4) {
      if (addFamily) {
        if (!familyRelation || !familyName || !familyPhone || familyPhone.length < 10 || (familyRelation === 'Other' && !customRelation)) {
          Toast.show({ type: 'error', text1: 'Missing Details', text2: 'Please fill in all family member details correctly' });
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

    if (isDuplicateAddress && !relation && step === 6) {
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
      await AsyncStorage.removeItem('register_draft'); // Clear draft

      isCompleteRef.current = true;
      Toast.show({ type: 'success', text1: 'Welcome', text2: 'Account created successfully!' });
      router.replace('/login');
    } catch (err: any) {
      const errorCode = err.response?.data?.error_code;
      if (errorCode === 'DUPLICATE_ADDRESS') {
        setIsDuplicateAddress(true);
        setMaxStep(6);
        Toast.show({ type: 'info', text1: 'Address Taken', text2: 'Please specify your relation.' });
        goToStep(6);
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
      <Text style={styles.stepTitle}>{t('register.step1Title')}</Text>
      <Text style={styles.stepSubtitle}>{t('register.step1Sub')}</Text>
      
      <View style={styles.inputWrapper}>
        <Text style={styles.label}>{t('register.fullName')}</Text>
        <View style={styles.inputBox}>
          <Ionicons name="person-outline" size={20} color="#64748B" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="John Doe"
            placeholderTextColor="#94A3B8"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>
      </View>

      <Text style={[styles.label, {marginTop: 16, marginBottom: 8}]}>{t('register.genderLabel')}</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        {['Male', 'Female'].map((gen) => (
          <TouchableOpacity
            key={gen}
            style={[styles.smallChip, { flex: 1, alignItems: 'center' }, gender === gen && styles.smallChipActive]}
            onPress={() => setGender(gen)}
          >
            <Text style={[styles.smallChipText, gender === gen && styles.smallChipTextActive]}>
              {t('register.' + gen.toLowerCase()) || gen}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.inputWrapper}>
        <Text style={styles.label}>{t('register.phonePlaceholder').replace(' (+91)', '')}</Text>
        <View style={styles.inputBox}>
          <Ionicons name="call-outline" size={20} color="#64748B" style={styles.inputIcon} />
          <Text style={{fontSize: 16, color: '#334155', marginRight: 8, fontWeight: '500'}}>+91</Text>
          <TextInput
            style={styles.input}
            placeholder="9876543210"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
            maxLength={10}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />
        </View>
      </View>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Do you own or rent?</Text>
      <Text style={styles.stepSubtitle}>Select your property status in the society.</Text>
      
      <View style={styles.chipsContainer}>
        {propertyTypes.map((type) => (
          <TouchableOpacity 
            key={type}
            style={[styles.chip, propertyType === type && styles.chipActive]}
            onPress={() => {
              setPropertyType(type);
              setTimeout(() => {
                goToStep(2);
              }, 350);
            }}
          >
            <Ionicons name={type === 'Owned' ? 'home' : 'key'} size={24} color={propertyType === type ? '#FFF' : '#3B82F6'} style={{marginBottom: 8}} />
            <Text style={[styles.chipText, propertyType === type && styles.chipTextActive]}>{t('register.' + type.toLowerCase()) || type}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Where is your property?</Text>
      <Text style={styles.stepSubtitle}>Select your phase and block.</Text>
      
      <Text style={styles.label}>{t('register.selectPhase')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow: 0, marginBottom: 20}}>
        {phasesList.map((p) => (
          <TouchableOpacity 
            key={p}
            style={[styles.smallChip, phase === p && styles.smallChipActive]}
            onPress={() => {
              setPhase(p);
              setBlock(''); // reset block
            }}
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
                style={[styles.gridItem, block === b && styles.gridItemActive]}
                onPress={() => {
                  setBlock(b);
                  setTimeout(() => {
                    goToStep(3);
                  }, 350);
                }}
              >
                <Text style={[styles.gridItemText, block === b && styles.gridItemTextActive]}>{b}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Almost there!</Text>
      <Text style={styles.stepSubtitle}>What is your house or flat number?</Text>
      
      <View style={styles.inputWrapper}>
        <Text style={styles.label}>{t('register.houseNo')}</Text>
        <View style={styles.inputBox}>
          <Ionicons name="business-outline" size={20} color="#64748B" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="e.g. 102A, 45-B"
            placeholderTextColor="#94A3B8"
            value={houseNo}
            onChangeText={setHouseNo}
            autoCapitalize="characters"
          />
        </View>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('register.step5Title')}</Text>
      <Text style={styles.stepSubtitle}>{t('register.step5Sub')}</Text>
      
      <View style={styles.chipsContainer}>
        <TouchableOpacity style={[styles.chip, !addFamily && styles.chipActive]} onPress={() => setAddFamily(false)}>
          <Text style={[styles.chipText, !addFamily && styles.chipTextActive]}>{t('register.no')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.chip, addFamily && styles.chipActive]} onPress={() => setAddFamily(true)}>
          <Text style={[styles.chipText, addFamily && styles.chipTextActive]}>{t('register.yes')}</Text>
        </TouchableOpacity>
      </View>

      {addFamily && (
        <View style={{marginTop: 24}}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow: 0, marginBottom: 16}}>
            {['Mother', 'Father', 'Brother', 'Sister', 'Other'].map((rel) => (
              <TouchableOpacity 
                key={rel}
                style={[styles.smallChip, familyRelation === rel && styles.smallChipActive]}
                onPress={() => setFamilyRelation(rel)}
              >
                <Text style={[styles.smallChipText, familyRelation === rel && styles.smallChipTextActive]}>{t('register.' + rel.toLowerCase()) || rel}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {familyRelation === 'Other' && (
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>{t('register.customRelation')}</Text>
              <View style={styles.inputBox}>
                <Ionicons name="people-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('register.customRelation')}
                  placeholderTextColor="#94A3B8"
                  value={customRelation}
                  onChangeText={setCustomRelation}
                />
              </View>
            </View>
          )}

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>{t('register.theirName')}</Text>
            <View style={styles.inputBox}>
              <Ionicons name="person-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder={t('register.theirName')} placeholderTextColor="#94A3B8" value={familyName} onChangeText={setFamilyName} />
            </View>
          </View>
          
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>{t('register.phonePlaceholder').replace(' (+91)', '')}</Text>
            <View style={styles.inputBox}>
              <Ionicons name="call-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <Text style={{fontSize: 16, color: '#334155', marginRight: 8, fontWeight: '500'}}>+91</Text>
              <TextInput style={styles.input} placeholder="9876543210" placeholderTextColor="#94A3B8" keyboardType="phone-pad" maxLength={10} value={familyPhone} onChangeText={setFamilyPhone} />
            </View>
          </View>
        </View>
      )}
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('register.step6Title')}</Text>
      <Text style={styles.stepSubtitle}>{t('register.step6Sub')}</Text>
      
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
        style={styles.termsBox}
        onPress={() => setAgreedToTerms(!agreedToTerms)}
        activeOpacity={0.7}
      >
        <Ionicons name={agreedToTerms ? "checkbox" : "square-outline"} size={26} color={agreedToTerms ? "#3B82F6" : "#64748B"} />
        <Text style={styles.termsText}>
          I agree to the Anytime Help Community Rules and Terms & Conditions.
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep6 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.warningBox}>
        <Ionicons name="alert-circle" size={24} color="#D97706" />
        <Text style={styles.warningTitle}>Address Already Exists</Text>
      </View>
      <Text style={styles.stepTitle}>What's your relation?</Text>
      <Text style={styles.stepSubtitle}>Someone else is already registered at this house. Please specify your relation to them (e.g., Tenant, Son, Daughter).</Text>
      
      <View style={styles.inputWrapper}>
        <Text style={styles.label}>Your Relation</Text>
        <View style={styles.inputBox}>
          <Ionicons name="people-outline" size={20} color="#64748B" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="e.g. Family Member, Tenant"
            placeholderTextColor="#94A3B8"
            value={relation}
            onChangeText={setRelation}
          />
        </View>
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
      case 6: return renderStep6();
      default: return renderStep0();
    }
  };

  const isNextDisabled = () => {
    if (step === 0) return !name || phoneNumber.length < 10 || !gender;
    if (step === 1) return !propertyType;
    if (step === 2) return !phase || !block;
    if (step === 3) return !houseNo;
    if (step === 4) return addFamily && (!familyRelation || !familyName || familyPhone.length < 10);
    if (step === 5) return !agreedToTerms;
    if (step === 6) return !relation;
    return false;
  };

  return (
    <View style={{flex: 1, backgroundColor: '#EFF6FF'}}>
      <LinearGradient colors={['#DBEAFE', '#EFF6FF', '#FFFFFF']} style={StyleSheet.absoluteFill} />
      <View style={{position: 'absolute', top: -100, right: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: '#BFDBFE', opacity: 0.5, transform: [{scale: 1.2}]}} />
      <View style={{position: 'absolute', bottom: -50, left: -100, width: 250, height: 250, borderRadius: 125, backgroundColor: '#93C5FD', opacity: 0.3}} />
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

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <Animated.View style={[styles.progressBar, {
          width: progressAnim.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%']
          })
        }]} />
      </View>
      <Text style={styles.progressText}>Step {step + 1} of {maxStep + 1}</Text>

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
            style={[styles.primaryBtn, isNextDisabled() && styles.disabledBtn]} 
            onPress={handleRegister}
            disabled={isNextDisabled() || loading}
          >
            <Text style={styles.primaryBtnText}>{loading ? 'Please wait...' : 'Complete Registration'}</Text>
            {!loading && <Ionicons name="checkmark" size={20} color="#FFF" style={{marginLeft: 8}} />}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
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
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 },
  iconBtn: { padding: 8, borderRadius: 20, backgroundColor: '#F1F5F9' },
  langBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#DBEAFE' },
  langText: { color: '#1E3A8A', fontWeight: '600', fontSize: 13, marginLeft: 4 },
  
  progressContainer: { height: 4, backgroundColor: '#F1F5F9', marginHorizontal: 24, borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
  progressBar: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 2 },
  progressText: { fontSize: 12, color: '#94A3B8', fontWeight: '600', textAlign: 'right', marginRight: 24, marginBottom: 20 },
  
  contentArea: { flex: 1, paddingHorizontal: 24 },
  stepContainer: { flex: 1, paddingTop: 20 },
  stepTitle: { fontSize: 28, fontWeight: '800', color: '#1D4ED8', marginBottom: 8, letterSpacing: -0.5 },
  stepSubtitle: { fontSize: 16, color: '#64748B', marginBottom: 40, lineHeight: 24 },
  
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8, marginLeft: 4 },
  inputWrapper: { marginBottom: 24 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, height: 60, paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: '100%', fontSize: 16, color: '#1D4ED8', fontWeight: '500' },
  
  chipsContainer: { flexDirection: 'row', gap: 16 },
  chip: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 20, padding: 24, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  chipText: { fontSize: 16, fontWeight: '600', color: '#475569' },
  chipTextActive: { color: '#FFFFFF' },

  smallChip: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 20, marginRight: 12 },
  smallChipActive: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  smallChipText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  smallChipTextActive: { color: '#2563EB' },

  gridContainer: { flexDirection: 'column', gap: 12 },
  gridItem: { width: '100%', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  gridItemActive: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  gridItemText: { fontSize: 16, fontWeight: '600', color: '#475569' },
  gridItemTextActive: { color: '#2563EB' },

  summaryCard: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 24 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontSize: 15, color: '#64748B', fontWeight: '500' },
  summaryValue: { fontSize: 15, color: '#1D4ED8', fontWeight: '600', maxWidth: '70%', textAlign: 'right' },
  
  termsBox: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  termsText: { flex: 1, fontSize: 14, color: '#475569', marginLeft: 12, lineHeight: 20 },

  warningBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', padding: 12, borderRadius: 12, marginBottom: 20 },
  warningTitle: { fontSize: 14, fontWeight: '700', color: '#92400E', marginLeft: 8 },

  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 10 : 24, paddingTop: 16, backgroundColor: '#FFF' },
  primaryBtn: { backgroundColor: '#1D4ED8', height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  disabledBtn: { backgroundColor: '#CBD5E1', shadowOpacity: 0, elevation: 0 },
  primaryBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  
  loginLinkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  loginHintText: { color: '#64748B', fontSize: 14 },
  loginLink: { color: '#1D4ED8', fontSize: 14, fontWeight: '700' }
});
