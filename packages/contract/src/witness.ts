import type { CustomStructs_CreditScore, CustomStructs_ScoreAccumulators, Ledger } from "./managed/veil-protocol/contract";
import { MerkleTreePath, toHex, WitnessContext } from "@midnight-ntwrk/compact-runtime";

export interface VeilPrivateState {
    creditScores: Record<string, CustomStructs_CreditScore>,
    scoreAmmulations: Record<string, CustomStructs_ScoreAccumulators>,
    secreteKey: Uint8Array
}

export function createVeilPrivateState(secreteKey: Uint8Array): VeilPrivateState {
    return {
        secreteKey,
        scoreAmmulations: {},
        creditScores: {}
    }
}

export const defaultCreditScore = {
  score: 0n,                  // Uint<32> → bigint, default 0
  durationWeeks: 0n,          // Uint<32> → bigint, default 0
  lastComputedEpoch: 0n,      // Uint<64> → bigint, default 0
  repaymentRatio: 0n,         // Uint<32> → bigint, default 0
  liquidationCount: 0n,       // Uint<32> → bigint, default 0
  protocolsUsed: 0n,          // Uint<32> → bigint, default 0
  activeDebt: false,          // Boolean → boolean, default false
  mtIndex: 0n,                // Uint<64> → bigint, default 0
};

export const defaultMerkleTreePath = {
  leaf: new Uint8Array(32),        // Bytes<32>
  path: Array.from({ length: 32 }, () => ({
    sibling: { field: 0n },        // MerkleTreeDigest wraps a Field → bigint
    goes_left: false,              // Boolean → boolean, default false
  })),
};

export const defaultScoreAccumulators = {
  firstSeenEpoch: 0n,               
  lastEventEpoch: 0n,               
  lastComputedEpoch: 0n,            

  onTimeCount: 0n,                  
  lateCount: 0n,                    
  weightedRepaymentVolume: 0n,      

  liquidationCount: 0n,             
  liquidationPenaltyPoints: 0n,     

  distinctProtocols: 0n,            
  activeDebtFlag: 0n,               
  riskBand: 0n,                     
  mtIndex: 0n,                      
};


export const witness = {
    getLocalSecreteKey: ({ privateState }: WitnessContext<Ledger, VeilPrivateState>): [VeilPrivateState, Uint8Array] => {
        return [privateState, privateState.secreteKey]
    },

    getCurrentTime: ({ privateState }: WitnessContext<Ledger, VeilPrivateState>): [VeilPrivateState, bigint] => {
        return [privateState, BigInt(Date.now())]
    },

    getCreditScoreByPk: (
        { privateState }: WitnessContext<Ledger, VeilPrivateState>,
        userPk: Uint8Array
    ): [VeilPrivateState, {is_some: boolean, value: CustomStructs_CreditScore}] => {
        const strUserPk = toHex(userPk);
        const creditScores = privateState.creditScores[strUserPk];

        if (creditScores) {
            return [privateState, {
                is_some: true,
                value: creditScores
            }]
        } else {
            return [privateState, {
                is_some: false,
                value: defaultCreditScore
            }]

        }
    },

    updatedCreditScore: (
        { privateState }: WitnessContext<Ledger, VeilPrivateState>,
        userPk: Uint8Array,
        updatedCreditScore: CustomStructs_CreditScore
    ): [VeilPrivateState, []] => {
        const strUserPk = toHex(userPk);

        const newPrivateState: VeilPrivateState = {
            ...privateState,
            creditScores: {
                ...privateState.creditScores,
                [strUserPk]: updatedCreditScore
            }
        }

        return [newPrivateState, []]
    },

    getAccumulatedScoreByPk: (
        { privateState }: WitnessContext<Ledger, VeilPrivateState>,
        userPk: Uint8Array
    ): [VeilPrivateState, {is_some: boolean, value: CustomStructs_ScoreAccumulators}] => {
        const strUserPk = toHex(userPk);
        const accumulatedScore = privateState.scoreAmmulations[strUserPk];

        if (accumulatedScore) {
            return [privateState, {
                is_some: true,
                value: accumulatedScore
            }]
        } else {
            return [privateState, {
                is_some: false,
                value: defaultScoreAccumulators
            }]

        }
    },

    updatedAccumulatedScore: (
        { privateState }: WitnessContext<Ledger, VeilPrivateState>,
        userPk: Uint8Array,
        updatedAccumulatedScore: CustomStructs_ScoreAccumulators
    ): [VeilPrivateState, []] => {
        const strUserPk = toHex(userPk);

        const newPrivateState: VeilPrivateState = {
            ...privateState,
            scoreAmmulations: {
                ...privateState.scoreAmmulations,
                [strUserPk]: updatedAccumulatedScore
            }
        }

        return [newPrivateState, []]
    },

    verifyScoreCommitment: (
        { privateState, ledger }: WitnessContext<Ledger, VeilPrivateState>,
        commitmentHash: Uint8Array
    ): [VeilPrivateState, {is_some: boolean, value: MerkleTreePath<Uint8Array>}] => {
        const path = ledger.LedgerStates_creditScoreCommitments.findPathForLeaf(commitmentHash);

        if (path) {
            return [privateState, {
                is_some: true,
                value: path
            }]
        } else {
            return [privateState, {
                is_some: false,
                value: defaultMerkleTreePath
            }]

        }
    },

     verifyAggregatCommitment: (
        { privateState, ledger }: WitnessContext<Ledger, VeilPrivateState>,
        commitmentHash: Uint8Array
    ): [VeilPrivateState, {is_some: boolean, value: MerkleTreePath<Uint8Array>}] => {
        const path = ledger.LedgerStates_scoreAccumulatorCommitments.findPathForLeaf(commitmentHash);

        if (path) {
            return [privateState, {
                is_some: true,
                value: path
            }]
        } else {
            return [privateState, {
                is_some: false,
                value: defaultMerkleTreePath
            }]
        }
    },
    getFirstFreeCreditScoreIndex: ({ privateState, ledger}: WitnessContext<Ledger, VeilPrivateState>): [VeilPrivateState, bigint] => {
        return [privateState, ledger.LedgerStates_creditScoreCommitments.firstFree()]
    },

    getFirstFreeAccumulatorIndex: ({ privateState, ledger}: WitnessContext<Ledger, VeilPrivateState>): [VeilPrivateState, bigint] => {
        return [privateState, ledger.LedgerStates_scoreAccumulatorCommitments.firstFree()]
    },
};  
