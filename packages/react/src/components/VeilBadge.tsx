import React from 'react';
import type { ScoreBand } from '@veil-reputation-protocol/sdk';
import { useReputationCheck } from '../hooks/useReputationCheck';

const BAND_LABELS: Record<ScoreBand, string> = {
  unranked: 'Unranked',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

const BAND_COLORS: Record<ScoreBand, string> = {
  unranked: '#6b7280',
  bronze: '#b45309',
  silver: '#9ca3af',
  gold: '#d97706',
  platinum: '#7c3aed',
};

export interface VeilBadgeProps {
  veilId: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

/**
 * Displays a user's current reputation band inline.
 * Can be embedded in any dApp UI next to user profiles or vote counts.
 *
 * @example
 * <VeilBadge veilId={user.veilId} size="lg" />
 */
export function VeilBadge({ veilId, size = 'md', showLabel = true, className }: VeilBadgeProps) {
  const { decision, loading } = useReputationCheck({
    veilId,
    minimumBand: 'unranked',
    purpose: 'general',
  });

  if (loading) return <span style={{ opacity: 0.4 }}>—</span>;
  if (!decision) return null;

  const color = BAND_COLORS[decision.band];
  const label = BAND_LABELS[decision.band];
  const fontSize = size === 'sm' ? '12px' : size === 'lg' ? '16px' : '14px';

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color, fontWeight: 600, fontSize }}
    >
      <span>●</span>
      {showLabel && <span>{label}</span>}
    </span>
  );
}
