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
import { Contract as VeilBootstrapContractClass } from '@veil/veil-contract/bootstrap';
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
  Ledger,
} from '@veil/veil-contract';
export type { VeilPrivateState, Witnesses };
export { createVeilPrivateState, pureCircuits, witness };

export type VeilContract = VeilContractClass<VeilPrivateState, Witnesses<VeilPrivateState>>;
export type VeilBootstrapContract = VeilBootstrapContractClass<VeilPrivateState, Witnesses<VeilPrivateState>>;

export const PRIVATE_STATE_ID = 'veil_ps' as const;
export type PrivateStateId = typeof PRIVATE_STATE_ID;

export const FULL_CONTRACT_CIRCUITS = [
  'Utils_deriveVeilId',
  'Utils_deriveIdentityProofHash',
  'Utils_deriveScoreConfigHash',
  'Utils_deriveScoreConfigHashFor',
  'Utils_deriveReputationProofHash',
  'Utils_deriveGovernanceActionHash',
  'Utils_deriveGovernanceProofHash',
  'Utils_deriveBand',
  'Identity_register',
  'Identity_assertActive',
  'Reputation_prove',
  'Reputation_check',
  'Governance_proposeScoreConfig',
  'Governance_applyScoreConfig',
  'Governance_cancelScoreConfig',
] as const;

export const BOOTSTRAP_CONTRACT_CIRCUITS = [
  'Utils_deriveVeilId',
  'Utils_deriveIdentityProofHash',
  'Identity_register',
  'Identity_assertActive',
  'Reputation_prove',
  'Reputation_check',
  'Governance_proposeScoreConfig',
  'Governance_applyScoreConfig',
  'Governance_cancelScoreConfig',
] as const;

export const POST_BOOTSTRAP_CONTRACT_CIRCUITS = [
  'Utils_deriveScoreConfigHash',
  'Utils_deriveScoreConfigHashFor',
  'Utils_deriveReputationProofHash',
  'Utils_deriveGovernanceActionHash',
  'Utils_deriveGovernanceProofHash',
  'Utils_deriveBand',
] as const;

export type FullContractCircuitId = (typeof FULL_CONTRACT_CIRCUITS)[number];
export type BootstrapContractCircuitId = (typeof BOOTSTRAP_CONTRACT_CIRCUITS)[number];
export type PostBootstrapContractCircuitId = (typeof POST_BOOTSTRAP_CONTRACT_CIRCUITS)[number];

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

export const DEFAULT_GOVERNANCE_CONTROLLER_COMMITMENT = new Uint8Array([
  1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
]);

export const DEFAULT_GOVERNANCE_TIMELOCK_EPOCHS = 10n;

// ─── Compiled contract factories ─────────────────────────────────────────────

export const makeFullCompiledContract = (zkConfigPath: string): unknown =>
  utils.createCompiledContract('veil-protocol', VeilContractClass as never, witness as never, zkConfigPath);

export const makeBootstrapCompiledContract = (zkConfigPath: string): unknown =>
  utils.createCompiledContract(
    'veil-protocol-bootstrap',
    VeilBootstrapContractClass as never,
    witness as never,
    zkConfigPath,
  );

// ─── Circuit input types ──────────────────────────────────────────────────────

export type VeilIdentityRegistrationInput = {
  veilIdHash: BytesLike;
  chainNamespace: BytesLike;
  publicKeyOrLockHashCommitment: BytesLike;
  walletSignatureHash: BytesLike;
  chainProofHash: BytesLike;
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
};

export type ReputationProofInput = ReputationSignals & {
  veilIdHash: BytesLike;
  claimedBand: bigint;
  witnessCommitment: BytesLike;
  proofNonce: BytesLike;
  proofHash: BytesLike;
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
  effectiveEpoch: bigint;
};

export type GovernanceProofInput = {
  controllerCommitment: BytesLike;
  actionHash: BytesLike;
  nonce: BytesLike;
};

export type ScoreConfigProposalInput = {
  nextConfig: CustomStructs_ScoreConfig;
  currentEpoch: bigint;
  actionHash: BytesLike;
  governanceProofHash: BytesLike;
  governanceNonce: BytesLike;
};

// ─── Circuit argument builders ────────────────────────────────────────────────

export const buildIdentityRegistrationArgs = (input: VeilIdentityRegistrationInput) =>
  [
    toBytes32(input.veilIdHash, 'veilIdHash'),
    toBytes32(input.chainNamespace, 'chainNamespace'),
    toBytes32(input.publicKeyOrLockHashCommitment, 'publicKeyOrLockHashCommitment'),
    toBytes32(input.walletSignatureHash, 'walletSignatureHash'),
    toBytes32(input.chainProofHash, 'chainProofHash'),
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
    toBytes32(input.witnessCommitment, 'witnessCommitment'),
    toBytes32(input.proofNonce, 'proofNonce'),
    toBytes32(input.proofHash, 'proofHash'),
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
    toBytes32(input.actionHash, 'actionHash'),
    toBytes32(input.governanceProofHash, 'governanceProofHash'),
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

// ─── On-chain circuit call wrappers ──────────────────────────────────────────

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

export const deriveIdentityProofHash = async (
  api: VeilCallTx,
  input: VeilIdentityProofHashInput,
): Promise<Uint8Array> =>
  extractCircuitResult<Uint8Array>(
    await api.callTx(
      'Utils_deriveIdentityProofHash',
      toBytes32(input.veilIdHash, 'veilIdHash'),
      toBytes32(input.chainNamespace, 'chainNamespace'),
      toBytes32(input.publicKeyOrLockHashCommitment, 'publicKeyOrLockHashCommitment'),
      toBytes32(input.walletSignatureHash, 'walletSignatureHash'),
    ),
    'Utils_deriveIdentityProofHash',
  );

export const deriveReputationProofHash = async (
  api: VeilCallTx,
  input: ReputationProofBindingInput,
): Promise<Uint8Array> =>
  extractCircuitResult<Uint8Array>(
    await api.callTx(
      'Utils_deriveReputationProofHash',
      toBytes32(input.veilIdHash, 'veilIdHash'),
      toBytes32(input.witnessCommitment, 'witnessCommitment'),
      input.claimedBand,
      toBytes32(input.proofNonce, 'proofNonce'),
    ),
    'Utils_deriveReputationProofHash',
  );

export const deriveScoreConfigHashFor = async (
  api: VeilCallTx,
  scoreConfig: CustomStructs_ScoreConfig,
): Promise<Uint8Array> =>
  extractCircuitResult<Uint8Array>(
    await api.callTx('Utils_deriveScoreConfigHashFor', scoreConfig),
    'Utils_deriveScoreConfigHashFor',
  );

export const deriveGovernanceActionHash = async (
  api: VeilCallTx,
  input: GovernanceActionInput,
): Promise<Uint8Array> =>
  extractCircuitResult<Uint8Array>(
    await api.callTx(
      'Utils_deriveGovernanceActionHash',
      toBytes32(input.actionTag, 'actionTag'),
      toBytes32(input.scoreConfigHash, 'scoreConfigHash'),
      input.effectiveEpoch,
    ),
    'Utils_deriveGovernanceActionHash',
  );

export const deriveGovernanceProofHash = async (
  api: VeilCallTx,
  input: GovernanceProofInput,
): Promise<Uint8Array> =>
  extractCircuitResult<Uint8Array>(
    await api.callTx(
      'Utils_deriveGovernanceProofHash',
      toBytes32(input.controllerCommitment, 'controllerCommitment'),
      toBytes32(input.actionHash, 'actionHash'),
      toBytes32(input.nonce, 'nonce'),
    ),
    'Utils_deriveGovernanceProofHash',
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

export const cancelScoreConfig = (api: VeilCallTx, actionHash: BytesLike): Promise<unknown> =>
  api.callTx('Governance_cancelScoreConfig', toBytes32(actionHash, 'actionHash'));
