const IDB_DB_NAME = 'veil-wallet-cache';
const IDB_STORE = 'wallets';
const IDB_VERSION = 1;

export interface WalletStateCache {
  savedAt: string;
  networkId: string;
  shielded: string;
  unshielded: string;
  dust: string;
}

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const idbGet = async (key: string): Promise<unknown> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
};

const idbSet = async (key: string, value: unknown): Promise<void> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
};

export const loadIdbWalletCache = async (cacheKey: string): Promise<WalletStateCache | null> => {
  try {
    const raw = await idbGet(cacheKey) as WalletStateCache | null;
    if (!raw) return null;
    if (
      typeof raw.shielded !== 'string' ||
      typeof raw.unshielded !== 'string' ||
      typeof raw.dust !== 'string' ||
      typeof raw.networkId !== 'string'
    ) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
};

export interface SerializableWallet {
  shielded: { serializeState(): Promise<string> };
  unshielded: { serializeState(): Promise<string> };
  dust: { serializeState(): Promise<string> };
}

export const saveIdbWalletCache = async (
  cacheKey: string,
  wallet: SerializableWallet,
  networkId: string,
): Promise<void> => {
  const [shielded, unshielded, dust] = await Promise.all([
    wallet.shielded.serializeState(),
    wallet.unshielded.serializeState(),
    wallet.dust.serializeState(),
  ]);
  await idbSet(cacheKey, {
    savedAt: new Date().toISOString(),
    networkId,
    shielded,
    unshielded,
    dust,
  } satisfies WalletStateCache);
};
