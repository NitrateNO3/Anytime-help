import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StatusBar, ImageBackground } from 'react-native';
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

export default function RegisterScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleLanguage = async () => {
    const newLang = i18n.language === 'en' ? 'hi' : 'en';
    await i18n.changeLanguage(newLang);
    await AsyncStorage.setItem('user-language', newLang);
  };

  const handleRegister = async () => {
    if (!name || !phoneNumber || phoneNumber.length < 10) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter Name and a valid Phone Number' });
      return;
    }

    setLoading(true);

    try {
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      const payload: any = { 
        name, 
        phone_number: formattedPhone, 
        role: 'Resident' 
      };

      const res = await axios.post(`${API_URL}/auth/register`, payload);
      const { token, user } = res.data;
      
      // Save token securely
      await SecureStore.setItemAsync('userToken', token);
      await SecureStore.setItemAsync('userData', JSON.stringify(user));

      Toast.show({ type: 'success', text1: 'Welcome', text2: 'Account created successfully!' });
      router.replace('/resident');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Registration Failed', text2: err.response?.data?.msg || err.message || 'Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <View style={styles.imageContainer}>
        <ImageBackground source={bgImage} style={styles.bgImage} resizeMode="cover">
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.5)', 'rgba(30, 64, 175, 0.5)', 'rgba(30, 64, 175, 0.85)', '#1E40AF']}
            style={styles.gradient}
          />
        </ImageBackground>
      </View>

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
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
              <Text style={styles.title}>{t('register.title') || 'Create Account'}</Text>
              <Text style={styles.subtitle}>{t('register.subtitle') || 'Join Anytime Help Community'}</Text>
            </View>

            <View style={styles.formCard}>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#555" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('register.fullName') || 'Full Name'}
                  placeholderTextColor="#777"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.inputContainer}>
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
                />
              </View>

              <TouchableOpacity 
                style={[styles.registerBtn, loading && styles.registerBtnDisabled]} 
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
            </View>
          </View>
        </KeyboardAvoidingView>
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FBF9', // Almost white
    borderRadius: 30, // Changed from 12 to 30 for pill shape
    marginBottom: 16,
    paddingHorizontal: 20, // Increased padding slightly
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
  registerBtn: {
    backgroundColor: '#1D4ED8', // Dark blue button
    borderRadius: 30, // Changed from 12 to 30 for pill shape
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
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
