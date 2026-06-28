# Veil Protocol v2

Veil Protocol v2 is a private cross-chain reputation protocol. Users prove a banded reputation
state from social and protocol activity without exposing raw wallet history, linked addresses, or
private score inputs.

Veil is no longer framed as a credit-scoring product. Lending can integrate Veil, but the primary
surface is private reputation for DeFi, DAOs, airdrops, incentives, and access systems.

## Packages

```text
packages/
  contract/       Midnight Compact v2 reputation contract
  sdk/            @veil-protocol/sdk for protocol integrators and apps
  cli/            Deployment and smoke-test CLI
  backend/        DUST sponsorship and optional encrypted backup API
  apps/
    veil-ui/      Single EVM-wallet reputation dashboard
    docs/         Static v2 documentation site
```

## v2 Flow

1. A user connects one EVM-compatible wallet.
2. The app/SDK derives a CKB lock-hash anchor and stable Veil ID.
3. The user signs the registration message and submits `Identity_register`.
4. The SDK collects public chain signals and submits `Reputation_prove`.
5. Integrators call `checkReputation` or `Reputation_check` for a minimum band.
6. The backend only sponsors DUST and optionally stores encrypted client backups.

## Backend API

Base path: `/api/v1`

| Endpoint | Purpose |
|---|---|
| `GET /health` | Backend health and enabled scopes |
| `GET /contract` | Active Midnight contract address |
| `POST /sponsor/dust` | DUST sponsorship |
| `POST /dust-sponsor` | Compatibility alias |
| `PUT /backups/:backupId` | Store encrypted private-state or wallet metadata backup |
| `GET /backups/:backupId?owner=...` | Fetch one encrypted backup |
| `GET /backups?owner=...` | List backup metadata |
| `DELETE /backups/:backupId?owner=...` | Delete a backup |

Deprecated v1 credit-decision, issuer-event, DID, DOB, and score-entry endpoints are no longer mounted.

## SDK

`@veil-protocol/sdk` is the main integration surface for cross-chain protocols:

- identity derivation and registration
- reputation witness collection
- proof submission
- band checks and batch checks
- DUST sponsor client
- deployment helper constants and contract argument builders

## Development

Install dependencies:

```bash
bun install
```

Build all workspaces:

```bash
bun run build
```

Run focused packages:

```bash
cd packages/sdk && bun run test:run
cd packages/apps/docs && bun run dev
cd packages/apps/veil-ui && bun run dev
cd packages/backend && bun run dev
```

## Contract

The full contract has identity, reputation, governance, and utility circuits. Because the full
surface exceeds the small bootstrap set, deployment uses the staged bootstrap flow and then installs
the missing verifier keys.

See [packages/contract/README.md](./packages/contract/README.md) and
[packages/contract/SECURITY.md](./packages/contract/SECURITY.md).

## Security

The contract verifies proof bindings, witness commitments, signal bounds, replay protection, band
matching, and governance timelocks. Wallet-signature verification and canonical source-chain readers
are part of the SDK/prover integration boundary until native verifier circuits are available.
