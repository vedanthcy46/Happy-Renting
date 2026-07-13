import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

interface PrivacyPolicyScreenProps {
  onBack: () => void;
}

export const PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.updatedText}>Last updated: July 1, 2026</Text>
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const SECTIONS = [
  {
    title: '1. Information We Collect',
    body: 'We collect your name, email address, phone number, payment proof images, and ID proof documents that you voluntarily provide. We also collect device information (model, OS version) for push notification delivery, and IP address for security logging. If you enable biometric authentication (Face ID / Fingerprint), biometric data is stored locally on your device and never sent to our servers.',
  },
  {
    title: '2. How We Use Your Information',
    body: 'Your information is used to manage your tenancy, process rent payments (including UPI and bank details for owner payouts), send billing notifications, communicate maintenance requests, and detect fraud. We do not sell your data to third parties.',
  },
  {
    title: '3. Data Sharing',
    body: 'Your tenancy details and payment history are shared with your property owner. We use third-party services: Cashfree Payments (PCI-DSS compliant) for online rent collection, Expo for push notifications, Cloudinary for image storage, Resend for emails, and MongoDB Atlas for database hosting.',
  },
  {
    title: '4. Data Storage and Security',
    body: 'Passwords are hashed with bcrypt (12 rounds). Auth tokens are stored in SecureStore (mobile) or HTTP-only cookies (web). All API communication is over HTTPS. Uploaded images are stored on Cloudinary with private access controls.',
  },
  {
    title: '5. Data Retention',
    body: 'Personal data is retained for the duration of your tenancy plus 30 days. Payment records are retained for 7 years as required by law. Server logs are retained for 14 days.',
  },
  {
    title: '6. Your Rights',
    body: 'You may request access, correction, deletion, or portability of your data by contacting support@happyrenting.in. We will respond within 30 days. You may also withdraw consent for push notifications or biometric login at any time via app settings.',
  },
  {
    title: '7. Children & International Transfers',
    body: 'Our Platform is not intended for users under 18. Your data may be processed in India and the United States with appropriate safeguards. We do not use cookies for advertising or tracking.',
  },
  {
    title: '8. Contact Us',
    body: 'For privacy questions or requests, contact: support@happyrenting.in. Website: happyrenting.netlify.app',
  },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: colors.text.primary },
  content: { padding: spacing.xl, paddingBottom: 80 },
  updatedText: { fontSize: 12, color: colors.text.tertiary, marginBottom: spacing.xl },
  section: { marginBottom: spacing.xxl },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text.primary, marginBottom: spacing.sm },
  sectionBody: { fontSize: 14, color: colors.text.secondary, lineHeight: 22 },
});
