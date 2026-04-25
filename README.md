# Veil Credit Scoring Protocol

Privacy-preserving, issuer-driven credit scoring on Midnight — anonymous on-chain identity, ZK-backed score commitments, and time-bound Proof of Trustworthiness (PoT) NFTs as portable trust artifacts for DeFi integrations.

---

## Table of Contents

- [Overview](#overview)
- [Core Concepts](#core-concepts)
  - [The Veil ID](#the-veil-id)
  - [Credit Score Users](#credit-score-users)
  - [Issuers](#issuers)
  - [Backend Service Provider](#backend-service-provider)
- [Protocol Architecture](#protocol-architecture)
  - [Actors](#actors)
  - [Privacy Model: Private vs Public State](#privacy-model-private-vs-public-state)
  - [Protocol Lifecycle](#protocol-lifecycle)
- [Scoring Model](#scoring-model)
  - [Score Computation](#score-computation)
  - [Trust Tiers](#trust-tiers)
  - [Default Configuration](#default-configuration)
- [Proof of Trustworthiness (PoT) NFT](#proof-of-trustworthiness-pot-nft)
  - [Minting](#minting)
  - [Time-Bound Validity and Renewal](#time-bound-validity-and-renewal)
  - [Verification](#verification)
  - [Revocation](#revocation)
- [Circuit Catalog](#circuit-catalog)
- [Monorepo Structure](#monorepo-structure)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Running the Protocol](#running-the-protocol)
  - [Standalone (Local)](#standalone-local)
  - [Preview Network](#preview-network)
  - [Preprod Network](#preprod-network)
  - [End-to-End Walkthrough](#end-to-end-walkthrough)
- [Integration Guide for DeFi Protocols](#integration-guide-for-defi-protocols)
- [Planned Backend Scoring Service](#planned-backend-scoring-service)
- [Security and Operational Notes](#security-and-operational-notes)
- [Roadmap](#roadmap)

---

## Overview

Veil is a privacy-preserving credit scoring protocol built on [Midnight](https://midnight.network/), a data-protection blockchain that enables ZK-backed private state alongside public on-chain commitments.

**The core problem Veil solves:** DeFi protocols need user risk signals to make informed decisions (lending limits, access gating, fee structures), but demanding full identity disclosure or on-chain transaction history breaks user privacy. Veil bridges this gap — it lets users prove they are creditworthy without revealing who they are or disclosing their raw financial history.

**How it works at a high level:**

1. A user generates a **Veil ID** (an anonymous public key) derived from a secret key they hold off-chain. This is their shielded identity on the protocol.
2. They register on Veil by calling an API endpoint that creates an empty credit score and score accumulator entry in the protocol's **private state**, with cryptographic commitments stored on-chain.
3. DeFi protocols that have been registered as **issuers** submit behavior events (repayments, liquidations, protocol usage) tied to the user's Veil ID — without knowing the user's real identity.
4. When a user wants to prove creditworthiness to another protocol, they **mint a PoT NFT** that encodes their trust tier at that moment, backed by a ZK commitment to their score.
5. Any registered issuer can call Veil's verification endpoint with the user's Veil ID or PoT NFT to confirm the user meets a required trust tier — without Veil or the issuer ever learning the user's identity.

> **Design note:** The current architecture (API-driven, backend-mediated interactions) is a direct consequence of the absence of contract composability on Midnight at this stage of its development. Once composability is available, some flows may be restructured.

---

## Core Concepts

### The Veil ID

A **Veil ID** (also referred to as `userPk` throughout the codebase) is a deterministic, anonymous public key that identifies a user within the Veil protocol. It is derived from the user's secret key using a domain-separated persistent hash:

```
veilId = persistentHash(["veil:user", secretKey, contractAddress])
```

The secret key is stored **off-chain only** by the user (never disclosed to the protocol). The Veil ID is what gets stored on-chain in commitments, ensuring the protocol can track behavior without ever linking it back to a real-world identity or wallet address.

Users generate their Veil ID off-chain and use it when calling Veil's API endpoints to register and interact with the protocol.

### Credit Score Users

Credit score users are individuals who want to build and prove their DeFi reputation anonymously. Their journey:

1. **Generate a Veil ID** from their secret key off-chain.
2. **Register** by calling the Veil API, which creates an empty score entry and accumulator in private state and commits them on-chain.
3. **Accumulate behavior** — issuers (DeFi protocols the user interacts with) submit repayment, liquidation, and protocol-usage events tied to the user's Veil ID.
4. **Mint a PoT NFT** to capture their current trust tier as a portable, verifiable credential.
5. **Present the PoT NFT** to other DeFi protocols that use Veil as a trust filtering layer.
6. **Renew the NFT** before it expires to maintain access — expired NFTs are automatically revoked during verification.

### Issuers

Issuers are registered DeFi protocols that have been approved by the Veil admin to submit behavioral data and verify user trust. They fulfill two roles:

**As data providers:**
- Submit repayment events (paid-on-time flag, amount weight)
- Submit liquidation events (severity 1–3)
- Submit protocol usage events (tracks unique protocol diversity)
- Submit debt state events (active debt flag, risk band)

**As verifiers:**
- Call Veil's verification endpoint with a user's Veil ID or PoT NFT to confirm they meet a specific trust tier before granting access or privileges.

Issuers never learn the real identity of the users they're tracking or verifying — they only interact with Veil IDs.

To become an issuer, a DeFi protocol must be registered by the Veil admin via `Admin_addIssuer`. This gating prevents unauthorized parties from polluting the scoring data.

### Backend Service Provider

All on-chain interactions in Veil flow through a **backend service provider** that acts on behalf of users and issuers. This service:

- Abstracts the complexity of ZK proof generation, private state management, and gas payment.
- Stores private state (credit scores, score accumulators) associated with user Veil IDs.
- Exposes API endpoints that users and issuers call to trigger contract interactions.
- Pays gas fees for all transactions on behalf of participants.

This means neither users nor issuers need a Midnight wallet or direct blockchain interaction — they interact with the Veil API, and the backend handles the rest.

---

## Protocol Architecture

### Actors

| Actor | Role |
|---|---|
| **Credit Score User** | Generates Veil ID, registers score entry, mints/renews PoT NFT |
| **Issuer** | Registered DeFi protocol; submits behavior events, verifies user trust |
| **Super Admin** | Bootstrap authority; registers first admin and issuers, initializes configs |
| **Admin** | Can add/remove issuers, update protocol and score config, update token URIs |
| **Backend Service Provider** | Orchestrates all on-chain interactions, manages private state, pays gas |
| **Integrator Protocol** | Any DeFi protocol that consumes Veil trust status before enabling privileged actions |

### Privacy Model: Private vs Public State

Veil's architecture cleanly separates what is private from what is verifiable on-chain:

**Private state (off-ledger, witness-managed — never disclosed on-chain):**

| Field | Description |
|---|---|
| `creditScores[veilId]` | Full credit score struct per user |
| `scoreAmmulations[veilId]` | Score accumulators (repayment counts, liquidation points, etc.) per user |
| `secreteKey` | User's secret key used to derive their Veil ID |
| `ownershipSecret` | Secondary secret used to prove NFT ownership during verification |

**Public ledger state (on-chain — verifiable by anyone):**

| Field | Description |
|---|---|
| `creditScoreCommitments` | Historic Merkle tree of credit score commitments |
| `scoreAccumulatorCommitments` | Historic Merkle tree of score accumulator commitments |
| `nftRegistry` | Map of Veil ID → PoT NFT metadata |
| `issuers` | Map of issuer public key → issuer metadata |
| `admins` | Set of admin public keys |
| `superAdmin` | Super admin public key |
| `protocolConfig` | Tier thresholds and NFT validity settings |
| `scoreConfig` | Score formula weights and bounds |
| `processedScoreEvents` | Replay-protection set for scoring events |
| `usedVerificationChallenges` | Replay-protection set for NFT verification challenges |
| `issuerTrustWeights` | Configurable per-issuer penalty multipliers |
| `elapsedEpoch` | Counter of protocol epochs elapsed since deployment |
| `tokenIssueCounter` | Monotonic NFT token ID counter |

This split enables a critical guarantee: **anyone can verify that a PoT NFT is backed by a valid on-chain commitment without ever seeing the underlying score data**.

### Protocol Lifecycle

```
1. Contract deployment
   └─ Sets nonce, epoch duration (5 days), domain separator, and derives super admin pk

2. Admin setup
   └─ Admin_addIssuer → registers DeFi protocol as approved issuer, returns issuerPk
   └─ Utils_initializeContractConfigurations → sets token metadata, tier thresholds, score weights

3. User registration
   └─ User generates Veil ID off-chain from secret key
   └─ Scoring_createScoreEntry(veilId) → creates empty score + accumulator in private state, commits both on-chain

4. Behavior accumulation (repeated over time)
   └─ Scoring_submitRepaymentEvent  → updates accumulator: onTimeCount / lateCount / weightedRepaymentVolume
   └─ Scoring_submitLiquidationEvent → updates accumulator: liquidationCount / liquidationPenaltyPoints
   └─ Scoring_submitProtocolUsageEvent → updates accumulator: distinctProtocols (counted once per unique protocol)
   └─ Scoring_submitDebtStateEvent → updates accumulator: activeDebtFlag / riskBand (scaffolded)

5. PoT NFT minting
   └─ NFT_mintPoTNFT()
       ├─ Triggers lazy epoch update (computeCurrentEpoch)
       ├─ Recomputes score from accumulators + config (recomputeAndPersistScore)
       ├─ Validates score commitment against on-chain Merkle tree
       ├─ Determines trust tier from repayment ratio
       └─ Mints shielded token, stores NFT metadata in nftRegistry

6. NFT verification (by issuer)
   └─ NFT_verifyPoTNFT(issuerPk, veilId, challenge, expiresAt, ownershipSecret)
       ├─ Checks issuer is registered and approved
       ├─ Confirms NFT exists in nftRegistry
       ├─ Validates replay-protection challenge
       ├─ Verifies ownership commitment
       ├─ Auto-revokes if NFT has expired
       └─ Returns Boolean (true = valid and not expired)

7. NFT renewal
   └─ NFT_renewPoTNFT(token)
       ├─ Burns old PoT token
       ├─ Recomputes score and determines new tier
       └─ Issues new PoT token with updated metadata and extended expiry
```

---

## Scoring Model

### Score Computation

The score is computed from the user's accumulated behavior data whenever `recomputeAndPersistScore` is triggered (during mint and renewal). The formula:

```
rawScore = baseScore + behaviorScore - penaltyScore
rawScore = clamp(rawScore, 0, maxScore)
```

**Behavior score components:**

| Component | Formula | Config param |
|---|---|---|
| Repayment contribution | `repaymentRatio × repaymentWeight` | `repaymentWeight` |
| Protocol diversity contribution | `distinctProtocols × protocolWeight` | `protocolWeight` |
| Tenure contribution | `epochsActive × tenureWeight` | `tenureWeight` |

Where `repaymentRatio = (onTimeRepayments / totalRepayments) × scale`, computed off-circuit by the witness and verified inside the circuit with a remainder proof.

**Penalty score components:**

| Component | Formula | Config param |
|---|---|---|
| Liquidation penalties | `liquidationPenaltyPoints × liquidationWeight` | `liquidationWeight` |
| Active debt penalty | `activeDebtFlag × activeDebtPenalty` | `activeDebtPenalty` |
| Risk band penalty | `riskBand × riskBandWeight` | `riskBandWeight` |

**Safety invariants enforced on-chain:**
- Event monotonicity: `eventEpoch >= lastEventEpoch` (prevents retroactive manipulation)
- Replay protection: each `eventId` is hashed with domain tag, user, issuer, and contract address — duplicates are rejected
- Commitment validation: both the credit score and accumulator must have valid Merkle paths in the on-chain commitment trees before and after each update
- Score arithmetic: underflow and overflow are asserted before the final value is stored

### Trust Tiers

PoT NFT tiers are assigned based on the user's `repaymentRatio` at the time of minting or renewal:

| Tier | Threshold (default) | Token color |
|---|---|---|
| Unranked | below Bronze | — |
| Bronze | ≥ 20% repayment ratio | `markers.bronze` |
| Silver | ≥ 40% repayment ratio | `markers.silver` |
| Gold | ≥ 60% repayment ratio | `markers.gold` |
| Platinum | ≥ 80% repayment ratio | `markers.platinum` |

Thresholds are stored in `protocolConfig` and can be updated by an admin via `Admin_updatedProtocolConfig`.

### Default Configuration

The CLI initializes the contract with these defaults (adjustable by admin):

```
ScoreConfig:
  baseScore:             300
  maxScore:              900
  scale:                 100
  repaymentWeight:       2
  protocolWeight:        10
  tenureWeight:          1
  liquidationWeight:     3
  activeDebtPenalty:     5
  riskBandWeight:        5
  maxScoreDeltaPerEpoch: 50

ProtocolConfig:
  bronzeThreshold:       20  (repaymentRatio %)
  silverThreshold:       40
  goldThreshold:         60
  platinumThreshold:     80
  maxLiquidationsAllowed: 3
  nftEpochValidity:      12  (epochs, approx. 60 days at 5-day epoch)

Epoch duration: 432,000,000 ms (5 days)
```

---

## Proof of Trustworthiness (PoT) NFT

### Minting

A user calls `NFT_mintPoTNFT()` after accumulating sufficient behavior data. The circuit:

1. Derives the user's Veil ID from their local secret key.
2. Triggers a lazy epoch update to advance the protocol clock.
3. Recomputes and persists the user's credit score from their current accumulators.
4. Validates the score commitment against the on-chain Merkle tree.
5. Determines the trust tier (Unranked → Platinum) based on repayment ratio vs. config thresholds.
6. Mints a shielded token using the domain separator `"veil:protocol:nft"`.
7. Stores NFT metadata in the public `nftRegistry` under the user's Veil ID, including:
   - Token URI (IPFS link resolving to tier-appropriate image)
   - Token ID (from `tokenIssueCounter`)
   - Tier snapshot
   - Mint timestamp
   - Expiry epoch (`epochLastUpdateTimeStamp + EPOCH_DURATION`)
   - Credit score commitment hash
   - Ownership commitment (`persistentCommit(veilId, ownershipSecret)`)

The shielded token itself serves as the bearer credential; the registry entry enables on-chain verification without revealing user identity.

### Time-Bound Validity and Renewal

PoT NFTs expire after `nftEpochValidity` epochs (default: 12 epochs ≈ 60 days). This is intentional: requiring periodic renewal ensures the trust signal reflects **ongoing** good behavior, not just a historical snapshot.

**Renewal flow (`NFT_renewPoTNFT`):**
1. User provides their existing shielded PoT token.
2. The circuit verifies the token color matches the Veil domain separator.
3. Recomputes the credit score and determines the new tier.
4. Burns the old token (`sendImmediateShielded` to the burn address).
5. Mints a fresh token with updated metadata and a new expiry.

If a user does not renew before expiry, their NFT is automatically revoked during the next verification call.

### Verification

Issuers call `NFT_verifyPoTNFT(issuerPk, veilId, challenge, challengeExpiresAt, ownershipSecret)` to validate a user's trust status. The circuit:

1. Confirms the calling issuer is registered and approved.
2. Checks the user has an NFT in `nftRegistry`.
3. Computes a challenge hash (domain-tagged, per-user, per-issuer) and asserts it has not been used before (replay protection).
4. Verifies the ownership commitment: `persistentCommit(veilId, ownershipSecret) == nftMetadata.ownershipCommitment`.
5. Validates the stored credit score commitment against the on-chain Merkle tree.
6. Checks the challenge has not expired (`challengeExpiresAt >= currentTime`).
7. Auto-revokes the NFT if `nftMetadata.expiresAtEpoch < currentTime` and returns `false`.
8. Returns `true` if the NFT is valid, active, and not revoked.

The verification result is a boolean: the protocol learns only whether the user passes (no score value, no identity).

### Revocation

NFTs can be revoked by:
- **Expiry:** auto-revoked during any verification call if the current time exceeds `expiresAtEpoch`.
- **Admin action:** `revokePoTNFT(veilId, adminPk)` allows an authorized admin to revoke a specific user's NFT (for example, in response to detected misconduct outside the protocol's event system).

Revoked NFTs cause `verifyPoTNFT` to return `false`.

---

## Circuit Catalog

### Admin Circuits (`packages/contract/src/modules/Admin.compact`)

| Circuit | Signature | Description |
|---|---|---|
| `Admin_addIssuer` | `(protocolName, contractAddress) → issuerPk: Bytes<32>` | Registers a new issuer and returns their derived public key. Requires super admin or admin authorization. |
| `Admin_removeIssuer` | `(issuerPk)` | Removes a registered issuer. |
| `Admin_addAdmin` | `(adminPk)` | Grants admin privileges to a new key. Only callable by super admin. |
| `Admin_removeAdmin` | `(adminPk)` | Revokes admin privileges. |
| `Admin_updatedProtocolConfig` | `(updatedConfig: ProtocolConfig)` | Updates tier thresholds and NFT validity. |
| `Admin_updatedScoreConfig` | `(updatedScoreConfig: ScoreConfig)` | Updates score formula weights and bounds. |
| `Admin_updateTokenUris` | `(tokenImageUris, scoreConfig)` | Updates IPFS URIs for tier token images. |

### Scoring Circuits (`packages/contract/src/modules/Scoring.compact`)

| Circuit | Signature | Description |
|---|---|---|
| `Scoring_createScoreEntry` | `(userPk: Bytes<32>)` | Initializes an empty credit score and accumulator in private state; commits both on-chain. One entry per Veil ID. |
| `Scoring_submitRepaymentEvent` | `(userPk, issuerPk, paidOnTimeFlag: 0\|1, amountWeight, eventEpoch, eventId)` | Records a loan repayment. Updates `onTimeCount`, `lateCount`, `weightedRepaymentVolume`. |
| `Scoring_submitLiquidationEvent` | `(userPk, issuerPk, severity: 1–3, eventEpoch, eventId)` | Records a liquidation. Penalty scaled by `severity × issuerTrustWeight`. |
| `Scoring_submitProtocolUsageEvent` | `(userPk, issuerPk, protocolId, eventEpoch)` | Records a unique protocol interaction. Each `(user, protocol)` pair counted once. |
| `Scoring_submitDebtStateEvent` | `(userPk, issuerPk, activeDebtFlag: 0\|1, riskBand: 0–3, eventEpoch, eventId)` | Records debt state snapshot. Currently scaffolded in the CLI but contract logic is complete. |

### NFT Circuits (`packages/contract/src/modules/PoTNFT.compact`)

| Circuit | Signature | Description |
|---|---|---|
| `NFT_mintPoTNFT` | `() → []` | Recomputes score, determines tier, mints shielded PoT token, registers metadata. |
| `NFT_renewPoTNFT` | `(token: ShieldedCoinInfo)` | Burns old PoT token, recomputes score, mints fresh token with extended expiry. |
| `NFT_verifyPoTNFT` | `(issuerPk, userPk, challenge, challengeExpiresAt, ownershipSecret) → Boolean` | Verifies NFT validity. Returns `true` = valid, `false` = expired/revoked. |
| `revokePoTNFT` | `(userPk, adminPk)` | Admin-only forced revocation. |

### Utility Circuits (`packages/contract/src/modules/Utils.compact`)

| Circuit | Signature | Description |
|---|---|---|
| `Utils_initializeContractConfigurations` | `(tokenImageUris, tokenName, protocolConfig, scoreConfig, tokenMarkers)` | One-time initialization of all protocol parameters. |
| `Utils_generateUserPk` | `(sk: Bytes<32>) → Bytes<32>` | Derives a Veil ID from a secret key. Domain: `"veil:user"`. |

**Internal utility circuits** (not directly callable as entry points):
- `generateIssuerPk` — derives issuer key from secret: domain `"veil:issuer"`
- `generateAdminPk` — derives admin key: domain `"veil:superadmin"`
- `assertAuthorization` — checks caller's derived key against `superAdmin` ledger state
- `recomputeAndPersistScore` — full score recomputation pipeline with commitment updates
- `computeCurrentEpoch` — lazy epoch advancement based on block timestamp
- `mintAndSendToken` — shielded token issuance with nonce evolution

---

## Monorepo Structure

```
veil-credit-scoring-protocol/
├── packages/
│   ├── contract/              # Compact smart contract, witnesses, and tests
│   │   ├── src/
│   │   │   ├── main.compact             # Contract entry point, exports all circuits
│   │   │   ├── bootstrap.compact        # Lightweight bootstrap contract for staged deployment
│   │   │   ├── modules/
│   │   │   │   ├── Admin.compact        # Admin management circuits
│   │   │   │   ├── CustomStructs.compact # All struct/enum type definitions
│   │   │   │   ├── GlobalLedgerStates.compact # All on-chain ledger state declarations
│   │   │   │   ├── PoTNFT.compact       # NFT mint / renew / verify circuits
│   │   │   │   ├── Scoring.compact      # Score entry and event submission circuits
│   │   │   │   └── Utils.compact        # Shared utilities, witness declarations, score recompute
│   │   │   ├── tests/                   # Vitest integration tests
│   │   │   ├── managed/                 # Compact compiler output (generated, do not edit)
│   │   │   └── witness.ts               # TypeScript witness implementations and private state types
│   │   └── dist/                        # Built contract artifacts (generated by `bun run build`)
│   │
│   └── cli/                   # Interactive CLI DApp for local and remote environments
│       ├── src/
│       │   ├── index.ts                 # Main menu loop and contract API calls
│       │   ├── config.ts                # Environment configs (standalone, preview, preprod)
│       │   ├── midnight-wallet-provider.ts # Wallet integration
│       │   ├── generate-dust.ts         # Dust token generation helper
│       │   └── launcher/
│       │       ├── standalone.ts        # Local Docker-based launcher
│       │       ├── preview.ts           # Midnight Preview network launcher
│       │       └── preprod.ts           # Midnight Preprod network launcher
│       └── logs/                        # Per-session log files (gitignored)
```

---

## Prerequisites

Before setting up the project, ensure you have the following installed:

| Requirement | Version | Notes |
|---|---|---|
| **Compact toolchain** | `0.5.1` | Includes the `compact` CLI for compiling Compact contracts |
| **Compact compiler** | `>= 0.30.0` | Must be installed as part of the Compact toolchain |
| **Bun** | `>= 1.3.10` | JavaScript runtime and package manager used throughout the project |
| **Docker** | Latest stable | Required by the standalone local environment (spins up Midnight node + proof server containers) |
| **Node.js** | `>= 18` | Used alongside Bun for some CLI tooling |

Install Bun: https://bun.sh/docs/installation

Install the Compact toolchain by following the official Midnight documentation for your platform.

---

## Local Development Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd veil-credit-scoring-protocol
```

### 2. Install dependencies

From the root of the project:

```bash
bun install
```

This installs dependencies for all packages in the monorepo.

### 3. Compile and build the contract

Navigate to the contract package:

```bash
cd packages/contract
```

Run the full Compact compilation (generates ZK circuit artifacts):

```bash
bun compile
```

Run the contract test suite:

```bash
bun test
```

Build the TypeScript distribution artifacts (required by the CLI):

```bash
bun run build
```

> **Why this order matters:**
> - `bun compile` generates the managed contract files under `src/managed/` that the TypeScript build and tests depend on.
> - `bun test` validates protocol logic against the compiled circuits.
> - `bun run build` produces `dist/` which the CLI imports at runtime.

### 4. Build the CLI

Navigate to the CLI package:

```bash
cd ../cli
```

Build the CLI:

```bash
bun run build
```

---

## Running the Protocol

The CLI provides an interactive menu that exercises the full protocol flow. It supports three environments:

### Standalone (Local)

Runs against a local Midnight environment spun up via Docker containers (Midnight node + proof server). No real funds required.

```bash
cd packages/cli
bun run standalone
```

### Preview Network

Runs against the Midnight Preview testnet. Requires a funded wallet (use the Preview faucet).

```bash
cd packages/cli
bun run preview-remote
```

### Preprod Network

Runs against the Midnight Preprod testnet. Requires a funded wallet (use the Preprod faucet).

```bash
cd packages/cli
bun run preprod-remote
```

> **Remote network notes:**
> - On first launch you will be prompted to create a fresh wallet or restore from a seed phrase.
> - The CLI will request unshielded NIGHT tokens and generate dust tokens automatically when needed for shielded transactions.
> - A local proof server is started via Docker even in remote mode — allow up to 10 minutes for the proof server to become healthy on first run.
> - All logs are written to `packages/cli/logs/<mode>/<timestamp>.log`.

### End-to-End Walkthrough

Once the CLI is running, you will see a deployment menu followed by the main action menu. Here is the recommended full walkthrough:

**Step 1 — Deploy**

```
1. Deploy new Veil contract
```

This deploys the contract and returns the contract address. Take note of it if you plan to reconnect later via "Join deployed Veil contract".

**Step 2 — Admin setup**

```
2. Initialize contract config (admin)
```

Sets up tier thresholds, score config, token name, and IPFS image URIs. This must be done before any scoring activity.

```
1. Add issuer (admin)
```

Registers a DeFi protocol as an approved issuer. The issuerPk is returned and cached for the session.

**Step 3 — User registration**

```
3. Create score entry (self)
```

Creates an empty credit score and accumulator in private state with on-chain commitments. This is the equivalent of a user registering their Veil ID.

**Step 4 — Accumulate behavior events**

```
4. Submit repayment event
```

Enter the userPk (auto-resolved from private state), issuerPk (auto-resolved from the cached value), `paidOnTimeFlag` (1 = paid on time, 0 = late), `amountWeight`, and `eventEpoch`.

```
6. Submit protocol usage event
```

Enter userPk, issuerPk, and eventEpoch. Protocol usage is counted once per unique `(user, protocol)` pair.

```
5. Submit liquidation event
```

Enter userPk, issuerPk, severity (1–3), and eventEpoch.

**Step 5 — Mint PoT NFT**

```
8. Mint PoT NFT
```

Score is recomputed, tier is determined, and a shielded PoT token is minted. If shielded funds are insufficient, the CLI automatically generates dust tokens and retries.

**Step 6 — Verify**

```
10. Verify PoT NFT
```

Enter issuerPk, userPk, a challenge (random bytes), expiry timestamp, and the ownershipSecret (auto-resolved from private state). Returns `true` if the NFT is valid.

**Step 7 — Inspect state**

```
11. Show ledger state
```

Displays the full on-chain public state (commitments, NFT registry, issuers, config).

```
12. Show private state
```

Displays the private state (credit scores and accumulators keyed by Veil ID).

---

## Integration Guide for DeFi Protocols

To integrate Veil as a trust filtering layer:

### Becoming an issuer

1. Submit a registration request to the Veil admin to call `Admin_addIssuer` with your protocol name and contract address.
2. You will receive an `issuerPk` — this is your identity within Veil. Keep it secure.

### Submitting behavioral data

For each significant user action in your protocol, call the relevant Veil API endpoint:

| User action | Veil event |
|---|---|
| Loan repaid on time | `Scoring_submitRepaymentEvent` with `paidOnTimeFlag=1` |
| Loan repaid late | `Scoring_submitRepaymentEvent` with `paidOnTimeFlag=0` |
| Position liquidated | `Scoring_submitLiquidationEvent` with appropriate severity |
| User interacted with your protocol | `Scoring_submitProtocolUsageEvent` |

Use the user's Veil ID (not their wallet address) in all calls.

### Verifying user trust status

Before enabling a privileged action (undercollateralized borrowing, reduced liquidation threshold, fee discount, gated product access):

1. Generate a fresh challenge (32 random bytes) with a short expiry (e.g., 60 seconds from now).
2. Request the user provide their `ownershipSecret` (or have the Veil backend resolve it).
3. Call `NFT_verifyPoTNFT(issuerPk, userPk, challenge, expiresAt, ownershipSecret)`.
4. Act on the boolean result — `true` means the user holds a valid, non-expired PoT NFT.

### Policy examples

- Lending tiers by PoT tier (Bronze → base rate, Gold/Platinum → preferential rate)
- Undercollateralized borrowing only for Platinum tier
- Reduced liquidation buffer for consistently high-trust users
- Protocol access gating for new or unranked users

---

## Planned Backend Scoring Service

The CLI DApp is a developer tool for exercising the protocol. The production path is a dedicated backend scoring service that exposes all scoring flows via stable REST/webhook APIs.

**Planned responsibilities:**

- **Contract orchestration:** issuer registration, event submission, score recomputation, PoT verification flows
- **Private state management:** encrypted at-rest storage of `creditScores` and `scoreAmmulations`, controlled witness-side operations
- **Integration surface:** protocol-facing status endpoints, webhook/event streams for score-status updates, policy-ready trust responses
- **Key security:** hardened secret key handling, no plaintext key exposure in production paths

**Long-term vision:**

Veil's backend service will act as a universal privacy-preserving trust layer — not just for Midnight-native protocols, but potentially for any DeFi protocol that requires user conduct verification without identity disclosure. Protocols will request a trust decision from Veil and receive a ZK-backed boolean or tier result, eliminating the need to build isolated credit scoring engines.

---

## Security and Operational Notes

- **Issuer authorization:** Every score-affecting circuit asserts `LedgerStates_issuers.member(issuerPk)` before processing. Unregistered parties cannot submit events.
- **Replay protection:** All scoring events are deduplicated via a domain-tagged persistent hash of `(domainTag, eventId, userPk, issuerPk, contractAddress)`. Verification challenges are similarly deduplicated.
- **Commitment integrity:** Before any state update, both the credit score and accumulator commitments are validated against on-chain Merkle tree roots. After update, new commitments replace old ones atomically.
- **Epoch monotonicity:** `eventEpoch >= acc.lastEventEpoch` is enforced on every event submission. Events cannot be backdated.
- **Ownership proof:** PoT NFT verification requires the user to provide `ownershipSecret`, from which `persistentCommit(veilId, ownershipSecret)` is recomputed and checked against the stored `ownershipCommitment`. Neither Veil nor the issuer ever learns the secret.
- **Dev defaults:** The CLI uses a hardcoded private state password (`veil-credit-Test-2026!`) and the genesis wallet seed. These are intentional development shortcuts and must not be used in production deployments.
- **Scaffolded paths:** `Scoring_submitDebtStateEvent` and the `recomputeAndReturnScore` standalone circuit are implemented in the contract but currently commented out of the CLI menu. They are planned for full activation in upcoming releases.

---

## Development Commands (Root)

```bash
bun run build        # Build all packages
bun run dev          # Start dev watchers across packages
bun run lint         # Lint all packages
bun run check-types  # TypeScript type-check all packages
bun run format       # Format all source files
```

---

## Roadmap

- Activate scaffolded `submitDebtStateEvent` flow in the CLI and backend service.
- Ship production backend scoring service with encrypted private-state storage and stable API surface.
- Introduce per-issuer trust weight configuration (currently stored in `issuerTrustWeights` but not yet surfaced through an admin circuit).
- Define and publish open trust status standards for Midnight ecosystem protocols to consume Veil as a shared compliance layer.
- Expand integration examples: undercollateralized lending, derivatives access gating, reputation-aware liquidity provisioning.
- Explore Veil as a privacy-based compliance layer for protocols outside of Midnight as the ecosystem matures.
