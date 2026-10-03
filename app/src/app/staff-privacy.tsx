import React, { useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { WebView } from 'react-native-webview';

const privacyPolicyHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 20px; color: #4B5563; line-height: 1.6; padding-bottom: 50px;}
    h1 { font-size: 22px; color: #111827; line-height: 1.3;}
    h2 { font-size: 18px; color: #111827; margin-top: 24px; line-height: 1.3;}
    h3 { font-size: 16px; color: #111827; margin-top: 20px; line-height: 1.3;}
    p { margin-bottom: 16px; font-size: 14px; }
    ul { padding-left: 20px; margin-bottom: 16px; font-size: 14px; }
    li { margin-bottom: 8px; }
    strong { color: #111827; }
    .alert-box { border: 1px solid #F87171; background-color: #FEF2F2; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
    .alert-box h2 { margin-top: 0; color: #B91C1C; font-size: 16px; }
    .alert-box p { color: #991B1B; margin-bottom: 8px; font-size: 14px;}
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; margin-top: 8px;}
    th, td { border: 1px solid #D1D5DB; padding: 8px; text-align: left; font-size: 13px; }
    th { background-color: #F3F4F6; color: #111827;}
    .summary { background-color: #F3F4F6; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
  </style>
</head>
<body>

<h1>ANYTIME HELP — STAFF TERMS & CONDITIONS, PRIVACY & DATA DECLARATION</h1>

<p><strong>Version:</strong> 1.0<br/>
<strong>Effective from:</strong> 30 August 2026<br/>
<strong>Applies to:</strong> Staff members of Anytime Help<br/>
<strong>Operated by:</strong> Anytime Help</p>

<div class="summary">
  <h3>In short</h3>
  <p>Anytime Help is an app used by staff to view and resolve complaints. This document outlines your responsibilities as a staff member regarding user data, confidentiality, and professional conduct.</p>
</div>

<h2>PART 1 — TERMS OF USE</h2>

<h3>2. Confidentiality</h3>
<p><strong>2.1</strong> As a staff member, you will have access to resident names, addresses, and contact details to resolve complaints. You must keep this information strictly confidential.</p>
<p><strong>2.2</strong> Do not share, screenshot, or distribute resident information or complaint details outside of the platform.</p>

<h3>3. Professional Conduct</h3>
<p><strong>3.1</strong> You are expected to behave professionally while using the platform and interacting with residents.</p>
<p><strong>3.2</strong> Update the status of tasks accurately and upload clear 'after' pictures when a task is completed.</p>

<h2>PART 2 — PRIVACY & DATA DECLARATION</h2>

<h3>4. Your Data</h3>
<p><strong>4.1</strong> We collect your name, phone number, and category assignments to manage your account and assign relevant tasks.</p>

<br/>
<p><em>* This is the staff-facing portion of the Privacy & Data Declaration.</em></p>

</body>
</html>
`;

export default function StaffPrivacyPolicy() {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/staff-settings');
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
      <View style={styles.headerBar}>
        <TouchableOpacity 
          onPress={handleBack} 
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy & Terms</Text>
        <View style={{ width: 36 }} />
      </View>
      <WebView 
        originWhitelist={['*']}
        source={{ html: privacyPolicyHTML }}
        style={{ flex: 1, backgroundColor: '#F8FAFC' }}
      />
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', flex: 1 }
});
