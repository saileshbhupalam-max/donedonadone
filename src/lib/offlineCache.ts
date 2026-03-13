const DB_NAME = "focusclub-cache";
const STORE_NAME = "api-cache";
const DB_VERSION = 1;
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  key: string;
  data: unknown;
  timestamp: number;
  ttl: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save data to the IndexedDB offline cache.
 * @param key   Cache key (e.g. "events", "profile:abc")
 * @param data  Any JSON-serialisable value
 * @param ttl   Time-to-live in ms (default 24 h)
 */
export async function saveToCache(
  key: string,
  data: unknown,
  ttl: number = DEFAULT_TTL,
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const entry: CacheEntry = { key, data, timestamp: Date.now(), ttl };
    store.put(entry);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // IndexedDB may be unavailable (private browsing, etc.) — fail silently
  }
}

/**
 * Retrieve cached data if it exists and has not expired.
 * Returns `null` when the cache misses or the entry is stale.
 */
export async function getFromCache<T = unknown>(
  key: string,
): Promise<T | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const result = await new Promise<CacheEntry | undefined>(
      (resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result as CacheEntry | undefined);
        req.onerror = () => reject(req.error);
      },
    );
    db.close();

    if (!result) return null;

    const expired = Date.now() - result.timestamp > result.ttl;
    if (expired) return null;

    return result.data as T;
  } catch {
    return null;
  }
}

/** Clear all entries from the offline cache. */
export async function clearCache(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // fail silently
  }
}
