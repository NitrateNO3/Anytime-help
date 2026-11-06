import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const FEATURES: { title: string; body: string }[] = [
  { title: 'Raise Complaints', body: 'Submit complaints directly to the concerned department or authority and track their progress until resolution.' },
  { title: 'Connect with Local Representatives', body: 'Reach out to local elected representatives, including Ward Councillors (Parshads), MLAs, and other public officials.' },
  { title: 'Connect with RWA Management', body: 'Communicate with RWA Presidents, office bearers, and society management to address residential concerns.' },
  { title: 'Track Complaint Status', body: 'Stay informed about complaint updates, actions taken, and resolutions.' },
  { title: 'Stay Updated', body: 'Receive important society announcements, community updates, and notifications.' },
  { title: 'Engage with Your Community', body: 'Participate in community activities, share concerns, and connect with fellow residents.' },
  { title: 'Access Home Services', body: 'Discover and request essential home services through the platform.' },
];

/** Shared "About Us" body used by the resident, member and staff About screens. */
export default function AboutContent() {
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.heading2}>About Anytime Help</Text>
        <Text style={styles.subtitle}>Your Community. Your Voice. Your Anytime Help.</Text>
        <Text style={styles.text}>
          <Text style={styles.bold}>Anytime Help</Text> is an integrated community management and public assistance platform, developed and powered by <Text style={styles.bold}>QuenchMark Technologies</Text>, designed to make residential living smarter, safer, and more connected.
        </Text>
        <Text style={styles.text}>
          Our mission is to bridge the gap between residents, society management, government departments, and local elected representatives through one unified digital platform.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading3}>What You Can Do with Anytime Help</Text>
        {FEATURES.map((f) => (
          <Text key={f.title} style={styles.text}>
            <Text style={styles.bold}>{f.title}: </Text>
            {f.body}
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading3}>Our Vision</Text>
        <Text style={styles.text}>
          We envision a connected society where every resident has a voice, every complaint reaches the right authority, and every community has access to transparent and accountable management.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading3}>Powered By</Text>
        <Text style={[styles.text, styles.bold, styles.brand]}>QUENCHMARK TECHNOLOGIES</Text>
        <Text style={styles.text}>
          A technology venture focused on building innovative digital products, scalable platforms, and technology-driven solutions.
        </Text>
        <Text style={styles.text}>
          Anytime Help is proudly developed and maintained by QuenchMark Technologies.
        </Text>

        <View style={styles.divider} />

        <Text style={[styles.text, styles.bold, styles.tagline]}>
          Anytime Help – Empowering Residents. Connecting Communities. Building Better Neighbourhoods.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
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
  heading2: { fontSize: 20, fontWeight: '700', color: '#0F172A', marginBottom: 6 },
  subtitle: { fontSize: 15, fontWeight: '600', color: '#2563EB', marginBottom: 12 },
  heading3: { fontSize: 17, fontWeight: '700', color: '#0F172A', marginBottom: 10 },
  text: { fontSize: 14, lineHeight: 22, color: '#475569', marginBottom: 10 },
  bold: { fontWeight: '700', color: '#1E293B' },
  brand: { fontSize: 15, letterSpacing: 1, color: '#0F172A' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  tagline: { textAlign: 'center', color: '#059669', fontSize: 14, marginBottom: 0 },
});
