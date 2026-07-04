import { utils } from 'nite-api';
import {
  Contract as VeilContractClass,
  pureCircuits,
  witness,
  createVeilPrivateState,
  type CustomStructs_ScoreConfig,
  type VeilPrivateState,
  type Witnesses,
} from '@veil/veil-contract';
import { toBytes32 } from '../utils/bytes';
import { extractCircuitResult } from '../utils/bytes';
import type { BytesLike, VeilCallTx } from '../types';

export type {
  CustomStructs_PendingScoreConfig,
  CustomStructs_ReputationDecision,
  CustomStructs_ReputationProofBinding,
  CustomStructs_ReputationScore,
  CustomStructs_ReputationSignals,
  CustomStructs_ScoreConfig,
  CustomStructs_VeilIdentityRecord,
  CustomStructs_GuardianController,
  Ledger,
} from '@veil/veil-contract';
export type { VeilPrivateState, Witnesses };
export { createVeilPrivateState, pureCircuits, witness };

export type VeilContract = VeilContractClass<VeilPrivateState, Witnesses<VeilPrivateState>>;

export const PRIVATE_STATE_ID = 'veil_ps' as const;
export type PrivateStateId = typeof PRIVATE_STATE_ID;

export const FULL_CONTRACT_CIRCUITS = [
  'Utils_deriveVeilId',
  'Identity_register',
  'Identity_assertActive',
  'Reputation_prove',
  'Reputation_check',
  'Governance_proposeScoreConfig',
  'Governance_applyScoreConfig',
  'Governance_cancelScoreConfig',
] as const;

export type FullContractCircuitId = (typeof FULL_CONTRACT_CIRCUITS)[number];

export const DEFAULT_SCORE_CONFIG: CustomStructs_ScoreConfig = {
  baseScore: 300n,
  maxScore: 900n,
  walletAgeWeight: 3n,
  protocolWeight: 15n,
  daoWeight: 20n,
  lpWeight: 10n,
  crossChainWeight: 25n,
  consistencyWeight: 5n,
  bronzeThreshold: 400n,
  silverThreshold: 550n,
  goldThreshold: 700n,
  platinumThreshold: 820n,
};

export const DEFAULT_GOVERNANCE_GUARDIAN_SET_HASH = new Uint8Array([
  1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
]);
export const DEFAULT_GOVERNANCE_GUARDIAN_THRESHOLD = 3n;
export const DEFAULT_GOVERNANCE_CONTROLLER_VERSION = 1n;

export const DEFAULT_GOVERNANCE_TIMELOCK_EPOCHS = 10n;

// ─── Compiled contract factories ─────────────────────────────────────────────

export const makeFullCompiledContract = (zkConfigPath: string): unknown =>
  utils.createCompiledContract('veil-protocol', VeilContractClass as never, witness as never, zkConfigPath);

// ─── Circuit input types ──────────────────────────────────────────────────────

export type VeilIdentityRegistrationInput = {
  veilIdHash: BytesLike;
  chainNamespace: BytesLike;
  publicKeyOrLockHashCommitment: BytesLike;
  walletSignatureHash: BytesLike;
  currentEpoch: bigint;
};

export type VeilIdentityDerivationInput = {
  rawPublicKeyOrLockHash: BytesLike;
  chainNamespace: BytesLike;
  salt: BytesLike;
};

export type VeilIdentityProofHashInput = {
  veilIdHash: BytesLike;
  chainNamespace: BytesLike;
  publicKeyOrLockHashCommitment: BytesLike;
  walletSignatureHash: BytesLike;
  contractAddress: BytesLike;
};

export type ReputationSignals = {
  walletAgeInDays: bigint;
  distinctProtocols: bigint;
  daoVoteCount: bigint;
  lpTenureInDays: bigint;
  crossChainCount: bigint;
  txConsistencyScore: bigint;
  ethChainCommitment: BytesLike;
  ckbChainCommitment: BytesLike;
  witnessSalt: BytesLike;
};

export type ReputationProofBindingInput = {
  veilIdHash: BytesLike;
  witnessCommitment: BytesLike;
  claimedBand: bigint;
  proofNonce: BytesLike;
  scoreConfigHash: BytesLike;
};

export type ReputationProofInput = ReputationSignals & {
  veilIdHash: BytesLike;
  claimedBand: bigint;
  proofNonce: BytesLike;
  currentEpoch: bigint;
};

export type ReputationCheckInput = {
  veilIdHash: BytesLike;
  requesterAddressHash: BytesLike;
  purposeHash: BytesLike;
  minimumBand: bigint;
  currentEpoch: bigint;
};

export type GovernanceActionInput = {
  actionTag: BytesLike;
  scoreConfigHash: BytesLike;
  operationId: BytesLike;
  effectiveEpoch: bigint;
  contractAddress: BytesLike;
};

export type GovernanceProofInput = {
  controllerCommitment: BytesLike;
  actionHash: BytesLike;
  operationId: BytesLike;
  signatureBundleHash: BytesLike;
  nonce: BytesLike;
  contractAddress: BytesLike;
};

export type ScoreConfigProposalInput = {
  nextConfig: CustomStructs_ScoreConfig;
  currentEpoch: bigint;
  operationId: BytesLike;
  signatureBundleHash: BytesLike;
  governanceNonce: BytesLike;
};

// ─── Circuit argument builders ────────────────────────────────────────────────

export const buildIdentityRegistrationArgs = (input: VeilIdentityRegistrationInput) =>
  [
    toBytes32(input.veilIdHash, 'veilIdHash'),
    toBytes32(input.chainNamespace, 'chainNamespace'),
    toBytes32(input.publicKeyOrLockHashCommitment, 'publicKeyOrLockHashCommitment'),
    toBytes32(input.walletSignatureHash, 'walletSignatureHash'),
    input.currentEpoch,
  ] as const;

export const buildReputationProofArgs = (input: ReputationProofInput) =>
  [
    toBytes32(input.veilIdHash, 'veilIdHash'),
    input.walletAgeInDays,
    input.distinctProtocols,
    input.daoVoteCount,
    input.lpTenureInDays,
    input.crossChainCount,
    input.txConsistencyScore,
    input.claimedBand,
    toBytes32(input.ethChainCommitment, 'ethChainCommitment'),
    toBytes32(input.ckbChainCommitment, 'ckbChainCommitment'),
    toBytes32(input.witnessSalt, 'witnessSalt'),
    toBytes32(input.proofNonce, 'proofNonce'),
    input.currentEpoch,
  ] as const;

export const buildReputationCheckArgs = (input: ReputationCheckInput) =>
  [
    toBytes32(input.veilIdHash, 'veilIdHash'),
    toBytes32(input.requesterAddressHash, 'requesterAddressHash'),
    toBytes32(input.purposeHash, 'purposeHash'),
    input.minimumBand,
    input.currentEpoch,
  ] as const;

export const buildScoreConfigProposalArgs = (input: ScoreConfigProposalInput) =>
  [
    input.nextConfig,
    input.currentEpoch,
    toBytes32(input.operationId, 'operationId'),
    toBytes32(input.signatureBundleHash, 'signatureBundleHash'),
    toBytes32(input.governanceNonce, 'governanceNonce'),
  ] as const;

// ─── Witness commitment derivation ───────────────────────────────────────────

export const deriveReputationWitnessCommitment = (
  veilIdHash: BytesLike,
  walletAgeInDays: bigint,
  distinctProtocols: bigint,
  daoVoteCount: bigint,
  lpTenureInDays: bigint,
  crossChainCount: bigint,
  txConsistencyScore: bigint,
  ethChainCommitment: BytesLike,
  ckbChainCommitment: BytesLike,
  witnessSalt: BytesLike,
): Uint8Array =>
  pureCircuits.Utils_deriveReputationWitnessCommitment(
    toBytes32(veilIdHash, 'veilIdHash'),
    walletAgeInDays,
    distinctProtocols,
    daoVoteCount,
    lpTenureInDays,
    crossChainCount,
    txConsistencyScore,
    toBytes32(ethChainCommitment, 'ethChainCommitment'),
    toBytes32(ckbChainCommitment, 'ckbChainCommitment'),
    toBytes32(witnessSalt, 'witnessSalt'),
  );

export const deriveReputationWitnessCommitmentFromSignals = (
  veilIdHash: BytesLike,
  signals: ReputationSignals,
): Uint8Array =>
  deriveReputationWitnessCommitment(
    veilIdHash,
    signals.walletAgeInDays,
    signals.distinctProtocols,
    signals.daoVoteCount,
    signals.lpTenureInDays,
    signals.crossChainCount,
    signals.txConsistencyScore,
    signals.ethChainCommitment,
    signals.ckbChainCommitment,
    signals.witnessSalt,
  );

// ─── Pure helper derivations ─────────────────────────────────────────────────

export const deriveIdentityProofHash = (input: VeilIdentityProofHashInput): Uint8Array =>
  pureCircuits.Utils_deriveIdentityProofHash(
    toBytes32(input.veilIdHash, 'veilIdHash'),
    toBytes32(input.chainNamespace, 'chainNamespace'),
    toBytes32(input.publicKeyOrLockHashCommitment, 'publicKeyOrLockHashCommitment'),
    toBytes32(input.walletSignatureHash, 'walletSignatureHash'),
    toBytes32(input.contractAddress, 'contractAddress'),
  );

export const deriveScoreConfigHashFor = (
  scoreConfig: CustomStructs_ScoreConfig,
  contractAddress: BytesLike,
): Uint8Array =>
  pureCircuits.Utils_deriveScoreConfigHashFor(
    scoreConfig,
    toBytes32(contractAddress, 'contractAddress'),
  );

export const deriveReputationProofHash = (input: ReputationProofBindingInput): Uint8Array =>
  pureCircuits.Utils_deriveReputationProofHash(
    toBytes32(input.veilIdHash, 'veilIdHash'),
    toBytes32(input.witnessCommitment, 'witnessCommitment'),
    input.claimedBand,
    toBytes32(input.proofNonce, 'proofNonce'),
    toBytes32(input.scoreConfigHash, 'scoreConfigHash'),
  );

export const deriveGovernanceActionHash = (input: GovernanceActionInput): Uint8Array =>
  pureCircuits.Utils_deriveGovernanceActionHash(
    toBytes32(input.actionTag, 'actionTag'),
    toBytes32(input.scoreConfigHash, 'scoreConfigHash'),
    toBytes32(input.operationId, 'operationId'),
    input.effectiveEpoch,
    toBytes32(input.contractAddress, 'contractAddress'),
  );

export const deriveGuardianControllerCommitment = (input: {
  guardianSetHash: BytesLike;
  threshold: bigint;
  controllerVersion: bigint;
}): Uint8Array =>
  pureCircuits.Utils_deriveGuardianControllerCommitment(
    toBytes32(input.guardianSetHash, 'guardianSetHash'),
    input.threshold,
    input.controllerVersion,
  );

export const deriveGovernanceProofHash = (input: GovernanceProofInput): Uint8Array =>
  pureCircuits.Utils_deriveGovernanceProofHash(
    toBytes32(input.controllerCommitment, 'controllerCommitment'),
    toBytes32(input.actionHash, 'actionHash'),
    toBytes32(input.operationId, 'operationId'),
    toBytes32(input.signatureBundleHash, 'signatureBundleHash'),
    toBytes32(input.nonce, 'nonce'),
    toBytes32(input.contractAddress, 'contractAddress'),
  );

export const deriveCommunityWeightBps = (band: bigint): bigint =>
  pureCircuits.Utils_deriveCommunityWeightBps(band);

// ─── On-chain utility call wrappers ──────────────────────────────────────────

export const deriveVeilIdOnChain = async (
  api: VeilCallTx,
  input: VeilIdentityDerivationInput,
): Promise<Uint8Array> =>
  extractCircuitResult<Uint8Array>(
    await api.callTx(
      'Utils_deriveVeilId',
      toBytes32(input.rawPublicKeyOrLockHash, 'rawPublicKeyOrLockHash'),
      toBytes32(input.chainNamespace, 'chainNamespace'),
      toBytes32(input.salt, 'salt'),
    ),
    'Utils_deriveVeilId',
  );

export const submitIdentityRegistration = (api: VeilCallTx, input: VeilIdentityRegistrationInput): Promise<unknown> =>
  api.callTx('Identity_register', ...buildIdentityRegistrationArgs(input));

export const assertIdentityActive = (api: VeilCallTx, veilIdHash: BytesLike): Promise<unknown> =>
  api.callTx('Identity_assertActive', toBytes32(veilIdHash, 'veilIdHash'));

export const submitReputationProof = (api: VeilCallTx, input: ReputationProofInput): Promise<unknown> =>
  api.callTx('Reputation_prove', ...buildReputationProofArgs(input));

export const submitReputationCheck = (api: VeilCallTx, input: ReputationCheckInput): Promise<unknown> =>
  api.callTx('Reputation_check', ...buildReputationCheckArgs(input));

export const proposeScoreConfig = (api: VeilCallTx, input: ScoreConfigProposalInput): Promise<unknown> =>
  api.callTx('Governance_proposeScoreConfig', ...buildScoreConfigProposalArgs(input));

export const applyScoreConfig = (api: VeilCallTx, currentEpoch: bigint): Promise<unknown> =>
  api.callTx('Governance_applyScoreConfig', currentEpoch);

export type ScoreConfigCancelInput = {
  operationId: BytesLike;
  signatureBundleHash: BytesLike;
  governanceNonce: BytesLike;
};

export const cancelScoreConfig = (api: VeilCallTx, input: ScoreConfigCancelInput): Promise<unknown> =>
  api.callTx(
    'Governance_cancelScoreConfig',
    toBytes32(input.operationId, 'operationId'),
    toBytes32(input.signatureBundleHash, 'signatureBundleHash'),
    toBytes32(input.governanceNonce, 'governanceNonce'),
  );
