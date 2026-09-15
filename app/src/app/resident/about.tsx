import React, { useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, StatusBar, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

export default function AboutUs() {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/resident/settings');
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
        <Text style={styles.headerTitle}>About Us</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.heading2}>About Anytime Help</Text>
          <Text style={styles.text}>
            <Text style={styles.bold}>Anytime Help</Text> is a community-focused digital platform developed by <Text style={styles.bold}>SLERWA (Sushant Lok Extension Residents’ Welfare Association)</Text> to make it easier, faster, and more transparent for residents to raise and manage their concerns.
          </Text>

          <Text style={styles.text}>
            We believe that every resident should have a simple and reliable way to report issues affecting their neighbourhood. From civic and infrastructure-related concerns to maintenance and common-area issues, Anytime Help brings the complaint-reporting process into one convenient platform.
          </Text>

          <Text style={styles.text}>
            Through Anytime Help, residents can <Text style={styles.bold}>raise complaints, provide relevant details, track the status of their requests, and stay informed about the progress of issues reported by the community.</Text> This helps create a more organized channel of communication between residents and the association.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading3}>Our Mission</Text>
          <Text style={styles.text}>
            Our mission is to strengthen communication between residents and SLERWA while making community issue management more <Text style={styles.bold}>accessible, transparent, accountable, and efficient</Text>.
          </Text>

          <Text style={styles.text}>
            By bringing technology into everyday community management, Anytime Help aims to reduce delays, improve visibility of reported issues, and help ensure that residents' concerns reach the appropriate team or authority.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading3}>Built for the Community</Text>
          <Text style={styles.text}>
            Anytime Help is designed specifically with the residents of <Text style={styles.bold}>Sushant Lok 2 & 3</Text> in mind. SLERWA works with various civic and government authorities, including MCG, GMDA, DHBVN, DTCP, district administration, and other public representatives, to coordinate matters concerning the community.
          </Text>

          <Text style={styles.text}>
            With Anytime Help, we are taking another step towards building a <Text style={styles.bold}>more connected, responsive, and digitally enabled community</Text>.
          </Text>

          <View style={styles.divider} />

          <Text style={[styles.text, styles.bold, styles.highlight]}>
            One community. One platform. Better communication.
          </Text>

          <Text style={[styles.text, styles.bold, styles.tagline]}>
            Anytime Help — Your concern, our community's priority.
          </Text>
        </View>
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

  content: { padding: 16, paddingTop: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  heading2: { fontSize: 20, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  heading3: { fontSize: 17, fontWeight: '700', color: '#0F172A', marginBottom: 10 },
  text: { fontSize: 14, lineHeight: 22, color: '#475569', marginBottom: 10 },
  bold: { fontWeight: '700', color: '#1E293B' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  highlight: { textAlign: 'center', color: '#2563EB', fontSize: 15, marginBottom: 4 },
  tagline: { textAlign: 'center', color: '#059669', fontSize: 14, marginBottom: 0 }
});
