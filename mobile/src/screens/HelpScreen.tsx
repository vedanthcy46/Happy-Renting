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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const isOwner = activeWorkspace === 'owner';
  const faqList: FAQItem[] = isOwner ? t('help.ownerFaq', { returnObjects: true }) as FAQItem[] : t('help.tenantFaq', { returnObjects: true }) as FAQItem[];

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
      label: t('help.emailLabel'),
      subtitle: t('help.emailSubtitle'),
      onPress: () => openEmail(),
    },
    {
      icon: 'bug',
      iconColor: '#F59E0B',
      iconBg: '#F59E0B18',
      label: t('help.bugLabel'),
      subtitle: t('help.bugSubtitle'),
      onPress: () => openEmail('Bug Report - Happy Renting App'),
    },
    {
      icon: 'star',
      iconColor: '#F59E0B',
      iconBg: '#F59E0B18',
      label: t('help.rateLabel'),
      subtitle: t('help.rateSubtitle'),
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
        <Text style={[styles.topBarTitle, { color: themeColors.text.primary }]}>{t('help.title')}</Text>
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
          <Text style={styles.heroTitle}>{t('help.heroTitle')}</Text>
          <Text style={styles.heroSubtitle}>
            {isOwner ? t('help.heroSubtitleOwner') : t('help.heroSubtitleTenant')}
          </Text>
        </LinearGradient>

        {/* FAQ Section */}
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
          {t('help.faqSection')}
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
          {t('help.contactSection')}
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
          {t('help.responseTime')}
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
