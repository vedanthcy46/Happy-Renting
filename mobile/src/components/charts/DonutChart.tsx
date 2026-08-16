import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

// RNSVG's native parser rejects non-finite or exponential-notation numbers
// ("Invalid number formatting character"); always emit fixed-point values.
const svgNum = (n: number) => (Number.isFinite(n) ? Number(n.toFixed(3)) : 0);

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  valueFormat?: (n: number) => string;
  showLegend?: boolean;
  style?: ViewStyle;
}

/**
 * Donut chart with a legend. Segments are sized proportionally to value.
 * When all values are 0 an empty track is drawn instead.
 */
export const DonutChart: React.FC<DonutChartProps> = ({
  segments,
  size = 120,
  thickness = 16,
  centerLabel,
  centerValue,
  valueFormat,
  showLegend = true,
  style,
}) => {
  const { colors } = useTheme();
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  // Sanitize values: missing/NaN segments would emit "NaN" into SVG
  // attributes and crash react-native-svg ("Invalid number formatting character").
  const safeSegments = useMemo(
    () => segments.map((seg) => ({ ...seg, value: Math.max(0, Number(seg.value) || 0) })),
    [segments]
  );

  const total = useMemo(() => safeSegments.reduce((s, seg) => s + seg.value, 0), [safeSegments]);

  let acc = 0;
  const arcs = safeSegments.map((seg) => {
    const value = seg.value;
    const frac = total > 0 ? value / total : 0;
    const start = acc;
    const end = acc + frac * circumference;
    acc = end;
    return { ...seg, start, end, frac };
  });

  const renderLegend = () => (
    <View style={styles.legend}>
      {safeSegments.map((seg) => {
        const pct = total > 0 ? ((seg.value / total) * 100).toFixed(0) : '0';
        return (
          <View key={seg.label} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
            <Text style={[styles.legendLabel, { color: colors.text.primary }]}>{seg.label}</Text>
            <Text style={[styles.legendValue, { color: colors.text.secondary }]}>
              {valueFormat ? valueFormat(seg.value) : String(seg.value)} · {pct}%
            </Text>
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={style}>
      <View style={styles.centerWrap}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.borderLight}
            strokeWidth={thickness}
            fill="none"
          />
          {total > 0 &&
            arcs.map((arc, idx) => {
              const dash = svgNum(arc.end - arc.start);
              if (dash <= 0) return null;
              return (
                <Circle
                  key={`${arc.label}-${idx}`}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={arc.color}
                  strokeWidth={thickness}
                  fill="none"
                  strokeDasharray={`${dash} ${svgNum(circumference - dash)}`}
                  strokeDashoffset={-svgNum(arc.start)}
                  rotation={-90}
                  origin={`${size / 2}, ${size / 2}`}
                />
              );
            })}
          {centerValue !== undefined && (
            <SvgText
              x={size / 2}
              y={size / 2 - 4}
              fontSize={14}
              fontWeight="700"
              fill={colors.text.primary}
              textAnchor="middle"
            >
              {centerValue}
            </SvgText>
          )}
          {centerLabel !== undefined && (
            <SvgText
              x={size / 2}
              y={size / 2 + 12}
              fontSize={9}
              fill={colors.text.tertiary}
              textAnchor="middle"
            >
              {centerLabel}
            </SvgText>
          )}
        </Svg>
      </View>
      {showLegend && renderLegend()}
    </View>
  );
};

const styles = StyleSheet.create({
  centerWrap: { alignItems: 'center', justifyContent: 'center' },
  legend: { marginTop: spacing.md, gap: spacing.sm },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12, fontWeight: '500', flex: 1 },
  legendValue: { fontSize: 12, fontWeight: '600' },
});