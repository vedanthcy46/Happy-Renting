import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  Text,
  View,
  Switch,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  isBiometricAvailable,
  isBiometricEnabled,
  clearBiometricCredentials,
  saveBiometricCredentials,
} from '../hooks/useBiometric';
import { useAuthStore } from '../store/useAuthStore';
import { updateProfile, changePassword as apiChangePassword, getProfile } from '../api/user';
import { login } from '../api/auth';
import { AppCard, AppButton, AppInput } from '../components';
import { typography, spacing, radius, shadows } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import { getInitials } from '../utils';
import { rateApp, APP_VERSION } from '../utils/rateApp';

interface ProfileScreenProps {
  onLogout: () => void;
  onNavigate?: (screen: string, params?: any) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onLogout, onNavigate }) => {
  const { colors } = useTheme();
  const { user, setAuth, token } = useAuthStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: (user as any)?.phone || '',
  });

  const [showPassModal, setShowPassModal] = useState(false);
  const [passData, setPassData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passLoading, setPassLoading] = useState(false);

  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricActive, setBiometricActive] = useState(false);
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [biometricPassword, setBiometricPassword] = useState('');

  useEffect(() => {
    const checkBiometric = async () => {
      const isAvailable = await isBiometricAvailable();
      const isEnabled = await isBiometricEnabled();
      setBiometricSupported(isAvailable);
      setBiometricActive(isEnabled);
    };
    checkBiometric();
  }, []);

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      setBiometricPassword('');
      setShowBiometricModal(true);
    } else {
      await clearBiometricCredentials();
      setBiometricActive(false);
      Alert.alert('Success', 'Biometric login disabled.');
    }
  };

  const handleConfirmBiometric = async () => {
    if (!biometricPassword) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }
    try {
      if (!user?.email) {
        Alert.alert('Error', 'User email not found. Please log in again.');
        return;
      }
      await login(user.email, biometricPassword);
      await saveBiometricCredentials(user.email, biometricPassword);
      setBiometricActive(true);
      setShowBiometricModal(false);
      setBiometricPassword('');
      Alert.alert('Success', 'Biometric login enabled successfully.');
    } catch {
      Alert.alert('Error', 'Invalid password. Biometric login was not enabled.');
      setBiometricActive(false);
    }
  };

  const handleCancelBiometric = () => {
    setShowBiometricModal(false);
    setBiometricPassword('');
    setBiometricActive(false);
  };

  useEffect(() => {
    const fetchLatestProfile = async () => {
      try {
        const res = await getProfile();
        if (res.success) {
          setFormData({
            name: res.user.name,
            email: res.user.email,
            phone: (res.user as any).phone || '',
          });
          await setAuth(res.user, token!);
        }
      } catch (e) {
        console.error('Failed to fetch profile', e);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchLatestProfile();
  }, []);

  const handleUpdateProfile = async () => {
    if (!formData.name || !formData.email) {
      Alert.alert('Error', 'Name and email are required');
      return;
    }
    setLoading(true);
    try {
      const res = await updateProfile(formData);
      if (res.success) {
        await setAuth(res.user, token!);
        if (res.queued) {
          Alert.alert('Saved Offline', 'Profile updated on this device. It will sync automatically when you are back online.');
        } else {
          Alert.alert('Success', 'Profile updated successfully');
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passData.currentPassword || !passData.newPassword || !passData.confirmPassword) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    if (passData.newPassword !== passData.confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    setPassLoading(true);
    try {
      const res = await apiChangePassword({
        currentPassword: passData.currentPassword,
        newPassword: passData.newPassword,
      });
      if (res.success) {
        Alert.alert('Success', 'Password changed successfully');
        setShowPassModal(false);
        setPassData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to change password');
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.headerTitle}>Profile</Text>
            <Text style={styles.headerSubtitle}>Manage your account</Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate?.('settings')} style={{ padding: spacing.xs }}>
            <Ionicons name="settings-outline" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{getInitials(user?.name || '')}</Text>
          </View>
          <Text style={styles.profileName}>{user?.name}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="person" size={12} color={colors.primary} />
            <Text style={styles.roleText}>Tenant</Text>
          </View>
        </View>

        <AppCard variant="elevated" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="create-outline" size={18} color={colors.text.primary} />
            <Text style={styles.sectionTitle}>Edit Profile</Text>
          </View>
          {loadingProfile ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ margin: spacing.xl }} />
          ) : (
            <>
              <AppInput
                label="Name"
                placeholder="Enter your name"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
              />
              <AppInput
                label="Email"
                placeholder="Enter your email"
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <AppInput
                label="Phone"
                placeholder="Enter your phone"
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                keyboardType="phone-pad"
              />
              <AppButton title="Update Profile" onPress={handleUpdateProfile} loading={loading} fullWidth />
            </>
          )}
        </AppCard>

        <AppCard variant="elevated" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.text.primary} />
            <Text style={styles.sectionTitle}>Security</Text>
          </View>
          <AppButton
            title="Change Password"
            onPress={() => setShowPassModal(true)}
            variant="outline"
            fullWidth
            style={biometricSupported ? { marginBottom: spacing.md } : undefined}
            icon={<Ionicons name="lock-closed-outline" size={18} color={colors.text.secondary} />}
          />
          {biometricSupported && (
            <View style={styles.biometricRow}>
              <View style={styles.biometricLabelCol}>
                <Ionicons name="finger-print-outline" size={18} color={colors.text.secondary} style={{ marginRight: spacing.sm }} />
                <Text style={styles.biometricText}>Biometric Login</Text>
              </View>
              <Switch
                value={biometricActive}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={biometricActive ? colors.primary : '#ccc'}
              />
            </View>
          )}
        </AppCard>

        <AppCard variant="elevated" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="apps-outline" size={18} color={colors.text.primary} />
            <Text style={styles.sectionTitle}>Quick Links</Text>
          </View>
          <AppButton
            title="App Settings"
            onPress={() => router.push('/settings')}
            variant="outline"
            fullWidth
            style={{ marginBottom: spacing.md }}
            icon={<Ionicons name="settings-outline" size={18} color={colors.text.secondary} />}
          />
          <AppButton
            title="Help Center & FAQ"
            onPress={() => router.push('/help')}
            variant="outline"
            fullWidth
            style={{ marginBottom: spacing.md }}
            icon={<Ionicons name="help-circle-outline" size={18} color={colors.text.secondary} />}
          />
          <AppButton
            title="About Happy Renting"
            onPress={() => router.push('/about')}
            variant="outline"
            fullWidth
            style={{ marginBottom: spacing.md }}
            icon={<Ionicons name="information-circle-outline" size={18} color={colors.text.secondary} />}
          />
          <AppButton
            title="Rate Your App"
            onPress={rateApp}
            variant="outline"
            fullWidth
            style={{ marginBottom: spacing.md }}
            icon={<Ionicons name="star-outline" size={18} color="#F59E0B" />}
          />
          <AppButton
            title="Visit Website"
            onPress={() => Linking.openURL('https://happyrenting.netlify.app')}
            variant="outline"
            fullWidth
            icon={<Ionicons name="globe-outline" size={18} color={colors.text.secondary} />}
          />
        </AppCard>

        <AppCard variant="elevated" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={18} color={colors.text.primary} />
            <Text style={styles.sectionTitle}>Legal</Text>
          </View>
          <AppButton
            title="Privacy Policy"
            onPress={() => router.push('/privacy-policy')}
            variant="outline"
            fullWidth
            style={{ marginBottom: spacing.md }}
            icon={<Ionicons name="shield-outline" size={18} color={colors.text.secondary} />}
          />
          <AppButton
            title="Terms of Service"
            onPress={() => router.push('/terms-of-service')}
            variant="outline"
            fullWidth
            icon={<Ionicons name="document-text-outline" size={18} color={colors.text.secondary} />}
          />
        </AppCard>

        <TouchableOpacity style={styles.logoutButton} onPress={onLogout} activeOpacity={0.7}>
          <View style={styles.logoutIcon}>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
          </View>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Happy Renting v{APP_VERSION} · Made with ❤️ in India</Text>
      </ScrollView>

      <Modal visible={showPassModal} transparent animationType="fade">
        <KeyboardAvoidingView style={styles.passOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[styles.passModal, { flexGrow: 1, justifyContent: 'center' }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
            <View style={styles.passHeader}>
              <Text style={styles.passTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setShowPassModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            <AppInput
              label="Current Password"
              placeholder="Enter current password"
              value={passData.currentPassword}
              onChangeText={(text) => setPassData({ ...passData, currentPassword: text })}
              secureTextEntry
            />
            <AppInput
              label="New Password"
              placeholder="Enter new password"
              value={passData.newPassword}
              onChangeText={(text) => setPassData({ ...passData, newPassword: text })}
              secureTextEntry
            />
            <AppInput
              label="Confirm New Password"
              placeholder="Confirm new password"
              value={passData.confirmPassword}
              onChangeText={(text) => setPassData({ ...passData, confirmPassword: text })}
              secureTextEntry
            />
            <View style={styles.passButtons}>
              <TouchableOpacity
                style={styles.passCancelBtn}
                onPress={() => setShowPassModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.passCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.passChangeBtn}
                onPress={handleChangePassword}
                disabled={passLoading}
                activeOpacity={0.8}
              >
                {passLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.passChangeText}>Change Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showBiometricModal} transparent animationType="fade">
        <KeyboardAvoidingView style={styles.passOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[styles.passModal, { flexGrow: 1, justifyContent: 'center' }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
            <View style={styles.passHeader}>
              <Text style={styles.passTitle}>Confirm Biometrics</Text>
              <TouchableOpacity onPress={handleCancelBiometric}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 14, color: colors.text.secondary, marginBottom: spacing.lg, lineHeight: 20 }}>
              Please enter your password to confirm and securely save your login credentials on this device.
            </Text>
            <AppInput
              label="Account Password"
              placeholder="Enter your password"
              value={biometricPassword}
              onChangeText={setBiometricPassword}
              secureTextEntry
            />
            <View style={styles.passButtons}>
              <TouchableOpacity
                style={styles.passCancelBtn}
                onPress={handleCancelBiometric}
                activeOpacity={0.7}
              >
                <Text style={styles.passCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.passChangeBtn}
                onPress={handleConfirmBiometric}
                activeOpacity={0.8}
              >
                <Text style={styles.passChangeText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.huge + 40,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  avatarLargeText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  profileEmail: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  sectionCard: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  logoutIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
  },
  versionText: {
    fontSize: 12,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  passOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.xl,
    zIndex: 100,
  },
  passModal: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl + 4,
    padding: spacing.xxl,
    ...shadows.xl,
  },
  passHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  passTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  passButtons: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  passCancelBtn: {
    flex: 1,
    backgroundColor: colors.borderLight,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  passChangeBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  passChangeText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  biometricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: spacing.md,
  },
  biometricLabelCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  biometricText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
  },
});
