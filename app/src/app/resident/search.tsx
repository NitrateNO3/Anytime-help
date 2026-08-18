import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Linking, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export default function DirectoryScreen() {
  const { t } = useTranslation();
  const contacts = [
    { id: '1', name: 'Security Gate Main', role: 'Security', phone: '+91 9876543210', icon: 'shield-checkmark' },
    { id: '2', name: 'Estate Manager', role: 'Admin', phone: '+91 9876543211', icon: 'business' },
    { id: '3', name: 'Emergency Medical', role: 'Ambulance', phone: '108', icon: 'medkit' },
    { id: '4', name: 'Electrician (Ramesh)', role: 'Maintenance', phone: '+91 9876543212', icon: 'flash' },
    { id: '5', name: 'Plumber (Suresh)', role: 'Maintenance', phone: '+91 9876543213', icon: 'water' },
  ];

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('search.title')}</Text>
        <Text style={styles.headerSubtitle}>{t('search.subtitle')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        {contacts.map((contact) => (
          <View key={contact.id} style={styles.card}>
            <View style={styles.iconBox}>
              <Ionicons name={contact.icon as any} size={24} color="#111827" />
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{contact.name}</Text>
              <Text style={styles.role}>{contact.role}</Text>
            </View>
            <TouchableOpacity style={styles.callBtn} onPress={() => handleCall(contact.phone)}>
              <Ionicons name="call" size={20} color="#1D4ED8" />
            </TouchableOpacity>
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FCFDF6' },
  header: { padding: 24, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 20 : 50) : 60, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#111827' },
  headerSubtitle: { fontSize: 16, color: '#6B7280', marginTop: 4 },
  contentContainer: { padding: 20 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  iconBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  role: { fontSize: 14, color: '#6B7280' },
  callBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center' },
});
