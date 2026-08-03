import { BAND_ORDER, type ScoreBand } from '../types';

export const normalizeBand = (band: unknown): ScoreBand => {
  if (typeof band === 'string' && band in BAND_ORDER) return band as ScoreBand;
  const numeric = typeof band === 'bigint' ? Number(band) : typeof band === 'number' ? band : 0;
  return (['unranked', 'bronze', 'silver', 'gold', 'platinum'] as const)[numeric] ?? 'unranked';
};

export const deriveCommunityWeight = (band: ScoreBand): number => {
  const weights: Record<ScoreBand, number> = {
    unranked: 1,
    bronze: 1,
    silver: 1.25,
    gold: 1.5,
    platinum: 2,
  };
  return weights[band];
};
