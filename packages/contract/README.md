# Veil Credit Scoring Contract

Compact smart contract for privacy-preserving credit scoring and Proof-of-Trust (PoT) NFT issuance on Midnight.

## Overview

This package contains the core contract logic for:
- Registering approved issuers.
- Creating and updating private user credit score state.
- Verifiable on-chain commitments for private score and accumulator records.
- Minting, renewing, and verifying PoT NFTs tied to current score state.

The entrypoint contract is [`src/main.compact`](./src/main.compact), which composes the following modules:
- `modules/Admin.compact`
- `modules/Scoring.compact`
- `modules/PoTNFT.compact`
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
  - NFT metadata registry and issuer registry

This allows off-chain private data to be proven against on-chain commitment trees.

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

### PoT NFT

- `NFT_mintPoTNFT()`
- `NFT_renewPoTNFT(token)`
- `NFT_verifyPoTNFT(issuerPk) -> Boolean`

### Utility

- `Utils_initializeContractConfigurations(tokenImageUris, tokenName, protocolConfig, scoreConfig, tokenMarkers)`

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
- PoT NFT mint/renew/verify flows
- duplicate event rejection and invalid path failures

Several admin/debt/revocation paths are scaffolded but currently commented out in code and tests.

## Notes

- Constructor initializes `superAdmin` from witness local secret key.
- Mint/renew use shielded token mechanics and nonce evolution.
- Configuration values (`ProtocolConfig`, `ScoreConfig`, token URIs/markers) are set via `Utils_initializeContractConfigurations` and consumed by scoring/NFT logic.
