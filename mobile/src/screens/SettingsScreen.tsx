import React, { useState, useEffect } from 'react';
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
import { useRouter } from 'expo-router';

export const SettingsScreen: React.FC = () => {
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
      Alert.alert('Success', 'Biometric login disabled.');
    }
  };

  const handleConfirmBiometric = async () => {
    if (!password) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    setSubmittingBiometric(true);
    try {
      if (user?.email) {
        await saveBiometricCredentials(user.email, password);
        setBiometricActive(true);
        setShowBiometricModal(false);
        setPassword('');
        Alert.alert('Success', 'Biometric login enabled successfully.');
      } else {
        Alert.alert('Error', 'User email not found. Please log in again.');
      }
    } catch {
      Alert.alert('Error', 'Failed to save biometric credentials.');
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
      'Clear Cache & Reset',
      'Are you sure you want to clear the cache and log out? This will reset all local sessions and biometric settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear & Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear react query cache
              await queryClient.clear();
              // Invalidate and reset push settings
              await SecureStore.deleteItemAsync('push_notifications_enabled');
              // Log out (which also clears userToken, userData, and biometric credentials)
              await logout();
              router.replace('/login');
            } catch (e) {
              Alert.alert('Error', 'Failed to clear cache fully.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'To delete your account, please send an email to support@happyrenting.in from your registered email address requesting account deletion.',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Top Bar Header */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md, backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={themeColors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text.primary }]}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Preferences Section */}
        <Text style={[styles.sectionTitle, { color: themeColors.text.secondary }]}>Preferences</Text>
        <AppCard variant="elevated" style={[styles.card, { backgroundColor: themeColors.surface }]}>
          {/* Dark Mode */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: isDark ? '#3B82F620' : '#2563EB15' }]}>
                <Ionicons name="moon-outline" size={20} color={isDark ? '#60A5FA' : '#2563EB'} />
              </View>
              <View>
                <Text style={[styles.rowTitle, { color: themeColors.text.primary }]}>Dark Mode</Text>
                <Text style={[styles.rowDesc, { color: themeColors.text.tertiary }]}>Toggle light and dark themes</Text>
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
                <Text style={[styles.rowTitle, { color: themeColors.text.primary }]}>Push Notifications</Text>
                <Text style={[styles.rowDesc, { color: themeColors.text.tertiary }]}>Get updates about bills and complaints</Text>
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
                    <Text style={[styles.rowTitle, { color: themeColors.text.primary }]}>Biometric Login</Text>
                    <Text style={[styles.rowDesc, { color: themeColors.text.tertiary }]}>Enable Face ID or Fingerprint</Text>
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

          {/* Delete Account */}
          <TouchableOpacity style={styles.row} onPress={handleDeleteAccount} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#EF444415' }]}>
                <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
              </View>
              <View>
                <Text style={[styles.rowTitle, { color: '#EF4444' }]}>Delete Account</Text>
                <Text style={[styles.rowDesc, { color: themeColors.text.tertiary }]}>Permanently remove all data</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={themeColors.text.tertiary} />
          </TouchableOpacity>
        </AppCard>

        {/* Support & Legal Section */}
        <Text style={[styles.sectionTitle, { color: themeColors.text.secondary }]}>Support & Legal</Text>
        <AppCard variant="elevated" style={[styles.card, { backgroundColor: themeColors.surface }]}>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/help')} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#3B82F615' }]}>
                <Ionicons name="help-circle-outline" size={20} color="#3B82F6" />
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
            <Text style={[styles.infoValue, { color: themeColors.text.secondary }]}>v1.0.0 (Build 1)</Text>
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
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.surface }]}>
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
          </View>
        </View>
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
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
