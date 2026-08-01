import * as StoreReview from 'expo-store-review';
import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

export const PLAY_STORE_PACKAGE = 'co.in.happyrenting.tenant';

export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE}`;

const LAST_PROMPT_KEY = 'rate_app_last_prompted';
const PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export async function rateApp() {
  const storeUrl = `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE}`;
  const marketUrl = `market://details?id=${PLAY_STORE_PACKAGE}`;
  try {
    await Linking.openURL(marketUrl);
  } catch {
    try {
      await Linking.openURL(storeUrl);
    } catch {}
  }
}

async function requestInAppReview() {
  try {
    if (await StoreReview.isAvailableAsync()) {
      const hasAction = await StoreReview.hasAction();
      if (hasAction) {
        await StoreReview.requestReview();
        return true;
      }
    }
  } catch {}
  return false;
}

export async function maybeRequestRating() {
  try {
    const lastPrompted = await SecureStore.getItemAsync(LAST_PROMPT_KEY);
    if (lastPrompted && Date.now() - Number(lastPrompted) < PROMPT_COOLDOWN_MS) {
      return;
    }
    await SecureStore.setItemAsync(LAST_PROMPT_KEY, String(Date.now()));
  } catch {
    return;
  }
  const reviewed = await requestInAppReview();
  if (!reviewed) {
    await rateApp();
  }
}

export const APP_VERSION = Constants.expoConfig?.version || '1.0.0';
export const APP_BUILD_NUMBER = String(
  Platform.OS === 'android'
    ? Constants.expoConfig?.android?.versionCode ?? '1'
    : Constants.expoConfig?.ios?.buildNumber ?? '1'
);
