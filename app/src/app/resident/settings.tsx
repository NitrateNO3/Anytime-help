import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState<any>(null);

  const toggleLanguage = async () => {
    const newLang = i18n.language === 'en' ? 'hi' : 'en';
    await i18n.changeLanguage(newLang);
    await AsyncStorage.setItem('user-language', newLang);
  };

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await SecureStore.getItemAsync('userData');
    if (userData) setUser(JSON.parse(userData));
  };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('userToken');
    await SecureStore.deleteItemAsync('userData');
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1D4ED8" />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 30) : 40, paddingBottom: 15, paddingHorizontal: 24, backgroundColor: '#1D4ED8', zIndex: 1 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#FFFFFF' }}>{t('settings.settingsTitle') || 'Settings'}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingTop: 20, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
      
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarBox}>
            <Ionicons name="person" size={36} color="#1D4ED8" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'Resident'}</Text>
            <Text style={styles.profileEmail}>{user?.email || 'resident@society.com'}</Text>
          </View>
        </View>

        {/* Preferences */}
        <View style={styles.settingsGroup}>
          <Text style={styles.groupTitle}>{t('settings.preferences') || 'PREFERENCES'}</Text>
          <View style={styles.cardGroup}>
            <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
              <View style={styles.settingRowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: '#E0E7FF' }]}>
                  <Ionicons name="language-outline" size={20} color="#4338CA" />
                </View>
                <Text style={styles.settingText}>{t('settings.language') || 'Language'}: {i18n.language === 'en' ? 'English' : 'हिंदी'}</Text>
              </View>
              <TouchableOpacity onPress={toggleLanguage} style={styles.changeBtn}>
                <Text style={styles.changeBtnText}>{t('settings.change') || 'Change'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Support & About */}
        <View style={styles.settingsGroup}>
          <Text style={styles.groupTitle}>SUPPORT & ABOUT</Text>
          <View style={styles.cardGroup}>
            <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/resident/privacy')}>
              <View style={styles.settingRowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: '#F3F4F6' }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#4B5563" />
                </View>
                <Text style={styles.settingText}>Privacy Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/resident/about')}>
              <View style={styles.settingRowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: '#F3F4F6' }]}>
                  <Ionicons name="information-circle-outline" size={20} color="#4B5563" />
                </View>
                <Text style={styles.settingText}>About Us</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/resident/support')}>
              <View style={styles.settingRowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="help-buoy-outline" size={20} color="#D97706" />
                </View>
                <Text style={styles.settingText}>Help & Support</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.settingRow, { borderBottomWidth: 0 }]} onPress={() => Linking.openURL('https://www.slerwa.in')}>
              <View style={styles.settingRowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="globe-outline" size={20} color="#2563EB" />
                </View>
                <Text style={[styles.settingText, { flexShrink: 1 }]} numberOfLines={2}>
                  Know more about RWA (www.slerwa.in)
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Account */}
        <View style={styles.settingsGroup}>
          <Text style={styles.groupTitle}>{t('settings.account') || 'ACCOUNT'}</Text>
          <View style={styles.cardGroup}>
            <TouchableOpacity style={[styles.settingRow, { borderBottomWidth: 0 }]} onPress={handleLogout}>
              <View style={styles.settingRowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="log-out-outline" size={20} color="#DC2626" />
                </View>
                <Text style={[styles.settingText, { color: '#DC2626', fontWeight: '600' }]}>{t('settings.logout') || 'Logout'}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F4F6' },
  profileCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFFFFF', 
    padding: 20, 
    borderRadius: 20, 
    marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
  },
  avatarBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  profileEmail: { fontSize: 14, color: '#6B7280' },
  settingsGroup: { marginBottom: 24 },
  groupTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginLeft: 16 },
  cardGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1
  },
  settingRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingVertical: 16, 
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  settingRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12 },
  iconContainer: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  settingText: { fontSize: 16, fontWeight: '500', color: '#1F2937', flex: 1 }, 
  changeBtn: { backgroundColor: '#1D4ED8', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  changeBtnText: { color: 'white', fontWeight: '600', fontSize: 13 }
});
