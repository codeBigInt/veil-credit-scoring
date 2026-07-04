import type { ReputationProof, ReputationWitness, VeilIdentity, VeilMidnightProvider } from '../types';
import { BAND_ORDER } from '../types';
import type { ScoreBand } from '../types';
import type { VeilConfig } from '../config';
import { toBytes32, bytesToHex } from '../utils/bytes';
import { randomBytes32 } from '../utils/hash';
import {
  DEFAULT_SCORE_CONFIG,
  deriveReputationProofHash,
  deriveReputationWitnessCommitmentFromSignals,
  deriveScoreConfigHashFor,
  submitReputationProof,
} from '../contract';
import { extractTxId } from '../utils/tx';

/**
 * Derives the expected score band from the collected witness signals.
 * Uses DEFAULT_SCORE_CONFIG locally — the same weights the deployed contract uses.
 * The contract's Utils_assertBandMatchesScore will reject the tx if the claimed
 * band doesn't match the score it independently computes from the same inputs.
 */
const computeBandFromWitness = (w: ReputationWitness): ScoreBand => {
  const cfg = DEFAULT_SCORE_CONFIG;
  const score =
    Number(cfg.baseScore) +
    w.walletAgeInDays * Number(cfg.walletAgeWeight) +
    w.distinctProtocols * Number(cfg.protocolWeight) +
    w.daoVoteCount * Number(cfg.daoWeight) +
    w.lpTenureInDays * Number(cfg.lpWeight) +
    w.crossChainCount * Number(cfg.crossChainWeight) +
    w.txConsistencyScore * Number(cfg.consistencyWeight);

  if (score >= Number(cfg.platinumThreshold)) return 'platinum';
  if (score >= Number(cfg.goldThreshold)) return 'gold';
  if (score >= Number(cfg.silverThreshold)) return 'silver';
  if (score >= Number(cfg.bronzeThreshold)) return 'bronze';
  return 'unranked';
};

/**
 * Generates a ZK reputation proof and submits it to the Midnight contract.
 *
 * The complete flow — all local to the user's environment:
 *
 *  1. Compute band locally by scoring the witness signals
 *  2. Generate a fresh proofNonce (prevents replay)
 *  3. Call Reputation_prove — from here the Midnight JS layer takes over:
 *       • nite-api calls witness.ts functions to read VeilPrivateState (stays local, leveldb)
 *       • nite-api sends the execution trace to the proof server (localhost:6300 Docker container)
 *       • proof server generates ZK proof using the contract's prover key
 *       • nite-api submits proof + public inputs as a Midnight transaction
 *
 * No raw signal values, no VeilPrivateState, and no witness outputs leave the user's
 * local environment. Only the ZK proof and public inputs reach the Midnight network.
 */
export const proveReputation = async (
  identity: VeilIdentity,
  reputationWitness: ReputationWitness,
  _config: VeilConfig,
  midnightProvider: VeilMidnightProvider,
): Promise<ReputationProof> => {
  const veilIdHash = toBytes32(identity.veilId, 'identity.veilId');

  const band = computeBandFromWitness(reputationWitness);
  const claimedBand = BigInt(BAND_ORDER[band]);

  // The contract derives and stores the witness commitment internally. The SDK
  // keeps a local copy only for integrator logs and developer diagnostics.
  const localWitnessCommitment = deriveReputationWitnessCommitmentFromSignals(veilIdHash, {
    walletAgeInDays: BigInt(reputationWitness.walletAgeInDays),
    distinctProtocols: BigInt(reputationWitness.distinctProtocols),
    daoVoteCount: BigInt(reputationWitness.daoVoteCount),
    lpTenureInDays: BigInt(reputationWitness.lpTenureInDays),
    crossChainCount: BigInt(reputationWitness.crossChainCount),
    txConsistencyScore: BigInt(reputationWitness.txConsistencyScore),
    ethChainCommitment: reputationWitness.ethChainCommitment,
    ckbChainCommitment: reputationWitness.ckbChainCommitment,
    witnessSalt: reputationWitness.salt,
  });

  const proofNonce = randomBytes32();
  const scoreConfigHash = deriveScoreConfigHashFor(DEFAULT_SCORE_CONFIG, _config.contractAddress);
  const proofHash = deriveReputationProofHash({
    veilIdHash,
    witnessCommitment: localWitnessCommitment,
    claimedBand,
    proofNonce,
    scoreConfigHash,
  });

  // ZK proof generation and tx submission happen entirely inside this callTx call.
  // The SDK never interacts with the proof server directly.
  const tx = await submitReputationProof(midnightProvider, {
    veilIdHash,
    walletAgeInDays: BigInt(reputationWitness.walletAgeInDays),
    distinctProtocols: BigInt(reputationWitness.distinctProtocols),
    daoVoteCount: BigInt(reputationWitness.daoVoteCount),
    lpTenureInDays: BigInt(reputationWitness.lpTenureInDays),
    crossChainCount: BigInt(reputationWitness.crossChainCount),
    txConsistencyScore: BigInt(reputationWitness.txConsistencyScore),
    claimedBand,
    ethChainCommitment: reputationWitness.ethChainCommitment,
    ckbChainCommitment: reputationWitness.ckbChainCommitment,
    witnessSalt: reputationWitness.salt,
    proofNonce,
    currentEpoch: BigInt(Date.now()),
  });

  return {
    proofHash: bytesToHex(proofHash),
    txHash: extractTxId(tx) ?? '',
    band,
    validAt: 0,
  };
};
