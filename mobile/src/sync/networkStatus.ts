import NetInfo from '@react-native-community/netinfo';

let online = true;
let initialized = false;
const listeners = new Set<(online: boolean) => void>();

export function isOnline(): boolean {
  return online;
}

function setOnline(next: boolean) {
  if (online === next) return;
  online = next;
  if (__DEV__) console.log('[Sync] Network status changed', { online });
  listeners.forEach((listener) => listener(online));
}

export function subscribeToOnline(listener: (online: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function initNetworkMonitor(): void {
  if (initialized) return;
  initialized = true;

  NetInfo.addEventListener((state) => {
    const next = state.isConnected === true && state.isInternetReachable !== false;
    setOnline(next);
  });

  NetInfo.fetch().then((state) => {
    setOnline(state.isConnected === true && state.isInternetReachable !== false);
  }).catch(() => {
    // keep default online value
  });
}
