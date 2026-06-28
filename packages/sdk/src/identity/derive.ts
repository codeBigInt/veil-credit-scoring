import { CompactTypeBytes, CompactTypeVector, persistentHash, toHex } from '@midnight-ntwrk/compact-runtime';
import type { CCCSigner, SourceChain, VeilIdentity, BytesLike } from '../types';
import { VeilError } from '../types';
import { toBytes32 } from '../utils/bytes';

const VEIL_ID_DOMAIN = 'veil-v2';
const bytes32Descriptor = new CompactTypeBytes(32);
const veilIdDescriptor = new CompactTypeVector(2, bytes32Descriptor);
const veilIdDomain = new Uint8Array(32);
new TextEncoder().encodeInto(VEIL_ID_DOMAIN, veilIdDomain);

/**
 * Derives the stable veilId from a CKB lock hash.
 * The CKB lock hash is the anchor — all wallets resolve to one via CCC.
 *
 * MetaMask:  ETH key → CKB secp256k1 lock → lock hash → veilId
 * JoyID:     Passkey → CKB secp256r1 lock → lock hash → veilId
 * UniSat:    BTC key → CKB btc lock       → lock hash → veilId
 */
export const deriveVeilId = (ckbLockHash: BytesLike): string => {
  const lock = toBytes32(ckbLockHash, 'ckbLockHash');
  return toHex(persistentHash(veilIdDescriptor, [veilIdDomain, lock]));
};

export const detectSourceChain = (signer: unknown): SourceChain => {
  const signerType = (signer as { constructor?: { name?: string } })?.constructor?.name?.toLowerCase() ?? '';
  if (signerType.includes('evm') || signerType.includes('metamask')) return 'evm';
  if (signerType.includes('joyid') || signerType.includes('passkey')) return 'passkey';
  if (signerType.includes('unisat') || signerType.includes('btc')) return 'btc';
  if (signerType.includes('solana') || signerType.includes('phantom')) return 'solana';
  return 'ckb';
};

/**
 * Builds a VeilIdentity from any CCC-compatible signer.
 * Requires a deriveLockHashFromAddress adapter since CCC address parsing
 * depends on @ckb-ccc/core which is kept outside the core SDK.
 */
export const buildIdentityFromSigner = async (
  signer: CCCSigner,
  options: { deriveLockHashFromAddress?: (ckbAddress: string) => BytesLike } = {},
): Promise<VeilIdentity> => {
  const ckbAddress = await signer.getRecommendedAddress();
  if (!options.deriveLockHashFromAddress) {
    throw new VeilError(
      'buildIdentityFromSigner requires a deriveLockHashFromAddress adapter.',
      'INVALID_CONFIG',
    );
  }
  const ckbLockHashBytes = toBytes32(options.deriveLockHashFromAddress(ckbAddress), 'ckbLockHash');
  return {
    veilId: deriveVeilId(ckbLockHashBytes),
    ckbLockHash: toHex(ckbLockHashBytes),
    ckbAddress,
    sourceChain: detectSourceChain(signer),
  };
};
