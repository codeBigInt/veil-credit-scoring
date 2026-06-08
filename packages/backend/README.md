# Veil Backend

Express HTTP server that acts as the transaction gateway for the Veil credit-scoring protocol on the Midnight blockchain (preprod network). It receives scoring events from issuers and DeFi protocols, generates zero-knowledge proofs, submits signed transactions to the on-chain Veil contract, and prepares CKB Spore/DOB mint intents for user wallet signing.

## Architecture

```
Client (issuer / DeFi protocol / user wallet)
        │ HTTP POST
        ▼
  Express API  (/api/v1/*)
        │
        ▼
  ContractService
    ├── BackendWalletProvider  — signs & balances txns with the backend wallet seed
    ├── MongoPrivateStateProvider  — persists contract private state to MongoDB
    ├── FetchZkConfigProvider  — loads compiled ZK circuit configs from disk
    ├── HttpClientProofProvider  — generates ZK proofs via the proof server
    └── IndexerPublicDataProvider  — reads on-chain state via the Midnight indexer

CKB module
    ├── prepares immutable Veil Identity Spore/DOB content
    ├── returns the deployed veil_sbt_lock script and cell dep
    └── verifies and records user-submitted Spore mint results
```

Midnight contract calls are **synchronous** — each HTTP request waits for proof generation and on-chain confirmation before returning. Proof generation typically takes 15–60 seconds depending on the circuit. CKB Spore minting is decentralized: the backend prepares the mint intent, but the user's CKB wallet constructs/signs/sends the transaction and pays CKB capacity and fees.

## Prerequisites

| Dependency | Purpose |
|---|---|
| Node.js 20+ / Bun | Runtime |
| MongoDB 7 | Private state & signing key storage |
| Midnight proof server | ZK proof generation (provided by Midnight team) |
| Funded backend Midnight wallet | Pays NIGHT / dust transaction fees |
| User CKB wallet | Pays CKB Spore capacity and transaction fees |

## Configuration

Copy `.env.example` to `.env` and fill in all required values.

### Required

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string, e.g. `mongodb://localhost:27017/veil_backend` |
| `VEIL_BACKEND_WALLET_SEED` | 64-character hex seed for the backend wallet. Must hold enough NIGHT and dust tokens to cover transaction fees. |
| `VEIL_PROOF_SERVER_URL` | HTTP URL of the Midnight proof server, e.g. `http://127.0.0.1:6300` |
| `CKB_NETWORK` | Must be `testnet` for the current Veil Identity DOB milestone. |
| `CKB_RPC_URL` | CKB testnet RPC URL, e.g. `https://testnet.ckb.dev/rpc`. |
| `VEIL_SBT_LOCK_CODE_HASH` | Deployed `veil_sbt_lock` code hash. |
| `VEIL_SBT_LOCK_HASH_TYPE` | Deployed `veil_sbt_lock` hash type, e.g. `data2`. |
| `VEIL_SBT_LOCK_TX_HASH` | Transaction hash containing the deployed `veil_sbt_lock` cell dep. |
| `VEIL_SBT_LOCK_INDEX` | Output index for the deployed `veil_sbt_lock` cell dep. |
| `MIDNIGHT_NETWORK` | Midnight network name recorded in immutable DOB metadata, e.g. `testnet`. |
| `MIDNIGHT_CONTRACT_ADDRESS` | Midnight contract address recorded in immutable DOB metadata. Optional when `VEIL_AUTO_DEPLOY=true`; the backend fills it from the deployed contract at startup. |

### Optional

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Port the HTTP server listens on. |
| `MONGODB_DB_NAME` | `veil_backend` | MongoDB database name. |
| `VEIL_CONTRACT_ADDRESS` | — | Existing deployed Veil contract address. If omitted and no saved deployment exists, set `VEIL_AUTO_DEPLOY=true`. |
| `VEIL_AUTO_DEPLOY` | `false` | Deploy a new Veil Midnight contract from the backend wallet when no configured/saved contract address exists. |
| `VEIL_ZK_CONFIG_PATH` | `dist/contract-build/managed/veil-protocol` | Path to compiled ZK circuit configs. Usually leave unset in production because the Docker image includes them in `dist/contract-build`. |
| `LOG_LEVEL` | `info` | Pino log level: `trace`, `debug`, `info`, `warn`, `error`. |
| `NODE_ENV` | — | Set to `production` to disable pretty-printed logs. |
| `CKB_INDEXER_URL` | Spore testnet default | Optional CKB indexer URL used by Spore read/construct flows. |

### Network settings

The backend connects to the Midnight network selected by `MIDNIGHT_NETWORK`.
Supported values are `preview`, `preprod`, and `mainnet`.

## Setup

**1. Start MongoDB**

```bash
# First run
docker run -d --name veil-mongo -p 27017:27017 -v veil_mongo_data:/data/db mongo:7

# Subsequent runs
docker start veil-mongo
```

**2. Start the proof server**

Follow the Midnight proof server documentation. Verify it is reachable at `VEIL_PROOF_SERVER_URL` before starting the backend.

**3. Fund the wallets**

Derive the Midnight wallet address from the seed and transfer NIGHT and dust tokens from a preprod faucet or another funded account. Users must fund their own CKB testnet wallets with enough CKB to mint the Veil Identity Spore/DOB and pay fees.

**4. Configure environment**

```bash
cp .env.example .env
# Edit .env and fill in all required values
```

To deploy the Midnight contract from the backend wallet, leave `VEIL_CONTRACT_ADDRESS` empty and set:

```env
VEIL_AUTO_DEPLOY=true
```

The backend deploys once, persists the active address in MongoDB collection `veil_contract_deployments`, and joins that saved address on later restarts. The deployment private state is created from `VEIL_BACKEND_WALLET_SEED`, so the same backend wallet secret derives the contract `superAdmin`.

Before auto-deploying, compile deployable contract artifacts:

```bash
bun --filter @veil/veil-contract compile
```

Do not use `test:compile` for backend deployment because it uses `--skip-zk`. The backend also refuses to auto-deploy if generated artifacts still expose deprecated PoT circuits, which prevents accidentally deploying the old Midnight NFT contract surface.

## Running

```bash
# Install dependencies (from monorepo root)
bun install

# Development — ts-node with hot reload
cd packages/backend
bun run dev

# Production build
bun run build
bun start
```

The server logs startup progress including MongoDB connection, contract initialization, and the port it is listening on.

## Docker Deployment

Build the backend image from the monorepo root so Docker can see the workspace lockfile and backend package:

```bash
docker build -f packages/backend/Dockerfile -t veil-backend .
```

Run it with a production env file:

```bash
docker run --name veil-backend \
  --env-file packages/backend/.env \
  -p 3001:3001 \
  veil-backend
```

For hosted deployment, set the same env vars in your hosting provider instead of passing `.env`. The minimum production dependencies are:

- A reachable MongoDB connection string in `MONGODB_URI`.
- A reachable Midnight proof server in `VEIL_PROOF_SERVER_URL`.
- A funded backend Midnight wallet seed in `VEIL_BACKEND_WALLET_SEED`.
- `MIDNIGHT_NETWORK` matching the network where the contract is deployed.
- `VEIL_CONTRACT_ADDRESS`, or `VEIL_AUTO_DEPLOY=true` for the first backend-owned deployment.
- CKB testnet lock script config for Spore/DOB verification.

After deployment, verify:

```bash
curl https://your-backend-domain.example/api/v1/health
curl https://your-backend-domain.example/api/v1/contract
```

Then update the Veil UI:

```env
NEXT_PUBLIC_BACKEND_URL=https://your-backend-domain.example/api/v1
NEXT_PUBLIC_CONTRACT_ADDRESS=<value returned by /api/v1/contract>
```

## Graceful shutdown

The server handles `SIGINT` and `SIGTERM` by:

1. Stopping the HTTP server from accepting new connections.
2. Stopping the ContractService and closing the indexer WebSocket.
3. Closing the MongoDB connection.

## MongoDB collections

| Collection | Contents |
|---|---|
| `veil_private_states` | Serialized contract private state, keyed by contract address and private state ID, scoped to the backend wallet account. |
| `veil_signing_keys` | Contract signing keys, keyed by contract address, scoped to the backend wallet account. |

Private state is serialized with SuperJSON to preserve `BigInt`, `Uint8Array`, and `Date` types.

## API reference

See [API.md](./API.md) for the full endpoint reference, request and response schemas, field type conventions, and curl examples.
