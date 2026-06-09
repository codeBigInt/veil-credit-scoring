# Veil Credit Scoring Protocol

Veil is a privacy-preserving credit scoring protocol for DeFi. It uses Midnight for private credit state and zero-knowledge contract execution, and Nervos CKB Spore DOBs as user-owned public identity anchors.

The current preview app lets a tester connect a Midnight wallet, join the deployed Veil contract, generate a Veil ID, create a private credit score entry, mint a CKB Veil Identity DOB, and authorize a risk decision without exposing raw score data.

## Live Links

- Docs: https://docs-veil-credit-scoring.netlify.app
- Testnet guide: https://docs-veil-credit-scoring.netlify.app/docs/user-guide/testnet
- Integration guide: https://docs-veil-credit-scoring.netlify.app/docs/integration
- API reference: https://docs-veil-credit-scoring.netlify.app/docs/integration/api-reference

## Current Preview Deployment

| Item | Value |
|---|---|
| Midnight network | `preview` |
| Veil contract | `115b1fb509025f6d9f7d8976101a31f28014d4b5627f518c5601ed7ef1179cc5` |
| Backend API | `https://api.13-61-145-21.sslip.io/api/v1` |
| Proof server | `https://proof810.116-203-250-124.sslip.io` |
| Midnight indexer | `https://indexer.preview.midnight.network/api/v4/graphql` |
| CKB explorer | `https://testnet.explorer.nervos.org` |
| CKB faucet | `https://faucet.nervos.org` |

Use these same values when configuring the Veil UI preview environment.

## What Is In This Repo

```text
packages/
  apps/
    veil-ui/      Next.js user app and dashboard
    docs/         Next.js documentation site
  backend/        Express API, Midnight transaction gateway, CKB DOB verification
  contract/       Midnight Compact contract, witnesses, generated artifacts, tests
  cli/            Developer CLI for standalone, preview, and preprod flows
veil-ckb-contracts/
  contracts/      CKB veil_sbt_lock contract used by Veil Identity DOBs
```

## Core Flow

1. A user connects a Midnight wallet in the Veil dashboard.
2. The dashboard joins the deployed Midnight Veil contract.
3. The user generates a local Veil ID, represented in the app as `userPk`.
4. The backend creates a private score entry on Midnight for that Veil ID.
5. The user connects a CKB testnet wallet.
6. The backend prepares a CKB Spore DOB mint intent that binds the user's `veilIdHash` to their CKB owner lock.
7. The user's CKB wallet signs and pays for the DOB mint.
8. The backend records and verifies the minted Spore DOB.
9. A user can authorize a credit decision by signing a challenge with the CKB wallet that owns the DOB.

The result is a minimized risk response such as `scoreBand`, `approved`, `maxLtvBps`, and `riskPremiumBps`. Veil does not return raw private score state or scoring history through the decision endpoint.

## Architecture

```text
Veil UI
  ├─ Midnight wallet connector
  ├─ CKB wallet connector via CCC
  └─ Dashboard flow for score entry, DOB minting, and decisions

Veil Backend
  ├─ Express REST API
  ├─ Midnight proof provider and indexer provider
  ├─ MongoDB private state provider
  ├─ CKB Spore/DOB mint intent preparation
  └─ CKB DOB record and signature verification

Midnight Contract
  ├─ Admin and issuer management
  ├─ Score entry creation
  ├─ Repayment, liquidation, protocol usage, and debt state events
  └─ Private score and accumulator commitments

CKB
  ├─ Spore DOB stores public identity-anchor metadata
  └─ veil_sbt_lock constrains the DOB ownership model
```

## Backend API

Local base URL:

```text
http://localhost:3001/api/v1
```

Preview base URL:

```text
https://api.13-61-145-21.sslip.io/api/v1
```

Important endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /health` | Backend health check |
| `GET /contract` | Active Midnight contract address |
| `POST /score-entries` | Create a user's score entry and prepare CKB DOB mint intent |
| `GET /score-entries/:userPk` | Check score entry and DOB status |
| `POST /scoring-events/repayments` | Submit repayment behavior |
| `POST /scoring-events/liquidations` | Submit liquidation behavior |
| `POST /scoring-events/protocol-usage` | Submit protocol usage behavior |
| `POST /scoring-events/debt-states` | Submit debt state behavior |
| `POST /challenges` | Create a short-lived decision challenge |
| `POST /credit-decisions` | Verify DOB ownership and return a risk decision |
| `GET /jobs/:jobId` | Poll queued Midnight transaction jobs |

See [packages/backend/API.md](./packages/backend/API.md) for request and response schemas.

## Local Development

Install dependencies from the repo root:

```bash
bun install
```

Build everything:

```bash
bun run build
```

Run the docs app:

```bash
cd packages/apps/docs
bun run dev
```

Run the Veil UI:

```bash
cd packages/apps/veil-ui
cp .env.example .env.local
bun run dev
```

Run the backend:

```bash
cd packages/backend
cp .env.example .env
bun run dev
```

The backend requires MongoDB, a reachable Midnight proof server, Midnight network configuration, a funded backend Midnight wallet, and CKB testnet lock script configuration. See [packages/backend/README.md](./packages/backend/README.md).

## Contract Development

Compile the Compact contract:

```bash
cd packages/contract
bun run compile
```

Run contract tests:

```bash
bun test
```

Build TypeScript artifacts:

```bash
bun run build
```

## CLI Development

The CLI is mainly for developer and protocol testing.

```bash
cd packages/cli
bun run standalone       # local Docker-backed Midnight environment
bun run preview-remote   # Midnight preview network
bun run preprod-remote   # Midnight preprod network
```

## Root Commands

```bash
bun run build        # Build all workspaces through Turbo
bun run dev          # Start workspace dev tasks
bun run lint         # Lint workspaces that define lint
bun run check-types  # Type-check workspaces that define check-types
bun run format       # Format source files
```

## Testing The Preview App

Share the testnet guide with external testers:

```text
https://docs-veil-credit-scoring.netlify.app/docs/user-guide/testnet
```

Testers need:

- Chrome or Brave
- 1AM Wallet or Lace for Midnight
- JoyID or another CCC-supported CKB testnet wallet
- CKB testnet tokens from https://faucet.nervos.org

After connecting a CKB wallet in the dashboard, testers can copy the connected CKB address and paste it into the Nervos faucet to claim testnet CKBytes for the DOB mint.

## Security Notes

- Testnet deployments are not production systems. Use test wallets only.
- The backend manages Midnight transaction submission and private state for API-driven flows.
- Users pay CKB capacity and fees for their own Spore DOB mint.
- Credit decisions are challenge-based and require CKB wallet authorization.
- Raw credit scores, accumulators, and behavior history are not exposed by the public decision endpoint.

## Roadmap

- Stabilize the preview dashboard and tester onboarding flow.
- Harden backend deployment, observability, and private-state operations.
- Expand issuer onboarding and event submission examples.
- Publish a thin TypeScript API client once backend contracts stabilize.
- Continue developing the CKB DOB identity layer and verification tooling.
