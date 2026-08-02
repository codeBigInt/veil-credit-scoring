import { toHex } from '@midnight-ntwrk/compact-runtime';
import type { CCCSigner, SourceChain, VeilIdentity, BytesLike } from '../types';
import { VeilError } from '../types';
import { deriveVeilIdHash } from '../contract';
import { padStringToBytes32, toBytes32 } from '../utils/bytes';

export const DEFAULT_VEIL_ID_SALT = padStringToBytes32('veil:v2:identity');

export type DeriveVeilIdOptions = {
  chainNamespace?: BytesLike;
  salt?: BytesLike;
  contractAddress: BytesLike;
};

/**
 * Derives the stable Veil ID from a wallet/lock hash using the same pure
 * Compact circuit used by the contract package.
 *
 * The ID is namespaced by source chain, salt, and deployed Veil contract.
 */
export const deriveVeilId = (rawPublicKeyOrLockHash: BytesLike, options: DeriveVeilIdOptions): string => {
  if (!options.contractAddress) {
    throw new VeilError('deriveVeilId requires a deployed Veil contract address.', 'INVALID_CONFIG');
  }

  return toHex(deriveVeilIdHash({
    rawPublicKeyOrLockHash: toBytes32(rawPublicKeyOrLockHash, 'rawPublicKeyOrLockHash'),
    chainNamespace: options.chainNamespace ?? padStringToBytes32('ckb'),
    salt: options.salt ?? DEFAULT_VEIL_ID_SALT,
    contractAddress: options.contractAddress,
  }));
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
  options: {
    deriveLockHashFromAddress?: (ckbAddress: string) => BytesLike;
    chainNamespace?: BytesLike;
    salt?: BytesLike;
    contractAddress?: BytesLike;
  } = {},
): Promise<VeilIdentity> => {
  const ckbAddress = await signer.getRecommendedAddress();
  if (!options.deriveLockHashFromAddress) {
    throw new VeilError(
      'buildIdentityFromSigner requires a deriveLockHashFromAddress adapter.',
      'INVALID_CONFIG',
    );
  }
  if (!options.contractAddress) {
    throw new VeilError(
      'buildIdentityFromSigner requires the deployed Veil contract address.',
      'INVALID_CONFIG',
    );
  }
  const ckbLockHashBytes = toBytes32(options.deriveLockHashFromAddress(ckbAddress), 'ckbLockHash');
  const sourceChain = detectSourceChain(signer);
  return {
    veilId: deriveVeilId(ckbLockHashBytes, {
      chainNamespace: options.chainNamespace ?? padStringToBytes32(sourceChain),
      salt: options.salt ?? DEFAULT_VEIL_ID_SALT,
      contractAddress: options.contractAddress,
    }),
    ckbLockHash: toHex(ckbLockHashBytes),
    ckbAddress,
    sourceChain,
  };
};
