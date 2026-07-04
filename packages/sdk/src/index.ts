// ─── Main client ─────────────────────────────────────────────────────────────
export { VeilClient } from './client';

// ─── Midnight providers ───────────────────────────────────────────────────────
export { createDerivedProvider } from './providers/derived';
export type { DerivedProviderHandle } from './providers/derived';
export { FetchZkConfigProvider } from './providers/fetch-zk-config';
export { IdbPrivateStateProvider } from './providers/idb-private-state';
export { loadIdbWalletCache, saveIdbWalletCache } from './providers/idb-wallet-cache';
export type { WalletStateCache, SerializableWallet } from './providers/idb-wallet-cache';

// ─── Standalone functions ─────────────────────────────────────────────────────
export { checkReputation, batchCheckReputation } from './check';
export { registerIdentity, buildRegistrationMessage } from './identity/register';
export { deriveVeilId, buildIdentityFromSigner, detectSourceChain } from './identity/derive';
export { resolveIdentityState, checkIfRegistered } from './identity/resolve';
export type { IdentityState } from './identity/resolve';
export { collectReputationWitness, collectReputationWitnessFromAddresses } from './reputation/reader';
export { readEthereumSignals, computeConsistencyScore } from './reputation/reader/ethereum';
export { readCKBSignals } from './reputation/reader/ckb';
export { proveReputation } from './reputation/prove';
export { requestSponsorship } from './sponsor';

// ─── SDK types ────────────────────────────────────────────────────────────────
export type {
  VeilConfig,
  ChainRpcConfig,
} from './config';
export { DEFAULT_FEE_SPONSOR } from './config';

export type {
  Bytes32,
  HexString,
  BytesLike,
  ScoreBand,
  ReputationPurpose,
  SourceChain,
  VeilIdentity,
  RegistrationResult,
  GovernanceVote,
  LPPosition,
  EthereumSignals,
  CkbSignals,
  EthereumSignalReader,
  CkbSignalReader,
  ReputationReaderOptions,
  ReputationWitness,
  ReputationProof,
  ReputationDecision,
  VeilErrorCode,
  CCCSigner,
  SponsoredFee,
  VeilCallTx,
  VeilMidnightProvider,
  CheckOptions,
  ProofServerResponse,
  ReputationSignalReader,
} from './types';
export { BAND_ORDER, bandMeetsMinimum, VeilError } from './types';

// ─── Utilities ────────────────────────────────────────────────────────────────
export { bytesToHex, hexToBytes, toBytes, toBytes32, padStringToBytes32, extractCircuitResult } from './utils/bytes';
export { hashChainState, sha256Bytes32, randomBytes32 } from './utils/hash';

// ─── Contract layer ───────────────────────────────────────────────────────────
export {
  PRIVATE_STATE_ID,
  FULL_CONTRACT_CIRCUITS,
  DEFAULT_SCORE_CONFIG,
  DEFAULT_GOVERNANCE_GUARDIAN_SET_HASH,
  DEFAULT_GOVERNANCE_GUARDIAN_THRESHOLD,
  DEFAULT_GOVERNANCE_CONTROLLER_VERSION,
  DEFAULT_GOVERNANCE_TIMELOCK_EPOCHS,
  createVeilPrivateState,
  pureCircuits,
  witness,
  makeFullCompiledContract,
  buildIdentityRegistrationArgs,
  buildReputationProofArgs,
  buildReputationCheckArgs,
  buildScoreConfigProposalArgs,
  deriveReputationWitnessCommitment,
  deriveReputationWitnessCommitmentFromSignals,
  deriveIdentityProofHash,
  deriveScoreConfigHashFor,
  deriveReputationProofHash,
  deriveGovernanceActionHash,
  deriveGuardianControllerCommitment,
  deriveGovernanceProofHash,
  deriveCommunityWeightBps,
  deriveVeilIdOnChain,
  submitIdentityRegistration,
  assertIdentityActive,
  submitReputationProof,
  submitReputationCheck,
  proposeScoreConfig,
  applyScoreConfig,
  cancelScoreConfig,
} from './contract';

export type {
  VeilContract,
  VeilPrivateState,
  Witnesses,
  PrivateStateId,
  FullContractCircuitId,
  CustomStructs_PendingScoreConfig,
  CustomStructs_ReputationDecision,
  CustomStructs_ReputationProofBinding,
  CustomStructs_ReputationScore,
  CustomStructs_ReputationSignals,
  CustomStructs_ScoreConfig,
  CustomStructs_VeilIdentityRecord,
  Ledger,
  VeilIdentityRegistrationInput,
  VeilIdentityDerivationInput,
  VeilIdentityProofHashInput,
  ReputationSignals,
  ReputationProofBindingInput,
  ReputationProofInput,
  ReputationCheckInput,
  GovernanceActionInput,
  GovernanceProofInput,
  ScoreConfigProposalInput,
  ScoreConfigCancelInput,
} from './contract';
