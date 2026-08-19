import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, radius, shadows, useResponsive } from '../theme';
import type { Workspace } from '../types/auth';

interface WorkspacePickerProps {
  visible: boolean;
  onClose?: () => void;
  /** If true, shows as a post-login picker (no close button, must pick) */
  required?: boolean;
}

const WORKSPACES: { key: Workspace; label: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  {
    key: 'tenant',
    label: 'Tenant',
    subtitle: 'View rent, payments & complaints',
    icon: 'home-outline',
  },
  {
    key: 'owner',
    label: 'Owner',
    subtitle: 'Manage properties, tenants & collections',
    icon: 'business-outline',
  },
  {
    key: 'pg',
    label: 'PG Manager',
    subtitle: 'Manage beds, residents & PG operations',
    icon: 'bed-outline',
  },
];

export const WorkspacePicker: React.FC<WorkspacePickerProps> = ({
  visible, onClose, required = false,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useResponsive();
  const { activeWorkspace, setWorkspace, user } = useAuthStore();
  const isNarrowed = width >= 600;
  const sheetWidth = isNarrowed ? Math.min(width * 0.94, 560) : undefined;

  const availableWorkspaces = WORKSPACES.filter(w => {
    if (!user) return false;
    const roles = user.roles ?? [user.role];
    // superadmin alone is not a mobile workspace — they must also have owner or tenant role
    if (w.key === 'owner' || w.key === 'pg') return roles.includes('owner');
    return roles.includes('tenant');
  });

  const handleSelect = async (workspace: Workspace) => {
    await setWorkspace(workspace);
    onClose?.();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={[styles.overlay, { paddingBottom: insets.bottom + 64 }]}>
        {!required && (
          <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        )}
        <View style={[styles.sheet, { backgroundColor: colors.surface }, ...(isNarrowed ? [{ width: sheetWidth, alignSelf: 'center' as const, borderRadius: radius.xxl }] : [])]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <Text style={[styles.title, { color: colors.text.primary }]}>
            {required ? 'Choose Workspace' : 'Switch Workspace'}
          </Text>
          {required && (
            <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
              Your account has access to multiple workspaces.
            </Text>
          )}

          <View style={styles.options}>
            {availableWorkspaces.map(ws => {
              const isActive = activeWorkspace === ws.key && !required;
              return (
                <TouchableOpacity
                  key={ws.key}
                  style={[
                    styles.option,
                    { backgroundColor: colors.background, borderColor: isActive ? colors.primary : colors.border },
                    isActive && { borderWidth: 2 },
                    shadows.sm,
                  ]}
                  onPress={() => handleSelect(ws.key)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.optionIcon, { backgroundColor: isActive ? colors.primary : colors.primaryLight }]}>
                    <Ionicons name={ws.icon} size={24} color={isActive ? '#FFFFFF' : colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, { color: colors.text.primary }]}>{ws.label}</Text>
                    <Text style={[styles.optionSub, { color: colors.text.secondary }]}>{ws.subtitle}</Text>
                  </View>
                  {isActive && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.xxl,
    paddingBottom: spacing.xxxl + spacing.xxl,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  options: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  optionSub: {
    fontSize: 13,
    marginTop: 2,
  },
});
