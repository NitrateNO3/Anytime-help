import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function AboutUs() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About Us</Text>
        <View style={{width: 24}} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
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

        <Text style={styles.heading3}>Our Mission</Text>
        
        <Text style={styles.text}>
          Our mission is to strengthen communication between residents and SLERWA while making community issue management more <Text style={styles.bold}>accessible, transparent, accountable, and efficient</Text>.
        </Text>

        <Text style={styles.text}>
          By bringing technology into everyday community management, Anytime Help aims to reduce delays, improve visibility of reported issues, and help ensure that residents' concerns reach the appropriate team or authority.
        </Text>

        <Text style={styles.heading3}>Built for the Community</Text>

        <Text style={styles.text}>
          Anytime Help is designed specifically with the residents of <Text style={styles.bold}>Sushant Lok 2 & 3</Text> in mind. SLERWA works with various civic and government authorities, including MCG, GMDA, DHBVN, DTCP, district administration, and other public representatives, to coordinate matters concerning the community.
        </Text>

        <Text style={styles.text}>
          With Anytime Help, we are taking another step towards building a <Text style={styles.bold}>more connected, responsive, and digitally enabled community</Text>.
        </Text>

        <Text style={[styles.text, styles.bold, styles.highlight]}>
          One community. One platform. Better communication.
        </Text>

        <Text style={[styles.text, styles.bold, styles.tagline]}>
          Anytime Help — Your concern, our community's priority.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FCFDF6' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 40) : 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FFF' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#111827' },
  content: { padding: 24, paddingBottom: 120 },
  heading2: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 12, marginTop: 8 },
  heading3: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 8, marginTop: 20 },
  text: { fontSize: 15, lineHeight: 24, color: '#4B5563', marginBottom: 12 },
  bold: { fontWeight: 'bold', color: '#111827' },
  highlight: { marginTop: 16, textAlign: 'center', color: '#1D4ED8', fontSize: 16 },
  tagline: { marginTop: 8, textAlign: 'center', color: '#047857', fontSize: 16 }
});
