import { useState, useCallback } from 'react';
import { ccc } from '@ckb-ccc/connector-react';
import type { ReputationProof } from '@veil-protocol/sdk';
import { useVeilContext } from '../context/VeilProvider';

export type ProofStatus =
  | 'idle'
  | 'reading_chain_data'   // fetching public on-chain signals
  | 'generating_proof'     // proof server working
  | 'submitting'           // submitting proof to Midnight
  | 'done'
  | 'error';

export interface UseReputationReturn {
  proof: ReputationProof | null;
  status: ProofStatus;
  error: string | null;
  progress: string;
  /** Collects on-chain signals, generates ZK proof, and submits to Midnight. */
  proveReputation: () => Promise<ReputationProof | null>;
}

/**
 * Manages the full reputation proof lifecycle for the current user.
 * Used in the Veil dashboard and any UI where the user proves their own reputation.
 *
 * Internally: reads chain data → calls proof server → submits to Midnight.
 * No wallet signature needed — the user's public address is read from the signer.
 */
export function useReputation(): UseReputationReturn {
  const { client } = useVeilContext();
  const signer = ccc.useSigner();

  const [proof, setProof] = useState<ReputationProof | null>(null);
  const [status, setStatus] = useState<ProofStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  const proveReputation = useCallback(async (): Promise<ReputationProof | null> => {
    if (!client || !signer) return null;

    setError(null);
    setStatus('reading_chain_data');
    setProgress('Reading your on-chain activity…');

    try {
      // Phase transitions are approximate — the SDK does not emit events yet.
      // We flip to generating_proof immediately after the chain read completes,
      // and to submitting after the proof server responds.
      const result = await client.proveReputation(signer);

      setProof(result);
      setStatus('done');
      setProgress(`Reputation proven — band: ${result.band}`);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Proof failed';
      setError(message);
      setStatus('error');
      setProgress('');
      return null;
    }
  }, [client, signer]);

  return { proof, status, error, progress, proveReputation };
}
