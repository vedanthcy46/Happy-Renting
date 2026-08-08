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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      Alert.alert(t('common.success'), t('settings.bioDisabled'));
    }
  };

  const handleConfirmBiometric = async () => {
    if (!biometricPassword) {
      Alert.alert(t('common.error'), t('settings.bioEnterPassword'));
      return;
    }
    try {
      if (!user?.email) {
        Alert.alert(t('common.error'), t('settings.bioEmailNotFound'));
        return;
      }
      await login(user.email, biometricPassword);
      await saveBiometricCredentials(user.email, biometricPassword);
      setBiometricActive(true);
      setShowBiometricModal(false);
      setBiometricPassword('');
      Alert.alert(t('common.success'), t('settings.bioEnabled'));
    } catch {
      Alert.alert(t('common.error'), t('settings.bioInvalidPassword'));
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
      Alert.alert(t('common.error'), t('profile.nameEmailRequired'));
      return;
    }
    setLoading(true);
    try {
      const res = await updateProfile(formData);
      if (res.success) {
        await setAuth(res.user, token!);
        if (res.queued) {
          Alert.alert(t('profile.savedOfflineTitle'), t('profile.savedOfflineBody'));
        } else {
          Alert.alert(t('common.success'), t('profile.updateProfileSuccess'));
        }
      }
    } catch (error: any) {
      Alert.alert(t('common.error'), error.response?.data?.message || t('profile.updateProfileFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passData.currentPassword || !passData.newPassword || !passData.confirmPassword) {
      Alert.alert(t('common.error'), t('profile.allFieldsRequired'));
      return;
    }
    if (passData.newPassword !== passData.confirmPassword) {
      Alert.alert(t('common.error'), t('profile.passwordsMismatch'));
      return;
    }
    setPassLoading(true);
    try {
      const res = await apiChangePassword({
        currentPassword: passData.currentPassword,
        newPassword: passData.newPassword,
      });
      if (res.success) {
        Alert.alert(t('common.success'), t('profile.passwordChanged'));
        setShowPassModal(false);
        setPassData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (error: any) {
      Alert.alert(t('common.error'), error.response?.data?.message || t('profile.changePasswordFailed'));
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.headerTitle}>{t('profile.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('profile.subtitle')}</Text>
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
            <Text style={styles.roleText}>{user?.role === 'owner' ? t('profile.owner') : t('profile.tenant')}</Text>
          </View>
        </View>

        <AppCard variant="elevated" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="create-outline" size={18} color={colors.text.primary} />
            <Text style={styles.sectionTitle}>{t('profile.editProfile')}</Text>
          </View>
          {loadingProfile ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ margin: spacing.xl }} />
          ) : (
            <>
              <AppInput
                label={t('profile.name')}
                placeholder={t('profile.enterName')}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
              />
              <AppInput
                label={t('profile.email')}
                placeholder={t('profile.enterEmail')}
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <AppInput
                label={t('profile.phone')}
                placeholder={t('profile.enterPhone')}
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                keyboardType="phone-pad"
              />
              <AppButton title={t('profile.updateProfile')} onPress={handleUpdateProfile} loading={loading} fullWidth />
            </>
          )}
        </AppCard>

        <AppCard variant="elevated" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.text.primary} />
            <Text style={styles.sectionTitle}>{t('profile.security')}</Text>
          </View>
          <AppButton
            title={t('profile.changePassword')}
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
                <Text style={styles.biometricText}>{t('settings.biometricLogin')}</Text>
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
            <Text style={styles.sectionTitle}>{t('profile.quickLinks')}</Text>
          </View>
          <AppButton
            title={t('profile.appSettings')}
            onPress={() => router.push('/settings')}
            variant="outline"
            fullWidth
            style={{ marginBottom: spacing.md }}
            icon={<Ionicons name="settings-outline" size={18} color={colors.text.secondary} />}
          />
          <AppButton
            title={t('settings.helpCenter')}
            onPress={() => router.push('/help')}
            variant="outline"
            fullWidth
            style={{ marginBottom: spacing.md }}
            icon={<Ionicons name="help-circle-outline" size={18} color={colors.text.secondary} />}
          />
          <AppButton
            title={t('settings.about')}
            onPress={() => router.push('/about')}
            variant="outline"
            fullWidth
            style={{ marginBottom: spacing.md }}
            icon={<Ionicons name="information-circle-outline" size={18} color={colors.text.secondary} />}
          />
          <AppButton
            title={t('settings.rateApp')}
            onPress={rateApp}
            variant="outline"
            fullWidth
            style={{ marginBottom: spacing.md }}
            icon={<Ionicons name="star-outline" size={18} color="#F59E0B" />}
          />
          <AppButton
            title={t('settings.visitWebsite')}
            onPress={() => Linking.openURL('https://happyrenting.netlify.app')}
            variant="outline"
            fullWidth
            icon={<Ionicons name="globe-outline" size={18} color={colors.text.secondary} />}
          />
        </AppCard>

        <AppCard variant="elevated" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={18} color={colors.text.primary} />
            <Text style={styles.sectionTitle}>{t('profile.legal')}</Text>
          </View>
          <AppButton
            title={t('profile.privacyPolicy')}
            onPress={() => router.push('/privacy-policy')}
            variant="outline"
            fullWidth
            style={{ marginBottom: spacing.md }}
            icon={<Ionicons name="shield-outline" size={18} color={colors.text.secondary} />}
          />
          <AppButton
            title={t('profile.termsOfService')}
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
          <Text style={styles.logoutText}>{t('profile.signOut')}</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Happy Renting v{APP_VERSION} · Made with ❤️ in India</Text>
      </ScrollView>

      <Modal visible={showPassModal} transparent animationType="fade">
        <KeyboardAvoidingView style={styles.passOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[styles.passModal, { flexGrow: 1, justifyContent: 'center' }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
            <View style={styles.passHeader}>
              <Text style={styles.passTitle}>{t('profile.changePassword')}</Text>
              <TouchableOpacity onPress={() => setShowPassModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            <AppInput
              label={t('profile.currentPassword')}
              placeholder={t('profile.enterCurrentPassword')}
              value={passData.currentPassword}
              onChangeText={(text) => setPassData({ ...passData, currentPassword: text })}
              secureTextEntry
            />
            <AppInput
              label={t('profile.newPassword')}
              placeholder={t('profile.enterNewPassword')}
              value={passData.newPassword}
              onChangeText={(text) => setPassData({ ...passData, newPassword: text })}
              secureTextEntry
            />
            <AppInput
              label={t('profile.confirmNewPassword')}
              placeholder={t('profile.confirmNewPasswordPlaceholder')}
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
                <Text style={styles.passCancelText}>{t('common.cancel')}</Text>
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
                  <Text style={styles.passChangeText}>{t('profile.changePassword')}</Text>
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
              <Text style={styles.passTitle}>{t('settings.confirmBiometrics')}</Text>
              <TouchableOpacity onPress={handleCancelBiometric}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 14, color: colors.text.secondary, marginBottom: spacing.lg, lineHeight: 20 }}>
              {t('settings.confirmBioDesc')}
            </Text>
            <AppInput
              label={t('settings.accountPassword')}
              placeholder={t('login.passwordPlaceholder')}
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
                <Text style={styles.passCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.passChangeBtn}
                onPress={handleConfirmBiometric}
                activeOpacity={0.8}
              >
                <Text style={styles.passChangeText}>{t('common.confirm')}</Text>
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
