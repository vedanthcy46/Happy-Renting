import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import i18n, {
  initI18n,
  getDeviceLanguage,
  normalizeLanguage,
  type SupportedLanguage,
} from './i18n';

export const LANGUAGE_STORAGE_KEY = 'preferred_language';
export const FOLLOW_DEVICE_KEY = 'follow_device_language';

const isWeb = Platform.OS === 'web';

const webGet = async (key: string): Promise<string | null> => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
};

const webSet = async (key: string, value: string): Promise<void> => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
};

const webDelete = async (key: string): Promise<void> => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  } catch {
    /* noop */
  }
};

const storeGet = isWeb ? webGet : SecureStore.getItemAsync;
const storeSet = isWeb ? webSet : SecureStore.setItemAsync;
const storeDelete = isWeb ? webDelete : SecureStore.deleteItemAsync;

export interface LanguageState {
  language: SupportedLanguage;
  followDevice: boolean;
}

/** Persist the user's language choice. */
export const saveLanguagePreference = async (language: SupportedLanguage): Promise<void> => {
  await storeSet(LANGUAGE_STORAGE_KEY, language);
  await storeSet(FOLLOW_DEVICE_KEY, 'false');
  await i18n.changeLanguage(language);
};

/** Revert to following the device language. */
export const followDeviceLanguage = async (): Promise<void> => {
  await storeDelete(LANGUAGE_STORAGE_KEY);
  await storeSet(FOLLOW_DEVICE_KEY, 'true');
  await i18n.changeLanguage(getDeviceLanguage());
};

/** Restore the persisted preference, else fall back to device language. */
export const restoreLanguagePreference = async (): Promise<LanguageState> => {
  const saved = await storeGet(LANGUAGE_STORAGE_KEY);
  const followRaw = await storeGet(FOLLOW_DEVICE_KEY);

  if (saved) {
    return { language: normalizeLanguage(saved), followDevice: false };
  }
  if (followRaw === 'true') {
    return { language: getDeviceLanguage(), followDevice: true };
  }
  return { language: getDeviceLanguage(), followDevice: false };
};

/**
 * Initialize i18n, restoring any persisted language preference before the app
 * renders UI. Call this once at app startup.
 */
export const initializeLanguage = async (): Promise<void> => {
  const { language } = await restoreLanguagePreference();
  await initI18n(language);
};

/** Initialization for first install — detect device language before showing UI. */
export const detectDeviceLanguage = (): SupportedLanguage => getDeviceLanguage();

/**
 * Sync the user's backend `preferredLanguage` into the app when no explicit
 * local choice exists yet (fresh install / logged-out device). Best effort.
 */
export const syncUserLanguage = async (preferredLanguage?: string): Promise<void> => {
  if (!preferredLanguage) return;
  const saved = await storeGet(LANGUAGE_STORAGE_KEY);
  if (saved) return; // user has an explicit local choice — keep it
  const language = normalizeLanguage(preferredLanguage);
  if (language !== getDeviceLanguage()) {
    await storeSet(LANGUAGE_STORAGE_KEY, language);
    await storeSet(FOLLOW_DEVICE_KEY, 'false');
    await i18n.changeLanguage(language);
  }
};
