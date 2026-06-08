# Veil Credit Scoring Contract

Compact smart contract for privacy-preserving credit scoring on Midnight.

## Overview

This package contains the core contract logic for:
- Registering approved issuers.
- Creating and updating private user credit score state.
- Verifiable on-chain commitments for private score and accumulator records.
- Deriving the private Veil user identifier that can be anchored publicly on CKB through a Spore/DOB.

The entrypoint contract is [`src/main.compact`](./src/main.compact), which composes the following modules:
- `modules/Admin.compact`
- `modules/Scoring.compact`
- `modules/Utils.compact`
- `modules/GlobalLedgerStates.compact`
- `modules/CustomStructs.compact`

## Key Concepts

### Private vs Public State

- Private state lives in witness-managed storage (`src/witness.ts`):
  - `creditScores[userPk]`
  - `scoreAmmulations[userPk]`
- Public on-chain state stores commitment roots and indexes:
  - `creditScoreCommitments` and `scoreAccumulatorCommitments`
  - `userCreditScoreIndex` and `userAccumulatorIndex`
  - issuer registry and score event replay protection

This allows off-chain private data to be proven against on-chain commitment trees.

### Public Identity Anchor

Public credential minting has moved out of Midnight. After `Scoring_createScoreEntry` creates the private Veil ID and initial score commitment, the app hashes the Veil ID and lets the user mint a Veil Identity Spore/DOB on CKB testnet from their own CKB wallet.

The Spore content stores only stable public metadata:
- protocol: `Veil`
- object type: `VeilIdentity`
- `veilIdHash`
- Midnight network and contract address
- content version
- owner CKB lock hash

Mutable credit scores, score commitments, behavioral data, raw identity data, and private state are not written into the Spore content.

### Issuers

Only approved issuers can submit scoring events or request score recomputation.
Issuers are registered via `Admin_addIssuer` and stored in `LedgerStates_issuers`.

### Event Deduplication

Scoring events are replay-protected using `LedgerStates_processedScoreEvents`.
Repayment and liquidation events include `_eventId` in dedupe keys.
Protocol usage is deduped by `(user, protocol)` pair.

### Epoch Tracking

Epoch progression is lazy-computed via `Utils_computeCurrentEpoch` using witness time.
`EPOCH_DURATION` is initialized in constructor (currently `432000`).

## Exported Circuits

### Admin

- `Admin_addIssuer(protocolName, contractAddress) -> Bytes<32>`

### Scoring

- `Scoring_createScoreEntry()`
- `Scoring_submitRepaymentEvent(userPk, issuerPk, paidOnTimeFlag, amountWeight, eventEpoch, eventId)`
- `Scoring_submitLiquidationEvent(userPk, issuerPk, severity, eventEpoch, eventId)`
- `Scoring_submitProtocolUsageEvent(userPk, issuerPk, protocolId, eventEpoch)`
- `Scoring_recomputeAndReturnScore(userPk, issuerPk) -> CreditScore`

### Utility
## Credit Score Computation

`Utils_recomputeAndPersistScore` calculates score using:

- Positive factors:
  - Repayment ratio (`onTime / totalRepay`, scaled)
  - Distinct protocols used
  - Tenure (`currentEpoch - firstSeenEpoch`)
- Penalties:
  - Liquidation penalty points
  - Active debt flag
  - Risk band

Formula shape:
- `behavior = repaymentRatioScaled * repaymentWeight + protocolScore + tenureScore`
- `penalties = liquidationPenaltyPoints * liquidationWeight + activeDebtFlag * activeDebtPenalty + riskBand * riskBandWeight`
- `rawScore = baseScore + behavior - penalties`
- Enforced bounds: `rawScore <= maxScore`

Both credit score and accumulator commitments are rotated and reinserted with fresh Merkle indexes on update.

## Witness Responsibilities

`src/witness.ts` supplies contract witnesses, including:
- local secret key access
- current time sourcing
- private score/accumulator read-write
- Merkle path lookup for commitment verification
- first-free index resolution in commitment trees
- repayment ratio helper and tier/URI selection

If you replace the witness implementation, preserve the expected invariants and return types.

## Development

From repository root, use the package scripts:

```bash
bun install
bun run --filter @veil/veil-contract test:compile
bun run --filter @veil/veil-contract test:run
```

Or from `packages/contract`:

```bash
bun install
bun run test:compile
bun run test:run
```

### Useful Scripts

- `test:compile`: compile contract with `--skip-zk`
- `compile`: full compile
- `test` / `test:run`: run Vitest suite
- `build`: transpile TS and copy managed contract artifacts

## Test Coverage Snapshot

Current tests (`src/tests/veil-credit-scoring.test.ts`) cover:
- issuer registration
- score entry creation
- repayment/protocol/liquidation event submission
- score recomputation and persistence checks
- duplicate event rejection and invalid path failures

Several admin/debt/revocation paths are scaffolded but currently commented out in code and tests.

## Notes

- Constructor initializes `superAdmin` from witness local secret key.
- Veil Identity DOB minting is handled by CKB Spore in the app/backend CKB module, not by Midnight token circuits.
- Constructor receives the initial `ScoreConfig`; later score policy updates use `Admin_updatedScoreConfig`.
- PoT NFT mint/renew/verify circuits and token URI/marker configuration have been removed from the Midnight source. Public identity anchoring now lives on CKB as a user-minted Spore/DOB, while Midnight keeps private scoring state and proof-oriented credit decision logic.
