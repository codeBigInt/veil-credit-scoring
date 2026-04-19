import type { CustomStructs_CreditScore, CustomStructs_ScoreAccumulators, Ledger } from "./managed/veil-protocol/contract";
import { MerkleTreePath, toHex, WitnessContext } from "@midnight-ntwrk/compact-runtime";
import { CustomStructs_Tier } from "./managed/veil-protocol/contract";

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
  score: 0n,                  
  durationWeeks: 0n,          
  lastComputedEpoch: 0n,      
  repaymentRatio: 0n,         
  liquidationCount: 0n,       
  protocolsUsed: 0n,          
  activeDebt: false,          
  mtIndex: 0n,                
};

export const defaultMerkleTreePath = {
  leaf: new Uint8Array(32),        
  path: Array.from({ length: 32 }, () => ({
    sibling: { field: 0n },        
    goes_left: false,              
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

    determineNftRating: (
        { privateState, ledger }: WitnessContext<Ledger, VeilPrivateState>,
        userPk: Uint8Array
    ): [VeilPrivateState, [string, number]] => {
        const strUserPk = toHex(userPk);
        const score = privateState.creditScores[strUserPk] ?? defaultCreditScore;
        const ratio = score.repaymentRatio;

        const config = ledger.LedgerStates_protocolConfig;
        const uris = ledger.LedgerStates_tokenImageUris;

        const returnValue: [string, number] = ratio >= config.platinumThreshold
            ? [uris.platinum, CustomStructs_Tier.platinum]
            : ratio >= config.goldThreshold
            ? [uris.gold, CustomStructs_Tier.gold]
            : ratio >= config.silverThreshold
            ? [uris.silver, CustomStructs_Tier.silver]
            : ratio >= config.bronzeThreshold
            ? [uris.bronze, CustomStructs_Tier.bronze]
            : [uris.unranked, CustomStructs_Tier.unranked];

        return [privateState, returnValue];
    },

    calculatedExpiredEpoch: (
        { privateState, ledger }: WitnessContext<Ledger, VeilPrivateState>,
        elapsedTime: bigint
    ): [VeilPrivateState, bigint] => {
        const epochDurationSeconds = ledger.LedgerStates_EPOCH_DURATION;
        if (epochDurationSeconds <= 0n) {
            return [privateState, 0n];
        }

        return [privateState, elapsedTime / epochDurationSeconds];
    },

    computeRepaymentRatio: (
        { privateState }: WitnessContext<Ledger, VeilPrivateState>,
        onTimeCount: bigint,
        totalRepay: bigint,
        scale: bigint
    ): [VeilPrivateState, [bigint, bigint]] => {
        if (totalRepay === 0n) {
            return [privateState, [0n, 0n]];
        }

        const numerator = onTimeCount * scale;
        const quotient = numerator / totalRepay;
        const remainder = numerator % totalRepay;
        return [privateState, [quotient, remainder]];
    },
};  
