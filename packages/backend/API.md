# Veil Backend API Integration Guide

This document describes the backend HTTP API for integrating applications, issuers, and protocol services with the Veil credit scoring protocol on Midnight preprod.

## Base URL

Local development:

```text
http://localhost:3001/api/v1
```

Production and shared environments should expose the same versioned path:

```text
https://<backend-host>/api/v1
```

## Integration Flow

1. Check backend readiness with `GET /health`.
2. Create or update protocol state by calling the relevant resource endpoint.
3. Transaction endpoints return `202 Accepted` with a queued job record.
4. Read the returned `id`.
5. Poll `GET /jobs/{jobId}` until the job status is `succeeded` or `failed`.

The backend submits Midnight contract transactions asynchronously because proof generation and chain confirmation can take longer than a normal HTTP request lifecycle.

## Data Formats

All requests and responses use JSON.

Hex-encoded byte fields are sent as strings without a required `0x` prefix. Values that map to Compact `Uint` or JavaScript `bigint` are returned as decimal strings in JSON responses. Request integer fields can be sent as JSON numbers or decimal strings; decimal strings are recommended for large values.

Common byte fields:

| Field | Type | Description |
| --- | --- | --- |
| `userPk` | hex string | User public key or Veil identity public key expected by the contract circuit. |
| `issuerPk` | hex string | Issuer or protocol public key submitting or verifying data. |
| `eventId` | hex string, optional | Unique 32-byte id for replay protection. If omitted, the backend generates one. |
| `challenge` | hex string, optional | Unique 32-byte verification challenge. If omitted, the backend generates one. |
| `ownershipSecret` | hex string | Secret used by the PoT NFT verification circuit. |

## Job Object

Transaction endpoints return the same job shape as `GET /jobs/{jobId}`.

```json
{
  "id": "6c8cfa3d-6fd4-458c-8ad9-0c58dcbfef69",
  "name": "Scoring_createScoreEntry",
  "status": "queued",
  "createdAt": "2026-04-27T10:21:00.000Z",
  "updatedAt": "2026-04-27T10:21:00.000Z"
}
```

Possible statuses:

| Status | Meaning |
| --- | --- |
| `queued` | The transaction is waiting to be processed. |
| `running` | The backend is generating proof data and submitting the transaction. |
| `succeeded` | The contract call completed. The `result` field contains transaction metadata. |
| `failed` | The contract call failed. The `error` field contains the failure message. |

Successful job result example:

```json
{
  "id": "6c8cfa3d-6fd4-458c-8ad9-0c58dcbfef69",
  "name": "Scoring_createScoreEntry",
  "status": "succeeded",
  "createdAt": "2026-04-27T10:21:00.000Z",
  "updatedAt": "2026-04-27T10:21:18.000Z",
  "startedAt": "2026-04-27T10:21:01.000Z",
  "finishedAt": "2026-04-27T10:21:18.000Z",
  "result": {
    "circuit": "Scoring_createScoreEntry",
    "contractAddress": "0200...",
    "txHash": "..."
  }
}
```

## Errors

Validation and lookup errors use this shape:

```json
{
  "success": false,
  "message": "Job not found"
}
```

Common status codes:

| Status | Meaning |
| --- | --- |
| `200 OK` | Read request succeeded. |
| `201 Created` | Challenge was generated. |
| `202 Accepted` | Transaction job was queued. |
| `400 Bad Request` | Request body or parameters are invalid. |
| `404 Not Found` | Requested resource does not exist. |

## Endpoints

### Health Check

```http
GET /health
```

Response:

```json
{
  "success": true,
  "service": "veil-backend",
  "version": "v1"
}
```

### Generate Verification Challenge

```http
POST /challenges
```

Creates a fresh challenge for PoT NFT verification. The challenge expires after roughly 60 seconds.

Response `201 Created`:

```json
{
  "challenge": "8f6c...",
  "challengeExpiresAt": "1777285341000"
}
```

### Deploy Staged Contract

```http
POST /deployments/staged
```

Deploys the lightweight bootstrap contract, installs all full contract verifier keys, and joins the newly deployed full contract in the running backend process.

Optional request:

```json
{
  "nonce": "aabbcc...",
  "currentTime": "1777285281000"
}
```

Response `201 Created`:

```json
{
  "success": true,
  "result": {
    "contractAddress": "0200...",
    "installedCircuits": ["Utils_generateUserPk", "Scoring_createScoreEntry"]
  }
}
```

### Add Issuer

```http
POST /admin/issuers
```

Runs `Admin_addIssuer` on the currently joined contract. Use this before submitting scoring events, because random issuer keys are rejected by the contract.

Request:

```json
{
  "protocolName": "Aave",
  "contractAddress": "0200..."
}
```

`contractAddress` defaults to the currently joined Veil contract address if omitted.

### Get Job

```http
GET /jobs/{jobId}
```

Path parameters:

| Parameter | Type | Description |
| --- | --- | --- |
| `jobId` | UUID string | Job id returned by a transaction endpoint. |

Response `200 OK`: a job object.

### Create Score Entry

```http
POST /score-entries
```

Queues `Scoring_createScoreEntry`.

Request:

```json
{
  "userPk": "aabbcc..."
}
```

Response `202 Accepted`: queued job object.

### Verify PoT NFT

```http
POST /pot-nft/verifications
```

Queues `NFT_verifyPoTNFT`. Use `POST /challenges` first when the client needs to display or sign a challenge before verification.

Request:

```json
{
  "issuerPk": "112233...",
  "userPk": "aabbcc...",
  "challenge": "8f6c...",
  "challengeExpiresAt": "1777285341000",
  "ownershipSecret": "998877..."
}
```

Optional fields:

| Field | Default |
| --- | --- |
| `challenge` | Backend-generated 32-byte random value. |
| `challengeExpiresAt` | Current server time plus 60 seconds, in Unix milliseconds. |

Response `202 Accepted`: queued job object.

### Submit Repayment Event

```http
POST /scoring-events/repayments
```

Queues `Scoring_submitRepaymentEvent`.

Request:

```json
{
  "userPk": "aabbcc...",
  "issuerPk": "112233...",
  "paidOnTimeFlag": "1",
  "amountWeight": "75",
  "eventEpoch": "1777285281000",
  "eventId": "0f0e0d..."
}
```

`eventId` is optional. If omitted, the backend generates a unique 32-byte id.

Response `202 Accepted`: queued job object.

### Submit Liquidation Event

```http
POST /scoring-events/liquidations
```

Queues `Scoring_submitLiquidationEvent`.

Request:

```json
{
  "userPk": "aabbcc...",
  "issuerPk": "112233...",
  "severity": "3",
  "eventEpoch": "1777285281000",
  "eventId": "0f0e0d..."
}
```

`eventId` is optional.

Response `202 Accepted`: queued job object.

### Submit Protocol Usage Event

```http
POST /scoring-events/protocol-usage
```

Queues `Scoring_submitProtocolUsageEvent`.

Request:

```json
{
  "userPk": "aabbcc...",
  "issuerPk": "112233...",
  "protocolId": "556677...",
  "eventEpoch": "1777285281000"
}
```

Response `202 Accepted`: queued job object.

### Submit Debt State Event

```http
POST /scoring-events/debt-states
```

Queues `Scoring_submitDebtStateEvent`.

Request:

```json
{
  "userPk": "aabbcc...",
  "issuerPk": "112233...",
  "activeDebtFlag": "1",
  "riskBand": "2",
  "eventEpoch": "1777285281000",
  "eventId": "0f0e0d..."
}
```

`eventId` is optional.

Response `202 Accepted`: queued job object.

## Curl Examples

Create a score entry:

```bash
curl -X POST http://localhost:3001/api/v1/score-entries \
  -H 'Content-Type: application/json' \
  -d '{"userPk":"aabbcc"}'
```

Poll the queued transaction:

```bash
curl http://localhost:3001/api/v1/jobs/6c8cfa3d-6fd4-458c-8ad9-0c58dcbfef69
```

Generate a verification challenge:

```bash
curl -X POST http://localhost:3001/api/v1/challenges
```
