// Terms of Use & Privacy Consent shown during resident registration.
// The resident must open it and scroll to the end before "I Agree" is enabled;
// agreeing ticks the consent checkbox on the registration screen.
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PolicyHtml from './PolicyHtml';

// Bump when the text changes; stored with the user's consent on registration.
export const REGISTER_TERMS_VERSION = '2026-11-03';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const buildRegisterTermsHtml = (areaName?: string) => {
  const area = areaName ? escapeHtml(areaName) : 'your area';
  return `
<h1>Terms of Use and Privacy Consent</h1>
<p><em>Effective from 3 November 2026</em></p>

<h2>1. About the service</h2>
<p>Anytime Help enables residents of ${area} to submit complaints about local services, including electricity or lighting, water, and garbage collection. We map a complaint to the resident’s address and forward it to the relevant Residents’ Welfare Association (“RWA”) chairman or authorised RWA representative for review and resolution.</p>
<p>Anytime Help is a complaint submission and coordination service. We will make reasonable efforts to route complaints promptly, but we do not guarantee a particular response time, outcome, or resolution by the RWA or any service provider. For emergencies or immediate safety risks, contact the appropriate emergency service or utility directly.</p>

<h2>2. Information we collect</h2>
<p>To operate the service, we collect the information you provide, which may include:</p>
<ul>
  <li>Your mobile number and any other phone number you provide;</li>
  <li>Your email address;</li>
  <li>Your current residential address, including details needed to identify your sector and map the complaint; and</li>
  <li>The details of your complaint and any information you choose to include in it.</li>
</ul>
<p>Please do not include another person’s personal information or sensitive details in a complaint unless they are necessary and you are authorised to share them.</p>

<h2>3. How we use and share information</h2>
<p>We use your information to identify and map your residence, create and track your complaint, assign it to the relevant RWA chairman or authorised representative, contact you for clarification, and communicate updates about its status.</p>
<p>We share the information needed to handle your complaint with the relevant RWA chairman or authorised RWA representatives. They may contact you using the details you provided. We may also use service providers that help us host, secure, and operate the app, subject to appropriate confidentiality and security arrangements. We do not sell your personal information.</p>

<h2>4. Your consent</h2>
<p><strong>By entering your information and selecting “I Agree” when you register, you consent to Anytime Help collecting, using, storing, and sharing the information described in Sections 2 and 3 for the purpose of receiving, routing, managing, and resolving your complaint.</strong> You understand that your complaint and relevant contact and address details will be made available to the assigned RWA chairman or authorised RWA representatives.</p>
<p>You may withdraw your consent by contacting us at support@anytimehelp.com or by deleting your account from Settings in the app. Withdrawal will not affect processing already carried out before we receive it. It may prevent us or the RWA from continuing to handle your complaint. We may retain information where required or permitted by applicable law.</p>

<h2>5. Accuracy and appropriate use</h2>
<p>You agree to provide information that is accurate to the best of your knowledge and to use the app for genuine complaints concerning the specified sector. You must not knowingly submit false, abusive, unlawful, or misleading complaints, impersonate another person, or interfere with the service.</p>

<h2>6. Retention and security</h2>
<p>We keep your account and profile information for as long as your account is active. You can delete your account at any time from Settings → Delete Account; this permanently removes your account and profile details. Complaints you have already submitted may be kept as service records of the RWA, or for longer where required for a legal obligation or an ongoing dispute.</p>
<p>We use reasonable technical and organisational safeguards to protect personal information. No electronic system can be guaranteed completely secure.</p>

<h2>7. Your requests and complaints</h2>
<p>You may contact us at support@anytimehelp.com to request access to or correction of your information, withdraw consent, or raise a concern about how your information is handled. We will respond in accordance with applicable law. Where applicable, you may also use the complaint mechanism provided under Indian data protection law.</p>

<h2>8. Changes to these terms</h2>
<p>We may update these terms when the service or legal requirements change. We will display the updated terms and effective date in the app. Where required, we will seek fresh consent before using your information for a new purpose.</p>

<h2>9. Applicable law</h2>
<p>These terms are governed by the laws of India. Nothing in these terms limits any right or remedy that cannot lawfully be limited, or excludes any responsibility that applicable law does not permit us to exclude.</p>

<h2>10. Contact</h2>
<p>For questions about Anytime Help or your personal information, contact:</p>
<p><strong>Anytime Help</strong><br/>
G-564, Block G, Sushant Lok 2, Sector 57, Gurugram, Haryana 122011<br/>
support@anytimehelp.com<br/>
+91 88820 04800</p>
`;
};

type Props = {
  visible: boolean;
  areaName?: string;
  onAgree: () => void;
  onClose: () => void;
};

export default function RegisterTermsModal({ visible, areaName, onAgree, onClose }: Props) {
  const [reachedEnd, setReachedEnd] = useState(false);
  const [viewHeight, setViewHeight] = useState(0);
  const html = React.useMemo(() => buildRegisterTermsHtml(areaName), [areaName]);

  React.useEffect(() => {
    if (visible) setReachedEnd(false);
  }, [visible]);

  const onScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 40) setReachedEnd(true);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* A Modal is a separate native view: it needs its own provider or the
          safe-area insets read 0 on iOS and the header sits under the status bar */}
      <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Terms & Privacy Consent</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          onScroll={onScroll}
          scrollEventThrottle={100}
          onLayout={(e) => setViewHeight(e.nativeEvent.layout.height)}
          onContentSizeChange={(_, h) => {
            // Short enough to fit on screen: nothing to scroll through
            if (viewHeight && h <= viewHeight + 40) setReachedEnd(true);
          }}
        >
          <PolicyHtml html={html} />
        </ScrollView>

        <View style={styles.footer}>
          {!reachedEnd && <Text style={styles.hint}>Please scroll to the end to continue</Text>}
          <TouchableOpacity
            style={[styles.agreeBtn, !reachedEnd && styles.agreeBtnDisabled]}
            disabled={!reachedEnd}
            onPress={onAgree}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.agreeText}>I Agree</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#0F172A' },
  scroll: { flex: 1, backgroundColor: '#F8FAFC' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  hint: { textAlign: 'center', fontSize: 12, color: '#64748B', marginBottom: 8 },
  agreeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
  },
  agreeBtnDisabled: { backgroundColor: '#94A3B8' },
  agreeText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
