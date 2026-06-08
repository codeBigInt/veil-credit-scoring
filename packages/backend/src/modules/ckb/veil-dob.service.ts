import { createHash } from 'node:crypto';
import type { Collection, Db } from 'mongodb';
import { ccc } from '@ckb-ccc/core';
import type { Script } from '@ckb-lumos/base';

import { getCkbConfig, type CkbConfig } from './ckb.config.js';
import { SporeService } from './spore.service.js';

export type VeilIdentityContent = {
  readonly protocol: 'Veil';
  readonly objectType: 'VeilIdentity';
  readonly veilIdHash: string;
  readonly ownerCkbLockHash: string;
  readonly midnightNetwork: string;
  readonly midnightContract: string;
  readonly version: '1';
};

export type CreateVeilIdentityDOBMintIntentParams = {
  readonly userCkbAddress: string;
  readonly veilIdHash: string;
  readonly midnightContractAddress: string;
  readonly midnightNetwork: string;
};

export type VeilIdentityDOBMintIntent = {
  readonly contentType: 'application/json';
  readonly content: VeilIdentityContent;
  readonly lockScript: Script;
  readonly cellDeps: readonly unknown[];
};

export type RecordVeilIdentityDOBMintParams = {
  readonly sporeId: string;
  readonly txHash: string;
  readonly veilIdHash: string;
  readonly userCkbAddress: string;
  readonly midnightContractAddress: string;
};

export type VeilIdentityDOBRecord = {
  readonly veilIdHash: string;
  readonly ckbSporeId: string;
  readonly ckbTxHash: string;
  readonly midnightContractAddress: string;
  readonly createdAt: Date;
};

export type ExistingVeilIdentityDOB = {
  readonly veilIdHash: string;
  readonly sporeId: string;
  readonly txHash: string;
  readonly midnightContractAddress: string;
  readonly createdAt: Date;
};

export type MintVeilIdentityDOBResult = {
  readonly sporeId: string;
  readonly txHash: string;
  readonly veilIdHash: string;
  readonly lockScript: Script;
  readonly content: VeilIdentityContent;
};

export type LoadedVeilIdentityDOB = {
  readonly sporeId: string;
  readonly lockScript: Script;
  readonly content: Record<string, unknown>;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class VeilDobService {
  private ckbConfig?: CkbConfig;
  private sporeService?: SporeService;
  private readonly mappings?: Collection<VeilIdentityDOBRecord>;

  constructor(db?: Db) {
    this.mappings = db?.collection<VeilIdentityDOBRecord>('veil_identity_ckb_anchors');
  }

  async createVeilIdentityDOBMintIntent(
    params: CreateVeilIdentityDOBMintIntentParams,
  ): Promise<VeilIdentityDOBMintIntent> {
    const ownerCkbLockHash = await this.ownerLockHash(params.userCkbAddress);
    // Public Spore content is intentionally stable identity-anchor metadata only.
    // Scores, score commitments, behavior data, and raw user identity stay off CKB.
    const content: VeilIdentityContent = {
      protocol: 'Veil',
      objectType: 'VeilIdentity',
      veilIdHash: normalizeHexHash(params.veilIdHash, 'veilIdHash'),
      ownerCkbLockHash,
      midnightNetwork: params.midnightNetwork,
      midnightContract: params.midnightContractAddress,
      version: '1',
    };

    return {
      contentType: 'application/json',
      content,
      lockScript: this.veilIdentityLock(content.veilIdHash, ownerCkbLockHash),
      cellDeps: [this.config().veilSbtLock.cellDep],
    };
  }

  async recordVeilIdentityDOBMint(params: RecordVeilIdentityDOBMintParams): Promise<VeilIdentityDOBRecord> {
    const veilIdHash = normalizeHexHash(params.veilIdHash, 'veilIdHash');
    const existing = await this.getVeilIdentityDOBRecord(veilIdHash);
    if (existing) {
      return {
        veilIdHash: existing.veilIdHash,
        ckbSporeId: existing.sporeId,
        ckbTxHash: existing.txHash,
        midnightContractAddress: existing.midnightContractAddress,
        createdAt: existing.createdAt,
      };
    }

    const dob = await this.getVeilIdentityDOBWithRetry(params.sporeId);
    const ownerCkbLockHash = await this.ownerLockHash(params.userCkbAddress);
    const expectedLock = this.veilIdentityLock(veilIdHash, ownerCkbLockHash);

    if (
      dob.content.protocol !== 'Veil' ||
      dob.content.objectType !== 'VeilIdentity' ||
      dob.content.veilIdHash !== veilIdHash ||
      dob.content.ownerCkbLockHash !== ownerCkbLockHash ||
      !scriptsEqual(dob.lockScript, expectedLock)
    ) {
      throw new Error('Minted Spore does not match the expected Veil Identity DOB mint intent');
    }

    const record = {
      veilIdHash,
      ckbSporeId: dob.sporeId,
      ckbTxHash: normalizeHexHash(params.txHash, 'txHash'),
      midnightContractAddress: params.midnightContractAddress,
      createdAt: new Date(),
    };

    await this.saveMapping(record);
    return record;
  }

  async getVeilIdentityDOBRecord(veilIdHash: string): Promise<ExistingVeilIdentityDOB | null> {
    const normalized = normalizeHexHash(veilIdHash, 'veilIdHash');
    const record = await this.mappings?.findOne({ veilIdHash: normalized });
    if (!record) return null;

    return {
      veilIdHash: record.veilIdHash,
      sporeId: record.ckbSporeId,
      txHash: record.ckbTxHash,
      midnightContractAddress: record.midnightContractAddress,
      createdAt: record.createdAt,
    };
  }

  async mintVeilIdentityDOB(): Promise<never> {
    throw new Error('Backend-funded CKB minting is deprecated. Use mint intent and user CKB wallet signing.');
  }

  async getVeilIdentityDOB(sporeId: string): Promise<LoadedVeilIdentityDOB> {
    const id = normalizeHexHash(sporeId, 'sporeId');
    const cell = await this.spore().getSporeCell(id);
    return {
      sporeId: id,
      lockScript: cell.cellOutput.lock,
      content: this.spore().decodeJsonSporeContent(cell),
    };
  }

  private async getVeilIdentityDOBWithRetry(sporeId: string): Promise<LoadedVeilIdentityDOB> {
    const attempts = 20;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await this.getVeilIdentityDOB(sporeId);
      } catch (error) {
        lastError = error;
        if (attempt === attempts) break;
        await sleep(3_000);
      }
    }

    throw lastError instanceof Error
      ? new Error(`Minted Spore was not visible on CKB after waiting: ${lastError.message}`, { cause: lastError })
      : new Error('Minted Spore was not visible on CKB after waiting');
  }

  async verifyVeilIdentityDOB(
    sporeId: string,
    veilIdHash: string,
  ): Promise<{ valid: boolean; details: Record<string, unknown> }> {
    const expectedVeilIdHash = normalizeHexHash(veilIdHash, 'veilIdHash');
    const dob = await this.getVeilIdentityDOB(sporeId);
    const ownerCkbLockHash = typeof dob.content.ownerCkbLockHash === 'string' ? dob.content.ownerCkbLockHash : '';
    const expectedLock = ownerCkbLockHash ? this.veilIdentityLock(expectedVeilIdHash, ownerCkbLockHash) : undefined;
    const details = {
      protocolMatches: dob.content.protocol === 'Veil',
      objectTypeMatches: dob.content.objectType === 'VeilIdentity',
      veilIdHashMatches: dob.content.veilIdHash === expectedVeilIdHash,
      ownerCkbLockHashPresent: ownerCkbLockHash.length > 0,
      lockScriptMatches: expectedLock ? scriptsEqual(dob.lockScript, expectedLock) : false,
      lockScript: dob.lockScript,
      expectedLockScript: expectedLock,
      content: dob.content,
    };

    return {
      valid: [
        details.protocolMatches,
        details.objectTypeMatches,
        details.veilIdHashMatches,
        details.ownerCkbLockHashPresent,
        details.lockScriptMatches,
      ].every((value) => value === true),
      details,
    };
  }

  hashVeilId(veilId: Uint8Array | string): string {
    const bytes = typeof veilId === 'string' ? Buffer.from(stripHexPrefix(veilId), 'hex') : Buffer.from(veilId);
    return `0x${createHash('sha256').update(bytes).digest('hex')}`;
  }

  defaultMidnightContractAddress(): string {
    return this.config().midnightContractAddress;
  }

  defaultMidnightNetwork(): string {
    return this.config().midnightNetwork;
  }

  async getOwnerCkbLockHash(userCkbAddress: string): Promise<string> {
    return this.ownerLockHash(userCkbAddress);
  }

  cccClient(): ccc.ClientPublicTestnet {
    return this.spore().cccClient();
  }

  private async saveMapping(record: VeilIdentityDOBRecord): Promise<void> {
    if (!this.mappings) return;
    await this.mappings.updateOne(
      { veilIdHash: record.veilIdHash },
      {
        $setOnInsert: {
          veilIdHash: record.veilIdHash,
          createdAt: record.createdAt,
        },
        $set: {
          ckbSporeId: record.ckbSporeId,
          ckbTxHash: record.ckbTxHash,
          midnightContractAddress: record.midnightContractAddress,
        },
      },
      { upsert: true },
    );
  }

  private veilIdentityLock(veilIdHash: string, ownerCkbLockHash: string): Script {
    const config = this.config();
    return {
      codeHash: config.veilSbtLock.codeHash,
      hashType: config.veilSbtLock.hashType,
      // The deployed veil_sbt_lock preserves this exact lock across spends.
      // Including owner lock hash + Veil ID hash makes each DOB lock unique to one user identity anchor.
      args: `${ownerCkbLockHash}${stripHexPrefix(veilIdHash)}`,
    };
  }

  private async ownerLockHash(userCkbAddress: string): Promise<string> {
    const address = await ccc.Address.fromString(userCkbAddress, this.spore().cccClient());
    return address.script.hash().toLowerCase();
  }

  private config(): CkbConfig {
    this.ckbConfig ??= getCkbConfig();
    return this.ckbConfig;
  }

  private spore(): SporeService {
    this.sporeService ??= new SporeService(this.config());
    return this.sporeService;
  }
}

const stripHexPrefix = (value: string): string => value.startsWith('0x') ? value.slice(2) : value;

const normalizeHexHash = (value: string, name: string): string => {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be a 32-byte 0x-prefixed hex string`);
  }
  return value.toLowerCase();
};

const scriptsEqual = (a: Script, b: Script): boolean =>
  a.codeHash.toLowerCase() === b.codeHash.toLowerCase() &&
  a.hashType === b.hashType &&
  a.args.toLowerCase() === b.args.toLowerCase();
