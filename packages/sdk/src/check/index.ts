import type { CheckOptions, ReputationDecision, ScoreBand } from '../types';
import { BAND_ORDER, bandMeetsMinimum } from '../types';
import { toBytes32, bytesToHex } from '../utils/bytes';
import { padStringToBytes32, extractCircuitResult } from '../utils/bytes';
import { submitReputationCheck } from '../contract';
import { normalizeBand, deriveCommunityWeight } from '../reputation/band';

/**
 * Checks whether a veilId meets a reputation threshold.
 * Direct Midnight read — no Veil backend involved.
 *
 * This is the primary function for DeFi protocol backends,
 * DAOs, and airdrop contracts.
 *
 * @example
 * const rep = await checkReputation(user.veilId, {
 *   minimumBand: "silver",
 *   purpose: "governance",
 *   midnightProvider,
 *   config,
 * })
 * if (rep.meetsThreshold) applyVoteWeight(rep.communityWeight)
 */
export const checkReputation = async (
  veilId: string,
  options: CheckOptions,
): Promise<ReputationDecision> => {
  const minimumBandNumber = BigInt(BAND_ORDER[options.minimumBand]);

  const raw = extractCircuitResult<Record<string, unknown>>(
    await submitReputationCheck(options.midnightProvider, {
      veilIdHash: veilId,
      requesterAddressHash: options.requesterAddressHash ?? padStringToBytes32('integrator'),
      purposeHash: padStringToBytes32(options.purpose),
      minimumBand: minimumBandNumber,
      currentEpoch: options.currentEpoch ?? BigInt(Date.now()),
    }),
    'Reputation_check',
  );

  const band = normalizeBand(raw.band);

  return {
    veilId,
    meetsThreshold: Boolean(raw.meetsThreshold ?? bandMeetsMinimum(band, options.minimumBand)),
    band,
    communityWeight:
      typeof raw.communityWeightBps === 'bigint'
        ? Number(raw.communityWeightBps) / 10_000
        : deriveCommunityWeight(band),
    accessTier: typeof raw.accessTier === 'bigint' ? Number(raw.accessTier) : BAND_ORDER[band],
    purpose: options.purpose,
    validAt: typeof raw.validAtEpoch === 'bigint' ? Number(raw.validAtEpoch) : 0,
    proofHash: raw.proofHash instanceof Uint8Array ? bytesToHex(raw.proofHash) : '',
  };
};

/**
 * Batch check for multiple veilIds.
 * Failed individual checks are returned as "unranked" rather than throwing.
 * Use for airdrop filtering where you have a list of candidates.
 */
export const batchCheckReputation = async (
  veilIds: string[],
  options: CheckOptions,
): Promise<Map<string, ReputationDecision>> => {
  const settled = await Promise.allSettled(veilIds.map((veilId) => checkReputation(veilId, options)));
  const decisions = new Map<string, ReputationDecision>();

  settled.forEach((result, index) => {
    const veilId = veilIds[index] ?? '';
    if (result.status === 'fulfilled') {
      decisions.set(veilId, result.value);
    } else {
      decisions.set(veilId, {
        veilId,
        meetsThreshold: false,
        band: 'unranked',
        communityWeight: 1,
        accessTier: 0,
        purpose: options.purpose,
        validAt: 0,
        proofHash: '',
      });
    }
  });

  return decisions;
};
