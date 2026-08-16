import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme';

export interface BarSeries {
  label: string;
  color: string;
}

// RNSVG's native parser rejects non-finite or exponential-notation numbers
// ("Invalid number formatting character"); always emit fixed-point values.
const svgNum = (n: number) => (Number.isFinite(n) ? Number(n.toFixed(3)) : 0);

export interface BarDatum {
  label: string;
  values: number[];
}

interface GroupedBarChartProps {
  data: BarDatum[];
  series: BarSeries[];
  height?: number;
  valueFormat?: (n: number) => string;
  showLegend?: boolean;
  style?: ViewStyle;
}

/**
 * Lightweight grouped bar chart built on react-native-svg.
 * Renders one cluster of bars per datum, with rounded tops.
 */
export const GroupedBarChart: React.FC<GroupedBarChartProps> = ({
  data,
  series,
  height = 160,
  valueFormat,
  showLegend = true,
  style,
}) => {
  const { colors } = useTheme();
  const width = 280;

  // Sanitize values so undefined/NaN never reaches SVG geometry
  // (react-native-svg crashes on "NaN" with "Invalid number formatting character").
  const safeData = useMemo(
    () => data.map((d) => ({ ...d, values: d.values.map((v) => (Number.isFinite(v) ? Math.max(0, v) : 0)) })),
    [data]
  );

  const max = useMemo(() => {
    let m = 0;
    for (const d of safeData) {
      for (const v of d.values) m = Math.max(m, v);
    }
    return m || 1;
  }, [safeData]);

  const chartPadBottom = 26;
  const chartPadTop = 8;
  const chartHeight = height - chartPadBottom - chartPadTop;
  const groupWidth = safeData.length ? width / safeData.length : width;
  const barWidth = Math.min(14, (groupWidth * 0.5) / series.length);

  return (
    <View style={[styles.wrap, style]}>
      {showLegend && series.length > 1 && (
        <View style={styles.legend}>
          {series.map((s) => (
            <View key={s.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text style={[styles.legendText, { color: colors.text.secondary }]}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}
      <Svg width={width} height={height}>
        {safeData.map((d, di) => {
          const gx = di * groupWidth;
          const center = gx + groupWidth / 2;
          return d.values.map((v, si) => {
            const barH = svgNum((v / max) * chartHeight);
            const x = svgNum(center - (series.length * barWidth) / 2 + si * barWidth);
            const y = svgNum(chartPadTop + (chartHeight - barH));
            return (
              <Rect
                key={`${di}-${si}`}
                x={x}
                y={y}
                width={svgNum(barWidth)}
                height={Math.max(barH, 1)}
                rx={3}
                fill={series[si]?.color || colors.primary}
              />
            );
          });
        })}
        {safeData.map((d, di) => {
          const gx = di * groupWidth;
          const center = gx + groupWidth / 2;
          return (
            <SvgText
              key={`l-${di}`}
              x={svgNum(center)}
              y={height - 6}
              fontSize={8}
              fontWeight="600"
              fill={colors.text.tertiary}
              textAnchor="middle"
            >
              {d.label}
            </SvgText>
          );
        })}
      </Svg>
      {valueFormat && (
        <Text style={[styles.maxLabel, { color: colors.text.tertiary }]}>
          {valueFormat(max)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '500' },
  maxLabel: { fontSize: 10, alignSelf: 'flex-end', marginTop: spacing.xs },
});