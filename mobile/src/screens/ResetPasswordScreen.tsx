import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppInput, AppButton } from '../components';
import { colors, spacing, radius, shadows } from '../theme';
import { resetPassword } from '../api/auth';

interface ResetPasswordScreenProps {
  token: string;
  onBack: () => void;
  onSuccess: () => void;
}

export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({
  token,
  onBack,
  onSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const handleReset = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in both fields');
      return;
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;
    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }
    if (!passwordRegex.test(newPassword)) {
      Alert.alert('Error', 'Password must include uppercase, lowercase, number, and a special character (@$!%*?&)');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword(token, newPassword);
      if (res.success) {
        Alert.alert('Success', 'Your password has been reset successfully. Please sign in.', [
          { text: 'OK', onPress: onSuccess },
        ]);
      } else {
        Alert.alert('Error', res.message || 'Failed to reset password');
      }
    } catch (err: any) {
      Alert.alert(
        'Error',
        err.response?.data?.message || 'Something went wrong. The link may have expired or is invalid.'
      );
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
            colors={['#2563EB', '#1D4ED8']}
            style={styles.heroSection}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.heroContent}>
              <View style={styles.logoContainer}>
                <Ionicons name="lock-open" size={44} color="#FFFFFF" />
              </View>
              <Text style={styles.appName}>Happy Renting</Text>
              <Text style={styles.tagline}>Reset Password</Text>
            </View>
          </LinearGradient>

          <View style={styles.formSection}>
            <Text style={styles.welcomeTitle}>Create new password</Text>
            <Text style={styles.welcomeSubtitle}>
              Password must be at least 8 characters with uppercase, lowercase, a number, and a special character (@$!%*?&).
            </Text>

            <View style={styles.formFields}>
              <View style={styles.inputWrapper}>
                <AppInput
                  label="New Password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPass}
                  leftIcon={
                    <Ionicons name="lock-closed-outline" size={20} color={colors.text.tertiary} />
                  }
                />
                <TouchableOpacity
                  onPress={() => setShowNewPass(!showNewPass)}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showNewPass ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color={colors.text.tertiary}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.inputWrapper}>
                <AppInput
                  label="Confirm Password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPass}
                  leftIcon={
                    <Ionicons name="lock-closed-outline" size={20} color={colors.text.tertiary} />
                  }
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPass(!showConfirmPass)}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showConfirmPass ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color={colors.text.tertiary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <AppButton
              title="Reset Password"
              onPress={handleReset}
              loading={loading}
              style={styles.submitBtn}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl + spacing.xxl,
    borderBottomLeftRadius: radius.xxl + 4,
    borderBottomRightRadius: radius.xxl + 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroContent: {
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  appName: {
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
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
  formFields: {
    marginBottom: spacing.xxl,
  },
  inputWrapper: {
    position: 'relative',
  },
  eyeBtn: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 24, // aligned with input container height
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    marginTop: spacing.sm,
  },
});
