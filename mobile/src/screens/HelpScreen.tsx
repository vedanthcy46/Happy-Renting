import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, radius, shadows, typography } from '../theme';
import { useAuthStore } from '../store/useAuthStore';

// â”€â”€â”€ Enable LayoutAnimation on Android â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// â”€â”€â”€ FAQ Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface FAQItem {
  q: string;
  a: string;
}

const faqs: FAQItem[] = [
  {
    q: 'How do I pay my rent?',
    a: 'Go to the Payments tab and tap on your current bill. You can pay via UPI, Cashfree, or mark as paid after bank transfer. Your owner will be notified immediately.',
  },
  {
    q: 'How do I raise a maintenance complaint?',
    a: 'Tap the Complaints tab, then tap "+ New Complaint". Select a category, describe the issue, attach photos if needed, and submit. Your owner will be notified.',
  },
  {
    q: 'When is my rent due?',
    a: 'Your rent due date is set by your property owner — typically the 5th of every month. You will receive a push notification and email reminder 2 days before the due date.',
  },
  {
    q: 'How do I download a rent receipt?',
    a: 'Go to Payments → select a paid bill → tap the Download Receipt button. The PDF will be saved and can be shared directly from the app.',
  },
  {
    q: 'How do I change my password?',
    a: 'Go to Profile → Settings → Change Password. You will need to enter your current password first. If you forgot it, use Forgot Password on the login screen.',
  },
  {
    q: 'Why is my account locked?',
    a: 'Your account gets locked after 5 failed login attempts for security. Wait 15 minutes and try again, or use Forgot Password to reset your credentials.',
  },
  {
    q: 'Is my payment data secure?',
    a: 'Yes. All payment data is encrypted and processed through certified payment gateways. Happy Renting never stores your card or UPI credentials.',
  },
  {
    q: 'How do I update my profile?',
    a: 'Go to the Profile tab and tap Edit Profile. You can update your name, phone number. Contact your owner to update your email or room details.',
  },
];

const ownerFaqs: FAQItem[] = [
  {
    q: 'How do I add a property?',
    a: 'Go to Properties in the drawer and tap "+ Add". Enter the property name, address and city, and save. You can then add rooms and tenants to it.',
  },
  {
    q: 'How do I add a tenant to a room?',
    a: 'Open a property, tap a room, then Assign Tenant. You can also use "Add Tenant" in the drawer to create a tenant account and link them to a room.',
  },
  {
    q: 'How do I verify a tenant rent payment?',
    a: 'Go to Payments and tap "Verify" on any record awaiting verification. Confirm the proof to credit the tenant, or Reject it with a reason.',
  },
  {
    q: 'How do I set / edit rent amounts?',
    a: 'Open a room under Properties and edit the monthly rent and due date. New rent amounts apply to future bills immediately.',
  },
  {
    q: 'How do I record expenses?',
    a: 'Go to Expenses in the drawer and tap "+" to add a new expense. Categorize it, add the amount and date; it will flow into your summary and reports.',
  },
  {
    q: 'How do I generate reports?',
    a: 'Open the Reports screen to view collections, receivables and expenses. Use the date range picker to filter and tap Export to save as PDF.',
  },
  {
    q: 'How do I handle a maintenance complaint?',
    a: 'Go to Complaints, open a request to see photos and the tenant message, then change its status (e.g. In Progress, Resolved) as you act on it.',
  },
  {
    q: 'When do I get paid?',
    a: 'Tenants receive a rent due notification, and you are paid as soon as a payment is verified. Track collected and pending amounts on your Dashboard.',
  },
];

// â”€â”€â”€ Contact Items â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface ContactItem {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  iconBg: string;
  label: string;
  subtitle: string;
  onPress: () => void;
}

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const HelpScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();
  const { activeWorkspace } = useAuthStore();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const isOwner = activeWorkspace === 'owner';
  const faqList = isOwner ? ownerFaqs : faqs;

  const handleToggle = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIndex(prev => (prev === index ? null : index));
  };

  const openEmail = (subject?: string) => {
    const url = subject
      ? `mailto:support@happyrenting.co.in?subject=${encodeURIComponent(subject)}`
      : 'mailto:support@happyrenting.co.in';
    Linking.openURL(url).catch(() => {});
  };

  const openPlayStore = () => {
    Linking.openURL('market://details?id=co.in.happyrenting.tenant').catch(() =>
      Linking.openURL('https://play.google.com/store/apps/details?id=co.in.happyrenting.tenant').catch(() => {})
    );
  };

  const contactItems: ContactItem[] = [
    {
      icon: 'mail',
      iconColor: '#4B6BED',
      iconBg: '#4B6BED18',
      label: 'Email Support',
      subtitle: 'support@happyrenting.co.in',
      onPress: () => openEmail(),
    },
    {
      icon: 'bug',
      iconColor: '#F59E0B',
      iconBg: '#F59E0B18',
      label: 'Report a Bug',
      subtitle: 'Help us improve',
      onPress: () => openEmail('Bug Report - Happy Renting App'),
    },
    {
      icon: 'star',
      iconColor: '#F59E0B',
      iconBg: '#F59E0B18',
      label: 'Rate the App',
      subtitle: 'Love us? Let us know!',
      onPress: openPlayStore,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Top Bar */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + spacing.md,
            backgroundColor: themeColors.surface,
            borderBottomColor: themeColors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color={themeColors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text.primary }]}>Help Center</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero Banner */}
        <LinearGradient
          colors={['#4B6BED', '#3D56C9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.heroCircle} />
          <View style={styles.heroCircleSmall} />
          <View style={styles.heroIconContainer}>
            <Ionicons name="help-buoy" size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.heroTitle}>How can we help you?</Text>
          <Text style={styles.heroSubtitle}>
            {isOwner ? 'Owner FAQ, billing and property guides' : 'Browse our FAQ or contact us'}
          </Text>
        </LinearGradient>

        {/* FAQ Section */}
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
          Frequently Asked Questions
        </Text>

        {faqList.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <View
              key={index}
              style={[
                styles.accordionCard,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: isOpen ? themeColors.primary + '55' : themeColors.border,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => handleToggle(index)}
                activeOpacity={0.7}
              >
                <View style={styles.accordionHeaderLeft}>
                  <View
                    style={[
                      styles.faqIndexBadge,
                      { backgroundColor: isOpen ? themeColors.primary : themeColors.background },
                    ]}
                  >
                    <Text
                      style={[
                        styles.faqIndexText,
                        { color: isOpen ? '#FFFFFF' : themeColors.text.tertiary },
                      ]}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.questionText,
                      { color: isOpen ? themeColors.primary : themeColors.text.primary },
                    ]}
                  >
                    {item.q}
                  </Text>
                </View>
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={isOpen ? themeColors.primary : themeColors.text.tertiary}
                />
              </TouchableOpacity>

              {isOpen && (
                <View style={[styles.accordionBody, { borderTopColor: themeColors.border }]}>
                  <Text style={[styles.answerText, { color: themeColors.text.secondary }]}>
                    {item.a}
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Contact Us Section */}
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary, marginTop: 28 }]}>
          Still need help?
        </Text>

        <View
          style={[
            styles.contactCard,
            { backgroundColor: themeColors.surface, borderColor: themeColors.border },
          ]}
        >
          {contactItems.map((item, idx) => (
            <React.Fragment key={idx}>
              <TouchableOpacity
                style={styles.contactRow}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={[styles.contactIconBox, { backgroundColor: item.iconBg }]}>
                  <Ionicons name={item.icon} size={22} color={item.iconColor} />
                </View>
                <View style={styles.contactLabels}>
                  <Text style={[styles.contactLabel, { color: themeColors.text.primary }]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.contactSubtitle, { color: themeColors.text.tertiary }]}>
                    {item.subtitle}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={themeColors.text.tertiary} />
              </TouchableOpacity>

              {idx < contactItems.length - 1 && (
                <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Footer */}
        <Text style={[styles.footerText, { color: themeColors.text.tertiary }]}>
          Response time: Usually within 24 hours
        </Text>
      </ScrollView>
    </View>
  );
};

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  backButton: {
    padding: spacing.xs,
    width: 44,
  },
  topBarTitle: {
    ...typography.h4,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 44,
  },

  // Scroll
  scrollContent: {
    paddingBottom: spacing.xl * 2,
  },

  // Hero Banner
  heroBanner: {
    margin: 16,
    borderRadius: 20,
    padding: 24,
    overflow: 'hidden',
    minHeight: 140,
    justifyContent: 'center',
  },
  heroCircle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -40,
    right: -40,
  },
  heroCircleSmall: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: -20,
    left: -20,
  },
  heroIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.80)',
    fontWeight: '400',
  },

  // Section Title
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginHorizontal: 16,
    marginBottom: 12,
  },

  // Accordion
  accordionCard: {
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  accordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  faqIndexBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  faqIndexText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  questionText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },
  accordionBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
  },
  answerText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400',
  },

  // Contact Card
  contactCard: {
    borderRadius: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  contactIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  contactLabels: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  contactSubtitle: {
    fontSize: 12,
    fontWeight: '400',
  },

  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    opacity: 0.6,
  },

  // Footer
  footerText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 28,
    marginBottom: 32,
    fontWeight: '400',
  },
});
