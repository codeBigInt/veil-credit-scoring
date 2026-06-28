import type { CCCSigner, RegistrationResult, VeilIdentity, VeilMidnightProvider } from '../types';
import type { VeilConfig } from '../config';
import { toBytes32, bytesToHex } from '../utils/bytes';
import { sha256Bytes32 } from '../utils/hash';
import { deriveIdentityProofHash, submitIdentityRegistration } from '../contract';
import { padStringToBytes32 } from '../utils/bytes';

export const buildRegistrationMessage = (veilId: string, network: VeilConfig['network']): string =>
  [
    'Veil Protocol v2 - Identity Registration',
    `veilId: ${veilId}`,
    `network: ${network}`,
    'By signing this message you register your wallet as a Veil identity.',
    'This does not grant anyone access to your funds or wallet history.',
  ].join('\n');

const signatureToString = (signature: string | { signature: string }): string =>
  typeof signature === 'string' ? signature : signature.signature;

/**
 * Registers the user's identity on the Midnight Veil contract.
 * Idempotent — safe to call if already registered.
 *
 * 1. Signs a registration message to prove wallet ownership
 * 2. Submits Identity_register circuit call to Midnight
 *
 * DUST sponsorship happens at the Midnight provider layer because the backend
 * requires the user's DUST address, not the Veil ID.
 */
export const registerIdentity = async (
  identity: VeilIdentity,
  signer: CCCSigner,
  config: VeilConfig,
  midnightProvider: VeilMidnightProvider,
): Promise<RegistrationResult> => {
  const message = buildRegistrationMessage(identity.veilId, config.network);
  const signature = signatureToString(await signer.signMessage(message));
  const walletSignatureHash = await sha256Bytes32(signature);

  const veilIdHash = toBytes32(identity.veilId, 'identity.veilId');
  const chainNamespace = padStringToBytes32(identity.sourceChain);
  const publicKeyOrLockHashCommitment = toBytes32(identity.ckbLockHash, 'identity.ckbLockHash');

  const chainProofHash = await deriveIdentityProofHash(midnightProvider, {
    veilIdHash,
    chainNamespace,
    publicKeyOrLockHashCommitment,
    walletSignatureHash,
  });

  const tx = await submitIdentityRegistration(midnightProvider, {
    veilIdHash,
    chainNamespace,
    publicKeyOrLockHashCommitment,
    walletSignatureHash,
    chainProofHash,
    currentEpoch: BigInt(Date.now()),
  });

  const txHash =
    (tx as { txHash?: string })?.txHash ??
    (tx as { hash?: string })?.hash ??
    bytesToHex(chainProofHash);

  return {
    veilId: identity.veilId,
    txHash,
    sponsored: false,
  };
};
