# Veil Backend — API Reference

HTTP API for submitting credit-scoring events to the Veil protocol on Midnight preprod and preparing user-signed CKB Spore/DOB identity anchors.

## Base URL

```
http://localhost:3001/api/v1        # local development
https://<backend-host>/api/v1       # production
```

## How it works

Midnight transaction endpoints are queued. The server:

1. Validates the request body.
2. Passes the inputs to the on-chain Veil contract circuit.
3. Generates a ZK proof via the proof server (15–60 seconds per circuit).
4. Balances and signs the transaction with the backend wallet.
5. Submits the transaction to Midnight preprod and waits for confirmation.
6. Updates the queued job result with the Midnight transaction response.

CKB Spore/DOB minting is not backend-funded. The backend returns an immutable mint intent, the user's CKB wallet constructs/signs/sends the Spore transaction, then the app records the minted Spore ID with the backend.

## Data conventions

| Type | Wire format | Example |
|---|---|---|
| Byte arrays | Lowercase hex string, no `0x` prefix | `"aabbccdd..."` |
| `BigInt` / `Uint` integers | Decimal string (recommended) or JSON number | `"1777285281000"` |
| Timestamps | Unix milliseconds as decimal string | `"1777285341000"` |

## Response envelope

All responses share the same outer shape.

**Success**

```json
{
  "success": true,
  "result": { ... }
}
```

**Error**

```json
{
  "success": false,
  "message": "description of what went wrong"
}
```

## HTTP status codes

| Code | Meaning |
|---|---|
| `200 OK` | Request succeeded. |
| `201 Created` | Challenge generated. |
| `202 Accepted` | Transaction job accepted. Poll the returned job endpoint if the client needs completion details. |
| `500 Internal Server Error` | Validation failure, proof error, or chain submission failure. The `message` field contains the reason. |

---

## Endpoints

### Health check

```
GET /health
```

Returns the service status. Use this to verify the backend is running and reachable before making transaction calls.

**Response `200`**

```json
{
  "success": true,
  "service": "veil-backend",
  "version": "v1"
}
```

---

### Contract info

```
GET /contract
```

Returns the active Midnight Veil contract address managed by this backend. If `VEIL_AUTO_DEPLOY=true`, this is the address deployed by the backend wallet and persisted in MongoDB.

**Response `200`**

```json
{
  "success": true,
  "contractAddress": "7c7d7b...",
  "superAdminSource": "VEIL_BACKEND_WALLET_SEED"
}
```

---

### Generate verification challenge

```
POST /challenges
```

Generates a fresh 32-byte random challenge and a 60-second expiry timestamp for off-chain user authorization flows.

**Request body** — none required.

**Response `201`**

```json
{
  "challenge": "8f6c2a...",
  "challengeExpiresAt": "1777285341000"
}
```

| Field | Type | Description |
|---|---|---|
| `challenge` | hex string | 32-byte random challenge. |
| `challengeExpiresAt` | decimal string | Unix milliseconds when the challenge expires (current time + 60 000 ms). |

---

### Create credit decision

```
POST /credit-decisions
```

Returns a minimized user-authorized risk decision. This endpoint never accepts the user's Midnight secret key and never returns raw credit score state, score accumulators, repayment history, or private behavior data.

The user signs this exact message with their CKB wallet:

```text
Veil credit decision authorization
challenge:<challenge>
userPk:<userPk>
veilIdHash:<veilIdHash>
sporeId:<sporeId>
```

**Request body**

```json
{
  "userPk": "aabbcc...",
  "veilIdHash": "0x...",
  "sporeId": "0x...",
  "userCkbAddress": "ckt...",
  "challenge": "8f6c2a...",
  "authorization": {
    "signature": "0x...",
    "identity": "0x...",
    "signType": "CkbSecp256k1"
  }
}
```

**Response `200`**

```json
{
  "success": true,
  "approved": true,
  "scoreBand": "gold",
  "maxLtvBps": 7000,
  "riskPremiumBps": 150,
  "hasCreditScore": true,
  "reason": "Credit score meets gold risk policy.",
  "veilIdHash": "0x...",
  "validAt": "2026-06-06T10:20:30.000Z"
}
```

Verification performed:
- challenge is single-use and unexpired
- Spore/DOB exists and matches `veilIdHash`
- DOB lock matches deployed `veil_sbt_lock`
- `userCkbAddress` matches the DOB `ownerCkbLockHash`
- wallet signature validates against the canonical message
- for `CkbSecp256k1`, the signature public key derives to the same CKB owner lock

---

### Get score entry status

```
GET /score-entries/:userPk
```

Checks the backend MongoDB private state for an existing score entry for the user's stable Veil public key. Use this before creating a score entry so existing users do not submit a duplicate `Scoring_createScoreEntry` transaction.

Optional query params:

| Field | Type | Description |
|---|---|---|
| `userCkbAddress` | string | If supplied and the score entry exists, the response includes a CKB Veil Identity DOB mint intent. |
| `veilIdHash` | 0x-prefixed hex string | Optional precomputed Veil ID hash. Defaults to `sha256(userPk)`. |

**Response `200`**

```json
{
  "success": true,
  "userPk": "aabbcc...",
  "veilIdHash": "0x...",
  "scoreEntry": {
    "exists": true,
    "hasAccumulator": true,
    "hasCreditScore": false
  },
  "ckbDob": {
    "veilIdHash": "0x...",
    "sporeId": "0x...",
    "txHash": "0x..."
  },
  "ckbMintIntent": {
    "contentType": "application/json",
    "content": {}
  }
}
```

---

### Create score entry

```
POST /score-entries
```

Calls the `Scoring_createScoreEntry` circuit only if the backend private state does not already contain a score entry for `userPk`. Registers an initial on-chain credit score accumulator for a user who has not been seen before. Must be called before any scoring event can be submitted for that user. The response job result also includes a CKB Veil Identity DOB mint intent that the user's CKB wallet signs and pays for.

**Request body**

```json
{
  "userPk": "aabbcc...",
  "userCkbAddress": "ckt..."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `userPk` | hex string | yes | The user's Veil public key (derived from the user's secret key via `Utils_generateUserPk`). |
| `userCkbAddress` | string | yes | User's CKB testnet address. The backend derives its lock hash and binds the Veil Identity DOB lock args to it. |
| `veilIdHash` | 0x-prefixed hex string | no | 32-byte hash of the Veil ID. Defaults to `sha256(userPk)` if omitted. |

**Response `202`**

```json
{
  "success": true,
  "job": {
    "id": "01HZ...",
    "status": "queued"
  }
}
```

If the score entry already exists, the backend returns `200` instead of submitting a duplicate transaction:

```json
{
  "success": true,
  "created": false,
  "scoreEntry": {
    "exists": true,
    "hasAccumulator": true,
    "hasCreditScore": false
  },
  "ckbDob": {
    "veilIdHash": "0x...",
    "sporeId": "0x...",
    "txHash": "0x..."
  },
  "ckbMintIntent": {}
}
```

If `ckbDob` is present, the Veil Identity DOB has already been minted for that `veilIdHash`; clients must display the existing DOB and skip reminting.

---

### Submit repayment event

```
POST /scoring-events/repayments
```

Calls the `Scoring_submitRepaymentEvent` circuit. Records a loan repayment outcome for a user and updates their on-chain score accumulators.

**Request body**

```json
{
  "userPk": "aabbcc...",
  "issuerPk": "112233...",
  "paidOnTimeFlag": "1",
  "amountWeight": "75",
  "eventEpoch": "42",
  "eventId": "0f0e0d..."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `userPk` | hex string | yes | The user's Veil public key. |
| `issuerPk` | hex string | yes | The issuer's public key. |
| `paidOnTimeFlag` | decimal string | yes | `"1"` if the repayment was on time, `"0"` if late. |
| `amountWeight` | decimal string | yes | Weighted repayment volume in protocol-defined units. |
| `eventEpoch` | decimal string | yes | The epoch number in which this repayment occurred. |
| `eventId` | hex string | no | Unique 32-byte identifier for this event (replay protection). Backend generates one if omitted. |

**Response `202`** — same queued job shape as [Create score entry](#create-score-entry), with a completed job result for `circuit: "Scoring_submitRepaymentEvent"`.

---

### Submit liquidation event

```
POST /scoring-events/liquidations
```

Calls the `Scoring_submitLiquidationEvent` circuit. Records a liquidation event for a user and applies the corresponding penalty to their score accumulators.

**Request body**

```json
{
  "userPk": "aabbcc...",
  "issuerPk": "112233...",
  "severity": "3",
  "eventEpoch": "42",
  "eventId": "0f0e0d..."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `userPk` | hex string | yes | The user's Veil public key. |
| `issuerPk` | hex string | yes | The issuer's public key. |
| `severity` | decimal string | yes | Liquidation severity level as defined by the protocol config. |
| `eventEpoch` | decimal string | yes | The epoch number in which this liquidation occurred. |
| `eventId` | hex string | no | Unique 32-byte event identifier. Backend generates one if omitted. |

**Response `202`** — same queued job shape as [Create score entry](#create-score-entry), with a completed job result for `circuit: "Scoring_submitLiquidationEvent"`.

---

### Submit protocol usage event

```
POST /scoring-events/protocol-usage
```

Calls the `Scoring_submitProtocolUsageEvent` circuit. Records that a user interacted with a specific DeFi protocol, contributing to their protocol diversity score.

**Request body**

```json
{
  "userPk": "aabbcc...",
  "issuerPk": "112233...",
  "protocolId": "556677...",
  "eventEpoch": "42"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `userPk` | hex string | yes | The user's Veil public key. |
| `issuerPk` | hex string | yes | The issuer's public key. |
| `protocolId` | hex string | yes | Unique 32-byte identifier for the DeFi protocol. |
| `eventEpoch` | decimal string | yes | The epoch number in which this interaction occurred. |

**Response `202`** — same queued job shape as [Create score entry](#create-score-entry), with a completed job result for `circuit: "Scoring_submitProtocolUsageEvent"`.

---

### Submit debt state event

```
POST /scoring-events/debt-states
```

Calls the `Scoring_submitDebtStateEvent` circuit. Records the current debt state and risk classification of a user.

**Request body**

```json
{
  "userPk": "aabbcc...",
  "issuerPk": "112233...",
  "activeDebtFlag": "1",
  "riskBand": "2",
  "eventEpoch": "42",
  "eventId": "0f0e0d..."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `userPk` | hex string | yes | The user's Veil public key. |
| `issuerPk` | hex string | yes | The issuer's public key. |
| `activeDebtFlag` | decimal string | yes | `"1"` if the user currently has active debt, `"0"` otherwise. |
| `riskBand` | decimal string | yes | Risk classification band as defined by the protocol score config. |
| `eventEpoch` | decimal string | yes | The epoch number of this debt state snapshot. |
| `eventId` | hex string | no | Unique 32-byte event identifier. Backend generates one if omitted. |

**Response `202`** — same queued job shape as [Create score entry](#create-score-entry), with a completed job result for `circuit: "Scoring_submitDebtStateEvent"`.

---

## CKB Veil Identity DOB

### Create Veil Identity DOB mint intent

`POST /ckb/veil-identity/mint-intent`

Builds the immutable Spore/DOB content and lock script for the user's wallet. This endpoint does not sign, send, fund, or mint the CKB transaction.

```json
{
  "veilIdHash": "0x...",
  "userCkbAddress": "ckt..."
}
```

**Response `200`**

```json
{
  "success": true,
  "intent": {
    "contentType": "application/json",
    "content": {
      "protocol": "Veil",
      "objectType": "VeilIdentity",
      "veilIdHash": "0x...",
      "ownerCkbLockHash": "0x...",
      "midnightNetwork": "testnet",
      "midnightContract": "0x...",
      "version": "1"
    },
    "lockScript": {
      "codeHash": "0x...",
      "hashType": "data2",
      "args": "0x..."
    },
    "cellDeps": [
      {
        "outPoint": {
          "txHash": "0x...",
          "index": "0x0"
        },
        "depType": "code"
      }
    ]
  }
}
```

### Record minted Veil Identity DOB

`POST /ckb/veil-identity/record`

After the user's CKB wallet sends the Spore transaction, this endpoint verifies the minted Spore content and lock script, then stores the backend mapping.

```json
{
  "veilIdHash": "0x...",
  "userCkbAddress": "ckt...",
  "sporeId": "0x...",
  "txHash": "0x..."
}
```

**Response `201`**

```json
{
  "success": true,
  "sporeId": "0x...",
  "txHash": "0x...",
  "veilIdHash": "0x..."
}
```

### Read Veil Identity DOB

`GET /ckb/veil-identity/:sporeId`

Fetches the Spore cell, decodes the JSON content, and verifies that it is a Veil identity anchor locked by the deployed `veil_sbt_lock`.

**Response `200`**

```json
{
  "sporeId": "0x...",
  "content": {
    "protocol": "Veil",
    "objectType": "VeilIdentity",
    "veilIdHash": "0x...",
    "ownerCkbLockHash": "0x...",
    "midnightNetwork": "testnet",
    "midnightContract": "0x...",
    "version": "1"
  },
  "validVeilIdentity": true
}
```

---

## Typical integration flow

```
1.  GET  /health                          — confirm backend is up

2.  POST /score-entries                   — register the user on Midnight and prepare a CKB DOB mint intent
        { userPk, userCkbAddress }

3.  User CKB wallet                       — signs and sends the Spore/DOB mint transaction

4.  POST /ckb/veil-identity/record        — verify and record the minted Spore/DOB
        { veilIdHash, userCkbAddress, sporeId, txHash }

5.  POST /challenges                      — get a single-use challenge for a score decision

6.  User CKB wallet                       — signs the canonical credit decision message

7.  POST /credit-decisions                — receive minimized score band and risk terms
        { userPk, veilIdHash, sporeId, userCkbAddress, challenge, authorization }

8.  POST /scoring-events/repayments       — submit repayment data after each loan
        { userPk, issuerPk, paidOnTimeFlag, amountWeight, eventEpoch }

9.  POST /scoring-events/liquidations     — submit liquidation data if a position is liquidated
        { userPk, issuerPk, severity, eventEpoch }

10. POST /scoring-events/protocol-usage   — record each new protocol the user interacts with
        { userPk, issuerPk, protocolId, eventEpoch }

11. POST /scoring-events/debt-states      — snapshot the user's debt state each epoch
        { userPk, issuerPk, activeDebtFlag, riskBand, eventEpoch }
```

---

## curl examples

**Check health**

```bash
curl http://localhost:3001/api/v1/health
```

**Register a new user**

```bash
curl -X POST http://localhost:3001/api/v1/score-entries \
  -H 'Content-Type: application/json' \
  -d '{"userPk":"aabbccddeeff...","userCkbAddress":"ckt..."}'
```

**Submit a repayment event**

```bash
curl -X POST http://localhost:3001/api/v1/scoring-events/repayments \
  -H 'Content-Type: application/json' \
  -d '{
    "userPk": "aabbccddeeff...",
    "issuerPk": "112233445566...",
    "paidOnTimeFlag": "1",
    "amountWeight": "75",
    "eventEpoch": "42"
  }'
```

**Submit a liquidation event**

```bash
curl -X POST http://localhost:3001/api/v1/scoring-events/liquidations \
  -H 'Content-Type: application/json' \
  -d '{
    "userPk": "aabbccddeeff...",
    "issuerPk": "112233445566...",
    "severity": "3",
    "eventEpoch": "42"
  }'
```

**Submit a protocol usage event**

```bash
curl -X POST http://localhost:3001/api/v1/scoring-events/protocol-usage \
  -H 'Content-Type: application/json' \
  -d '{
    "userPk": "aabbccddeeff...",
    "issuerPk": "112233445566...",
    "protocolId": "556677889900...",
    "eventEpoch": "42"
  }'
```

**Submit a debt state snapshot**

```bash
curl -X POST http://localhost:3001/api/v1/scoring-events/debt-states \
  -H 'Content-Type: application/json' \
  -d '{
    "userPk": "aabbccddeeff...",
    "issuerPk": "112233445566...",
    "activeDebtFlag": "1",
    "riskBand": "2",
    "eventEpoch": "42"
  }'
```

**Create a CKB Veil Identity DOB mint intent directly**

```bash
curl -X POST http://localhost:3001/api/v1/ckb/veil-identity/mint-intent \
  -H 'Content-Type: application/json' \
  -d '{
    "veilIdHash": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "userCkbAddress": "ckt..."
  }'
```

**Record a user-signed CKB Veil Identity DOB mint**

```bash
curl -X POST http://localhost:3001/api/v1/ckb/veil-identity/record \
  -H 'Content-Type: application/json' \
  -d '{
    "veilIdHash": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "userCkbAddress": "ckt...",
    "sporeId": "0x...",
    "txHash": "0x..."
  }'
```
