import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, StatusBar, ImageBackground, ScrollView, TouchableWithoutFeedback, Keyboard } from 'react-native';
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

export default function LoginScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [role, setRole] = useState('Resident');

  const toggleLanguage = async () => {
    const newLang = i18n.language === 'en' ? 'hi' : 'en';
    await i18n.changeLanguage(newLang);
    await AsyncStorage.setItem('user-language', newLang);
  };
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  // Auto-login check
  useEffect(() => {
    const checkLogin = async () => {
      try {
        const token = await SecureStore.getItemAsync('userToken');
        const userDataStr = await SecureStore.getItemAsync('userData');
        if (token && userDataStr) {
          const user = JSON.parse(userDataStr);
          if (user.role === 'Resident') {
            router.replace('/resident');
          } else if (user.role === 'Staff') {
            router.replace('/staff');
          }
        }
      } catch (e) {
        console.log("No saved session");
      }
    };
    checkLogin();
  }, []);

  // OTP Countdown Timer
  useEffect(() => {
    let interval: any = null;
    if (step === 'OTP' && timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, timer]);

  const sendOTP = async () => {
    if (!phoneNumber || phoneNumber.length !== 10) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter a valid 10-digit phone number' });
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/send-otp`, {
        phone_number: phoneNumber,
        role: role
      });

      setStep('OTP');
      setTimer(60); // Start 60-second countdown
      Toast.show({ type: 'success', text1: 'OTP Sent', text2: res.data.msg || 'Please check your messages' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed to send OTP', text2: err.response?.data?.msg || err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyLogin = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter a valid 6-digit OTP' });
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/verify-otp`, {
        phone_number: phoneNumber.trim(),
        otp: verificationCode.trim(),
        role: role
      });
      
      const { token, user } = res.data;

      await SecureStore.setItemAsync('userToken', token);
      await SecureStore.setItemAsync('userData', JSON.stringify(user));

      if (user.role === 'Resident') {
        Toast.show({ type: 'success', text1: 'Welcome', text2: 'Logged in successfully' });
        router.replace('/resident');
      } else if (user.role === 'Staff') {
        Toast.show({ type: 'success', text1: 'Welcome', text2: 'Logged in successfully' });
        router.replace('/staff');
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Login Failed', text2: err.response?.data?.msg || err.message || 'Invalid OTP' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Top Image with Seamless Fade */}
      <View style={styles.imageContainer}>
        <ImageBackground source={bgImage} style={styles.bgImage} resizeMode="cover">
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.5)', 'rgba(30, 64, 175, 0.5)', 'rgba(30, 64, 175, 0.85)', '#1E40AF']}
            style={styles.gradient}
          />
        </ImageBackground>
      </View>

      <SafeAreaView style={styles.safeArea}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.langToggleContainer}>
            <TouchableOpacity onPress={toggleLanguage} style={styles.langToggle}>
              <Ionicons name="language-outline" size={16} color="#FFF" style={{marginRight: 6}} />
              <Text style={styles.langToggleText}>{i18n.language === 'en' ? 'हिंदी' : 'EN'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mainContent}>
            {/* Header / Hero */}
            <View style={styles.heroSection}>
              <View style={styles.badgeContainer}>
                <Ionicons name="shield-checkmark" size={14} color="#F59E0B" />
                <Text style={styles.badgeText}>RWA APPROVED</Text>
              </View>
              <View style={styles.iconCircle}>
                <Ionicons name="business" size={40} color="#1D4ED8" />
              </View>
              <Text style={styles.title}>{t('login.welcomeBack') || 'Welcome Back'}</Text>
              <Text style={styles.subtitle}>{t('login.subtitle') || 'Login to Anytime Help'}</Text>
            </View>

            {/* Form Card */}
            <View style={styles.formCard}>
              <View style={styles.roleContainer}>
                <TouchableOpacity 
                  style={[styles.roleBtn, role === 'Resident' && styles.roleBtnActive]}
                  onPress={() => setRole('Resident')}
                >
                  <Text style={[styles.roleBtnText, role === 'Resident' && styles.roleBtnTextActive]}>
                    {t('login.residentLogin') || 'Resident'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.roleBtn, role === 'Staff' && styles.roleBtnActive]}
                  onPress={() => setRole('Staff')}
                >
                  <Text style={[styles.roleBtnText, role === 'Staff' && styles.roleBtnTextActive]}>
                    {t('login.staffLogin') || 'Staff'}
                  </Text>
                </TouchableOpacity>
              </View>

              {step === 'PHONE' ? (
                <>
                  <View style={styles.inputContainer}>
                    <Ionicons name="call-outline" size={20} color="#555" style={styles.inputIcon} />
                    <Text style={{fontSize: 16, color: '#333', marginRight: 8}}>+91</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t('login.phonePlaceholder') || 'Phone Number'}
                      placeholderTextColor="#777"
                      keyboardType="phone-pad"
                      maxLength={10}
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                    />
                  </View>

                  <TouchableOpacity 
                    style={[styles.loginBtn, loading && styles.loginBtnDisabled]} 
                    onPress={sendOTP}
                    disabled={loading}
                  >
                    <Text style={styles.loginBtnText}>{loading ? 'Sending OTP...' : 'Get OTP'}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.inputContainer}>
                    <Ionicons name="keypad-outline" size={20} color="#555" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter 6-digit OTP"
                      placeholderTextColor="#777"
                      keyboardType="number-pad"
                      maxLength={6}
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                    />
                  </View>

                  <TouchableOpacity 
                    style={[styles.loginBtn, loading && styles.loginBtnDisabled]} 
                    onPress={handleVerifyLogin}
                    disabled={loading}
                  >
                    <Text style={styles.loginBtnText}>{loading ? 'Verifying...' : 'Verify & Login'}</Text>
                  </TouchableOpacity>
                  
                  <View style={{flexDirection: 'row', justifyContent: 'center', marginBottom: 20}}>
                    {timer > 0 ? (
                      <Text style={{color: '#555', fontWeight: '500'}}>Resend OTP in {timer}s</Text>
                    ) : (
                      <TouchableOpacity onPress={sendOTP} disabled={loading}>
                        <Text style={{color: '#1D4ED8', fontWeight: '700'}}>Resend OTP</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <TouchableOpacity onPress={() => setStep('PHONE')} style={{alignItems: 'center', marginBottom: 20}}>
                    <Text style={{color: '#1D4ED8', fontWeight: '600'}}>Change Phone Number</Text>
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.footer}>
                <Text style={styles.footerText}>{t('login.noAccount') || "Don't have an account? "}</Text>
                <TouchableOpacity onPress={() => router.push('/register' as any)}>
                  <Text style={styles.footerLink}>{t('login.registerHere') || 'Sign Up'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          </ScrollView>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </SafeAreaView>
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
    paddingTop: 140, // Minimum space from top
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
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
    marginBottom: 30,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7', // Soft gold background
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
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
    backgroundColor: '#EFF6FF',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
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
    padding: 24,
    paddingTop: 32,
    flex: 1,
    minHeight: 400,
    marginBottom: 20,
  },
  roleContainer: {
    flexDirection: 'row',
    backgroundColor: '#BFDBFE',
    borderRadius: 30, // Changed from 12
    padding: 4,
    marginBottom: 20,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 26, // Slightly smaller than container to fit inside
  },
  roleBtnActive: {
    backgroundColor: '#1D4ED8',
  },
  roleBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  roleBtnTextActive: {
    color: '#FFF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FBF9', // Almost white
    borderRadius: 30, // Changed from 12 to 30 for pill shape
    marginBottom: 16,
    paddingHorizontal: 20, // Increased padding slightly for pill shape
    height: 60,
  },
  inputIcon: {
    marginRight: 12,
  },
  eyeIcon: {
    padding: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#333',
  },
  loginBtn: {
    backgroundColor: '#1D4ED8', // Dark blue button
    borderRadius: 30, // Changed from 12 to 30 for pill shape
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingBottom: 20,
  },
  footerText: {
    color: '#555',
    fontSize: 15,
  },
  footerLink: {
    color: '#1D4ED8',
    fontSize: 15,
    fontWeight: '700',
  }
});
