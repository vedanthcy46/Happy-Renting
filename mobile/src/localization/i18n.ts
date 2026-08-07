import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from './translations/en.json';
import kn from './translations/kn.json';
import hi from './translations/hi.json';
import ta from './translations/ta.json';
import te from './translations/te.json';
import ml from './translations/ml.json';

export const SUPPORTED_LANGUAGES = ['en', 'kn', 'hi', 'ta', 'te', 'ml'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  kn: 'ಕನ್ನಡ',
  hi: 'हिन्दी',
  ta: 'தமிழ்',
  te: 'తెలుగు',
  ml: 'മലയാളം',
};

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

/** Map a raw locale string (e.g. 'kn-IN', 'hi', 'kn') to a supported language, falling back to en. */
export const normalizeLanguage = (locale?: string | null): SupportedLanguage => {
  if (!locale) return DEFAULT_LANGUAGE;
  const code = locale.toLowerCase().split('-')[0].split('_')[0];
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code)
    ? (code as SupportedLanguage)
    : DEFAULT_LANGUAGE;
};

/** Get the device's preferred supported language. */
export const getDeviceLanguage = (): SupportedLanguage => {
  try {
    const locales = getLocales();
    const primary = locales && locales.length > 0 ? locales[0].languageCode : null;
    return normalizeLanguage(primary);
  } catch {
    return DEFAULT_LANGUAGE;
  }
};

/** Get the currently active app language. */
export const getCurrentLanguage = (): SupportedLanguage => {
  try {
    return normalizeLanguage(i18n.language);
  } catch {
    return DEFAULT_LANGUAGE;
  }
};

export const resources = {
  en: { translation: en },
  kn: { translation: kn },
  hi: { translation: hi },
  ta: { translation: ta },
  te: { translation: te },
  ml: { translation: ml },
} as const;

export const initI18n = (initialLanguage?: SupportedLanguage) => {
  if (i18n.isInitialized) return i18n;
  return i18n.use(initReactI18next).init({
    resources,
    lng: initialLanguage || getDeviceLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    interpolation: {
      escapeValue: false, // React already escapes by default
    },
    // Keep only the active language loaded in memory (lazy loading by design)
    load: 'languageOnly',
    react: {
      useSuspense: false,
    },
  });
};

/** Format a number in the active locale (Indian digit grouping for kn/hi/ta/te/ml). */
export const formatCurrency = (amount: number | string | null | undefined): string => {
  const value = Number(amount || 0);
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

/** Format a date in the active language. */
export const formatDate = (date: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string => {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  const locale = i18n.language === 'en' ? 'en-IN' : i18n.language;
  return d.toLocaleDateString(locale, options || { day: 'numeric', month: 'short', year: 'numeric' });
};

export default i18n;
