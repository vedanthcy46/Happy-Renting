import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme';

export interface HBarDatum {
  label: string;
  value: number;
  color: string;
  /** Optional trailing detail, e.g. "8/10 rooms" */
  subLabel?: string;
}

interface HorizontalBarChartProps {
  data: HBarDatum[];
  valueFormat?: (n: number) => string;
  /** Fixed scale maximum; defaults to the largest value */
  maxValue?: number;
  /** Makes each row tappable */
  onRowPress?: (index: number) => void;
  style?: ViewStyle;
}

/**
 * Horizontal bar list: label, proportional fill and formatted value per row.
 * Used for property-wise collections/occupancy and tenant payment status.
 */
export const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({
  data,
  valueFormat,
  maxValue,
  onRowPress,
  style,
}) => {
  const { colors } = useTheme();

  // Sanitize values so missing/NaN data renders an empty bar instead of breaking layout.
  const safeData = useMemo(
    () => data.map((d) => ({ ...d, value: Number.isFinite(d.value) ? Math.max(0, d.value) : 0 })),
    [data]
  );

  const max = useMemo(() => {
    if (maxValue !== undefined && maxValue > 0) return maxValue;
    return safeData.reduce((m, d) => Math.max(m, d.value), 0) || 1;
  }, [safeData, maxValue]);

  return (
    <View style={[styles.wrap, style]}>
      {safeData.map((d, i) => {
        const frac = Math.max(0, Math.min(1, d.value / max));
        const Row = onRowPress ? TouchableOpacity : View;
        return (
          <Row
            key={`${d.label}-${i}`}
            style={styles.row}
            {...(onRowPress
              ? { onPress: () => onRowPress(i), activeOpacity: 0.7, hitSlop: { top: 4, bottom: 4 } }
              : {})}
          >
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: colors.text.primary }]} numberOfLines={1}>
                {d.label}
              </Text>
              <Text style={[styles.value, { color: colors.text.secondary }]}>
                {valueFormat ? valueFormat(d.value) : String(d.value)}
                {d.subLabel ? ` · ${d.subLabel}` : ''}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.borderLight }]}>
              <View
                style={[
                  styles.fill,
                  {
                    backgroundColor: d.color,
                    width: `${Math.max(frac * 100, d.value > 0 ? 3 : 0)}%`,
                  },
                ]}
              />
            </View>
          </Row>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  row: { gap: spacing.xs },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  label: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  value: { fontSize: 12, fontWeight: '700' },
  track: { height: 8, borderRadius: radius.sm, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.sm },
});
