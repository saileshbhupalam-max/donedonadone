import { useState, useEffect, useCallback, useRef } from "react";
import { saveToCache, getFromCache } from "@/lib/offlineCache";

interface UseOfflineQueryOptions {
  /** Time-to-live for the cached data in ms (default 24 h). */
  ttl?: number;
  /** Set to false to skip the fetch entirely. */
  enabled?: boolean;
}

interface UseOfflineQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  /** True when the returned data came from IndexedDB rather than the network. */
  isOffline: boolean;
  /** Manually re-fetch from the network. */
  refetch: () => Promise<void>;
}

/**
 * Lightweight hook that wraps an async fetch function with an IndexedDB
 * offline fallback.  On success the result is persisted; on network failure
 * the most recent cached value is returned instead.
 *
 * @param cacheKey   Unique key used for the IndexedDB entry.
 * @param fetchFn    Async function that returns the data.
 * @param options    ttl / enabled toggles.
 */
export function useOfflineQuery<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options?: UseOfflineQueryOptions,
): UseOfflineQueryResult<T> {
  const { ttl, enabled = true } = options ?? {};
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // Keep fetchFn stable across renders via ref
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  const execute = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setIsOffline(false);

    try {
      const result = await fetchRef.current();
      setData(result);
      // Persist to IDB in background — don't block the UI
      saveToCache(cacheKey, result, ttl).catch(() => {});
    } catch (err) {
      const fetchError =
        err instanceof Error ? err : new Error(String(err));
      setError(fetchError);

      // Network failure — try the cache
      const cached = await getFromCache<T>(cacheKey);
      if (cached !== null) {
        setData(cached);
        setIsOffline(true);
      }
    } finally {
      setLoading(false);
    }
  }, [cacheKey, ttl, enabled]);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, isOffline, refetch: execute };
}
