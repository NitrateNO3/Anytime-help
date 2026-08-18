import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, StatusBar, ImageBackground } from 'react-native';
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
  const [rememberMe, setRememberMe] = useState(false);

  const toggleLanguage = async () => {
    const newLang = i18n.language === 'en' ? 'hi' : 'en';
    await i18n.changeLanguage(newLang);
    await AsyncStorage.setItem('user-language', newLang);
  };
  const [email, setEmail] = useState('test@resident.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please fill in all fields' });
      return;
    }

    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/auth/login`, { email, password });
      const { token, user } = res.data;
      
      // Save token securely
      await SecureStore.setItemAsync('userToken', token);
      await SecureStore.setItemAsync('userData', JSON.stringify(user));

      // Route based on role
      if (user.role === 'Resident') {
        Toast.show({ type: 'success', text1: 'Welcome', text2: 'Logged in successfully' });
        router.replace('/resident');
      } else if (user.role === 'Staff') {
        Toast.show({ type: 'success', text1: 'Welcome', text2: 'Logged in successfully' });
        router.replace('/staff');
      } else {
        Toast.show({ type: 'error', text1: 'Access Denied', text2: 'Admin access restricted to Web App only.' });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Login Failed', text2: err.response?.data?.msg || 'Please check your credentials.' });
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
          <View style={styles.headerTop}>
            <View style={styles.badge}>
              <Ionicons name="shield-checkmark" size={14} color="#10B981" />
              <Text style={styles.badgeText}>RWA APPROVED</Text>
            </View>
            <TouchableOpacity onPress={toggleLanguage} style={styles.langToggle}>
              <Text style={styles.langToggleText}>{i18n.language === 'en' ? 'हिंदी' : 'EN'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.heroTextContainer}>
            <Text style={styles.title}>RWA Anytime Help</Text>
            <Text style={styles.subtitle}>Welcome back to your community</Text>
          </View>

          <View style={styles.glassCard}>
            <View style={styles.roleContainer}>
              <TouchableOpacity 
                style={[styles.roleBtn, role === 'Resident' && styles.roleBtnActive]}
                onPress={() => setRole('Resident')}
              >
                <Ionicons name="home" size={16} color={role === 'Resident' ? '#10B981' : '#6B7280'} style={{marginRight: 6}} />
                <Text style={[styles.roleBtnText, role === 'Resident' && styles.roleBtnTextActive]}>
                  {t('login.residentLogin') || 'Resident'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.roleBtn, role === 'Staff' && styles.roleBtnActive]}
                onPress={() => setRole('Staff')}
              >
                <Ionicons name="construct" size={16} color={role === 'Staff' ? '#3B82F6' : '#6B7280'} style={{marginRight: 6}} />
                <Text style={[styles.roleBtnText, role === 'Staff' && styles.roleBtnTextActive]}>
                  {t('login.staffLogin') || 'Staff'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email Address"
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
                placeholder="Password"
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
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]} 
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.loginBtnText}>{loading ? (t('login.loggingInBtn') || 'Signing in...') : 'Log In'}</Text>
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
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/register' as any)}>
                <Text style={styles.footerLink}>Register Here</Text>
              </TouchableOpacity>
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
    padding: 24,
    justifyContent: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 24,
    right: 24,
    zIndex: 10,
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
  langToggle: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  langToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
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
  roleContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
    padding: 6,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  roleBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  roleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  roleBtnTextActive: {
    color: '#FFF',
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
  loginBtn: {
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
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
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
