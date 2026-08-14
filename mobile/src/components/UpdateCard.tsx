import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';
import { LinearGradient } from 'expo-linear-gradient';
import { getAppVersionInfo } from '../api/appVersion';
import { APP_VERSION, APP_BUILD_NUMBER, PLAY_STORE_URL } from '../utils/rateApp';

const DISMISSED_KEY = 'app_update_dismissed';
const REMIND_DAYS = 3;
const REMIND_MS = REMIND_DAYS * 24 * 60 * 60 * 1000;

interface Dismissal {
  version: string;
  dismissedAt: number;
}

function isUpdateAvailable(latestVersionCode?: number, latestVersion?: string): boolean {
  const currentBuild = Number(APP_BUILD_NUMBER) || 0;
  if (latestVersionCode && latestVersionCode > currentBuild) return true;

  if (latestVersion) {
    const latestParts = latestVersion.split('.').map((p) => Number(p) || 0);
    const currentParts = APP_VERSION.split('.').map((p) => Number(p) || 0);
    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i += 1) {
      const a = latestParts[i] ?? 0;
      const b = currentParts[i] ?? 0;
      if (a > b) return true;
      if (a < b) return false;
    }
  }
  return false;
}

export const UpdateCard: React.FC = () => {
  const { t } = useTranslation();
  const { colors: themeColors } = useTheme();
  const [dismissed, setDismissed] = useState<Dismissal | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['appVersion'],
    queryFn: getAppVersionInfo,
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    SecureStore.getItemAsync(DISMISSED_KEY)
      .then((val) => {
        if (val) {
          try {
            setDismissed(JSON.parse(val) as Dismissal);
          } catch {
            setDismissed(null);
          }
        }
      })
      .catch(() => {});
  }, []);

  const latestCode = data?.latestVersionCode;
  const latestVersion = data?.latestVersion;
  const updateAvailable = !!data?.success && isUpdateAvailable(latestCode, latestVersion);

  if (isLoading || isError || !updateAvailable) return null;

  const versionKey = String(latestCode ?? latestVersion ?? '');
  const isDismissed =
    dismissed !== null && dismissed.version === versionKey && Date.now() - dismissed.dismissedAt < REMIND_MS;
  if (isDismissed) return null;

  const onUpdate = () => {
    Linking.openURL(data?.playStoreUrl || PLAY_STORE_URL).catch(() => {});
  };

  const onLater = () => {
    if (versionKey) {
      const dismissal: Dismissal = { version: versionKey, dismissedAt: Date.now() };
      SecureStore.setItemAsync(DISMISSED_KEY, JSON.stringify(dismissal)).catch(() => {});
      setDismissed(dismissal);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: themeColors.surface }, styles.shadow]}>
      <LinearGradient colors={themeColors.gradient.primary as any} style={styles.iconWrap}>
        <Ionicons name="arrow-up-circle-outline" size={22} color="#FFFFFF" />
      </LinearGradient>
      <View style={styles.content}>
        <Text style={[styles.title, { color: themeColors.text.primary }]}>{t('update.available')}</Text>
        <Text style={[styles.message, { color: themeColors.text.secondary }]}>
          {latestVersion && latestVersion !== APP_VERSION
            ? t('update.messageWithVersion', { version: latestVersion })
            : t('update.message')}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onUpdate}
            style={[styles.updateBtn, { backgroundColor: themeColors.primary }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.updateBtnText}>{t('update.update')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onLater} style={styles.laterBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.laterText, { color: themeColors.text.secondary }]}>{t('update.later')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  message: {
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 14,
  },
  updateBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  updateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  laterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  laterText: {
    fontSize: 13,
    fontWeight: '500',
  },
});