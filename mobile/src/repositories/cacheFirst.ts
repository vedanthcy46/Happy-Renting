import { queryClient } from '../queryClient';

export interface CacheFirstOptions<T> {
  queryKey: unknown[];
  read: () => Promise<T | null>;
  write: (data: T) => Promise<void>;
  fetch: () => Promise<T>;
  onBackgroundFresh?: (data: T) => void;
}

function refreshInBackground<T>(opts: CacheFirstOptions<T>): void {
  opts
    .fetch()
    .then(async (fresh) => {
      await opts.write(fresh);
      queryClient.setQueryData(opts.queryKey, fresh);
      opts.onBackgroundFresh?.(fresh);
    })
    .catch((error) => {
      if (__DEV__) console.warn(`[Cache] Background refresh failed for ${String(opts.queryKey[0])}`, error?.message);
    });
}

/**
 * Cache-first query function for react-query.
 *
 * - If the query already exists in memory (react-query cache restored from the
 *   persisted blob), a normal fresh fetch is performed and written through to
 *   SQLite so in-memory optimistic updates are never clobbered.
 * - If nothing is in memory but SQLite has cached rows, it returns those
 *   instantly (fast cold-start / offline) and refreshes in the background.
 * - Otherwise it fetches from the API and writes the result through to SQLite.
 */
export function cacheFirst<T>(opts: CacheFirstOptions<T>): () => Promise<T> {
  return async () => {
    const hasMemory = queryClient.getQueryData<T>(opts.queryKey) !== undefined;
    if (!hasMemory) {
      const cached = await opts.read();
      if (cached !== null) {
        refreshInBackground(opts);
        return cached;
      }
    }
    try {
      const fresh = await opts.fetch();
      await opts.write(fresh);
      return fresh;
    } catch (error) {
      // Offline / network failure: never clobber in-memory data, and fall back
      // to the SQLite cache when nothing is in memory yet.
      if (hasMemory) {
        const inMemory = queryClient.getQueryData<T>(opts.queryKey);
        if (inMemory !== undefined) return inMemory;
      }
      const cached = await opts.read();
      if (cached !== null) return cached;
      throw error;
    }
  };
}
