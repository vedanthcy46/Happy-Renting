import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme';

interface PremiumTagProps {
  label?: string;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}

/**
 * Small "Premium" pill used to mark premium-only cards / nav items.
 */
export const PremiumTag: React.FC<PremiumTagProps> = ({ label, style, small = false }) => {
  const { colors } = useTheme();
  const premiumColor = colors.gradient.premium[0];

  return (
    <View
      style={[
        styles.tag,
        small && styles.tagSmall,
        { backgroundColor: premiumColor + '1A', borderColor: premiumColor + '40' },
        style,
      ]}
    >
      <Ionicons name="diamond" size={small ? 8 : 10} color={premiumColor} />
      <Text style={[styles.text, small && styles.textSmall, { color: premiumColor }]}>
        {label || 'Premium'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  tagSmall: {
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  textSmall: {
    fontSize: 8,
    letterSpacing: 0.2,
  },
});