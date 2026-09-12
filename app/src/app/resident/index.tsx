import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';

export default function ResidentHome() {
  const router = useRouter();
  const { t } = useTranslation();
  const [user, setUser] = useState<any>(null);

  useFocusEffect(
    React.useCallback(() => {
      SecureStore.getItemAsync('userData').then((data) => {
        if (data) setUser(JSON.parse(data));
      });
    }, [])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1D4ED8" />

      {/* Curved Blue Header */}
      <LinearGradient
        colors={['#1D4ED8', '#1E3A8A']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 260, zIndex: 0, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 }}
      />

      <View style={[styles.container, { zIndex: 1, paddingHorizontal: 24 }]}>
        {/* Title Area */}
        <View style={[styles.titleArea, { paddingTop: 60 }]}>
          <View style={[styles.greetingRow, { alignItems: 'flex-start' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.greetingText, {color: '#93C5FD'}]}>
                {t('resident.hello').replace(',', '')} {user?.name ? user.name.split(' ')[0] : 'Resident'} 👋
              </Text>
              <Text style={[styles.exploreText, {color: '#FFFFFF'}]}>{t('resident.societyName')}</Text>
            </View>
            <TouchableOpacity style={styles.avatarContainer} onPress={() => router.push('/resident/settings')}>
              <Ionicons name="person" size={24} color="#1D4ED8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 2x2 Grid Dashboard (Centered vertically in remaining space) */}
        <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 20 }}>
          <View style={styles.dashboardGrid}>
            {/* Card 1: Lodge Grievance */}
            <TouchableOpacity 
              style={styles.gridCard}
              onPress={() => router.push('/resident/raise')}
              activeOpacity={0.8}
            >
              <View style={[styles.gridIconCircle, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="megaphone" size={32} color="#EF4444" />
              </View>
              <Text style={styles.gridCardTitle}>{t('resident.lodgeGrievance')}</Text>
              <Text style={styles.gridCardSub}>{t('resident.lodgeGrievanceSub')}</Text>
            </TouchableOpacity>

            {/* Card 2: My Complaints */}
            <TouchableOpacity 
              style={styles.gridCard}
              onPress={() => router.push('/resident/my-complaints')}
              activeOpacity={0.8}
            >
              <View style={[styles.gridIconCircle, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="list" size={32} color="#10B981" />
              </View>
              <Text style={styles.gridCardTitle}>{t('resident.myComplaints')}</Text>
              <Text style={styles.gridCardSub}>{t('resident.myComplaintsSub')}</Text>
            </TouchableOpacity>

            {/* Card 3: Announcements */}
            <TouchableOpacity 
              style={styles.gridCard}
              onPress={() => router.push('/resident/announcements')}
              activeOpacity={0.8}
            >
              <View style={[styles.gridIconCircle, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="notifications" size={32} color="#3B82F6" />
              </View>
              <Text style={styles.gridCardTitle}>{t('resident.announcements')}</Text>
              <Text style={styles.gridCardSub}>{t('resident.announcementsSub')}</Text>
            </TouchableOpacity>

            {/* Card 4: Directory */}
            <TouchableOpacity 
              style={styles.gridCard}
              onPress={() => router.push('/resident/search')}
              activeOpacity={0.8}
            >
              <View style={[styles.gridIconCircle, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="people" size={32} color="#8B5CF6" />
              </View>
              <Text style={styles.gridCardTitle}>{t('resident.directory')}</Text>
              <Text style={styles.gridCardSub}>{t('resident.directorySub')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FCFDF6' },
  container: { flex: 1 },
  contentContainer: { paddingBottom: 100, paddingTop: 60, paddingHorizontal: 24 },
  titleArea: { marginBottom: 30 },
  greetingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greetingText: { fontSize: 18, color: '#4B5563', marginBottom: 4, fontWeight: '500' },
  exploreText: { fontSize: 32, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  avatarContainer: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#1D4ED8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  dashboardGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 10, marginBottom: 20 },
  gridCard: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, marginBottom: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 3, borderWidth: 2, borderColor: 'transparent' },
  gridIconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 12, position: 'relative' },
  gridCardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 4 },
  gridCardSub: { fontSize: 12, color: '#6B7280', textAlign: 'center', lineHeight: 16 },
});
