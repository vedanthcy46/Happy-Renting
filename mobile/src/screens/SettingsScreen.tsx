import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  View,
  Text,
  Switch,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../theme/ThemeProvider';
import { colors, typography, spacing, radius, shadows } from '../theme';
import {
  isBiometricAvailable,
  isBiometricEnabled,
  clearBiometricCredentials,
  saveBiometricCredentials,
} from '../hooks/useBiometric';
import { useAuthStore } from '../store/useAuthStore';
import { AppCard, AppButton, AppInput } from '../components';
import { LanguageSelector } from '../localization';
import { setPreferredLanguage } from '../api/user';
import { useRouter } from 'expo-router';
import { requestDeletion, getMyDeletionStatus, cancelDeletion, DeletionStatusData } from '../api/deletion';
import { login } from '../api/auth';
import { rateApp, APP_VERSION, APP_BUILD_NUMBER } from '../utils/rateApp';

export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { isDark, colors: themeColors, toggleTheme } = useTheme();
  const { user, logout } = useAuthStore();

  const [pushEnabled, setPushEnabled] = useState(true);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricActive, setBiometricActive] = useState(false);

  // Biometric activation modal
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [password, setPassword] = useState('');
  const [submittingBiometric, setSubmittingBiometric] = useState(false);

  // Account deletion
  const [deletionStatus, setDeletionStatus] = useState<DeletionStatusData | null>(null);
  const [showDeletionModal, setShowDeletionModal] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [deletionLoading, setDeletionLoading] = useState(false);
  const [deletionStatusLoading, setDeletionStatusLoading] = useState(false);

  const fetchDeletionStatus = useCallback(async () => {
    if (!user) return;
    setDeletionStatusLoading(true);
    try {
      const res = await getMyDeletionStatus();
      if (res.success && res.data && 'status' in res.data) {
        setDeletionStatus(res.data as DeletionStatusData);
      } else {
        setDeletionStatus(null);
      }
    } catch {
      setDeletionStatus(null);
    } finally {
      setDeletionStatusLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchDeletionStatus(); }, [fetchDeletionStatus]);

  useEffect(() => {
    const loadSettings = async () => {
      // Load push notification setting
      const pushSetting = await SecureStore.getItemAsync('push_notifications_enabled');
      setPushEnabled(pushSetting !== 'false'); // default to true

      // Load biometric setting
      const isAvailable = await isBiometricAvailable();
      const isEnabled = await isBiometricEnabled();
      setBiometricSupported(isAvailable);
      setBiometricActive(isEnabled);
    };

    loadSettings();
  }, []);

  const handlePushToggle = async (value: boolean) => {
    setPushEnabled(value);
    await SecureStore.setItemAsync('push_notifications_enabled', String(value));
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      setPassword('');
      setShowBiometricModal(true);
    } else {
      await clearBiometricCredentials();
      setBiometricActive(false);
      Alert.alert(t('common.success'), t('settings.bioDisabled'));
    }
  };

  const handleConfirmBiometric = async () => {
    if (!password) {
      Alert.alert(t('common.error'), t('settings.bioEnterPassword'));
      return;
    }

    setSubmittingBiometric(true);
    try {
      if (!user?.email) {
        Alert.alert(t('common.error'), t('settings.bioEmailNotFound'));
        return;
      }
      await login(user.email, password);
      await saveBiometricCredentials(user.email, password);
      setBiometricActive(true);
      setShowBiometricModal(false);
      setPassword('');
      Alert.alert(t('common.success'), t('settings.bioEnabled'));
    } catch {
      Alert.alert(t('common.error'), t('settings.bioInvalidPassword'));
      setBiometricActive(false);
    } finally {
      setSubmittingBiometric(false);
    }
  };

  const handleCancelBiometric = () => {
    setShowBiometricModal(false);
    setPassword('');
    setBiometricActive(false);
  };

  const handleClearCache = () => {
    Alert.alert(
      t('settings.clearCacheTitle'),
      t('settings.clearCacheBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.clearLogout'),
          style: 'destructive',
          onPress: async () => {
            try {
              await queryClient.clear();
              await SecureStore.deleteItemAsync('push_notifications_enabled');
              await logout();
              router.replace('/login');
            } catch (e) {
              Alert.alert(t('common.error'), t('settings.clearFailed'));
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccountPress = () => {
    if (!deletionStatus) {
      setDeletionReason('');
      setShowDeletionModal(true);
    }
  };

  const submitDeletionRequest = async () => {
    setDeletionLoading(true);
    try {
      const res = await requestDeletion({ reason: deletionReason || undefined });
      if (res.success) {
        Alert.alert(t('settings.deleteSubmitted'), t('settings.deleteSubmittedBody'));
        setShowDeletionModal(false);
        await fetchDeletionStatus();
      } else {
        Alert.alert(t('common.error'), res.message || t('settings.deleteFailed'));
      }
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.message || err.message || t('errors.generic'));
    } finally {
      setDeletionLoading(false);
    }
  };

  const handleCancelDeletion = () => {
    Alert.alert(t('settings.deleteCancelTitle'), t('settings.deleteCancelBody'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('settings.deleteYesCancel'), style: 'destructive',
        onPress: async () => {
          try {
            await cancelDeletion();
            await fetchDeletionStatus();
            Alert.alert(t('common.success'), t('settings.deleteCancelled'));
          } catch (err: any) {
            Alert.alert(t('common.error'), err?.response?.data?.message || err.message || t('settings.deleteCancelFailed'));
          }
        },
      },
    ]);
  };

  const handleReRequestDeletion = () => {
    setDeletionReason('');
    setShowDeletionModal(true);
  };

  const deletionStatusLabels: Record<string, { label: string; color: string }> = {
    pending_owner: { label: t('settings.statusPendingOwner'), color: '#F59E0B' },
    owner_approved: { label: t('settings.statusOwnerApproved'), color: '#4B6BED' },
    owner_rejected: { label: t('settings.statusOwnerRejected'), color: '#EF4444' },
    cancelled: { label: t('settings.statusCancelled'), color: '#94A3B8' },
    completed: { label: t('settings.statusCompleted'), color: '#10B981' },
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Top Bar Header */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md, backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={themeColors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text.primary }]}>{t('settings.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Preferences Section */}
        <Text style={[styles.sectionTitle, { color: themeColors.text.secondary }]}>{t('settings.preferences')}</Text>
        <AppCard variant="elevated" style={[styles.card, { backgroundColor: themeColors.surface }]}>
          {/* Dark Mode */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: isDark ? '#4B6BED20' : '#4B6BED15' }]}>
                <Ionicons name="moon-outline" size={20} color={isDark ? '#60A5FA' : '#4B6BED'} />
              </View>
              <View>
                <Text style={[styles.rowTitle, { color: themeColors.text.primary }]}>{t('settings.darkMode')}</Text>
                <Text style={[styles.rowDesc, { color: themeColors.text.tertiary }]}>{t('settings.darkModeDesc')}</Text>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: themeColors.border, true: themeColors.primaryLight }}
              thumbColor={isDark ? themeColors.primary : '#ccc'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          {/* Push Notifications */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#EF444415' }]}>
                <Ionicons name="notifications-outline" size={20} color="#EF4444" />
              </View>
              <View>
                <Text style={[styles.rowTitle, { color: themeColors.text.primary }]}>{t('settings.pushNotifications')}</Text>
                <Text style={[styles.rowDesc, { color: themeColors.text.tertiary }]}>{t('settings.pushDesc')}</Text>
              </View>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={handlePushToggle}
              trackColor={{ false: themeColors.border, true: themeColors.primaryLight }}
              thumbColor={pushEnabled ? themeColors.primary : '#ccc'}
            />
          </View>

          {biometricSupported && (
            <>
              <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
              {/* Biometric Login */}
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={[styles.iconBox, { backgroundColor: '#10B98115' }]}>
                    <Ionicons name="finger-print-outline" size={20} color="#10B981" />
                  </View>
                  <View>
                    <Text style={[styles.rowTitle, { color: themeColors.text.primary }]}>{t('settings.biometricLogin')}</Text>
                    <Text style={[styles.rowDesc, { color: themeColors.text.tertiary }]}>{t('settings.biometricDesc')}</Text>
                  </View>
                </View>
                <Switch
                  value={biometricActive}
                  onValueChange={handleBiometricToggle}
                  trackColor={{ false: themeColors.border, true: themeColors.primaryLight }}
                  thumbColor={biometricActive ? themeColors.primary : '#ccc'}
                />
              </View>
            </>
          )}

          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          {/* Language Preference */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#6366F115' }]}>
                <Ionicons name="language-outline" size={20} color="#6366F1" />
              </View>
              <View>
                <Text style={[styles.rowTitle, { color: themeColors.text.primary }]}>Language</Text>
                <Text style={[styles.rowDesc, { color: themeColors.text.tertiary }]}>Choose your preferred language</Text>
              </View>
            </View>
          </View>
          <View style={{ paddingVertical: spacing.sm }}>
            <LanguageSelector onLanguageChange={(lang) => { if (lang !== 'device') setPreferredLanguage(lang).catch(() => {}); }} />
          </View>
        </AppCard>

        {/* Support & Storage Section */}
        <Text style={[styles.sectionTitle, { color: themeColors.text.secondary }]}>System & Data</Text>
        <AppCard variant="elevated" style={[styles.card, { backgroundColor: themeColors.surface }]}>
          {/* Clear Cache */}
          <TouchableOpacity style={styles.row} onPress={handleClearCache} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#F59E0B15' }]}>
                <Ionicons name="trash-outline" size={20} color="#F59E0B" />
              </View>
              <View>
                <Text style={[styles.rowTitle, { color: themeColors.text.primary }]}>Clear Cache & Reset</Text>
                <Text style={[styles.rowDesc, { color: themeColors.text.tertiary }]}>Clear local database and log out</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={themeColors.text.tertiary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          {/* Delete Account (Tenant Only) */}
          {user?.role === 'tenant' && !deletionStatus && (
          <TouchableOpacity style={styles.row} onPress={handleDeleteAccountPress} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#EF444415' }]}>
                <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: '#EF4444' }]}>Delete Account</Text>
                <Text style={[styles.rowDesc, { color: themeColors.text.tertiary }]} numberOfLines={1}>
                  Permanently remove all data
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={themeColors.text.tertiary} />
          </TouchableOpacity>
          )}

          {/* Deletion Status Card */}
          {user?.role === 'tenant' && deletionStatus && (
            <View style={{ paddingVertical: spacing.md }}>
              <View style={{
                backgroundColor: deletionStatus.status === 'owner_rejected' ? '#EF444415' : deletionStatus.status === 'owner_approved' ? '#4B6BED15' : deletionStatus.status === 'completed' ? '#10B98115' : '#F59E0B15',
                borderRadius: radius.lg,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: deletionStatus.status === 'owner_rejected' ? '#EF444430' : deletionStatus.status === 'owner_approved' ? '#4B6BED30' : deletionStatus.status === 'completed' ? '#10B98130' : '#F59E0B30',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: deletionStatusLabels[deletionStatus.status]?.color || '#94A3B8' }} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: deletionStatusLabels[deletionStatus.status]?.color || '#94A3B8' }}>
                      {deletionStatusLabels[deletionStatus.status]?.label || deletionStatus.status}
                    </Text>
                  </View>
                  {(deletionStatus.status === 'pending_owner' || deletionStatus.status === 'owner_approved') && (
                    <TouchableOpacity onPress={handleCancelDeletion} activeOpacity={0.7}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#EF4444' }}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {deletionStatus.referenceId && (
                  <Text style={{ fontSize: 11, color: themeColors.text.tertiary, fontFamily: 'monospace' }}>
                    Ref: {deletionStatus.referenceId}
                  </Text>
                )}

                {deletionStatus.scheduledDeletionAt && (
                  <Text style={{ fontSize: 12, color: '#4B6BED', marginTop: 4 }}>
                    Scheduled for: {new Date(deletionStatus.scheduledDeletionAt).toLocaleDateString()}
                  </Text>
                )}

                {deletionStatus.status === 'owner_rejected' && (
                  <View style={{ marginTop: spacing.sm }}>
                    <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '600' }}>Previous request was not approved.</Text>
                    {deletionStatus.deletionRejectedReason && (
                      <Text style={{ fontSize: 11, color: '#EF4444AA', marginTop: 2 }}>Reason: {deletionStatus.deletionRejectedReason}</Text>
                    )}
                    <TouchableOpacity
                      onPress={handleReRequestDeletion}
                      style={{
                        marginTop: spacing.sm, backgroundColor: '#EF4444', borderRadius: radius.lg,
                        paddingVertical: 10, alignItems: 'center',
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: themeColors.text.inverse }}>Re-request Deletion</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {deletionStatus.status === 'cancelled' && (
                  <View style={{ marginTop: spacing.sm }}>
                    <Text style={{ fontSize: 12, color: '#94A3B8' }}>Previous request was cancelled.</Text>
                    <TouchableOpacity
                      onPress={handleReRequestDeletion}
                      style={{
                        marginTop: spacing.sm, backgroundColor: '#EF4444', borderRadius: radius.lg,
                        paddingVertical: 10, alignItems: 'center',
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: themeColors.text.inverse }}>Request Deletion</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {deletionStatus.status === 'completed' && (
                  <Text style={{ fontSize: 12, color: '#10B981', marginTop: 4 }}>Account deletion has been processed.</Text>
                )}
              </View>
            </View>
          )}
        </AppCard>

        {/* Support & Legal Section */}
        <Text style={[styles.sectionTitle, { color: themeColors.text.secondary }]}>Support & Legal</Text>
        <AppCard variant="elevated" style={[styles.card, { backgroundColor: themeColors.surface }]}>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/help')} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#4B6BED15' }]}>
                <Ionicons name="help-circle-outline" size={20} color="#4B6BED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: themeColors.text.primary }]}>Help Center & FAQ</Text>
                <Text style={[styles.rowDesc, { color: themeColors.text.tertiary }]} numberOfLines={1}>FAQ, WhatsApp and bug reporting</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={themeColors.text.tertiary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          <TouchableOpacity style={styles.row} onPress={() => router.push('/about')} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#7C3AED15' }]}>
                <Ionicons name="information-circle-outline" size={20} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: themeColors.text.primary }]}>About Happy Renting</Text>
                <Text style={[styles.rowDesc, { color: themeColors.text.tertiary }]} numberOfLines={1}>App version, status check and licenses</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={themeColors.text.tertiary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          <TouchableOpacity style={styles.row} onPress={rateApp} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#F59E0B15' }]}>
                <Ionicons name="star-outline" size={20} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: themeColors.text.primary }]}>Rate Your App</Text>
                <Text style={[styles.rowDesc, { color: themeColors.text.tertiary }]} numberOfLines={1}>Loved the app? Leave us a review</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={themeColors.text.tertiary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://happyrenting.netlify.app')} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#10B98115' }]}>
                <Ionicons name="globe-outline" size={20} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: themeColors.text.primary }]}>Visit Website</Text>
                <Text style={[styles.rowDesc, { color: themeColors.text.tertiary }]} numberOfLines={1}>Go to https://happyrenting.netlify.app</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={themeColors.text.tertiary} />
          </TouchableOpacity>
        </AppCard>

        {/* App Info Section */}
        <Text style={[styles.sectionTitle, { color: themeColors.text.secondary }]}>App Information</Text>
        <AppCard variant="elevated" style={[styles.card, { backgroundColor: themeColors.surface }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: themeColors.text.primary }]}>Version</Text>
            <Text style={[styles.infoValue, { color: themeColors.text.secondary }]}>v{APP_VERSION} (Build {APP_BUILD_NUMBER})</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: themeColors.text.primary }]}>Developer</Text>
            <Text style={[styles.infoValue, { color: themeColors.text.secondary }]}>Happy Renting Team</Text>
          </View>
        </AppCard>
      </ScrollView>

      {/* Biometric Password Input Modal */}
      <Modal visible={showBiometricModal} transparent animationType="fade">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[styles.modalContent, { backgroundColor: themeColors.surface, flexGrow: 1, justifyContent: 'center' }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text.primary }]}>Confirm Biometrics</Text>
              <TouchableOpacity onPress={handleCancelBiometric}>
                <Ionicons name="close" size={24} color={themeColors.text.primary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalDesc, { color: themeColors.text.secondary }]}>
              Please enter your password to confirm and securely save your login credentials on this device.
            </Text>
            <AppInput
              label="Account Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn, { borderColor: themeColors.border }]}
                onPress={handleCancelBiometric}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalCancelText, { color: themeColors.text.secondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalConfirmBtn, { backgroundColor: themeColors.primary }]}
                onPress={handleConfirmBiometric}
                activeOpacity={0.8}
                disabled={submittingBiometric}
              >
                {submittingBiometric ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Account Deletion Request Modal */}
      <Modal visible={showDeletionModal} transparent animationType="fade">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[styles.modalContent, { backgroundColor: themeColors.surface, flexGrow: 1, justifyContent: 'center' }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text.primary }]}>Delete Account</Text>
              <TouchableOpacity onPress={() => setShowDeletionModal(false)}>
                <Ionicons name="close" size={24} color={themeColors.text.primary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalDesc, { color: themeColors.text.secondary }]}>
              This sends a deletion request to your property owner for review. After owner approval, your account will be deleted after a 30-day grace period. Payment records will be retained for compliance.
            </Text>
            <AppInput
              label="Reason (optional)"
              placeholder="Let your owner know why you're leaving..."
              value={deletionReason}
              onChangeText={setDeletionReason}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn, { borderColor: themeColors.border }]}
                onPress={() => setShowDeletionModal(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalCancelText, { color: themeColors.text.secondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalConfirmBtn, { backgroundColor: '#EF4444' }]}
                onPress={submitDeletionRequest}
                activeOpacity={0.8}
                disabled={deletionLoading}
              >
                {deletionLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>Request Deletion</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  card: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  rowDesc: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    opacity: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadows.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtn: {
    borderWidth: 1,
  },
  modalConfirmBtn: {},
  modalCancelText: {
    fontWeight: '600',
  },
  modalConfirmText: {
    color: colors.text.inverse,
    fontWeight: '600',
  },
});
