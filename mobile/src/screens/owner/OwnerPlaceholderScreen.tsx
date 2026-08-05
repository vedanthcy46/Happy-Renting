import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  description?: string;
}

/**
 * Temporary placeholder shown for owner screens not yet built in Phase 3.
 * Replace this by pointing the route file to the real screen component.
 */
export const OwnerPlaceholderScreen: React.FC<Props> = ({
  title,
  icon,
  description = 'This screen is coming soon.',
}) => {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: themeColors.background, paddingTop: insets.top + 16 },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
        <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>{title}</Text>
      </View>

      {/* Body */}
      <View style={styles.body}>
        <View style={[styles.iconWrap, { backgroundColor: themeColors.primary + '15' }]}>
          <Ionicons name={icon} size={48} color={themeColors.primary} />
        </View>
        <Text style={[styles.comingTitle, { color: themeColors.text.primary }]}>{title}</Text>
        <Text style={[styles.comingBody, { color: themeColors.text.secondary }]}>
          {description}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  comingTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  comingBody: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
