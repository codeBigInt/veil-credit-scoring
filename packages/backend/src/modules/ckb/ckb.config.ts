import path from 'node:path';
import * as dotenv from 'dotenv';
import { predefinedSporeConfigs, type SporeConfig } from '@spore-sdk/core';
import type { CellDep, Script } from '@ckb-lumos/base';

const currentDir = path.resolve(new URL(import.meta.url).pathname, '..');
dotenv.config({ path: path.resolve(currentDir, '..', '..', '..', '.env') });
dotenv.config({ path: path.resolve(currentDir, '..', '..', '..', '..', '..', '.env') });

export type CkbNetwork = 'testnet';

export type CkbConfig = {
  readonly network: CkbNetwork;
  readonly rpcUrl: string;
  readonly veilSbtLock: {
    readonly codeHash: string;
    readonly hashType: Script['hashType'];
    readonly txHash: string;
    readonly index: string;
    readonly cellDep: CellDep;
  };
  readonly midnightNetwork: string;
  readonly midnightContractAddress: string;
  readonly spore: SporeConfig;
};

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
};

const requireHex = (name: string, bytes?: number): string => {
  const value = required(name);
  const expected = bytes == null ? '+' : `{${bytes * 2}}`;
  if (!new RegExp(`^0x[0-9a-fA-F]${expected}$`).test(value)) {
    throw new Error(`Environment variable ${name} must be a 0x-prefixed hex string${bytes ? ` (${bytes} bytes)` : ''}`);
  }
  return value.toLowerCase();
};

const normalizeIndex = (value: string): string => {
  if (/^0x[0-9a-fA-F]+$/.test(value)) return value.toLowerCase();
  if (/^\d+$/.test(value)) return `0x${BigInt(value).toString(16)}`;
  throw new Error('VEIL_SBT_LOCK_INDEX must be a decimal number or 0x-prefixed hex number');
};

const normalizeHashType = (value: string): Script['hashType'] => {
  if (value === 'data' || value === 'data1' || value === 'data2' || value === 'type') return value;
  throw new Error('VEIL_SBT_LOCK_HASH_TYPE must be one of data, data1, data2, type');
};

export const getCkbConfig = (): CkbConfig => {
  const network = required('CKB_NETWORK');
  if (network !== 'testnet') {
    throw new Error('Only CKB_NETWORK=testnet is supported for Veil Identity DOB minting right now');
  }

  const rpcUrl = required('CKB_RPC_URL');
  const index = normalizeIndex(required('VEIL_SBT_LOCK_INDEX'));
  const spore = {
    ...predefinedSporeConfigs.Aggron4,
    ckbNodeUrl: rpcUrl,
    ckbIndexerUrl: process.env.CKB_INDEXER_URL ?? predefinedSporeConfigs.Aggron4.ckbIndexerUrl,
  };

  const lockTxHash = requireHex('VEIL_SBT_LOCK_TX_HASH', 32);
  const veilSbtLock = {
    codeHash: requireHex('VEIL_SBT_LOCK_CODE_HASH', 32),
    hashType: normalizeHashType(required('VEIL_SBT_LOCK_HASH_TYPE')),
    txHash: lockTxHash,
    index,
    cellDep: {
      outPoint: {
        txHash: lockTxHash,
        index,
      },
      depType: 'code' as const,
    },
  };

  return {
    network,
    rpcUrl,
    veilSbtLock,
    midnightNetwork: required('MIDNIGHT_NETWORK'),
    midnightContractAddress: required('MIDNIGHT_CONTRACT_ADDRESS'),
    spore,
  };
};
