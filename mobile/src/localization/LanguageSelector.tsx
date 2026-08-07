import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { colors, spacing, radius } from '../theme';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, type SupportedLanguage } from './i18n';
import {
  saveLanguagePreference,
  followDeviceLanguage,
  restoreLanguagePreference,
} from './languageService';

export interface LanguageSelectorProps {
  /** Persist the choice to the backend as well (needs auth) */
  onLanguageChange?: (language: SupportedLanguage | 'device') => Promise<void> | void;
}

/**
 * Reusable language selector used in Settings. "Follow Device" uses the device
 * language; otherwise the choice is persisted locally (and optionally synced to
 * the backend via onLanguageChange).
 */
export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ onLanguageChange }) => {
  const { i18n } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [followDevice, setFollowDevice] = useState(true);
  const [active, setActive] = useState<SupportedLanguage>('en');

  useEffect(() => {
    restoreLanguagePreference().then((state) => {
      setFollowDevice(state.followDevice);
      setActive(state.language);
    });
  }, []);

  const handleSelect = useCallback(
    async (code: SupportedLanguage | 'device') => {
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
    [i18n.language, onLanguageChange],
  );

  return (
    <View>
      <TouchableOpacity
        style={[styles.option, followDevice ? styles.optionSelected : null]}
        onPress={() => handleSelect('device')}
        disabled={saving}
        activeOpacity={0.7}
      >
        <Text style={[styles.optionLabel, followDevice ? styles.optionLabelActive : null]}>
          Follow Device
        </Text>
        {followDevice && <Text style={styles.check}>✓</Text>}
      </TouchableOpacity>

      {(SUPPORTED_LANGUAGES as readonly SupportedLanguage[]).map((code) => {
        const selected = !followDevice && active === code;
        return (
          <TouchableOpacity
            key={code}
            style={[styles.option, selected ? styles.optionSelected : null]}
            onPress={() => handleSelect(code)}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Text style={[styles.optionLabel, selected ? styles.optionLabelActive : null]}>
              {LANGUAGE_NAMES[code]}
            </Text>
            {selected && <Text style={styles.check}>✓</Text>}
          </TouchableOpacity>
        );
      })}
      {saving && <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />}
    </View>
  );
};

const styles = StyleSheet.create({
  spinner: {
    marginTop: spacing.md,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginVertical: 2,
  },
  optionSelected: {
    backgroundColor: colors.primaryLight,
  },
  optionLabel: {
    fontSize: 15,
    color: colors.text.primary,
  },
  optionLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  check: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 16,
  },
});