import { StatusBar } from 'expo-status-bar';
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View } from '@/components/Themed';
import { useAuthStore } from '../src/store/useAuthStore';
import { updateProfile, changePassword as apiChangePassword, getProfile } from '../src/api/user';
import { AppCard, AppButton, AppInput, AppHeader } from '../src/components';
import { colors, typography, spacing, radius, shadows } from '../src/theme';
import { getInitials } from '../src/utils';

export default function ModalScreen() {
  const { user, logout, setAuth, token } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: (user as any)?.phone || '',
  });

  const [showPassModal, setShowPassModal] = useState(false);
  const [passData, setPassData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passLoading, setPassLoading] = useState(false);

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
        Alert.alert('Success', 'Profile updated');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to update');
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
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    setPassLoading(true);
    try {
      const res = await apiChangePassword({
        currentPassword: passData.currentPassword,
        newPassword: passData.newPassword,
      });
      if (res.success) {
        Alert.alert('Success', 'Password changed');
        setShowPassModal(false);
        setPassData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to change password');
    } finally {
      setPassLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Profile"
        onBack={() => router.back()}
        style={{ paddingTop: insets.top + spacing.md }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Avatar & Name */}
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

        {/* Edit Profile */}
        <AppCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="create-outline" size={18} color={colors.text.primary} />
            <Text style={styles.sectionTitle}>Edit Profile</Text>
          </View>
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
          <AppButton
            title="Update Profile"
            onPress={handleUpdateProfile}
            loading={loading}
            fullWidth
          />
        </AppCard>

        {/* Security */}
        <AppCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.text.primary} />
            <Text style={styles.sectionTitle}>Security</Text>
          </View>
          <AppButton
            title="Change Password"
            onPress={() => setShowPassModal(true)}
            variant="outline"
            fullWidth
            icon={<Ionicons name="lock-closed-outline" size={18} color={colors.primary} />}
          />
        </AppCard>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Happy Renting v1.0.0</Text>
      </ScrollView>

      {/* Change Password Modal */}
      {showPassModal && (
        <View style={styles.passOverlay}>
          <View style={styles.passModal}>
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
              <AppButton title="Cancel" onPress={() => setShowPassModal(false)} variant="ghost" style={{ flex: 1, marginRight: spacing.sm }} />
              <AppButton title="Change" onPress={handleChangePassword} loading={passLoading} style={{ flex: 1, marginLeft: spacing.sm }} />
            </View>
          </View>
        </View>
      )}

      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.huge,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  avatarLargeText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
  profileName: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  profileEmail: {
    ...typography.body,
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
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
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
    ...typography.subtitle,
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
  logoutText: {
    ...typography.subtitle,
    color: colors.error,
  },
  versionText: {
    ...typography.caption,
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
    borderRadius: radius.xl,
    padding: spacing.xxl,
  },
  passHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  passTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  passButtons: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
});
