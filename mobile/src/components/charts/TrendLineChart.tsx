import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Path, Circle, Text as SvgText, Line } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme';

interface TrendPoint {
  label: string;
  value: number;
}

// RNSVG's native parser rejects non-finite or exponential-notation numbers
// ("Invalid number formatting character"); always emit fixed-point values.
const svgNum = (n: number) => (Number.isFinite(n) ? Number(n.toFixed(3)) : 0);

interface TrendLineChartProps {
  data: TrendPoint[];
  height?: number;
  color?: string;
  valueFormat?: (n: number) => string;
  showPoints?: boolean;
  style?: ViewStyle;
}

/**
 * Simple line chart for income / pending trends. Y-axis is auto-scaled with
 * a padded max; x labels are drawn from `data[i].label`.
 */
export const TrendLineChart: React.FC<TrendLineChartProps> = ({
  data,
  height = 150,
  color,
  valueFormat,
  showPoints = true,
  style,
}) => {
  const { colors } = useTheme();
  const width = 280;
  const padBottom = 24;
  const padTop = 12;
  const padLeft = 0;
  const padRight = 0;
  const plotH = height - padBottom - padTop;
  const plotW = width - padLeft - padRight;
  const lineColor = color || colors.primary;

  // Sanitize values: undefined/NaN would produce "NaN"/"Infinity" in the
  // path string and crash react-native-svg ("Invalid number formatting character").
  const safeData = useMemo(
    () => data.map((d) => ({ ...d, value: Number.isFinite(d.value) ? Math.max(0, d.value) : 0 })),
    [data]
  );

  const max = useMemo(() => {
    let m = 0;
    for (const d of safeData) m = Math.max(m, d.value);
    return m === 0 ? 1 : m * 1.15;
  }, [safeData]);

  const points = useMemo(() => {
    if (safeData.length <= 1) return [];
    return safeData.map((d, i) => {
      const x = svgNum(padLeft + (safeData.length === 1 ? plotW / 2 : (i / (safeData.length - 1)) * plotW));
      const y = svgNum(padTop + plotH - (d.value / max) * plotH);
      return { x, y, ...d };
    });
  }, [safeData, max, plotW, plotH]);

  if (safeData.length === 0) {
    return (
      <View style={[styles.emptyWrap, { height }]}>
        <Text style={[styles.emptyText, { color: colors.text.tertiary }]}>—</Text>
      </View>
    );
  }

  const linePath = points.length > 1
    ? points
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
        .join(' ')
    : '';

  return (
    <View style={style}>
      <Svg width={width} height={height}>
        <Line x1={padLeft} y1={padTop + plotH} x2={padLeft + plotW} y2={padTop + plotH} stroke={colors.border} strokeWidth={1} />
        {points.length > 1 && (
          // Use Path directly: Polyline's `points` prop expects raw "x,y x,y" pairs
          // and RNSVG prepends its own "M", which corrupts an M/L path string and
          // crashes the native parser ("Invalid number formating character 'M'").
          <Path d={linePath} fill="none" stroke={lineColor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {showPoints &&
          points.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={3} fill={lineColor} stroke={colors.surface} strokeWidth={1.5} />
          ))}
        {points.map((p, i) => (
          <SvgText
            key={`l-${i}`}
            x={p.x}
            y={height - 6}
            fontSize={8}
            fontWeight="600"
            fill={colors.text.tertiary}
            textAnchor="middle"
          >
            {p.label}
          </SvgText>
        ))}
      </Svg>
      {valueFormat && (
        <Text style={[styles.maxLabel, { color: colors.text.tertiary }]}>{valueFormat(max)}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  emptyWrap: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, fontWeight: '700' },
  maxLabel: { fontSize: 10, alignSelf: 'flex-end', marginTop: spacing.xs },
});