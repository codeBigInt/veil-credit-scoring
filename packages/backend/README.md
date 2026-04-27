# Veil Backend API

Express API for submitting queued Veil contract transactions on Midnight preprod.

## Setup

Copy `.env.example` to `.env` and set:

- `MONGODB_URI`
- `VEIL_BACKEND_WALLET_SEED`
- `VEIL_CONTRACT_ADDRESS`
- `VEIL_PROOF_SERVER_URL`

The backend wallet must have enough NIGHT/dust liquidity to pay transaction fees. The MongoDB private-state provider stores both contract private state and contract signing keys scoped to the backend wallet account.

For local development, start MongoDB before running the backend:

```bash
docker run -d --name veil-mongo -p 27017:27017 -v veil_mongo_data:/data/db mongo:7
```

If the container already exists, start it again with:

```bash
docker start veil-mongo
```

The proof server must also be reachable at `VEIL_PROOF_SERVER_URL`.

## Run

```bash
bun install
cd packages/backend
bun run dev
```

## API

Use the versioned API under `/api/v1`. See [API.md](./API.md) for the full integration guide, request schemas, response examples, and job polling flow.

Transaction endpoints return `202 Accepted` with a queued job id. Poll `GET /api/v1/jobs/:jobId` for the transaction result.
