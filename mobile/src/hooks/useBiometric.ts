import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export const BIOMETRIC_CREDENTIALS_KEY = 'biometric_credentials';
export const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

export async function authenticateWithBiometric(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to access Happy Renting',
    cancelLabel: 'Use Password',
    disableDeviceFallback: false,
  });
  return result.success;
}

export async function saveBiometricCredentials(email: string, password: string): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_CREDENTIALS_KEY, JSON.stringify({ email, password }));
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
}

export async function getBiometricCredentials(): Promise<{ email: string; password: string } | null> {
  const raw = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function isBiometricEnabled(): Promise<boolean> {
  const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  return enabled === 'true';
}

export async function clearBiometricCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
}
