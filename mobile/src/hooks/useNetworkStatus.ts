import { useState, useEffect } from 'react';
import { isOnline, subscribeToOnline } from '../sync/networkStatus';

/**
 * Hooked view over the shared network-status singleton used by the sync
 * engine. Using one source of truth avoids the banner disagreeing with
 * sync behavior (e.g. showing offline while the engine is online).
 */
export function useNetworkStatus() {
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    const unsubscribe = subscribeToOnline(setOnline);
    return unsubscribe;
  }, []);

  return {
    isConnected: online,
    isInternetReachable: online,
    isOffline: !online,
  };
}
