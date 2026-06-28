import React from 'react';
import type { ReputationPurpose, ScoreBand } from '@veil-protocol/sdk';
import { useReputationCheck } from '../hooks/useReputationCheck';

export interface VeilGateProps {
  veilId: string;
  minimumBand: ScoreBand;
  purpose: ReputationPurpose;
  /** Rendered when the user meets the threshold */
  children: React.ReactNode;
  /** Rendered when the user does not meet the threshold */
  fallback?: React.ReactNode;
  /** Rendered while the check is in flight */
  loading?: React.ReactNode;
}

/**
 * Gates UI behind a Veil reputation threshold.
 * The simplest possible reputation integration for protocols.
 *
 * @example
 * <VeilGate
 *   veilId={user.veilId}
 *   minimumBand="silver"
 *   purpose="governance"
 *   fallback={<p>Silver reputation required to vote</p>}
 * >
 *   <VoteButton weight={decision.communityWeight} />
 * </VeilGate>
 */
export function VeilGate({
  veilId,
  minimumBand,
  purpose,
  children,
  fallback = null,
  loading: loadingNode = null,
}: VeilGateProps) {
  const { decision, loading } = useReputationCheck({ veilId, minimumBand, purpose });

  if (loading) return <>{loadingNode}</>;
  if (!decision?.meetsThreshold) return <>{fallback}</>;
  return <>{children}</>;
}
