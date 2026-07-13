import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

interface TermsOfServiceScreenProps {
  onBack: () => void;
}

export const TermsOfServiceScreen: React.FC<TermsOfServiceScreenProps> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
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
    title: '1. Acceptance of Terms',
    body: 'By downloading, installing, or using the Happy Renting mobile application, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the application.',
  },
  {
    title: '2. Eligibility',
    body: 'You must be a verified tenant residing in a registered property managed through Happy Renting. Access to the app requires active registration by your property owner.',
  },
  {
    title: '3. Acceptable Use',
    body: 'You agree not to misuse the application, submit false payment information, submit fraudulent complaints, or attempt to compromise app security. Violation of these rules may lead to account suspension.',
  },
  {
    title: '4. Rent Billing and Payments',
    body: 'Rent amounts and due dates are determined by your property owner, not Happy Renting. We facilitate the recording and processing of payments through third-party gateways (Cashfree) or manual proof verification.',
  },
  {
    title: '5. Manual Payment Verification',
    body: 'If you record a manual payment (e.g. cash, direct UPI, or bank transfer), your property owner has 48 hours to verify the transaction. Happy Renting is not liable for verification delays caused by the property owner.',
  },
  {
    title: '6. Dispute Resolution',
    body: 'In case of payment or tenancy disputes, please contact support@happyrenting.in. We target a 7-day resolution timeline for billing discrepancies.',
  },
  {
    title: '7. Limitation of Liability',
    body: 'Happy Renting is a platform utility. We are not a party to the rental agreement between you and the property owner, and we are not liable for property condition, eviction disputes, or security deposit refunds.',
  },
  {
    title: '8. Governing Law',
    body: 'These terms are governed by the laws of India. Any disputes arising out of the use of this service shall be subject to the exclusive jurisdiction of the courts in Bengaluru, Karnataka.',
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
