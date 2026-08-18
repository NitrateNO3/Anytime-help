import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StatusBar, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = 'https://anytime-help.onrender.com/api';
const bgImage = require('../../assets/images/electrician-review-response-templates-featured.webp');

export default function RegisterScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please fill in all fields' });
      return;
    }

    setLoading(true);

    try {
      const payload: any = { name, email, password, role: 'Resident' };

      const res = await axios.post(`${API_URL}/auth/register`, payload);
      const { token, user } = res.data;
      
      // Save token securely
      await SecureStore.setItemAsync('userToken', token);
      await SecureStore.setItemAsync('userData', JSON.stringify(user));

      Toast.show({ type: 'success', text1: 'Welcome', text2: 'Account created successfully!' });
      router.replace('/resident');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Registration Failed', text2: err.response?.data?.msg || 'Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <ImageBackground source={bgImage} style={styles.bgImage} resizeMode="cover">
        <LinearGradient
          colors={['rgba(10, 15, 36, 0.4)', 'rgba(10, 15, 36, 0.8)', '#0A0F24']}
          style={styles.gradient}
        />
      </ImageBackground>

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.headerTop}>
              <View style={styles.badge}>
                <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                <Text style={styles.badgeText}>RWA APPROVED</Text>
              </View>
            </View>

            <View style={styles.heroTextContainer}>
              <Text style={styles.title}>{t('register.title') || 'Create Account'}</Text>
              <Text style={styles.subtitle}>{t('register.subtitle') || 'Sign up to get started'}</Text>
            </View>

            <View style={styles.glassCard}>

              <View style={styles.inputContainer}>
                <Ionicons name="person" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('register.fullName') || 'Full Name'}
                  placeholderTextColor="#6B7280"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="mail" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('register.email') || 'Email Address'}
                  placeholderTextColor="#6B7280"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('register.password') || 'Password'}
                  placeholderTextColor="#6B7280"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showPassword ? "eye" : "eye-off"} size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={[styles.registerBtn, loading && styles.registerBtnDisabled]} 
                onPress={handleRegister}
                disabled={loading}
              >
                <Text style={styles.registerBtnText}>{loading ? (t('register.creating') || 'Creating...') : (t('register.signup') || 'Sign Up')}</Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity style={styles.socialBtn}>
                <Ionicons name="logo-google" size={20} color="#DB4437" />
                <Text style={styles.socialBtnText}>Continue with Google</Text>
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={styles.footerText}>{t('register.alreadyHave') || 'Already have an account? '}</Text>
                <TouchableOpacity onPress={() => router.push('/login' as any)}>
                  <Text style={styles.footerLink}>{t('register.loginHere') || 'Log In Here'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F24',
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    height: '60%',
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
    marginTop: Platform.OS === 'ios' ? 20 : 0,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  badgeText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  heroTextContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#E5E7EB',
    fontWeight: '500',
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 60,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    fontSize: 15,
    color: '#FFFFFF',
  },
  registerBtn: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  registerBtnDisabled: {
    opacity: 0.7,
  },
  registerBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    paddingHorizontal: 16,
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
  },
  socialBtn: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: 'transparent',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 24,
  },
  socialBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  footerLink: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
  }
});
