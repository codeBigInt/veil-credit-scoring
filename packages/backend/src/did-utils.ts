import { createHash } from 'node:crypto';
import { fromHex } from '@midnight-ntwrk/compact-runtime';

export type VeilDidDocument = {
  readonly '@context': readonly string[];
  readonly id: string;
  readonly controller: string;
  readonly verificationMethod: ReadonlyArray<{
    readonly id: string;
    readonly type: 'CkbSecp256k1VerificationKey2026';
    readonly controller: string;
    readonly blockchainAccountId?: string;
    readonly publicKeyHash: string;
  }>;
  readonly authentication: readonly string[];
  readonly assertionMethod: readonly string[];
  readonly service: ReadonlyArray<{
    readonly id: string;
    readonly type: string;
    readonly serviceEndpoint: string;
  }>;
  readonly veil: {
    readonly veilIdHash: string;
    readonly status: 'active' | 'revoked';
    readonly version: number;
    readonly sporeId: string;
    readonly sporeIdHash: string;
    readonly ckbOwnerLockHash: string;
    readonly midnightRegistry: string;
    readonly createdAt?: string;
  };
};

export const createVeilDid = (veilIdHash: string): string =>
  `did:veil:${normalizeHex32(veilIdHash, 'veilIdHash')}`;

export const parseVeilDid = (did: string): { readonly veilIdHash: string } => {
  const match = did.match(/^did:veil:(0x[0-9a-f]{64})$/);
  if (!match?.[1]) {
    throw new Error('Invalid did:veil identifier');
  }
  return { veilIdHash: match[1] };
};

export const normalizeHex32 = (value: string, name: string): string => {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be a 32-byte 0x-prefixed hex string`);
  }
  return value.toLowerCase();
};

export const bytesFrom0xHex32 = (value: string, name: string): Uint8Array =>
  fromHex(normalizeHex32(value, name).slice(2));

export const hashHex32 = (value: string, name: string): string => {
  const normalized = normalizeHex32(value, name);
  return `0x${createHash('sha256').update(Buffer.from(normalized.slice(2), 'hex')).digest('hex')}`;
};
