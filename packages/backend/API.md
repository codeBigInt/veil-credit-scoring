# Veil Backend v2 API

The v2 backend is not a scoring oracle and does not submit reputation or identity transactions for users.
Those flows live in `@veil-reputation-protocol/sdk` and the Midnight contract.

The backend has three responsibilities:

- Contract deployment/address discovery for the Veil Midnight contract.
- DUST sponsorship for first-time Midnight transactions.
- Optional encrypted backup storage for private state exports and wallet metadata.

Base path:

```text
/api/v1
```

## Endpoints

### `GET /health`

Returns service status and enabled backend scopes.

```json
{
  "success": true,
  "service": "veil-backend",
  "version": "v2",
  "scope": ["contract_deployment", "dust_sponsorship", "client_backup"]
}
```

### `GET /contract`

Returns the active Veil Midnight contract address. The address can come from `VEIL_CONTRACT_ADDRESS`,
from MongoDB's saved backend deployment record, or from a backend deployment.

```json
{
  "success": true,
  "contractAddress": "91e6...",
  "backendRole": "contract-deployer-dust-sponsor-and-backup",
  "deploymentEnabled": true
}
```

### `POST /contract/deploy`

Deploys the single Veil v2 contract. This route is idempotent: if an address is already active, it returns that address.

The route is disabled unless `VEIL_AUTO_DEPLOY=true`.

```json
{
  "success": true,
  "contractAddress": "91e6...",
  "deployed": true
}
```

### `POST /sponsor/dust`

Requests backend DUST generation for a user DUST address. When the client can estimate the
transaction fee, send `requiredDust` as a decimal string. The sponsor wallet selects enough free
unregistered NIGHT UTxOs to cover that budget.

`POST /dust-sponsor` remains as a compatibility alias.

The allocation is intentionally short-lived. By default the backend attempts to reclaim sponsor
UTxOs after 10 minutes so the sponsor pool can recycle capacity instead of locking one UTxO for
an entire day.

```json
{
  "dustAddress": "mn_dust_preview1...",
  "requiredDust": "123456",
  "scope": "Identity_register"
}
```

`scope` is required by SDK clients and must be one of:

- `Identity_register`
- `Reputation_prove`

The backend intentionally does not sponsor governance/admin traffic or general contract writes.

Response:

```json
{
  "success": true,
  "sponsored": true,
  "txId": "...",
  "selectedUtxos": 1,
  "requiredDust": "123456",
  "estimatedGeneratedDust": "123456",
  "registrationFee": "...",
  "expiresAt": "2026-06-28T04:38:51.000Z",
  "reused": false
}
```

If no free NIGHT UTxOs are available:

```json
{
  "success": true,
  "sponsored": false,
  "reason": "Free DUST sponsorship is temporarily unavailable. Please try again shortly.",
  "retryable": true,
  "sponsor": {
    "available": false,
    "allocationTtlMs": 600000,
    "reclaimIntervalMs": 60000,
    "capacity": {
      "availableCoins": 10,
      "freeNightUtxos": 0,
      "registeredUtxos": 10,
      "skippedNonNightUtxos": 0
    },
    "activeAllocations": 10,
    "expiringSoon": 10,
    "expiredAllocations": 0,
    "reclaimingAllocations": 0,
    "failedReclaimAllocations": 0
  }
}
```

Successful sponsorships are recorded by the backend and reclaimed automatically after
`VEIL_SPONSOR_ALLOCATION_TTL_MS` when the reclaim loop is enabled.

### `GET /sponsor/status`

Returns current sponsor-pool capacity so clients can display a clear temporary-unavailable message
before the user attempts an on-chain write.

The sponsor pool can also be rate-limited. Rate-limited requests return HTTP `429` with a public
message telling the user to retry later or use their own DUST.
before starting a registration flow.

```json
{
  "success": true,
  "sponsor": {
    "available": true,
    "allocationTtlMs": 600000,
    "reclaimIntervalMs": 60000,
    "capacity": {
      "availableCoins": 12,
      "freeNightUtxos": 4,
      "registeredUtxos": 8,
      "skippedNonNightUtxos": 0
    },
    "activeAllocations": 8,
    "expiringSoon": 8
  }
}
```

### `PUT /backups/:backupId`

Stores an encrypted client-side backup. The backend treats `payload` as opaque data and must not receive
raw private keys, seed phrases, or plaintext private state.

```json
{
  "owner": "0x...",
  "kind": "private_state",
  "version": 1,
  "metadata": {
    "network": "preview",
    "contractAddress": "91e6..."
  },
  "payload": {
    "ciphertext": "...",
    "iv": "...",
    "kdf": "..."
  }
}
```

Supported `kind` values:

- `private_state`
- `wallet_metadata`
- `wallet_export`

### `GET /backups/:backupId?owner=<owner>`

Returns a single encrypted backup payload.

### `GET /backups?owner=<owner>`

Lists backup metadata for an owner. Payloads are omitted.

### `DELETE /backups/:backupId?owner=<owner>`

Deletes a backup.

## Deprecated v1 Surfaces

These endpoints are removed from the v2 router:

- `/credit-decisions`
- `/score-entries`
- `/challenges`
- `/ckb/veil-identity/*`
- issuer/admin scoring event endpoints

Use the SDK for identity registration, reputation proof submission, and reputation checks.
