import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, StatusBar, ImageBackground, ScrollView } from 'react-native';
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
      
      {/* Top Image with Seamless Fade */}
      <View style={styles.imageContainer}>
        <ImageBackground source={bgImage} style={styles.bgImage} resizeMode="cover">
          <LinearGradient
            colors={['transparent', 'transparent', 'rgba(41, 138, 82, 0.8)', '#298A52']}
            style={styles.gradient}
          />
        </ImageBackground>
      </View>

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            <View style={styles.langToggleContainer}>
              <TouchableOpacity onPress={toggleLanguage} style={styles.langToggle}>
                <Text style={styles.langToggleText}>{i18n.language === 'en' ? 'हिंदी' : 'EN'}</Text>
              </TouchableOpacity>
            </View>

            {/* Header / Hero */}
            <View style={styles.heroSection}>
              <View style={styles.iconCircle}>
                <Ionicons name="log-in-outline" size={40} color="#0F6D36" />
              </View>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Login to Anytime Help</Text>
            </View>

            {/* Form Card */}
            <View style={styles.formCard}>
              <View style={styles.roleContainer}>
                <TouchableOpacity 
                  style={[styles.roleBtn, role === 'Resident' && styles.roleBtnActive]}
                  onPress={() => setRole('Resident')}
                >
                  <Text style={[styles.roleBtnText, role === 'Resident' && styles.roleBtnTextActive]}>
                    Resident
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.roleBtn, role === 'Staff' && styles.roleBtnActive]}
                  onPress={() => setRole('Staff')}
                >
                  <Text style={[styles.roleBtnText, role === 'Staff' && styles.roleBtnTextActive]}>
                    Staff
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#555" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor="#777"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#555" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#777"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#555" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={[styles.loginBtn, loading && styles.loginBtnDisabled]} 
                onPress={handleLogin}
                disabled={loading}
              >
                <Text style={styles.loginBtnText}>{loading ? 'Logging In...' : 'Log In'}</Text>
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/register' as any)}>
                  <Text style={styles.footerLink}>Sign Up</Text>
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
    backgroundColor: '#298A52', // Match the bottom fade color
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
  scrollContent: {
    flexGrow: 1,
    paddingTop: '25%', // Push content down over the image
  },
  langToggleContainer: {
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  langToggle: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  langToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconCircle: {
    width: 80,
    height: 80,
    backgroundColor: '#E8F5E9',
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
    color: '#E8F5E9',
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: '#D1E6D3', // Light greenish card
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingTop: 32,
    flex: 1,
    minHeight: 400,
  },
  roleContainer: {
    flexDirection: 'row',
    backgroundColor: '#BFE0C6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  roleBtnActive: {
    backgroundColor: '#0F6D36',
  },
  roleBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F6D36',
  },
  roleBtnTextActive: {
    color: '#FFF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FBF9', // Almost white
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
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
    backgroundColor: '#0F6D36', // Dark green button
    borderRadius: 12,
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
    color: '#0F6D36',
    fontSize: 15,
    fontWeight: '700',
  }
});
