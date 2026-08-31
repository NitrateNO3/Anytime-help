import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

<h1>ANYTIME HELP — RESIDENT TERMS & CONDITIONS, PRIVACY & DATA DECLARATION</h1>

<p><strong>Version:</strong> 1.0<br/>
<strong>Effective from:</strong> 30 August 2026<br/>
<strong>Applies to:</strong> Residents and authorised occupants of Sushant Lok Extension<br/>
<strong>Operated by:</strong> Anytime Help<br/>
<strong>In association with:</strong> SLERWA (the "<strong>RWA</strong>")</p>

<div class="summary">
  <h3>In short</h3>
  <p>Anytime Help is an app for residents of Sushant Lok Extension. You can read community announcements, raise complaints and service requests, attach photos or documents, and follow what happens next. To get your complaint fixed, we usually have to pass the relevant details to whoever handles that service — a plumber, an electrician, housekeeping, security, the RWA office, or an outside authority. This document explains what we collect, who we share it with, what we are responsible for, and what we are not. Please read it before you tap Accept. The full text below prevails over this summary.</p>
</div>

<div class="alert-box">
  <h2>⚠️ 1. THIS IS NOT AN EMERGENCY SERVICE</h2>
  <p><strong>Anytime Help is not a police, fire, ambulance, medical, rescue, disaster-response or security-monitoring service, and it is not a substitute for any of them.</strong></p>
  <p>Nobody is guaranteed to be watching the app at any given moment. Complaints are not monitored continuously and there is no guaranteed response time.</p>
  <p><strong>If there is a fire, a gas leak, a medical emergency, a crime in progress, a threat to anyone's safety, a structural collapse, an electrocution risk, a child or vulnerable person at risk, or any other situation needing immediate help — call the emergency services directly, first.</strong></p>
  <table>
    <tr><th>Service</th><th>Number</th></tr>
    <tr><td>All emergencies</td><td><strong>112</strong></td></tr>
    <tr><td>Police</td><td><strong>100</strong></td></tr>
    <tr><td>Fire</td><td><strong>101</strong></td></tr>
    <tr><td>Ambulance</td><td><strong>102 / 108</strong></td></tr>
  </table>
  <p>Use Anytime Help afterwards to create a record, not instead of calling for help.</p>
</div>

<h2>PART 1 — TERMS OF USE</h2>

<h3>2. Who these Terms are between, and what the words mean</h3>
<p><strong>2.1</strong> These Terms are an agreement between you (an individual resident or authorised occupant, "<strong>you</strong>") and Anytime Help. Parts of them also set out how the RWA participates in the platform.</p>
<p><strong>2.2</strong> By ticking the acceptance box and continuing, you enter into a legally binding agreement with us by electronic means. Contracts formed electronically are valid under Indian law, including section 10A of the Information Technology Act, 2000.</p>
<p><strong>2.3</strong> Definitions used throughout:</p>
<ul>
  <li><strong>"Platform"</strong> — the Anytime Help mobile application, any associated website, and the services provided through them.</li>
  <li><strong>"Complaint"</strong> — any complaint, grievance, maintenance request, service request, report or similar submission you make through the Platform, together with anything you attach to it.</li>
  <li><strong>"Content"</strong> — anything you submit: text, photographs, videos, audio, documents, comments and messages.</li>
  <li><strong>"RWA"</strong> — SLERWA, and its authorised office bearers, committee members, administrators and staff acting in that capacity.</li>
  <li><strong>"Service Partner"</strong> — a person or organisation that processes information <strong>on behalf of</strong> us or the RWA and under instructions.</li>
  <li><strong>"Independent Recipient"</strong> — a person or organisation that receives information from the Platform and then decides <strong>for itself</strong> how to use it.</li>
</ul>
<p><strong>2.4</strong> These Terms include the Privacy & Data Declaration in Part 2. They do not replace the RWA's own bylaws, house rules, resolutions or charges, which continue to apply to you separately.</p>

<h3>3. What Anytime Help is, and what it is not</h3>
<p><strong>3.1 What it is.</strong> A communication and record-keeping tool: read announcements and community information, raise and track Complaints, attach supporting material, receive updates, and use other features we may add.</p>
<p><strong>3.2 What it is not.</strong> <strong>We are not the plumber, the electrician, the guard, the housekeeper, the lift technician or the facility manager.</strong> We do not perform maintenance, repair, security, housekeeping, plumbing, electrical, parking, waste-management or any other physical service. Those are provided by the RWA, its employees, contractors, vendors or independent agencies. Our role is to receive your request, record it, route it to whoever is responsible, and show you what we are told about its progress.</p>
<p><strong>3.3 No guaranteed outcome.</strong> Submitting a Complaint does not guarantee that any particular service will be provided, within any particular time, in any particular way, or that the RWA or anyone else will act.</p>

<h3>4. Eligibility, accounts and account security</h3>
<p><strong>4.1 Age.</strong> You must be <strong>18 years or older</strong> to hold an account. The Platform is not intended for children.</p>
<p><strong>4.2 Who may register.</strong> You must be a resident, owner or authorised occupant of a unit in Sushant Lok Extension, or otherwise authorised by the RWA.</p>
<p><strong>4.3 Your credentials.</strong> Keep your password, OTP and other credentials confidential.</p>

<h3>5. Using the Complaint and request features</h3>
<p><strong>5.1 Be truthful.</strong> Information you submit must be true, accurate, complete so far as you know, and relevant to the issue.</p>
<p><strong>5.2 Do not use Complaints to harm people.</strong> You must not submit anything that is defamatory, threatening, abusive, obscene, harassing, discriminatory, fraudulent, malicious, or knowingly false.</p>
<p><strong>5.3 Complaints are seen by others.</strong> A Complaint is not anonymous and is not private in the ordinary sense. It will be visible to authorised administrators and to the people who need it to investigate or resolve the issue.</p>

<h3>7. Your Content and the licence you give us</h3>
<p><strong>7.1 You keep ownership.</strong> You continue to own what you submit. We do not claim ownership of your Complaints, photographs, videos, documents or comments.</p>
<p><strong>7.2 Photographs and videos — please be careful.</strong> Photograph the <em>problem</em>, not the <em>people</em>. Avoid capturing faces, children, domestic workers, vehicle number plates, house interiors and documents belonging to others unless they are genuinely necessary to explain the issue.</p>
<p><strong>7.3 The licence.</strong> So that we can actually run the service, you grant us and the RWA a non-exclusive, royalty-free, worldwide licence to host, store, copy, display, transmit, adapt, and disclose your Content.</p>

<h2>PART 2 — PRIVACY & DATA DECLARATION</h2>

<h3>10. Who is responsible for your personal data</h3>
<p><strong>10.1</strong> Anytime Help decides the purposes and means of processing your personal data on the Platform and is therefore the Data Fiduciary for it under the DPDP Act. The RWA is a separate Data Fiduciary for its own community records held outside the Platform.</p>

<h3>11. What we collect</h3>
<p><strong>11.1 Information you give us:</strong> Name, unit details, contact details, account information, complaint details, attachments, communications.</p>
<p><strong>11.2 What we do not want.</strong> We do not ask for and do not want your <strong>Aadhaar number</strong>, PAN, passport or other government ID numbers, bank or payment card numbers, biometric data, health information, or information about your caste, religion, political views or sexual life. Please do not submit these.</p>

<h3>14. Sharing Complaint information so it can be resolved</h3>
<p><strong>This is the clause we most want you to read.</strong></p>
<p><strong>14.1 The basic point.</strong> A Complaint cannot be resolved by us alone. To get a leaking pipe fixed, someone has to be told which flat is leaking and be able to reach you. So when you raise a Complaint, we will share the information reasonably necessary to investigate or resolve it with the people responsible for that service.</p>
<p><strong>14.2 The need-to-know limit.</strong> We will share only what is reasonably necessary for the recipient to do their job — typically the nature of the issue, the location, the timing, relevant attachments, and enough contact information for them to reach you or arrange access.</p>
<p><strong>14.3 Two different kinds of recipient:</strong> Service Partners (who act on our behalf) and Independent Recipients (who decide for themselves how to use the information after receiving it).</p>

<h3>18. Security</h3>
<p><strong>18.1</strong> We take <strong>reasonable technical and organisational security safeguards</strong> against unauthorised access, use, alteration, disclosure and loss.</p>
<p><strong>18.2</strong> <strong>We do not claim that the Platform is completely secure, and you should not assume that it is.</strong> No internet-connected system can be guaranteed against every attack, failure or human error.</p>

<h3>21. Your rights, and how to use them</h3>
<p>Subject to applicable law and verification of your identity, you may ask what we hold, correct inaccurate information, ask us to erase data, withdraw consent, and raise grievances.</p>

<br/>
<p><em>* This is the resident-facing portion of the Privacy & Data Declaration.</em></p>

</body>
</html>
`;

export default function PrivacyPolicy() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy & Terms</Text>
        <View style={{width: 24}} />
      </View>
      <WebView 
        originWhitelist={['*']}
        source={{ html: privacyPolicyHTML }}
        style={{ flex: 1, backgroundColor: '#FCFDF6' }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FCFDF6' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 40) : 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FFF' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#111827' }
});
