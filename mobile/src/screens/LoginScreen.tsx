import React, { useState, useRef } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { login as apiLogin, forgotPassword } from '../api/auth';
import { AppInput, AppButton } from '../components';
import { colors, typography, spacing, radius, shadows } from '../theme';
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
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await forgotPassword(forgotEmail.trim().toLowerCase());
      if (res.success) {
        setForgotSuccess(true);
      } else {
        Alert.alert('Error', res.message || 'Failed to send reset email');
      }
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to send reset email';
      Alert.alert('Error', message);
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
                  setError('Admin accounts are managed via the web portal.');
                  return;
                }
                await setAuth(response.user, response.token);
                onLoginSuccess(response.user.role);
              } else {
                setError('Biometric login failed. Please sign in with password.');
              }
            } catch (err: any) {
              setError(err.response?.data?.message || 'Biometric login failed. Use password.');
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
      Alert.alert('Error', 'No biometric credentials found. Please sign in with password first.');
      return;
    }
    const success = await authenticateWithBiometric();
    if (success) {
      setLoading(true);
      try {
        const response = await apiLogin(creds.email, creds.password);
        if (response.success) {
          if (response.user.role === 'superadmin' && !(response.user.roles ?? []).some((r: string) => r === 'owner' || r === 'tenant')) {
            Alert.alert('Not Available', 'Admin accounts are managed via the web portal.');
            return;
          }
          await setAuth(response.user, response.token);
          onLoginSuccess(response.user.role);
        } else {
          Alert.alert('Error', 'Biometric login failed. Please use password.');
        }
      } catch (err: any) {
        Alert.alert('Error', err.response?.data?.message || 'Biometric login failed. Use password.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    setError('');
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      const response = await apiLogin(email.trim().toLowerCase(), password);
      if (response.success) {
          // Block superadmin from mobile app — admin portal is web-only
          if (response.user.role === 'superadmin' && !(response.user.roles ?? []).some((r: string) => r === 'owner' || r === 'tenant')) {
            setError('Admin accounts are managed via the web portal. Please use happyrenting.netlify.app');
            setLoading(false);
            return;
          }
          await setAuth(response.user, response.token);

        // Prompt for biometric enrollment (any role can use biometrics)
        if (biometricSupported && !biometricActive) {
          Alert.alert(
            'Enable Biometric Login',
            'Would you like to enable fingerprint/face ID login for quicker access next time?',
            [
              {
                text: 'Maybe Later',
                style: 'cancel',
                onPress: () => onLoginSuccess(response.user.role),
              },
              {
                text: 'Enable',
                onPress: async () => {
                  try {
                    await saveBiometricCredentials(email.trim().toLowerCase(), password);
                    Alert.alert('Success', 'Biometric login enabled successfully!');
                  } catch {
                    Alert.alert('Error', 'Failed to save biometric credentials.');
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
        setError('Invalid credentials');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
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
          <LinearGradient
            colors={['#4B6BED', '#3D56C9']}
            style={styles.heroSection}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Animated.View style={[styles.heroContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../assets/images/icon.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.appName}>Happy Renting</Text>
              <Text style={styles.tagline}>Property Management</Text>
            </Animated.View>
          </LinearGradient>

          <Animated.View
            style={[styles.formSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
          >
            <Text style={styles.welcomeTitle}>Welcome back</Text>
            <Text style={styles.welcomeSubtitle}>Sign in to your account</Text>

            {error ? (
              <View style={styles.errorBox}>
                <View style={styles.errorIcon}>
                  <Ionicons name="alert-circle" size={18} color={colors.error} />
                </View>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.formFields}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color={colors.text.tertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="Enter your email"
                    placeholderTextColor={colors.text.tertiary}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.text.tertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="Enter your password"
                    placeholderTextColor={colors.text.tertiary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color={colors.text.tertiary}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.signInButton, biometricActive ? { flex: 1 } : { width: '100%' }]} onPress={handleLogin} disabled={loading} activeOpacity={0.9}>
                <LinearGradient
                  colors={['#4B6BED', '#3D56C9']}
                  style={styles.signInGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.signInText}>Sign In</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {biometricSupported && biometricActive && (
                <TouchableOpacity style={styles.biometricButton} onPress={handleBiometricLogin} disabled={loading} activeOpacity={0.8}>
                  <Ionicons name="finger-print" size={28} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={() => {
                setForgotSuccess(false);
                setForgotEmail('');
                setShowForgotModal(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotPassword}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Professional Footer */}
            <View style={styles.loginFooter}>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://happyrenting.netlify.app')}
                activeOpacity={0.7}
                style={styles.websiteBtn}
              >
                <Ionicons name="globe-outline" size={14} color={colors.primary} />
                <Text style={styles.websiteBtnText}>happyrenting.netlify.app</Text>
              </TouchableOpacity>
              <View style={styles.footerLinks}>
                <TouchableOpacity onPress={() => Linking.openURL('https://happy-renting.onrender.com/privacy')}>
                  <Text style={styles.footerLink}>Privacy Policy</Text>
                </TouchableOpacity>
                <Text style={styles.footerDot}>·</Text>
                <TouchableOpacity onPress={() => Linking.openURL('https://happy-renting.onrender.com/terms')}>
                  <Text style={styles.footerLink}>Terms</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.footerVersion}>v{APP_VERSION} · Made with ❤️ in India 🇮🇳</Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showForgotModal} animationType="fade" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.forgotModal}>
            {forgotSuccess ? (
              <View style={styles.forgotSuccessContent}>
                <Ionicons name="mail-open-outline" size={48} color={colors.success} />
                <Text style={styles.forgotTitle}>Email Sent!</Text>
                <Text style={styles.forgotBody}>
                  If that email exists, a password reset link has been sent to your inbox.
                </Text>
                <AppButton
                  title="Done"
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
                  <Ionicons name="key-outline" size={28} color={colors.primary} />
                </View>
                <Text style={styles.forgotTitle}>Forgot Password</Text>
                <Text style={styles.forgotBody}>
                  Enter your registered email and we'll send you a reset link.
                </Text>
                <AppInput
                  placeholder="your@email.com"
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  leftIcon={
                    <Ionicons name="mail-outline" size={20} color={colors.text.tertiary} />
                  }
                  containerStyle={{ backgroundColor: 'transparent' }}
                  style={{ backgroundColor: 'transparent' }}
                />
                <View style={styles.modalButtons}>
                  <AppButton
                    title="Cancel"
                    variant="ghost"
                    onPress={() => setShowForgotModal(false)}
                    fullWidth
                  />
                  <View style={styles.modalBtnSpacer} />
                  <AppButton
                    title="Send Link"
                    onPress={handleForgotPassword}
                    loading={forgotLoading}
                    fullWidth
                  />
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
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
  },
  heroContent: {
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  logoContainer: {
    width: 90,
    height: 90,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  logoImage: {
    width: 70,
    height: 70,
  },
  appName: {
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
    backgroundColor: 'transparent',
  },
  formSection: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl + 4,
    paddingBottom: spacing.huge,
    marginTop: -spacing.xxl - 4,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xxl + 4,
    borderTopRightRadius: radius.xxl + 4,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: spacing.xs,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    marginBottom: spacing.xxl,
    lineHeight: 22,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    padding: spacing.md + 2,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  errorIcon: {
    marginRight: spacing.sm,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    flex: 1,
    fontWeight: '500',
  },
  formFields: {
    gap: spacing.lg,
    marginBottom: spacing.xxl,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 52,
    ...shadows.sm,
  },
  inputIcon: {
    marginRight: spacing.md,
  },
  inputField: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '500',
    paddingVertical: 0,
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
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  signInGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.inverse,
    letterSpacing: 0.3,
  },
  forgotPassword: {
    fontSize: 14,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.xl,
    fontWeight: '600',
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
});
