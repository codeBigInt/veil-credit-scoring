# Veil Backend

Express HTTP server that acts as the transaction gateway for the Veil credit-scoring protocol on the Midnight blockchain (preprod network). It receives scoring events and NFT operations from issuers and DeFi protocols, generates zero-knowledge proofs, and submits signed transactions to the on-chain Veil contract.

## Architecture

```
Client (issuer / DeFi protocol)
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
```

Contract calls are **synchronous** — each HTTP request waits for proof generation and on-chain confirmation before returning. Proof generation typically takes 15–60 seconds depending on the circuit.

## Prerequisites

| Dependency | Purpose |
|---|---|
| Node.js 20+ / Bun | Runtime |
| MongoDB 7 | Private state & signing key storage |
| Midnight proof server | ZK proof generation (provided by Midnight team) |
| Funded backend wallet | Pays NIGHT / dust transaction fees |

## Configuration

Copy `.env.example` to `.env` and fill in all required values.

### Required

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string, e.g. `mongodb://localhost:27017/veil_backend` |
| `VEIL_BACKEND_WALLET_SEED` | 64-character hex seed for the backend wallet. Must hold enough NIGHT and dust tokens to cover transaction fees. |
| `VEIL_CONTRACT_ADDRESS` | Hex address of the deployed Veil contract on preprod. |
| `VEIL_PROOF_SERVER_URL` | HTTP URL of the Midnight proof server, e.g. `http://127.0.0.1:6300` |

### Optional

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Port the HTTP server listens on. |
| `MONGODB_DB_NAME` | `veil_backend` | MongoDB database name. |
| `VEIL_ZK_CONFIG_PATH` | `../contract/src/managed/veil-protocol` | Path to compiled ZK circuit configs relative to the backend package root. |
| `LOG_LEVEL` | `info` | Pino log level: `trace`, `debug`, `info`, `warn`, `error`. |
| `NODE_ENV` | — | Set to `production` to disable pretty-printed logs. |

### Hard-coded network settings

The backend always connects to the Midnight **preprod** testnet:

- Indexer: `https://indexer.preprod.midnight.network/api/v4/graphql`
- Node RPC: `https://rpc.preprod.midnight.network`

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

**3. Fund the backend wallet**

Derive the wallet address from the seed and transfer NIGHT and dust tokens from a preprod faucet or another funded account.

**4. Configure environment**

```bash
cp .env.example .env
# Edit .env and fill in all required values
```

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
