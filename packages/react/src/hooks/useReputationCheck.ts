import { useState, useEffect } from 'react';
import type { ReputationDecision, ReputationPurpose, ScoreBand } from '@veil-protocol/sdk';
import { useVeilContext } from '../context/VeilProvider';

export interface UseReputationCheckOptions {
  veilId: string | null | undefined;
  minimumBand: ScoreBand;
  purpose: ReputationPurpose;
}

export interface UseReputationCheckReturn {
  decision: ReputationDecision | null;
  loading: boolean;
  error: string | null;
}

/**
 * Checks a veilId's reputation in a protocol's UI.
 * Direct Midnight read — no Veil backend, no wallet needed.
 *
 * Re-runs automatically when veilId, minimumBand, or purpose changes.
 *
 * @example
 * function BorrowButton({ veilId }: { veilId: string }) {
 *   const { decision, loading } = useReputationCheck({
 *     veilId,
 *     minimumBand: "silver",
 *     purpose: "governance",
 *   })
 *   if (loading) return <Spinner />
 *   if (!decision?.meetsThreshold) return <p>Silver reputation required</p>
 *   return <button>Vote with {decision.communityWeight}x weight</button>
 * }
 */
export function useReputationCheck(options: UseReputationCheckOptions): UseReputationCheckReturn {
  const { client } = useVeilContext();
  const [decision, setDecision] = useState<ReputationDecision | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !options.veilId) {
      setDecision(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    client
      .checkReputation(options.veilId, {
        minimumBand: options.minimumBand,
        purpose: options.purpose,
      })
      .then((d) => {
        if (cancelled) return;
        setDecision(d);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to check reputation');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, options.veilId, options.minimumBand, options.purpose]);

  return { decision, loading, error };
}
