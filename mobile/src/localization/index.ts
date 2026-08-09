export {
  default as i18n,
  SUPPORTED_LANGUAGES,
  LANGUAGE_NAMES,
  DEFAULT_LANGUAGE,
  normalizeLanguage,
  getDeviceLanguage,
  getCurrentLanguage,
  formatCurrency,
  formatDate,
  type SupportedLanguage,
} from './i18n';

export {
  initializeLanguage,
  saveLanguagePreference,
  followDeviceLanguage,
  restoreLanguagePreference,
  detectDeviceLanguage,
  LANGUAGE_STORAGE_KEY,
  FOLLOW_DEVICE_KEY,
  type LanguageState,
} from './languageService';

export { LanguageSelector } from './LanguageSelector';
