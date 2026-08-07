import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/useAuthStore';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme';

/**
 * Floating "AI Assistant" launcher. Only shown when authenticated and while the
 * user is inside a tab screen (not on login/onboarding/chat itself).
 */
export const AiLauncher = () => {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const { colors } = useTheme();

  if (!user || !token) return null;
  if (pathname === '/ai') return null;
  if (pathname.includes('login') || pathname.includes('onboarding')) return null;

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: colors.primary }]}
      onPress={() => router.push('/ai')}
      activeOpacity={0.85}
    >
      <Ionicons name="sparkles" size={22} color="#FFFFFF" />
      <Text style={styles.label}>AI</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    // Positioned bottom-RIGHT. The tenant complaints screen keeps its "Add"
    // button in the header (top), so there is no overlap on that screen.
    right: spacing.lg,
    bottom: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  label: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});