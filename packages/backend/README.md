# Veil Backend

Small support service for Veil Protocol v2.

The backend is no longer a credit-scoring oracle. It does not accept behavioral events, compute user
scores, create credit decisions, or submit identity/reputation Midnight transactions for users. Those
flows are handled by the Midnight contract and `@veil-protocol/sdk`.

## Responsibilities

- Sponsor DUST for user Midnight transactions.
- Deploy the staged Veil Midnight contract when explicitly enabled.
- Expose the active Veil contract address.
- Optionally store encrypted private-state or wallet-metadata backups.

## Runtime

The backend starts two Midnight wallets:

- An operating wallet for contract deployment, maintenance transactions, and backend fees.
- A sponsor wallet that holds many small unregistered unshielded NIGHT UTXOs and registers one or more
  UTXOs to a user's DUST address when sponsorship is requested.

MongoDB is used for the saved active contract address, backend private state/signing keys required
for staged contract deployment, and optional encrypted client backups.

## Required Environment

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string. |
| `VEIL_BACKEND_WALLET_SEED` | Funded backend operating wallet seed. |
| `VEIL_PROOF_SERVER_URL` | Midnight proof server used by the backend wallet stack. |
| `MIDNIGHT_NETWORK` | `preview`, `preprod`, or `mainnet`. |

Useful optional values:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | HTTP port. |
| `MONGODB_DB_NAME` | `veil_backend` | Mongo database. |
| `VEIL_SPONSOR_WALLET_SEED` | `VEIL_BACKEND_WALLET_SEED` | Separate funded wallet seed for user DUST sponsorship. Use a dedicated seed in production. |
| `VEIL_SPONSOR_DEFAULT_REQUIRED_DUST` | `0` | Fallback DUST budget when clients cannot estimate the transaction fee. |
| `VEIL_SPONSOR_ALLOCATION_TTL_MS` | `600000` | Short sponsorship lease window before reclaim is attempted. Keep this low so sponsor UTxOs recycle. |
| `VEIL_SPONSOR_RECLAIM_INTERVAL_MS` | `60000` | Background reclaim interval. Set `0` to disable automatic reclaim. |
| `VEIL_CONTRACT_ADDRESS` | unset | Existing deployed Veil contract. |
| `VEIL_AUTO_DEPLOY` | `false` | Deploy the Veil contract from the backend wallet when no address is configured or saved. Also enables `POST /contract/deploy`. |
| `VEIL_ZK_CONFIG_PATH` | `../contract/dist/managed/veil-protocol` | Veil contract ZK artifacts. |

## API

Base path: `/api/v2`

- `GET /health`
- `GET /contract`
- `POST /contract/deploy`
- `GET /sponsor/status`
- `POST /sponsor/dust`
- `POST /dust-sponsor` compatibility alias
- `PUT /backups/:backupId`
- `GET /backups/:backupId?owner=<owner>`
- `GET /backups?owner=<owner>`
- `DELETE /backups/:backupId?owner=<owner>`

See [API.md](./API.md) for request and response examples.

## Development

```bash
bun install
cd packages/backend
bun run dev
```

Build:

```bash
bun run build
```

## Deprecated

The v1 credit-scoring endpoints are intentionally no longer mounted:

- credit decision creation
- issuer scoring events
- DID resolution
- CKB DOB mint intent and record endpoints
- score-entry lifecycle endpoints

Use `@veil-protocol/sdk` for identity registration, reputation proof submission, and band checks.
