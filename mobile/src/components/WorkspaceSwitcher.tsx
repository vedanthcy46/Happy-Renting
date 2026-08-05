import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme';
import { WorkspacePicker } from './WorkspacePicker';
import { appEvents, OPEN_DRAWER_EVENT } from '../utils/events';

interface WorkspaceSwitcherProps {
  /** Render the chip as a standalone row/header element. */
  variant?: 'chip' | 'header';
  /** When true, shows the three-line menu icon alongside (used in screens). */
  showMenu?: boolean;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({
  variant = 'chip',
  showMenu = false,
}) => {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, activeWorkspace } = useAuthStore();
  const [pickerVisible, setPickerVisible] = useState(false);

  const roles = user?.roles ?? (user?.role ? [user.role] : []);
  const hasOwner = roles.includes('owner');
  const hasTenant = roles.includes('tenant');
  const canSwitch = hasOwner && hasTenant;

  const label = activeWorkspace === 'owner' ? 'Owner' : 'Tenant';
  const icon = activeWorkspace === 'owner' ? 'business' : 'home';

  return (
    <>
      <View style={[styles.row, variant === 'header' && styles.headerRow]}>
        {showMenu && (
          <TouchableOpacity
            onPress={() => appEvents.emit(OPEN_DRAWER_EVENT)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.menuBtn}
          >
            <Ionicons name="menu" size={26} color={colors.text.primary} />
          </TouchableOpacity>
        )}
        {canSwitch && (
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={() => setPickerVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name={icon} size={14} color="#FFFFFF" />
            <Text style={styles.chipText}>{label}</Text>
            <Ionicons name="chevron-down" size={13} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
        )}
      </View>

      <WorkspacePicker
        visible={pickerVisible}
        onClose={() => {
          setPickerVisible(false);
          const { activeWorkspace: ws } = useAuthStore.getState();
          setTimeout(() => {
            if (ws === 'owner') router.replace('/(owner-tabs)' as any);
            else router.replace('/(tabs)' as any);
          }, 300);
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  headerRow: { gap: spacing.md },
  menuBtn: { padding: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
  },
  chipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});