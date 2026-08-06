import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, radius, shadows, typography } from '../theme';
import { AppButton } from '../components';
import {
  sendOwnerRequestOtp,
  verifyOwnerRequestOtp,
  submitOwnerRequest,
} from '../api/ownerRequest';

const STEPS = { EMAIL: 'email', OTP: 'otp', FORM: 'form', DONE: 'done' } as const;
type Step = (typeof STEPS)[keyof typeof STEPS];

const STEP_ORDER: Step[] = [STEPS.EMAIL, STEPS.OTP, STEPS.FORM];

const OTP_LENGTH = 6;

export const OwnerRequestScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [step, setStep] = useState<Step>(STEPS.EMAIL);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [verifiedToken, setVerifiedToken] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [form, setForm] = useState({ name: '', phone: '', propertyName: '', propertyLocation: '' });

  const otpRefs = useRef<Array<TextInput | null>>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startResendTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setResendTimer(60);
    timerRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    Keyboard.dismiss();
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await sendOwnerRequestOtp(email.trim().toLowerCase());
      if (res.success) {
        setOtp(Array(OTP_LENGTH).fill(''));
        setStep(STEPS.OTP);
        startResendTimer();
        setTimeout(() => otpRefs.current[0]?.focus(), 150);
      } else {
        Alert.alert('Error', res.message || 'Failed to send OTP.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
    if (next.every((d) => d !== '') && next.join('').length === OTP_LENGTH) {
      handleVerifyOtp(next.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, key: string) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (code?: string) => {
    const value = code || otp.join('');
    if (value.length !== OTP_LENGTH) {
      Alert.alert('Invalid OTP', 'Please enter the full 6-digit OTP.');
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    try {
      const res = await verifyOwnerRequestOtp(email.trim().toLowerCase(), value);
      if (res.success && res.verifiedToken) {
        setVerifiedToken(res.verifiedToken);
        setStep(STEPS.FORM);
      } else {
        Alert.alert('Error', res.message || 'Invalid OTP.');
        setOtp(Array(OTP_LENGTH).fill(''));
        otpRefs.current[0]?.focus();
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Invalid OTP. Please try again.');
      setOtp(Array(OTP_LENGTH).fill(''));
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!form.name.trim()) {
      Alert.alert('Name Required', 'Please enter your full name.');
      return;
    }
    if (!form.phone.trim()) {
      Alert.alert('Phone Required', 'Please enter your phone number.');
      return;
    }
    setLoading(true);
    try {
      const res = await submitOwnerRequest({
        name: form.name.trim(),
        email: email.trim().toLowerCase(),
        phone: form.phone.trim(),
        propertyName: form.propertyName.trim(),
        propertyLocation: form.propertyLocation.trim(),
        verifiedToken,
      });
      if (res.success) {
        setStep(STEPS.DONE);
      } else {
        Alert.alert('Error', res.message || 'Failed to submit request.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to submit request.');
    } finally {
      setLoading(false);
    }
  };

  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Owner Access</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <LinearGradient
            colors={colors.gradient.primary as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroCircle} />
            <View style={styles.heroCircleSmall} />
            <View style={styles.heroIcon}>
              <Ionicons name="business" size={30} color="#FFFFFF" />
            </View>
            <Text style={styles.heroTitle}>Request Owner Access</Text>
            <Text style={styles.heroSubtitle}>
              Manage your properties, tenants and rent collections with Happy Renting.
            </Text>
          </LinearGradient>

          {/* Step indicator */}
          {step !== STEPS.DONE && (
            <View style={styles.stepper}>
              {STEP_ORDER.map((s, i) => {
                const isActive = step === s;
                const isDone = stepIndex > i;
                return (
                  <React.Fragment key={s}>
                    <View style={styles.stepItem}>
                      <View
                        style={[
                          styles.stepDot,
                          {
                            backgroundColor: isDone ? colors.success : isActive ? colors.primary : colors.border,
                            borderColor: isActive ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        {isDone ? (
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        ) : (
                          <Text
                            style={[
                              styles.stepDotText,
                              { color: isActive ? '#FFFFFF' : colors.text.tertiary },
                            ]}
                          >
                            {i + 1}
                          </Text>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.stepLabel,
                          { color: isActive || isDone ? colors.text.primary : colors.text.tertiary },
                        ]}
                      >
                        {s === STEPS.EMAIL ? 'Email' : s === STEPS.OTP ? 'Verify' : 'Details'}
                      </Text>
                    </View>
                    {i < STEP_ORDER.length - 1 && (
                      <View style={[styles.stepLine, { backgroundColor: isDone ? colors.success : colors.border }]} />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          )}

          {/* ── Step 1: Email ── */}
          {step === STEPS.EMAIL && (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.sm]}>
              <Text style={[styles.cardTitle, { color: colors.text.primary }]}>Let's get started</Text>
              <Text style={[styles.cardBody, { color: colors.text.secondary }]}>
                We'll send a 6-digit verification code to your email to confirm your identity before you
                submit the request.
              </Text>
              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Email Address</Text>
              <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Ionicons name="mail-outline" size={20} color={colors.text.tertiary} />
                <TextInput
                  style={[styles.input, { color: colors.text.primary }]}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.text.tertiary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  editable={!loading}
                />
              </View>
              <AppButton
                title="Send Verification Code"
                onPress={handleSendOtp}
                loading={loading}
                fullWidth
                icon={<Ionicons name="mail" size={18} color="#FFFFFF" />}
              />
            </View>
          )}

          {/* ── Step 2: OTP ── */}
          {step === STEPS.OTP && (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.sm]}>
              <View style={styles.otpHeader}>
                <View style={[styles.otpIconWrap, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="shield-checkmark" size={28} color={colors.primary} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.text.primary }]}>Check your inbox</Text>
                <Text style={[styles.cardBody, { color: colors.text.secondary }]}>
                  We sent a 6-digit code to{' '}
                  <Text style={{ fontWeight: '700', color: colors.text.primary }}>{email}</Text>
                </Text>
              </View>

              <View style={styles.otpRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    style={[
                      styles.otpBox,
                      {
                        borderColor: digit ? colors.primary : colors.border,
                        backgroundColor: colors.background,
                        color: colors.text.primary,
                      },
                    ]}
                    value={digit}
                    onChangeText={(v) => handleOtpChange(i, v)}
                    onKeyPress={(e) => handleOtpKeyDown(i, e.nativeEvent.key)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    editable={!loading}
                  />
                ))}
              </View>

              <AppButton
                title="Verify Code"
                onPress={() => handleVerifyOtp()}
                loading={loading}
                disabled={otp.join('').length < OTP_LENGTH}
                fullWidth
                icon={<Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />}
              />

              <View style={styles.otpFooter}>
                <TouchableOpacity
                  onPress={handleSendOtp}
                  disabled={resendTimer > 0 || loading}
                  activeOpacity={0.7}
                  style={styles.otpFooterBtn}
                >
                  <Ionicons name="refresh" size={15} color={resendTimer > 0 ? colors.text.tertiary : colors.primary} />
                  <Text style={[styles.resendText, { color: resendTimer > 0 ? colors.text.tertiary : colors.primary }]}>
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setStep(STEPS.EMAIL); setOtp(Array(OTP_LENGTH).fill('')); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.changeEmail, { color: colors.text.secondary }]}>Use a different email</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Step 3: Form ── */}
          {step === STEPS.FORM && (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.sm]}>
              <View style={[styles.verifiedBanner, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.verifiedTitle, { color: colors.success }]}>Email Verified</Text>
                  <Text style={[styles.verifiedSub, { color: colors.text.secondary }]}>{email}</Text>
                </View>
              </View>

              <Text style={[styles.cardTitle, { color: colors.text.primary }]}>Your details</Text>
              <Text style={[styles.cardBody, { color: colors.text.secondary }]}>
                Tell us a little about you so the admin can review your request.
              </Text>

              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Full Name *</Text>
              <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Ionicons name="person-outline" size={20} color={colors.text.tertiary} />
                <TextInput
                  style={[styles.input, { color: colors.text.primary }]}
                  placeholder="Enter your name"
                  placeholderTextColor={colors.text.tertiary}
                  value={form.name}
                  onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                  autoCapitalize="words"
                />
              </View>

              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Phone Number *</Text>
              <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Ionicons name="call-outline" size={20} color={colors.text.tertiary} />
                <TextInput
                  style={[styles.input, { color: colors.text.primary }]}
                  placeholder="+91 XXXXX XXXXX"
                  placeholderTextColor={colors.text.tertiary}
                  value={form.phone}
                  onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
                  keyboardType="phone-pad"
                />
              </View>

              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Property Name (Optional)</Text>
              <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Ionicons name="business-outline" size={20} color={colors.text.tertiary} />
                <TextInput
                  style={[styles.input, { color: colors.text.primary }]}
                  placeholder="e.g. Green Valley"
                  placeholderTextColor={colors.text.tertiary}
                  value={form.propertyName}
                  onChangeText={(v) => setForm((f) => ({ ...f, propertyName: v }))}
                />
              </View>

              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Property Location (Optional)</Text>
              <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Ionicons name="location-outline" size={20} color={colors.text.tertiary} />
                <TextInput
                  style={[styles.input, { color: colors.text.primary }]}
                  placeholder="City, Area, or Landmark"
                  placeholderTextColor={colors.text.tertiary}
                  value={form.propertyLocation}
                  onChangeText={(v) => setForm((f) => ({ ...f, propertyLocation: v }))}
                />
              </View>

              <AppButton
                title="Submit Access Request"
                onPress={handleSubmit}
                loading={loading}
                fullWidth
                icon={<Ionicons name="send" size={18} color="#FFFFFF" />}
              />
            </View>
          )}

          {/* ── Done ── */}
          {step === STEPS.DONE && (
            <View style={[styles.doneCard, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.sm]}>
              <View style={[styles.doneIconWrap, { backgroundColor: colors.successLight }]}>
                <Ionicons name="checkmark-circle" size={52} color={colors.success} />
              </View>
              <Text style={[styles.doneTitle, { color: colors.text.primary }]}>Request Submitted!</Text>
              <Text style={[styles.doneBody, { color: colors.text.secondary }]}>
                Thank you! Our admin team will review your request and send your account credentials to{' '}
                <Text style={{ fontWeight: '700', color: colors.text.primary }}>{email}</Text>.
              </Text>
              <AppButton
                title="Back to Login"
                onPress={() => router.back()}
                fullWidth
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: { padding: spacing.xs, width: 44 },
  headerTitle: { ...typography.h4, flex: 1, textAlign: 'center' },
  headerSpacer: { width: 44 },

  scroll: { padding: spacing.lg, gap: spacing.lg },

  hero: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 150,
    justifyContent: 'center',
  },
  heroCircle: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.07)',
    top: -40,
    right: -30,
  },
  heroCircleSmall: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.09)',
    bottom: -30,
    left: -20,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.82)', lineHeight: 21 },

  stepper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm },
  stepItem: { alignItems: 'center', gap: 6 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotText: { fontSize: 12, fontWeight: '700' },
  stepLabel: { fontSize: 11, fontWeight: '600' },
  stepLine: { flex: 1, height: 2, marginHorizontal: spacing.sm, alignSelf: 'flex-start', marginTop: 12 },

  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  cardBody: { fontSize: 14, lineHeight: 21, marginBottom: spacing.sm },

  fieldLabel: { fontSize: 12, fontWeight: '600', marginTop: spacing.sm, letterSpacing: 0.3, textTransform: 'uppercase' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    height: 52,
    marginTop: spacing.xs,
  },
  input: { flex: 1, fontSize: 15, fontWeight: '500' },

  otpHeader: { alignItems: 'center', gap: 6, marginBottom: spacing.md },
  otpIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.lg },
  otpBox: {
    width: 44,
    height: 54,
    borderRadius: radius.md,
    borderWidth: 1.5,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  otpFooter: { alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  otpFooterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resendText: { fontSize: 14, fontWeight: '700' },
  changeEmail: { fontSize: 13 },

  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  verifiedTitle: { fontSize: 13, fontWeight: '700' },
  verifiedSub: { fontSize: 12, marginTop: 1 },

  doneCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  doneIconWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  doneTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  doneBody: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: spacing.lg },
});
