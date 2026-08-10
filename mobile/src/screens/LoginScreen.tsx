import React, { useState, useRef, useMemo } from 'react';
import {
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Dimensions,
  TouchableOpacity,
  Keyboard,
  TextInput,
  Text,
  ActivityIndicator,
  View,
  Modal,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';
import { login as apiLogin, forgotPassword } from '../api/auth';
import { AppInput, AppButton, KeyboardSafeModal } from '../components';
import { typography, spacing, radius, shadows } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import {
  isBiometricAvailable,
  isBiometricEnabled,
  authenticateWithBiometric,
  getBiometricCredentials,
  saveBiometricCredentials,
} from '../hooks/useBiometric';
import { APP_VERSION } from '../utils/rateApp';

const { width } = Dimensions.get('window');

interface LoginScreenProps {
  onLoginSuccess: (role: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { t } = useTranslation();
  const { colors: themeColors } = useTheme();
  const styles = useMemo(() => makeStyles(themeColors), [themeColors]);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { setAuth } = useAuthStore();
  const insets = useSafeAreaInsets();

  const handleForgotPassword = async () => {
    Keyboard.dismiss();
    if (!forgotEmail.trim()) {
      Alert.alert(t('common.error'), t('login.enterEmailError'));
      return;
    }
    setForgotLoading(true);
    try {
      const res = await forgotPassword(forgotEmail.trim().toLowerCase());
      if (res.success) {
        setForgotSuccess(true);
      } else {
        Alert.alert(t('common.error'), res.message || t('login.failedReset'));
      }
    } catch (err: any) {
      const message = err.response?.data?.message || t('login.failedReset');
      Alert.alert(t('common.error'), message);
    } finally {
      setForgotLoading(false);
    }
  };
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Check biometric support & try auto-login
    const checkBiometric = async () => {
      const isAvailable = await isBiometricAvailable();
      const isEnabled = await isBiometricEnabled();
      setBiometricSupported(isAvailable);
      setBiometricActive(isEnabled);

      if (isAvailable && isEnabled) {
        const creds = await getBiometricCredentials();
        if (creds) {
          // Auto-trigger biometric prompt
          const success = await authenticateWithBiometric();
          if (success) {
            setLoading(true);
            try {
              const response = await apiLogin(creds.email, creds.password);
              if (response.success) {
                if (response.user.role === 'superadmin' && !(response.user.roles ?? []).some((r: string) => r === 'owner' || r === 'tenant')) {
                  setError(t('login.adminWebOnly'));
                  return;
                }
                await setAuth(response.user, response.token);
                onLoginSuccess(response.user.role);
              } else {
                setError(t('login.biometricSignInFailed'));
              }
            } catch (err: any) {
              setError(err.response?.data?.message || t('login.biometricUsePassword'));
            } finally {
              setLoading(false);
            }
          }
        }
      }
    };
    checkBiometric();
  }, []);

  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricActive, setBiometricActive] = useState(false);

  const handleBiometricLogin = async () => {
    if (!biometricSupported || !biometricActive) return;
    const creds = await getBiometricCredentials();
    if (!creds) {
      Alert.alert(t('common.error'), t('login.biometricNotConfigured'));
      return;
    }
    const success = await authenticateWithBiometric();
    if (success) {
      setLoading(true);
      try {
        const response = await apiLogin(creds.email, creds.password);
        if (response.success) {
          if (response.user.role === 'superadmin' && !(response.user.roles ?? []).some((r: string) => r === 'owner' || r === 'tenant')) {
            Alert.alert(t('common.error'), t('login.adminWebOnly'));
            return;
          }
          await setAuth(response.user, response.token);
          onLoginSuccess(response.user.role);
        } else {
          Alert.alert(t('common.error'), t('login.biometricLoginFailed'));
        }
      } catch (err: any) {
        Alert.alert(t('common.error'), err.response?.data?.message || t('login.biometricLoginFailed'));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    setError('');
    if (!email || !password) {
      setError(t('login.enterBothError'));
      return;
    }
    setLoading(true);
    try {
      const response = await apiLogin(email.trim().toLowerCase(), password);
      if (response.success) {
          // Block superadmin from mobile app — admin portal is web-only
          if (response.user.role === 'superadmin' && !(response.user.roles ?? []).some((r: string) => r === 'owner' || r === 'tenant')) {
            setError(t('login.adminWebOnlyLink'));
            setLoading(false);
            return;
          }
          await setAuth(response.user, response.token);

        // Prompt for biometric enrollment (any role can use biometrics)
        if (biometricSupported && !biometricActive) {
          Alert.alert(
            t('login.enableBiometricTitle'),
            t('login.enableBiometricBody'),
            [
              {
                text: t('login.maybeLater'),
                style: 'cancel',
                onPress: () => onLoginSuccess(response.user.role),
              },
              {
                text: t('login.enable'),
                onPress: async () => {
                  try {
                    await saveBiometricCredentials(email.trim().toLowerCase(), password);
                    Alert.alert(t('login.success'), t('login.biometricEnabled'));
                  } catch {
                    Alert.alert(t('common.error'), t('login.biometricFailedSave'));
                  } finally {
                    onLoginSuccess(response.user.role);
                  }
                },
              },
            ]
          );
        } else {
          onLoginSuccess(response.user.role);
        }
      } else {
        setError(t('login.invalidCredentials'));
      }
    } catch (err: any) {
      setError(err.response?.data?.message || t('login.genericError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Modern hero */}
          <LinearGradient
            colors={themeColors.gradient.primary as any}
            style={styles.heroSection}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.heroBlob} />
            <View style={styles.heroBlobSmall} />
            <Animated.View style={[styles.heroContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../assets/images/icon.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.appName}>{t('common.appName')}</Text>
              <Text style={styles.tagline}>{t('login.tagline')}</Text>
            </Animated.View>
          </LinearGradient>

          <Animated.View
            style={[styles.formSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
          >
            <Text style={styles.welcomeTitle}>{t('login.title')}</Text>
            <Text style={styles.welcomeSubtitle}>
              {t('login.subtitle')}
            </Text>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: themeColors.errorLight, borderLeftColor: themeColors.error }]}>
                <Ionicons name="alert-circle" size={18} color={themeColors.error} style={{ marginRight: spacing.sm }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.formFields}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('login.email')}</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color={themeColors.text.tertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    placeholder={t('login.emailPlaceholder')}
                    placeholderTextColor={themeColors.text.tertiary}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.passwordLabelRow}>
                  <Text style={styles.inputLabel}>{t('login.password')}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setForgotSuccess(false);
                      setForgotEmail('');
                      setShowForgotModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.forgotInline}>{t('login.forgot')}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color={themeColors.text.tertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    placeholder={t('login.passwordPlaceholder')}
                    placeholderTextColor={themeColors.text.tertiary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color={themeColors.text.tertiary}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.signInButton, biometricActive ? { flex: 1 } : { width: '100%' }]} onPress={handleLogin} disabled={loading} activeOpacity={0.9}>
                <LinearGradient
                  colors={themeColors.gradient.primary as any}
                  style={styles.signInGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="log-in-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.signInText}>{t('login.signIn')}</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {biometricSupported && biometricActive && (
                <TouchableOpacity style={styles.biometricButton} onPress={handleBiometricLogin} disabled={loading} activeOpacity={0.8}>
                  <Ionicons name="finger-print" size={28} color={themeColors.primary} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('login.newHere')}</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Owner access request */}
            <TouchableOpacity
              onPress={() => router.push('/owner-request' as any)}
              activeOpacity={0.85}
              style={[styles.ownerRequestCard, { backgroundColor: themeColors.primaryLight, borderColor: themeColors.border }]}
            >
              <View style={[styles.ownerRequestIcon, { backgroundColor: themeColors.surface }]}>
                <Ionicons name="business" size={24} color={themeColors.primary} />
              </View>
              <View style={styles.ownerRequestText}>
                <Text style={styles.ownerRequestTitle}>
                  {t('login.ownerTitle')}
                </Text>
                <Text style={styles.ownerRequestSub}>
                  {t('login.ownerSub')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={themeColors.primary} />
            </TouchableOpacity>

            {/* Footer */}
            <View style={styles.loginFooter}>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://happyrenting.netlify.app')}
                activeOpacity={0.7}
                style={styles.websiteBtn}
              >
                <Ionicons name="globe-outline" size={14} color={themeColors.primary} />
                <Text style={styles.websiteBtnText}>happyrenting.netlify.app</Text>
              </TouchableOpacity>
              <View style={styles.footerLinks}>
                <TouchableOpacity onPress={() => Linking.openURL('https://happy-renting.onrender.com/privacy')}>
                  <Text style={styles.footerLink}>{t('login.privacyPolicy')}</Text>
                </TouchableOpacity>
                <Text style={styles.footerDot}>·</Text>
                <TouchableOpacity onPress={() => Linking.openURL('https://happy-renting.onrender.com/terms')}>
                  <Text style={styles.footerLink}>{t('login.terms')}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.footerVersion}>v{APP_VERSION} · Made with ❤️ in India 🇮🇳</Text>
              <Text style={styles.aiDisclosure}>
                🤖 Powered by AI — Happy Renting&apos;s Copilot may assist with queries. Always confirm payment and tenancy details with your owner.
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <KeyboardSafeModal
        visible={showForgotModal}
        animationType="fade"
        overlayStyle={styles.modalOverlay}
        onRequestClose={() => setShowForgotModal(false)}
      >
          <View style={styles.forgotModal}>
            {forgotSuccess ? (
              <View style={styles.forgotSuccessContent}>
                <Ionicons name="mail-open-outline" size={48} color={themeColors.success} />
                <Text style={styles.forgotTitle}>{t('login.emailSentTitle')}</Text>
                <Text style={styles.forgotBody}>
                  {t('login.emailSentBody')}
                </Text>
                <AppButton
                  title={t('login.done')}
                  onPress={() => {
                    setShowForgotModal(false);
                    setForgotSuccess(false);
                    setForgotEmail('');
                  }}
                  fullWidth
                />
              </View>
            ) : (
              <View style={styles.forgotFormContent}>
                <View style={styles.forgotIconWrap}>
                  <Ionicons name="key-outline" size={28} color={themeColors.primary} />
                </View>
                <Text style={styles.forgotTitle}>{t('login.forgotTitle')}</Text>
                <Text style={styles.forgotBody}>
                  {t('login.forgotDesc')}
                </Text>
                <AppInput
                  placeholder="your@email.com"
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  leftIcon={
                    <Ionicons name="mail-outline" size={20} color={themeColors.text.tertiary} />
                  }
                  containerStyle={{ backgroundColor: 'transparent' }}
                  style={{ backgroundColor: 'transparent' }}
                />
                <View style={styles.modalButtons}>
                  <AppButton
                    title={t('login.cancel')}
                    variant="ghost"
                    onPress={() => setShowForgotModal(false)}
                    fullWidth
                  />
                  <View style={styles.modalBtnSpacer} />
                  <AppButton
                    title={t('login.sendLink')}
                    onPress={handleForgotPassword}
                    loading={forgotLoading}
                    fullWidth
                  />
                </View>
              </View>
            )}
          </View>
      </KeyboardSafeModal>
    </View>
  );
};

const makeStyles = (colors: any) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroSection: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.massive,
    paddingBottom: spacing.xxxl + spacing.xxl,
    borderBottomLeftRadius: radius.xxl + 4,
    borderBottomRightRadius: radius.xxl + 4,
    overflow: 'hidden',
    position: 'relative',
  },
  heroBlob: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -60,
    right: -60,
  },
  heroBlobSmall: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -40,
    left: -40,
  },
  heroContent: {
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  logoImage: {
    width: 66,
    height: 66,
  },
  appName: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 21,
    backgroundColor: 'transparent',
    maxWidth: 280,
  },
  formSection: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl + 4,
    paddingBottom: spacing.huge,
    marginTop: -spacing.xxl + 2,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xxl + 4,
    borderTopRightRadius: radius.xxl + 4,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: spacing.xs,
    color: colors.text.primary,
  },
  welcomeSubtitle: {
    fontSize: 15,
    marginBottom: spacing.xl,
    lineHeight: 22,
    color: colors.text.secondary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md + 2,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
    borderLeftWidth: 3,
  },
  errorText: {
    ...typography.bodySmall,
    flex: 1,
    fontWeight: '500',
    color: colors.error,
  },
  formFields: {
    gap: spacing.lg,
    marginBottom: spacing.xxl,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: colors.text.secondary,
  },
  forgotInline: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    height: 52,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    ...shadows.sm,
  },
  inputIcon: {
    marginRight: spacing.md,
  },
  inputField: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 0,
    color: colors.text.primary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  signInButton: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    height: 54,
    ...shadows.md,
  },
  biometricButton: {
    width: 54,
    height: 54,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  signInGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.inverse,
    letterSpacing: 0.3,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xxl,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.tertiary,
  },
  ownerRequestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  ownerRequestIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerRequestText: {
    flex: 1,
  },
  ownerRequestTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
    color: colors.text.primary,
  },
  ownerRequestSub: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.secondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  forgotModal: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    width: '100%',
    maxWidth: 400,
    ...shadows.xl,
  },
  forgotFormContent: {
    alignItems: 'center',
  },
  forgotIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  forgotSuccessContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  forgotTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  forgotBody: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.xxl,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
  },
  modalBtnSpacer: {
    width: spacing.md,
  },
  loginFooter: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 24,
    gap: 10,
  },
  websiteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
  },
  websiteBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerLink: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  footerDot: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  footerVersion: {
    fontSize: 12,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  aiDisclosure: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});
