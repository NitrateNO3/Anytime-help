import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://anytime-help.onrender.com/api';

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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F24" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <TouchableOpacity onPress={toggleLanguage} style={styles.langToggle}>
          <Text style={styles.langToggleText}>{i18n.language === 'en' ? 'हिंदी' : 'EN'}</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.logoContainer}>
            {/* Heart with plus icon representing care/help */}
            <Ionicons name="medkit" size={64} color="#3B82F6" />
          </View>
          <Text style={styles.title}>Login to Your Account</Text>
        </View>

        <View style={styles.form}>
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

          <View style={styles.inputContainer}>
            <Ionicons name="mail" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
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

          <View style={styles.optionsRow}>
            <TouchableOpacity 
              style={styles.rememberMe}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                {rememberMe && <Ionicons name="checkmark" size={14} color="#FFF" />}
              </View>
              <Text style={styles.rememberMeText}>Remember me</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]} 
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginBtnText}>{loading ? (t('login.loggingInBtn') || 'Signing in...') : 'Sign in'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot the password?</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialContainer}>
            <TouchableOpacity style={styles.socialBtn}>
              <Ionicons name="logo-facebook" size={24} color="#3B82F6" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialBtn}>
              <Ionicons name="logo-google" size={24} color="#DB4437" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialBtn}>
              <Ionicons name="logo-apple" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/register' as any)}>
              <Text style={styles.footerLink}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F24', // Deep premium dark blue
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  langToggle: {
    position: 'absolute',
    top: 50,
    right: 24,
    backgroundColor: '#161F3D',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A365D',
    zIndex: 10,
  },
  langToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  logoContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  form: {
    width: '100%',
  },
  roleContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: '#161F3D',
    borderRadius: 16,
    padding: 6,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  roleBtnActive: {
    backgroundColor: '#3B82F6',
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
    backgroundColor: '#161F3D',
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 60,
    borderWidth: 1,
    borderColor: '#2A365D',
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
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  rememberMe: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#3B82F6',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#3B82F6',
  },
  rememberMeText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  loginBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  loginBtnDisabled: {
    backgroundColor: '#1D4ED8',
    opacity: 0.7,
  },
  loginBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  forgotPassword: {
    alignItems: 'center',
    marginBottom: 32,
  },
  forgotPasswordText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2A365D',
  },
  dividerText: {
    paddingHorizontal: 16,
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '500',
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 32,
  },
  socialBtn: {
    width: 60,
    height: 60,
    backgroundColor: '#161F3D',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A365D',
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
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '700',
  }
});
