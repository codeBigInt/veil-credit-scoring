import { createHash } from 'node:crypto';
import type { Collection, Db } from 'mongodb';
import type { ContractAddress, SigningKey } from '@midnight-ntwrk/compact-runtime';
import type {
  ExportPrivateStatesOptions,
  ExportSigningKeysOptions,
  ImportPrivateStatesOptions,
  ImportPrivateStatesResult,
  ImportSigningKeysOptions,
  ImportSigningKeysResult,
  PrivateStateExport,
  PrivateStateId,
  PrivateStateProvider,
  SigningKeyExport,
} from '@midnight-ntwrk/midnight-js-types';
import * as superjson from 'superjson';

type StoredValue = {
  readonly scope: string;
  readonly key: string;
  readonly payload: string;
  readonly updatedAt: Date;
};

export type MongoPrivateStateProviderConfig = {
  readonly db: Db;
  readonly accountId: string;
  readonly privateStateCollectionName?: string;
  readonly signingKeyCollectionName?: string;
};

const hashAccountId = (accountId: string): string =>
  createHash('sha256').update(accountId).digest('hex').slice(0, 32);

export class MongoPrivateStateProvider<PSI extends PrivateStateId, PS = unknown>
  implements PrivateStateProvider<PSI, PS>
{
  private readonly accountScope: string;
  private readonly privateStates: Collection<StoredValue>;
  private readonly signingKeys: Collection<StoredValue>;
  private contractAddress: ContractAddress | null = null;

  constructor(config: MongoPrivateStateProviderConfig) {
    this.accountScope = hashAccountId(config.accountId);
    this.privateStates = config.db.collection<StoredValue>(config.privateStateCollectionName ?? 'private_states');
    this.signingKeys = config.db.collection<StoredValue>(config.signingKeyCollectionName ?? 'signing_keys');
  }

  async init(): Promise<void> {
    await Promise.all([
      this.privateStates.createIndex({ scope: 1, key: 1 }, { unique: true }),
      this.signingKeys.createIndex({ scope: 1, key: 1 }, { unique: true }),
    ]);
  }

  setContractAddress(address: ContractAddress): void {
    this.contractAddress = address;
  }

  async set(privateStateId: PSI, state: PS): Promise<void> {
    await this.upsert(this.privateStates, this.privateStateKey(privateStateId), state);
  }

  async get(privateStateId: PSI): Promise<PS | null> {
    return this.getValue<PS>(this.privateStates, this.privateStateKey(privateStateId));
  }

  async remove(privateStateId: PSI): Promise<void> {
    await this.privateStates.deleteOne({ scope: this.accountScope, key: this.privateStateKey(privateStateId) });
  }

  async clear(): Promise<void> {
    const address = this.requireContractAddress();
    await this.privateStates.deleteMany({ scope: this.accountScope, key: { $regex: `^${address}:` } });
  }

  async setSigningKey(address: ContractAddress, signingKey: SigningKey): Promise<void> {
    await this.upsert(this.signingKeys, address, signingKey);
  }

  async getSigningKey(address: ContractAddress): Promise<SigningKey | null> {
    return this.getValue<SigningKey>(this.signingKeys, address);
  }

  async removeSigningKey(address: ContractAddress): Promise<void> {
    await this.signingKeys.deleteOne({ scope: this.accountScope, key: address });
  }

  async clearSigningKeys(): Promise<void> {
    await this.signingKeys.deleteMany({ scope: this.accountScope });
  }

  exportPrivateStates(_options?: ExportPrivateStatesOptions): Promise<PrivateStateExport> {
    throw new Error('MongoPrivateStateProvider does not implement private-state export yet.');
  }

  importPrivateStates(
    _exportData: PrivateStateExport,
    _options?: ImportPrivateStatesOptions,
  ): Promise<ImportPrivateStatesResult> {
    throw new Error('MongoPrivateStateProvider does not implement private-state import yet.');
  }

  exportSigningKeys(_options?: ExportSigningKeysOptions): Promise<SigningKeyExport> {
    throw new Error('MongoPrivateStateProvider does not implement signing-key export yet.');
  }

  importSigningKeys(
    _exportData: SigningKeyExport,
    _options?: ImportSigningKeysOptions,
  ): Promise<ImportSigningKeysResult> {
    throw new Error('MongoPrivateStateProvider does not implement signing-key import yet.');
  }

  private async upsert<T>(collection: Collection<StoredValue>, key: string, value: T): Promise<void> {
    await collection.updateOne(
      { scope: this.accountScope, key },
      {
        $set: {
          scope: this.accountScope,
          key,
          payload: superjson.stringify(value),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
  }

  private async getValue<T>(collection: Collection<StoredValue>, key: string): Promise<T | null> {
    const row = await collection.findOne({ scope: this.accountScope, key });
    return row ? (superjson.parse(row.payload) as T) : null;
  }

  private privateStateKey(privateStateId: PSI): string {
    return `${this.requireContractAddress()}:${privateStateId}`;
  }

  private requireContractAddress(): ContractAddress {
    if (this.contractAddress == null) {
      throw new Error('Contract address not set. Call setContractAddress() before accessing private state.');
    }
    return this.contractAddress;
  }
}
