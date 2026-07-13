import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';
import { useRouter } from 'expo-router';

// ─── Types ────────────────────────────────────────────────────────────────────

type BackendStatus = 'checking' | 'online' | 'offline';

// ─── Info Row ─────────────────────────────────────────────────────────────────

interface InfoRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  showDivider?: boolean;
  primaryColor: string;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
}

const InfoRow: React.FC<InfoRowProps> = ({
  icon,
  label,
  value,
  showDivider = true,
  primaryColor,
  textPrimary,
  textSecondary,
  borderColor,
}) => (
  <>
    <View style={styles.infoRow}>
      <View style={styles.infoRowLeft}>
        <Ionicons name={icon} size={20} color={primaryColor} style={styles.infoIcon} />
        <Text style={[styles.infoLabel, { color: textSecondary }]}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, { color: textPrimary }]}>{value}</Text>
    </View>
    {showDivider && <View style={[styles.divider, { backgroundColor: borderColor }]} />}
  </>
);

// ─── Link Row ─────────────────────────────────────────────────────────────────

interface LinkRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  showDivider?: boolean;
  primaryColor: string;
  textPrimary: string;
  textTertiary: string;
  borderColor: string;
}

const LinkRow: React.FC<LinkRowProps> = ({
  icon,
  label,
  onPress,
  showDivider = true,
  primaryColor,
  textPrimary,
  textTertiary,
  borderColor,
}) => (
  <>
    <TouchableOpacity style={styles.linkRow} onPress={onPress} activeOpacity={0.65}>
      <View style={styles.linkRowLeft}>
        <Ionicons name={icon} size={20} color={primaryColor} style={styles.infoIcon} />
        <Text style={[styles.linkLabel, { color: textPrimary }]}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={textTertiary} />
    </TouchableOpacity>
    {showDivider && <View style={[styles.divider, { backgroundColor: borderColor }]} />}
  </>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const AboutScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();

  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');

  // ── Backend health check ──────────────────────────────────────────────────
  const fetchHealth = () => {
    setBackendStatus('checking');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch('https://happy-renting.onrender.com/health', { signal: controller.signal })
      .then((res) => {
        clearTimeout(timeoutId);
        setBackendStatus(res.ok ? 'online' : 'offline');
      })
      .catch(() => {
        clearTimeout(timeoutId);
        setBackendStatus('offline');
      });

    return controller;
  };

  useEffect(() => {
    const controller = fetchHealth();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Link helpers ─────────────────────────────────────────────────────────
  const openLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open this link on your device.');
      }
    } catch {
      Alert.alert('Error', 'Something went wrong while opening the link.');
    }
  };

  // ── Derived card style ───────────────────────────────────────────────────
  const cardStyle = [
    styles.card,
    {
      backgroundColor: themeColors.surface,
      shadowColor: themeColors.text.primary,
      borderColor: themeColors.border,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 8,
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

        <Text style={[styles.topBarTitle, { color: themeColors.text.primary }]}>About</Text>

        {/* Spacer balances back button */}
        <View style={styles.topBarSpacer} />
      </View>

      {/* ── Scrollable body ────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* ── Hero card ─────────────────────────────────────────────── */}
        <LinearGradient
          colors={['#2563EB', '#1D4ED8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroCircleTopRight} />
          <View style={styles.heroCircleBottomLeft} />

          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.heroLogo}
          />
          <Text style={styles.heroTitle}>Happy Renting</Text>
          <Text style={styles.heroSubtitle}>Smart Rental Management</Text>
        </LinearGradient>

        {/* ── App Info card ────────────────────────────────────────── */}
        <View style={cardStyle}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="phone-portrait-outline" size={18} color={themeColors.primary} />
            <Text style={[styles.cardTitle, { color: themeColors.text.primary }]}>
              App Information
            </Text>
          </View>

          <InfoRow
            icon="information-circle-outline"
            label="Version"
            value="1.0.0"
            primaryColor={themeColors.primary}
            textPrimary={themeColors.text.primary}
            textSecondary={themeColors.text.secondary}
            borderColor={themeColors.border}
          />
          <InfoRow
            icon="layers-outline"
            label="Build Number"
            value="1"
            primaryColor={themeColors.primary}
            textPrimary={themeColors.text.primary}
            textSecondary={themeColors.text.secondary}
            borderColor={themeColors.border}
          />
          <InfoRow
            icon="phone-portrait-outline"
            label="Platform"
            value="Android & iOS"
            primaryColor={themeColors.primary}
            textPrimary={themeColors.text.primary}
            textSecondary={themeColors.text.secondary}
            borderColor={themeColors.border}
          />
          <InfoRow
            icon="calendar-outline"
            label="Released"
            value="2025"
            showDivider={false}
            primaryColor={themeColors.primary}
            textPrimary={themeColors.text.primary}
            textSecondary={themeColors.text.secondary}
            borderColor={themeColors.border}
          />
        </View>

        {/* ── Backend Status card ──────────────────────────────────── */}
        <View style={cardStyle}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="server-outline" size={18} color={themeColors.primary} />
            <Text style={[styles.cardTitle, { color: themeColors.text.primary }]}>
              Backend Status
            </Text>
          </View>

          <View style={styles.statusRow}>
            {backendStatus === 'checking' ? (
              <>
                <ActivityIndicator
                  size="small"
                  color={themeColors.primary}
                  style={{ marginRight: 10 }}
                />
                <Text style={[styles.statusText, { color: themeColors.text.secondary }]}>
                  Checking...
                </Text>
              </>
            ) : backendStatus === 'online' ? (
              <>
                <View style={[styles.statusDot, { backgroundColor: themeColors.success }]} />
                <Text style={[styles.statusText, { color: themeColors.success }]}>Online</Text>
              </>
            ) : (
              <>
                <View style={[styles.statusDot, { backgroundColor: themeColors.error }]} />
                <Text style={[styles.statusText, { color: themeColors.error }]}>Offline</Text>
              </>
            )}
          </View>

          {backendStatus !== 'checking' && (
            <TouchableOpacity
              style={[styles.retryButton, { borderColor: themeColors.border }]}
              onPress={fetchHealth}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={15} color={themeColors.text.secondary} />
              <Text style={[styles.retryText, { color: themeColors.text.secondary }]}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Links card ───────────────────────────────────────────── */}
        <View style={cardStyle}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="link-outline" size={18} color={themeColors.primary} />
            <Text style={[styles.cardTitle, { color: themeColors.text.primary }]}>
              Quick Links
            </Text>
          </View>

          <LinkRow
            icon="globe-outline"
            label="Visit Website"
            onPress={() => openLink('https://happyrenting.netlify.app')}
            primaryColor={themeColors.primary}
            textPrimary={themeColors.text.primary}
            textTertiary={themeColors.text.tertiary}
            borderColor={themeColors.border}
          />
          <LinkRow
            icon="mail-outline"
            label="Contact Support"
            onPress={() => openLink('mailto:support@happyrenting.co.in')}
            primaryColor={themeColors.primary}
            textPrimary={themeColors.text.primary}
            textTertiary={themeColors.text.tertiary}
            borderColor={themeColors.border}
          />
          <LinkRow
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => router.push('/privacy-policy')}
            primaryColor={themeColors.primary}
            textPrimary={themeColors.text.primary}
            textTertiary={themeColors.text.tertiary}
            borderColor={themeColors.border}
          />
          <LinkRow
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => router.push('/terms-of-service')}
            primaryColor={themeColors.primary}
            textPrimary={themeColors.text.primary}
            textTertiary={themeColors.text.tertiary}
            borderColor={themeColors.border}
          />
          <LinkRow
            icon="star-outline"
            label="Rate Happy Renting"
            onPress={() =>
              openLink('https://play.google.com/store/apps/details?id=com.happyrenting.app')
            }
            showDivider={false}
            primaryColor={themeColors.primary}
            textPrimary={themeColors.text.primary}
            textTertiary={themeColors.text.tertiary}
            borderColor={themeColors.border}
          />
        </View>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <Text style={[styles.footer, { color: themeColors.text.tertiary }]}>
          {'Made with \u2764\ufe0f in India\n\u00a9 2025 Happy Renting'}
        </Text>
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  topBarSpacer: {
    width: 40,
  },

  // Scroll
  scrollContent: {
    paddingTop: 8,
  },

  // Hero
  heroCard: {
    borderRadius: 24,
    padding: 32,
    margin: 16,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  heroCircleTopRight: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.07)',
    top: -40,
    right: -40,
  },
  heroCircleBottomLeft: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: -30,
    left: -30,
  },
  heroLogo: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },

  // Card
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  infoIcon: {
    marginRight: 10,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    opacity: 0.6,
  },

  // Status
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Link rows
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
  },
  linkRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  linkLabel: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Footer
  footer: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginVertical: 24,
    letterSpacing: 0.1,
  },
});
