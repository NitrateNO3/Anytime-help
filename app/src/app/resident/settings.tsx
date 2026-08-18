import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Switch, Platform, StatusBar } from 'react-native';
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('settings.settingsTitle')}</Text>
      </View>

      <View style={styles.profileSection}>
        <View style={styles.avatarBox}>
          <Ionicons name="person" size={40} color="#1D4ED8" />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.name || 'Resident'}</Text>
          <Text style={styles.profileEmail}>{user?.email || 'resident@society.com'}</Text>
        </View>
      </View>

      <View style={styles.settingsGroup}>
        <Text style={styles.groupTitle}>{t('settings.preferences')}</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingItemLeft}>
            <Ionicons name="language-outline" size={24} color="#4B5563" style={styles.settingIcon} />
            <Text style={styles.settingText}>{t('settings.language')}: {i18n.language === 'en' ? 'English' : 'हिंदी'}</Text>
          </View>
          <TouchableOpacity onPress={toggleLanguage} style={{ backgroundColor: '#1D4ED8', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>{t('settings.change')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.settingsGroup}>
        <Text style={styles.groupTitle}>{t('settings.account')}</Text>

        <TouchableOpacity style={styles.settingItemAction} onPress={handleLogout}>
          <View style={styles.settingItemLeft}>
            <Ionicons name="log-out-outline" size={24} color="#EF4444" style={styles.settingIcon} />
            <Text style={[styles.settingText, { color: '#EF4444' }]}>{t('settings.logout')}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FCFDF6' },
  header: { padding: 24, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 20 : 50) : 60, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#111827' },
  profileSection: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#FFFFFF', marginTop: 20 },
  avatarBox: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  profileEmail: { fontSize: 14, color: '#6B7280' },
  settingsGroup: { marginTop: 24, paddingHorizontal: 20 },
  groupTitle: { fontSize: 14, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 12, marginLeft: 4 },
  settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 8 },
  settingItemAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 8 },
  settingItemLeft: { flexDirection: 'row', alignItems: 'center' },
  settingIcon: { marginRight: 12 },
  settingText: { fontSize: 16, fontWeight: '500', color: '#111827' }
});
