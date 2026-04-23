# Veil Credit Scoring Protocol

Privacy-preserving, issuer-driven credit scoring on Midnight, with PoT (Proof of Trustworthiness) NFTs as reusable trust artifacts for DeFi integrations.

## Table of Contents

- [Project Overview](#project-overview)
- [Why Veil in Midnight DeFi](#why-veil-in-midnight-defi)
- [Protocol Architecture](#protocol-architecture)
- [Scoring Model](#scoring-model)
- [Circuit Catalog](#circuit-catalog)
- [Monorepo Structure](#monorepo-structure)
- [Local Development Setup](#local-development-setup)
- [Running the Protocol Locally](#running-the-protocol-locally)
- [Running Against Preview and Preprod](#running-against-preview-and-preprod)
- [Integration Guide for Other Protocols](#integration-guide-for-other-protocols)
- [Planned Backend Scoring Service](#planned-backend-scoring-service)
- [Security and Operational Notes](#security-and-operational-notes)
- [Roadmap](#roadmap)

## Project Overview

Veil is a privacy-preserving credit scoring protocol built for Midnight.

At a high level:

- Behavior and score details remain in private state (witness-managed).
- Public chain state contains commitments and indexes needed for verification.
- Approved issuers submit behavior events that influence user score accumulators.
- Recomputed scores can be converted into PoT NFTs to prove trust status without revealing raw activity history.

The result is a composable trust layer that protocols can consume while preserving user confidentiality.

Learn more: [Visit our website](https://veil-credit-scoring-protocol.vercel.app/)

## Why Veil in Midnight DeFi

Midnight applications need user risk signals but should not require identity leakage or full transaction history disclosure.

Veil addresses that gap:

- Lending and yield protocols can condition risk parameters on trust status.
- Integrators can verify trust claims via PoT flows rather than building isolated credit engines.
- Users can carry reputation between protocols without exposing sensitive details.

## Protocol Architecture

### Core Actors

- `User`: creates and maintains a private score position, mints/renews PoT NFTs.
- `Issuer`: approved protocol actor that submits scoring-relevant events.
- `Super Admin`: bootstrap authority that registers issuers and initializes configs.
- `Integrator Protocol`: verifies user trust status before enabling privileged actions.

### Data Separation Model

Private state (off-ledger, witness-managed):

- `creditScores[userPk]`
- `scoreAmmulations[userPk]`
- local secret key for deterministic participant keys

Public ledger state (on-chain):

- `creditScoreCommitments` and `scoreAccumulatorCommitments` (historic Merkle trees)
- `userCreditScoreIndex` and `userAccumulatorIndex` (position mapping)
- issuer registry and replay-protection sets
- PoT NFT metadata registry and protocol/scoring configuration

This split allows verifiability without exposing plaintext user behavior records.

### Lifecycle

1. Contract deployment initializes global parameters (`nonce`, epoch config, domain separator, super admin).
2. Admin registers issuer with `Admin_addIssuer`.
3. User initializes a score slot with `Scoring_createScoreEntry`.
4. Issuer submits repayment/liquidation/protocol-usage events.
5. Issuer (or authorized flow) triggers `Scoring_recomputeAndReturnScore`.
6. User mints or renews PoT NFT.
7. Integrator verifies trust status through `NFT_verifyPoTNFT`.

## Scoring Model

The contract computes score from score accumulators and config weights.

Behavior components:

- repayment ratio contribution
- distinct protocol usage contribution
- tenure contribution

Penalty components:

- liquidation penalty points
- active debt penalty
- risk band penalty

The score pipeline enforces:

- event monotonicity checks (epoch ordering),
- replay protection (`processedScoreEvents`),
- commitment validation before and after updates,
- bounded score arithmetic (`base + behavior - penalties`, then max cap).

### Development Default Config (from CLI)

In the CLI flow, default config passed to `Utils_initializeContractConfigurations` is:

- `baseScore`: `300`
- `maxScore`: `900`
- `scale`: `100`
- `repaymentWeight`: `2`
- `protocolWeight`: `10`
- `tenureWeight`: `1`
- `liquidationWeight`: `3`
- `activeDebtPenalty`: `5`
- `riskBandWeight`: `5`
- `maxScoreDeltaPerEpoch`: `50`

These are operational defaults for local/demo flows and can be adjusted through protocol configuration strategy.

## Circuit Catalog

### Admin Circuits

- `Admin_addIssuer(protocolName, contractAddress) -> Bytes<32>`
- Purpose: register approved issuer and return issuer key.

### Scoring Circuits

- `Scoring_createScoreEntry()`
- `Scoring_submitRepaymentEvent(userPk, issuerPk, paidOnTimeFlag, amountWeight, eventEpoch, eventId)`
- `Scoring_submitLiquidationEvent(userPk, issuerPk, severity, eventEpoch, eventId)`
- `Scoring_submitProtocolUsageEvent(userPk, issuerPk, protocolId, eventEpoch)`
- `Scoring_recomputeAndReturnScore(userPk, issuerPk) -> CreditScore`

### NFT Circuits

- `NFT_mintPoTNFT()`
- `NFT_renewPoTNFT(token)`
- `NFT_verifyPoTNFT(issuerPk) -> Boolean`

### Utility Circuit

- `Utils_initializeContractConfigurations(tokenImageUris, tokenName, protocolConfig, scoreConfig, tokenMarkers)`

## Monorepo Structure

- `packages/contract`: Compact contract, modules, witnesses, tests.
- `packages/cli`: interactive launcher for local and remote environments.
- `packages/apps/veil-ui`: Veil frontend.
- `packages/apps/ui`: template app.
- `packages/apps/docs`: template docs app.

Detailed package docs:

- [Contract README](./packages/contract/README.md)
- [CLI README](./packages/cli/README.md)
- [Veil UI README](./packages/apps/veil-ui/README.md)
- [UI README](./packages/apps/ui/README.md)
- [Docs README](./packages/apps/docs/README.md)

## Local Development Setup

### Prerequisites

- Bun `>= 1.3.10`
- Node.js `>= 18`
- Docker daemon running (required by local Midnight test/proof environment)

### Install

```bash
bun install
```

### Build and Validate Contract

```bash
bun run --filter @veil/veil-contract test:compile
bun run --filter @veil/veil-contract test:run
bun run --filter @veil/veil-contract build
```

Why this order:

- `test:compile` verifies contract compile path quickly (`--skip-zk`).
- `test:run` validates protocol logic through Vitest flows.
- `build` generates `dist` artifacts used by the CLI import path.

## Running the Protocol Locally

Start standalone launcher:

```bash
bun run --filter @veil/cli standalone
```

The CLI menu gives a complete protocol exercise path:

1. Deploy new Veil contract.
2. Add issuer as admin.
3. Initialize contract configurations.
4. Create score entry.
5. Submit repayment/liquidation/protocol usage events.
6. Recompute score.
7. Mint or renew PoT NFT.
8. Verify PoT NFT.
9. Inspect ledger and private state.

### Suggested End-to-End Local Scenario

1. `Deploy new Veil contract`
2. `Add issuer (admin)`
3. `Initialize contract config (admin)`
4. `Create score entry (self)`
5. Submit at least one repayment event and one protocol usage event.
6. `Recompute score`
7. `Mint PoT NFT`
8. `Show private state` and `Show ledger state` to inspect commitment/index updates.

Logs are written under `packages/cli/logs/*` for each launcher mode.

## Running Against Preview and Preprod

Preview:

```bash
bun run --filter @veil/cli preview-remote
```

Preprod:

```bash
bun run --filter @veil/cli preprod-remote
```

Notes:

- Remote launchers configure corresponding Midnight network endpoints.
- Proof server is expected and health checks are performed by environment config.
- Faucet/dust behavior differs by mode and is handled in launcher logic.

## Frontend (Veil UI)

Run the Veil UI app:

```bash
cd packages/apps/veil-ui
bun install
bun dev
```

Default URL: `http://localhost:3000`

## Integration Guide for Other Protocols

Veil can be consumed as a trust-status dependency layer.

Current practical integration model:

- issuer submits behavioral events from protocol interactions,
- protocol or authorized flow recomputes score,
- user holds renewed PoT NFT reflecting current trust state,
- integrator verifies PoT validity and applies policy.

Policy examples:

- lending tiers by trust status,
- liquidation threshold tuning,
- fee discounts for consistently high-trust users,
- gated product access for undercollateralized borrowing.

## Planned Backend Scoring Service

The project is moving toward a dedicated backend service that exposes scoring flows and secures private-state operations.

### Goals

- Expose all scoring-related circuit interactions via stable service APIs.
- Centralize issuer transaction orchestration.
- Harden private-state handling and key operations.
- Provide a single integration surface for ecosystem protocols.

### Planned Responsibilities

- Contract orchestration:
  - issuer registration workflows,
  - scoring event submission,
  - score recomputation triggers,
  - PoT verification helper flows.
- Private state boundary:
  - secure storage lifecycle,
  - encrypted at-rest state management,
  - controlled witness-side operations.
- Integration surface:
  - protocol-facing status endpoints,
  - webhook/event stream for score-status updates,
  - policy-ready trust responses.

### Filtering Layer Vision

Long-term, Veil acts as a universal trust filtering layer for Midnight protocols:

- protocols request user status from Veil before enabling sensitive actions,
- Veil returns a privacy-preserving trust decision context,
- downstream protocols avoid duplicating scoring engines and fragmented risk logic.

## Security and Operational Notes

- The contract enforces issuer authorization for score-affecting events.
- Replay-resistant keys protect score event ingestion.
- Merkle commitment checks ensure private/public state consistency.
- Current CLI demo includes dev-focused defaults (including local private-state password handling) and should not be copied directly into production operations.
- Contract logic contains scaffolded but currently inactive paths (for example debt-state/revocation-related extensions) that are planned for future enablement.

## Development Commands (Root)

- `bun run build`
- `bun run dev`
- `bun run lint`
- `bun run check-types`
- `bun run format`

## Roadmap

- Enable scaffolded admin/debt/revocation and expanded risk state flows.
- Ship production backend scoring service for circuit exposure and private-state security.
- Define protocol-facing trust status standards for broad Midnight ecosystem adoption.
- Add richer integration examples across lending, derivatives, and reputation-aware liquidity protocols.
