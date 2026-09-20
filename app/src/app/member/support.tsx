import React, { useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, StatusBar, Linking, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

export default function HelpSupport() {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/member/settings' as any);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleBack();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [])
  );

  const handleCall = () => {
    Linking.openURL('tel:+918882004800');
  };

  const handleEmail = () => {
    Linking.openURL('mailto:support@anytimehelp.com');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1D4ED8" />

      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity 
          onPress={handleBack} 
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.introBox}>
          <Text style={styles.introTitle}>How can we help you today?</Text>
          <Text style={styles.introSub}>
            Reach out to our resident assistance team for help with any service or inquiry.
          </Text>
        </View>

        {/* Contact Cards */}
        <TouchableOpacity style={styles.contactCard} onPress={handleCall} activeOpacity={0.7}>
          <View style={[styles.iconCircle, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="call" size={24} color="#10B981" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Phone Support</Text>
            <Text style={styles.cardSub}>+91 88820 04800</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.contactCard} onPress={handleEmail} activeOpacity={0.7}>
          <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="mail" size={24} color="#2563EB" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Email Support</Text>
            <Text style={styles.cardSub}>support@anytimehelp.com</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
        </TouchableOpacity>

        <View style={styles.contactCard}>
          <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="location" size={24} color="#D97706" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Office Address</Text>
            <Text style={styles.cardSub}>G-564, Block G, Sushant Lok 2, Sector 57, Gurugram, Haryana 122011</Text>
          </View>
        </View>

        {/* Quick Action Button */}
        <TouchableOpacity 
          style={styles.raiseBanner} 
          onPress={() => router.replace('/member/raise' as any)}
          activeOpacity={0.8}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.raiseBannerTitle}>Have an issue in your society?</Text>
            <Text style={styles.raiseBannerSub}>Lodge a grievance with photo and location</Text>
          </View>
          <View style={styles.raiseBtnCircle}>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 24) : 20, 
    paddingBottom: 14, 
    backgroundColor: '#1D4ED8',
    elevation: 4,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 1,
  },
  backButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', flex: 1 },

  content: { padding: 16, paddingTop: 20 },
  introBox: { marginBottom: 20 },
  introTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  introSub: { fontSize: 14, color: '#64748B', lineHeight: 20 },

  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  cardSub: { fontSize: 13, color: '#64748B' },

  raiseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1D4ED8',
    borderRadius: 18,
    padding: 20,
    marginTop: 16,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  raiseBannerTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  raiseBannerSub: { fontSize: 13, color: '#BFDBFE' },
  raiseBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
});
