import React from 'react';
import { ccc } from '@ckb-ccc/connector-react';
import { useIdentity } from '../hooks/useIdentity';
import { useReputation } from '../hooks/useReputation';

export interface VeilRegisterProps {
  /** Called when registration completes successfully */
  onRegistered?: (veilId: string) => void;
  /** Called when reputation proof is generated */
  onProven?: (band: string) => void;
  className?: string;
}

/**
 * Drop-in registration and reputation prove widget.
 * Handles the full user onboarding flow:
 *   1. Wallet connection (via CCC — any wallet type)
 *   2. Identity derivation (instant, no tx)
 *   3. Registration (one wallet signature)
 *   4. Reputation proof generation
 *
 * @example
 * <VeilRegister
 *   onRegistered={(veilId) => console.log('Registered:', veilId)}
 *   onProven={(band) => unlockFeatures(band)}
 * />
 */
export function VeilRegister({ onRegistered, onProven, className }: VeilRegisterProps) {
  const { open: openWalletModal } = ccc.useCcc();
  const signer = ccc.useSigner();
  const { identity, status: idStatus, register } = useIdentity();
  const { proof, status: proofStatus, progress, proveReputation } = useReputation();

  const handleRegister = async () => {
    const result = await register();
    if (result) onRegistered?.(result.veilId);
  };

  const handleProve = async () => {
    const result = await proveReputation();
    if (result) onProven?.(result.band);
  };

  if (!signer) {
    return (
      <div className={className}>
        <button onClick={() => openWalletModal()}>Connect Wallet</button>
        <p>Connect MetaMask, JoyID, OKX, or any supported wallet. No new wallet needed.</p>
      </div>
    );
  }

  if (idStatus === 'deriving' || idStatus === 'idle') {
    return (
      <div className={className}>
        <p>Deriving identity…</p>
      </div>
    );
  }

  if (idStatus === 'unregistered') {
    return (
      <div className={className}>
        <p>Your Veil ID: <code>{identity?.veilId.slice(0, 16)}…</code></p>
        <button onClick={handleRegister}>Register Identity</button>
        <p>One wallet signature. No gas from you. Takes a few seconds.</p>
      </div>
    );
  }

  if (idStatus === 'registering') {
    return (
      <div className={className}>
        <p>Registering…</p>
      </div>
    );
  }

  if (idStatus === 'registered' && !proof) {
    const isProving = proofStatus !== 'idle' && proofStatus !== 'error' && proofStatus !== 'done';
    return (
      <div className={className}>
        <p>✓ Identity registered</p>
        <button onClick={handleProve} disabled={isProving}>
          {isProving ? progress : 'Prove Reputation'}
        </button>
        <p>
          Veil reads your on-chain history privately and generates a ZK proof.
          Nothing is revealed — only your reputation band.
        </p>
      </div>
    );
  }

  if (proof) {
    return (
      <div className={className}>
        <p>✓ Registered</p>
        <p>✓ Reputation proven — <strong>{proof.band}</strong> band</p>
        <p>Your Veil ID: <code>{identity?.veilId}</code></p>
        <p>Share your Veil ID with any protocol to prove your reputation.</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <p>{idStatus === 'error' ? 'Something went wrong. Please try again.' : 'Loading…'}</p>
    </div>
  );
}
