import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme';

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface CalendarPickerProps {
  value: string;
  onChange: (dateKey: string) => void;
  maxDate?: string;
}

export const CalendarPicker: React.FC<CalendarPickerProps> = ({ value, onChange, maxDate }) => {
  const { colors } = useTheme();
  const [viewYear, setViewYear] = useState(() => {
    const v = value ? new Date(value) : new Date();
    return isNaN(v.getTime()) ? new Date().getFullYear() : v.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const v = value ? new Date(value) : new Date();
    return isNaN(v.getTime()) ? new Date().getMonth() : v.getMonth();
  });

  const maxKey = maxDate ?? toDateKey(new Date());
  const todayKey = toDateKey(new Date());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const isFutureMonth = () =>
    viewYear > new Date().getFullYear() ||
    (viewYear === new Date().getFullYear() && viewMonth >= new Date().getMonth());

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goToPrevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.nav}>
          <Ionicons name="chevron-back" size={20} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.text.primary }]}>
          {MONTH_LABELS[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity
          onPress={goToNextMonth}
          disabled={isFutureMonth()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.nav, !isFutureMonth() && { opacity: 0.3 }]}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.weekRow, { borderBottomColor: colors.border }]}>
        {WEEKDAY_LABELS.map((label, i) => (
          <View key={label} style={[styles.weekCell, i % 7 === 0 && { backgroundColor: colors.errorLight }]}>
            <Text style={[styles.weekLabel, { color: i === 0 ? colors.error : colors.text.tertiary }]}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`empty-${i}`} style={styles.dayCell} />;
          const dayKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = dayKey === value;
          const isToday = dayKey === todayKey;
          const isDisabled = !!maxKey && dayKey > maxKey;

          return (
            <TouchableOpacity
              key={dayKey}
              style={styles.dayCell}
              disabled={isDisabled}
              activeOpacity={0.7}
              onPress={() => onChange(dayKey)}
            >
              <View
                style={[
                  styles.dayCircle,
                  isSelected && { backgroundColor: colors.primary },
                  isToday && !isSelected && { backgroundColor: colors.primaryLight },
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    { color: isDisabled ? colors.border : colors.text.primary },
                    isSelected && { color: '#FFF', fontWeight: '700' },
                  ]}
                >
                  {day}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md - 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  nav: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.xs,
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    borderRadius: radius.sm,
    marginHorizontal: 2,
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: spacing.xs,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1.1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 14,
  },
});