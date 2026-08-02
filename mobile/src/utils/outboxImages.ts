import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const OUTBOX_DIR = 'outbox/';

function normalizeFilename(uri: string, fallback: string): string {
  const name = uri.split('/').pop();
  if (name && name.length < 100) return name;
  return fallback;
}

/**
 * Copy an image into the app's document directory so it survives app
 * restarts / OS cache eviction while waiting in the offline queue.
 */
export async function persistImageForOutbox(uri: string, fallbackName = 'image.jpg'): Promise<string> {
  try {
    if (Platform.OS === 'web' || !uri) return uri;
    const dir = FileSystem.documentDirectory + OUTBOX_DIR;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    const filename = `${Date.now()}-${normalizeFilename(uri, fallbackName)}`;
    const dest = dir + filename;
    await FileSystem.copyAsync({ from: uri, to: dest });
    if (__DEV__) console.log('[Outbox] Image persisted for offline upload', dest);
    return dest;
  } catch (error) {
    if (__DEV__) console.warn('[Outbox] Failed to persist image', error);
    return uri;
  }
}

export async function removeOutboxImage(uri: string | undefined): Promise<void> {
  if (!uri || Platform.OS === 'web' || !uri.startsWith('file://')) return;
  try {
    const dir = FileSystem.documentDirectory + OUTBOX_DIR;
    if (!uri.startsWith(dir)) return;
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  } catch {
    // best-effort cleanup
  }
}
