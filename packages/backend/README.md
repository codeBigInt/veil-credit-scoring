# Veil Backend API

Express API for submitting queued Veil contract transactions on Midnight preprod.

## Setup

Copy `.env.example` to `.env` and set:

- `MONGODB_URI`
- `VEIL_BACKEND_WALLET_SEED`
- `VEIL_CONTRACT_ADDRESS`
- `VEIL_PROOF_SERVER_URL`

The backend wallet must have enough NIGHT/dust liquidity to pay transaction fees. The MongoDB private-state provider stores both contract private state and contract signing keys scoped to the backend wallet account.

## Run

```bash
bun install
cd packages/backend
bun run dev
```

## Endpoints

- `GET /api/health`
- `POST /api/challenge`
- `GET /api/jobs/:id`
- `POST /api/score-entry`
- `POST /api/verify-pot-nft`
- `POST /api/events/repayment`
- `POST /api/events/liquidation`
- `POST /api/events/protocol-usage`
- `POST /api/events/debt-state`

Transaction endpoints return `202 Accepted` with a queued job id. Poll `GET /api/jobs/:id` for the transaction result.
