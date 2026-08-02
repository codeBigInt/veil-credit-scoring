// Browser-compatible PrivateStateProvider backed by IndexedDB.
// Replaces @midnight-ntwrk/midnight-js-level-private-state-provider for browser contexts.
// The structured-clone algorithm that IndexedDB uses natively handles Uint8Array,
// so VeilPrivateState (which contains Uint8Array commitment hashes) is stored as-is.

import type { PrivateStateId } from '@midnight-ntwrk/midnight-js-types';

const PRIVATE_STATES_STORE = 'privateStates';
const SIGNING_KEYS_STORE = 'signingKeys';

const openDb = (dbName: string): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PRIVATE_STATES_STORE)) {
        db.createObjectStore(PRIVATE_STATES_STORE);
      }
      if (!db.objectStoreNames.contains(SIGNING_KEYS_STORE)) {
        db.createObjectStore(SIGNING_KEYS_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const idbGet = async (db: IDBDatabase, store: string, key: string): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });

const idbPut = async (db: IDBDatabase, store: string, key: string, value: unknown): Promise<void> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

const idbDelete = async (db: IDBDatabase, store: string, key: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

const idbClear = async (db: IDBDatabase, store: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

// Intentionally does not statically declare `implements PrivateStateProvider` because the
// interface requires backup/restore methods (exportPrivateStates etc.) that are irrelevant
// for browser-only contexts.  The class is structurally compatible with the core
// get/set/remove/signing-key subset and is cast to PrivateStateProvider at the call site.
export class IdbPrivateStateProvider<PSI extends PrivateStateId, PS> {
  private contractAddress: string | null = null;
  private dbPromise: Promise<IDBDatabase>;

  constructor(dbName: string) {
    this.dbPromise = openDb(dbName);
  }

  setContractAddress(address: string): void {
    this.contractAddress = address;
  }

  private requireAddress(): string {
    if (!this.contractAddress) {
      throw new Error('IdbPrivateStateProvider: setContractAddress must be called before use.');
    }
    return this.contractAddress;
  }

  private psKey(privateStateId: PSI): string {
    return `${this.requireAddress()}/${privateStateId}`;
  }

  async set(privateStateId: PSI, state: PS): Promise<void> {
    const db = await this.dbPromise;
    await idbPut(db, PRIVATE_STATES_STORE, this.psKey(privateStateId), state);
  }

  async get(privateStateId: PSI): Promise<PS | null> {
    const db = await this.dbPromise;
    const value = await idbGet(db, PRIVATE_STATES_STORE, this.psKey(privateStateId));
    return (value as PS | null) ?? null;
  }

  async remove(privateStateId: PSI): Promise<void> {
    const db = await this.dbPromise;
    await idbDelete(db, PRIVATE_STATES_STORE, this.psKey(privateStateId));
  }

  async clear(): Promise<void> {
    const db = await this.dbPromise;
    await idbClear(db, PRIVATE_STATES_STORE);
  }

  async setSigningKey(address: string, signingKey: unknown): Promise<void> {
    const db = await this.dbPromise;
    await idbPut(db, SIGNING_KEYS_STORE, address, signingKey);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getSigningKey(address: string): Promise<any> {
    const db = await this.dbPromise;
    return idbGet(db, SIGNING_KEYS_STORE, address);
  }

  async removeSigningKey(address: string): Promise<void> {
    const db = await this.dbPromise;
    await idbDelete(db, SIGNING_KEYS_STORE, address);
  }

  async clearSigningKeys(): Promise<void> {
    const db = await this.dbPromise;
    await idbClear(db, SIGNING_KEYS_STORE);
  }
}
