# Veil Backend — API Reference

HTTP API for submitting credit-scoring events and NFT operations to the Veil protocol on Midnight preprod.

## Base URL

```
http://localhost:3001/api/v1        # local development
https://<backend-host>/api/v1       # production
```

## How it works

Every transaction endpoint (`POST`) is **synchronous**. The server:

1. Validates the request body.
2. Passes the inputs to the on-chain Veil contract circuit.
3. Generates a ZK proof via the proof server (15–60 seconds per circuit).
4. Balances and signs the transaction with the backend wallet.
5. Submits the transaction to Midnight preprod and waits for confirmation.
6. Returns the result — including the transaction hash — in a single response.

There is no job polling. If your HTTP client times out, increase the request timeout to at least **120 seconds**.

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

### Generate verification challenge

```
POST /challenges
```

Generates a fresh 32-byte random challenge and a 60-second expiry timestamp. Use this before calling `POST /pot-nft/verifications` when the issuer or user needs to sign or display the challenge value before sending it to the backend.

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

### Create score entry

```
POST /score-entries
```

Calls the `Scoring_createScoreEntry` circuit. Registers an initial on-chain credit score accumulator for a user who has not been seen before. Must be called before any scoring event can be submitted for that user.

**Request body**

```json
{
  "userPk": "aabbcc..."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `userPk` | hex string | yes | The user's Veil public key (derived from the user's secret key via `Utils_generateUserPk`). |

**Response `200`**

```json
{
  "success": true,
  "result": {
    "circuit": "Scoring_createScoreEntry",
    "contractAddress": "7c7d7b...",
    "txHash": "a1b2c3..."
  }
}
```

| Field | Type | Description |
|---|---|---|
| `circuit` | string | Name of the Compact circuit that was executed. |
| `contractAddress` | hex string | Address of the Veil contract the transaction was submitted to. |
| `txHash` | hex string \| undefined | Transaction hash on Midnight preprod. May be absent if the indexer did not return one. |

---

### Verify PoT NFT

```
POST /pot-nft/verifications
```

Calls the `NFT_verifyPoTNFT` circuit. Verifies that a user holds a valid Proof-of-Trust NFT. The issuer provides its public key, the user's public key, and the user's ownership secret.

If `challenge` and `challengeExpiresAt` are omitted the backend generates them automatically, but they will not be visible to the client or the user. Call `POST /challenges` first when the challenge value needs to be presented to the user or signed off-chain before verification.

**Request body**

```json
{
  "issuerPk": "112233...",
  "userPk": "aabbcc...",
  "ownershipSecret": "998877...",
  "challenge": "8f6c2a...",
  "challengeExpiresAt": "1777285341000"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `issuerPk` | hex string | yes | The issuer's public key. |
| `userPk` | hex string | yes | The user's Veil public key. |
| `ownershipSecret` | hex string | yes | The user's ownership secret used by the verification circuit. |
| `challenge` | hex string | no | 32-byte challenge. Defaults to a fresh backend-generated random value. |
| `challengeExpiresAt` | decimal string | no | Expiry in Unix milliseconds. Defaults to current server time + 60 000 ms. |

**Response `200`** — same shape as [Create score entry](#create-score-entry), with `circuit: "NFT_verifyPoTNFT"`.

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

**Response `200`** — same shape as [Create score entry](#create-score-entry), with `circuit: "Scoring_submitRepaymentEvent"`.

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

**Response `200`** — same shape as [Create score entry](#create-score-entry), with `circuit: "Scoring_submitLiquidationEvent"`.

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

**Response `200`** — same shape as [Create score entry](#create-score-entry), with `circuit: "Scoring_submitProtocolUsageEvent"`.

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

**Response `200`** — same shape as [Create score entry](#create-score-entry), with `circuit: "Scoring_submitDebtStateEvent"`.

---

## Typical integration flow

```
1.  GET  /health                          — confirm backend is up

2.  POST /score-entries                   — register the user on-chain (once per user)
        { userPk }

3.  POST /scoring-events/repayments       — submit repayment data after each loan
        { userPk, issuerPk, paidOnTimeFlag, amountWeight, eventEpoch }

4.  POST /scoring-events/liquidations     — submit liquidation data if a position is liquidated
        { userPk, issuerPk, severity, eventEpoch }

5.  POST /scoring-events/protocol-usage   — record each new protocol the user interacts with
        { userPk, issuerPk, protocolId, eventEpoch }

6.  POST /scoring-events/debt-states      — snapshot the user's debt state each epoch
        { userPk, issuerPk, activeDebtFlag, riskBand, eventEpoch }

7.  POST /challenges                      — get a fresh challenge before NFT verification
8.  POST /pot-nft/verifications           — verify the user's PoT NFT
        { issuerPk, userPk, ownershipSecret, challenge, challengeExpiresAt }
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
  -d '{"userPk":"aabbccddeeff..."}'
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

**Get a challenge then verify PoT NFT**

```bash
CHALLENGE_RESP=$(curl -s -X POST http://localhost:3001/api/v1/challenges)
CHALLENGE=$(echo $CHALLENGE_RESP | jq -r '.challenge')
EXPIRES_AT=$(echo $CHALLENGE_RESP | jq -r '.challengeExpiresAt')

curl -X POST http://localhost:3001/api/v1/pot-nft/verifications \
  -H 'Content-Type: application/json' \
  -d "{
    \"issuerPk\": \"112233445566...\",
    \"userPk\": \"aabbccddeeff...\",
    \"ownershipSecret\": \"998877665544...\",
    \"challenge\": \"$CHALLENGE\",
    \"challengeExpiresAt\": \"$EXPIRES_AT\"
  }"
```
