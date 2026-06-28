import type {
  CustomStructs_ReputationScore,
  Ledger,
} from "./managed/veil-protocol/contract";
import { MerkleTreePath, toHex, WitnessContext } from "@midnight-ntwrk/compact-runtime";

export interface VeilPrivateState {
  reputationScores: Record<string, CustomStructs_ReputationScore>;
}

export function createVeilPrivateState(): VeilPrivateState {
  return {
    reputationScores: {},
  };
}

export const defaultMerkleTreePath = {
  leaf: new Uint8Array(32),
  path: Array.from({ length: 32 }, () => ({
    sibling: { field: 0n },
    goes_left: false,
  })),
};

export const defaultReputationScore: CustomStructs_ReputationScore = {
  veilIdHash: new Uint8Array(32),
  score: 0n,
  band: 0n,
  walletAgeInDays: 0n,
  distinctProtocols: 0n,
  daoVoteCount: 0n,
  lpTenureInDays: 0n,
  crossChainCount: 0n,
  txConsistencyScore: 0n,
  ethChainCommitment: new Uint8Array(32),
  ckbChainCommitment: new Uint8Array(32),
  witnessCommitment: new Uint8Array(32),
  proofHash: new Uint8Array(32),
  lastUpdatedEpoch: 0n,
  mtIndex: 0n,
};

export const witness = {
  getReputationByVeilId: (
    { privateState }: WitnessContext<Ledger, VeilPrivateState>,
    veilIdHash: Uint8Array
  ): [VeilPrivateState, { is_some: boolean; value: CustomStructs_ReputationScore }] => {
    const key = toHex(veilIdHash);
    const reputation = privateState.reputationScores[key];

    if (reputation) {
      return [privateState, { is_some: true, value: reputation }];
    }

    return [privateState, { is_some: false, value: defaultReputationScore }];
  },

  updatedReputation: (
    { privateState }: WitnessContext<Ledger, VeilPrivateState>,
    veilIdHash: Uint8Array,
    reputation: CustomStructs_ReputationScore
  ): [VeilPrivateState, []] => {
    const key = toHex(veilIdHash);

    return [
      {
        ...privateState,
        reputationScores: {
          ...privateState.reputationScores,
          [key]: reputation,
        },
      },
      [],
    ];
  },

  verifyReputationCommitment: (
    { privateState, ledger }: WitnessContext<Ledger, VeilPrivateState>,
    commitmentHash: Uint8Array
  ): [VeilPrivateState, { is_some: boolean; value: MerkleTreePath<Uint8Array> }] => {
    const path = ledger.LedgerStates_reputationCommitments.findPathForLeaf(commitmentHash);

    if (path) {
      return [privateState, { is_some: true, value: path }];
    }

    return [privateState, { is_some: false, value: defaultMerkleTreePath }];
  },

  getFirstFreeReputationIndex: ({
    privateState,
    ledger,
  }: WitnessContext<Ledger, VeilPrivateState>): [VeilPrivateState, bigint] => {
    return [privateState, ledger.LedgerStates_reputationCommitments.firstFree()];
  },
};
