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
    body: 'We collect your name, email address, phone number, and payment proof images (screenshots/receipts) that you voluntarily provide. We also collect device information (device model, OS version) for push notification delivery.',
  },
  {
    title: '2. How We Use Your Information',
    body: 'Your information is used solely to manage your tenancy, process rent payments, send billing notifications, and communicate maintenance requests to your property owner. We do not sell your data to third parties.',
  },
  {
    title: '3. Data Storage and Security',
    body: 'Your authentication token is stored securely using expo-secure-store on your device. Payment proof images are stored on Cloudinary with private access controls. All API communication is over HTTPS.',
  },
  {
    title: '4. Third-Party Services',
    body: 'We use Cashfree Payments for online rent collection. Cashfree is PCI-DSS compliant. We use Expo Push Notifications for in-app alerts. We use Cloudinary for image storage.',
  },
  {
    title: '5. Data Retention',
    body: 'Your data is retained for the duration of your tenancy and up to 30 days after vacating. Payment records are retained for 7 years for legal compliance.',
  },
  {
    title: '6. Your Rights',
    body: 'You may request deletion of your account and associated data by contacting support@happyrenting.in. We will fulfill requests within 30 days.',
  },
  {
    title: '7. Contact Us',
    body: 'For privacy questions, contact: support@happyrenting.in',
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
