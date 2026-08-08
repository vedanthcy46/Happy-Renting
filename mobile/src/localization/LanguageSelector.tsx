import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, type SupportedLanguage } from './i18n';
import {
  saveLanguagePreference,
  followDeviceLanguage,
  restoreLanguagePreference,
} from './languageService';

export interface LanguageSelectorProps {
  onLanguageChange?: (language: SupportedLanguage | 'device') => Promise<void> | void;
}

type Option = { code: SupportedLanguage | 'device'; label: string };

const OPTIONS: Option[] = [
  { code: 'device', label: 'Follow Device' },
  ...(SUPPORTED_LANGUAGES as readonly SupportedLanguage[]).map((code) => ({
    code,
    label: LANGUAGE_NAMES[code],
  })),
];

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ onLanguageChange }) => {
  const { i18n } = useTranslation();
  const { colors } = useTheme();
  const [saving, setSaving] = useState(false);
  const [followDevice, setFollowDevice] = useState(true);
  const [active, setActive] = useState<SupportedLanguage>('en');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    restoreLanguagePreference().then((state) => {
      setFollowDevice(state.followDevice);
      setActive(state.language);
    });
  }, []);

  const currentCode: SupportedLanguage | 'device' = followDevice ? 'device' : active;
  const currentLabel = OPTIONS.find((o) => o.code === currentCode)?.label ?? 'English';

  const handleSelect = useCallback(
    async (code: SupportedLanguage | 'device') => {
      setOpen(false);
      if (code === currentCode) return;
      setSaving(true);
      try {
        if (code === 'device') {
          await followDeviceLanguage();
          setFollowDevice(true);
          setActive(i18n.language as SupportedLanguage);
        } else {
          await saveLanguagePreference(code);
          setFollowDevice(false);
          setActive(code);
        }
        if (onLanguageChange) await onLanguageChange(code);
      } finally {
        setSaving(false);
      }
    },
    [currentCode, i18n.language, onLanguageChange],
  );

  return (
    <>
      {/* Dropdown trigger */}
      <TouchableOpacity
        style={[styles.trigger, { borderColor: colors.border, backgroundColor: colors.background }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
        disabled={saving}
      >
        <View style={styles.triggerLeft}>
          <Ionicons name="language-outline" size={16} color={colors.primary} style={{ marginRight: spacing.sm }} />
          <Text style={[styles.triggerText, { color: colors.text.primary }]}>{currentLabel}</Text>
        </View>
        {saving ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="chevron-down" size={16} color={colors.text.tertiary} />
        )}
      </TouchableOpacity>

      {/* Picker sheet */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.text.primary }]}>Select Language</Text>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            {OPTIONS.map((opt, idx) => {
              const selected = opt.code === currentCode;
              return (
                <TouchableOpacity
                  key={opt.code}
                  style={[
                    styles.option,
                    selected && { backgroundColor: colors.primaryLight },
                    idx < OPTIONS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                  ]}
                  onPress={() => handleSelect(opt.code)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionLabel, { color: selected ? colors.primary : colors.text.primary }, selected && styles.optionLabelActive]}>
                    {opt.label}
                  </Text>
                  {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  triggerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 40,
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: 380,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  optionLabel: {
    fontSize: 15,
  },
  optionLabelActive: {
    fontWeight: '700',
  },
});
