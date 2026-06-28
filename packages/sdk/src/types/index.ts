import type { ChainRpcConfig, VeilConfig } from '../config';

export type { ChainRpcConfig, VeilConfig };

export type Bytes32 = Uint8Array;
export type HexString = `0x${string}` | string;
export type BytesLike = Uint8Array | HexString;

export type ScoreBand = 'unranked' | 'bronze' | 'silver' | 'gold' | 'platinum';

export const BAND_ORDER: Record<ScoreBand, number> = {
  unranked: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
};

export const bandMeetsMinimum = (band: ScoreBand, minimum: ScoreBand): boolean =>
  BAND_ORDER[band] >= BAND_ORDER[minimum];

export type ReputationPurpose = 'airdrop' | 'governance' | 'access' | 'incentive' | 'general';
export type SourceChain = 'evm' | 'ckb' | 'btc' | 'solana' | 'passkey';

export interface VeilIdentity {
  veilId: string;
  ckbLockHash: string;
  ckbAddress: string;
  sourceChain: SourceChain;
}

export interface RegistrationResult {
  veilId: string;
  txHash: string;
  sponsored: boolean;
}

export interface GovernanceVote {
  protocol: string;
  proposalId: string;
  timestamp: number;
}

export interface LPPosition {
  protocol: string;
  createdAt: number;
  tokenPair: string;
}

export interface EthereumSignals {
  firstTxTimestamp: number;
  contractsInteracted: string[];
  governanceVotes: GovernanceVote[];
  lpPositions: LPPosition[];
  txTimestamps: number[];
  transactionCount: number;
  activeChains: number;
}

export interface CkbSignals {
  contractsInteracted: string[];
  txTimestamps: number[];
  txCount: number;
  tipBlockNumber?: number;
  networkReachable: boolean;
}

export type EthereumSignalReader = (address: string, configs: ChainRpcConfig[]) => Promise<EthereumSignals>;
export type CkbSignalReader = (address: string, config: ChainRpcConfig) => Promise<CkbSignals>;

export interface ReputationReaderOptions {
  ethereumReader?: EthereumSignalReader;
  ckbReader?: CkbSignalReader;
}

export interface ReputationWitness {
  walletAgeInDays: number;
  distinctProtocols: number;
  daoVoteCount: number;
  lpTenureInDays: number;
  crossChainCount: number;
  txConsistencyScore: number;
  ethChainCommitment: string;
  ckbChainCommitment: string;
  salt: Uint8Array;
}

export interface ReputationProof {
  proofHash: string;
  txHash: string;
  band: ScoreBand;
  validAt: number;
}

export interface ReputationDecision {
  veilId: string;
  meetsThreshold: boolean;
  band: ScoreBand;
  communityWeight: number;
  accessTier: number;
  purpose: ReputationPurpose;
  validAt: number;
  proofHash: string;
}

export type VeilErrorCode =
  | 'IDENTITY_NOT_FOUND'
  | 'ALREADY_REGISTERED'
  | 'PROOF_FAILED'
  | 'MIDNIGHT_RPC_ERROR'
  | 'CHAIN_RPC_ERROR'
  | 'SPONSOR_UNAVAILABLE'
  | 'INVALID_CONFIG'
  | 'SCORE_NOT_COMPUTED';

export class VeilError extends Error {
  constructor(
    message: string,
    public readonly code: VeilErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'VeilError';
  }
}

export interface CCCSigner {
  getRecommendedAddress(): Promise<string>;
  signMessage(message: string): Promise<string | { signature: string }>;
  getEvmAddress?(): Promise<string>;
}

export interface SponsoredFee {
  readonly [key: string]: unknown;
}

export type VeilCallTx = {
  callTx(circuitName: string, ...args: unknown[]): Promise<unknown>;
};

export interface VeilMidnightProvider extends VeilCallTx {
  applySponsoredFee?(fee: SponsoredFee): Promise<void> | void;
  queryContractState?(contractAddress: string): Promise<unknown>;
}

export interface CheckOptions {
  minimumBand: ScoreBand;
  purpose: ReputationPurpose;
  midnightProvider: VeilMidnightProvider;
  config: VeilConfig;
  requesterAddressHash?: BytesLike;
  currentEpoch?: bigint;
}

export interface ProofServerResponse {
  proofHash?: string;
  proofNonce?: string;
  witnessCommitment?: string;
  band: ScoreBand | number;
  validAt?: number;
  txHash?: string;
}

export type ReputationSignalReader = (identity: VeilIdentity, config: VeilConfig) => Promise<ReputationWitness>;
