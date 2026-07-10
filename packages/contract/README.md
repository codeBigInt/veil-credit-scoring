# Veil v2 Reputation Contract

Compact smart contract for Veil v2: a private, band-based reputation layer on Midnight.

Veil v2 is not a credit-scoring contract. It has no issuer registry, no admin issuer approval, no repayment/liquidation event feed, and no user-facing Spore DOB flow. Users register a Veil identity, submit privately committed reputation signals, and expose only a reputation band or threshold decision to integrators.

## Package Layout

- [`src/main.compact`](./src/main.compact): exported v2 contract entrypoint.
- [`src/modules/Identity.compact`](./src/modules/Identity.compact): permissionless identity registration.
- [`src/modules/Reputation.compact`](./src/modules/Reputation.compact): reputation proof submission and threshold checks.
- [`src/modules/Governance.compact`](./src/modules/Governance.compact): timelocked score-config governance through a Phase 1 guardian-council controller commitment.
- [`src/modules/Utils.compact`](./src/modules/Utils.compact): canonical hash derivation and internal invariants.
- [`src/witness.ts`](./src/witness.ts): private reputation state and Merkle path witnesses.
- [`SECURITY.md`](./SECURITY.md): security model, external verification boundary, and audit checklist.

## Constructor

```compact
constructor(
  _scoreConfig: CustomStructs_ScoreConfig,
  _governanceGuardianSetHash: Bytes<32>,
  _governanceGuardianThreshold: Uint<8>,
  _governanceControllerVersion: Uint<64>,
  _configTimelockEpochs: Uint<64>,
)
```

- `_scoreConfig`: initial scoring weights and band thresholds.
- `_governanceGuardianSetHash`: hash of the sorted Phase 1 guardian public keys / attestor identifiers.
- `_governanceGuardianThreshold`: minimum guardian attestations required by the off-chain/verifier path, for example `3` for a 3-of-5 council.
- `_governanceControllerVersion`: version for rotating guardian-controller semantics without reusing old commitments.
- `_configTimelockEpochs`: delay before a proposed score config can be applied.

The constructor derives `governanceControllerCommitment` from the guardian set hash, threshold, and controller version. It validates score bounds, rejects a zero guardian set, and rejects a zero threshold.

## Exported Circuits

The contract currently has 7 provable circuits: the identity, reputation, and governance entrypoints. Derivation helpers, including `Utils_deriveVeilId`, are generated under `pureCircuits`, so SDKs can use the canonical Compact implementation without installing verifier keys for those helpers.

### Identity

`Identity_register(...) -> VeilIdentityRecord`

Registers a new identity. The contract stores a public identity record and a commitment, while replay-protecting the domain-separated identity proof.

Parameters:

- `_veilIdHash`
- `_chainNamespace`
- `_publicKeyOrLockHashCommitment`
- `_walletSignatureHash`
- `_currentEpoch`

`Identity_assertActive(_veilIdHash) -> Boolean`

Checks that an identity exists and has active status.

### Reputation

`Reputation_prove(...) -> Uint<8>`

Stores or updates a private reputation score and returns the accepted band.

It verifies:

- identity exists and is active
- chain commitments are present
- signal values are bounded
- witness commitment matches submitted inputs
- proof hash binds the witness commitment, claimed band, current score config, nonce, and contract address
- nonce and proof hash have not been replayed
- claimed band matches the computed private score interval
- raw score does not exceed `maxScore`

`Reputation_check(...) -> ReputationDecision`

Checks whether a user meets an integrator's requested minimum band. It returns band, threshold result, access tier, and community weight. It does not expose raw score inputs.

### Governance

`Governance_proposeScoreConfig(...)`

Queues a score-config update if the operation id, signature-bundle hash, and governance nonce pass the configured guardian-council controller binding.

`Governance_applyScoreConfig(_currentEpoch)`

Applies the pending config after the timelock expires. Anyone can call this once the proposal is executable.

`Governance_cancelScoreConfig(...)`

Cancels a pending config if the guardian-council operation proof binding matches the configured controller.

## Pure Helper Circuits

The utility surface is intentionally kept out of the deployable circuit set when the helper can be pure:

- `Utils_deriveVeilId`

`Utils_deriveVeilId` takes the deployed contract address explicitly instead of reading `kernel.self()`, so it can be called through generated `pureCircuits`. It does not require verifier-key installation and is not part of the deployable circuit surface.

## Circuit Argument Audit

The v2 circuit argument lists are intentionally explicit. No argument was removed in the latest audit because each external argument is used by at least one of these invariants:

| Circuit | Arguments retained because |
|---|---|
| `Identity_register` | `veilIdHash`, chain namespace, lock/public-key commitment, wallet signature hash, and epoch are stored or bound into the contract-derived identity proof/replay key. |
| `Reputation_prove` | Signal values compute the private score; chain commitments prevent empty source data; witness salt, proof nonce, and claimed band are replay and proof-binding inputs; epoch records freshness. |
| `Reputation_check` | Requester hash, purpose hash, minimum band, and epoch bind the decision to an integrator policy request. |
| `Governance_proposeScoreConfig` | New config, epoch, operation id, signature-bundle hash, and nonce bind the proposed config to the guardian-council proof and timelock. |
| `Governance_applyScoreConfig` | Current epoch is required to enforce the timelock. |
| `Governance_cancelScoreConfig` | Operation id, signature-bundle hash, and nonce bind cancellation to a fresh guardian-council operation. |

## Private State

Private state is stored by `veilIdHash`:

```ts
reputationScores: Record<string, ReputationScore>
```

The on-chain ledger stores identity records, commitment trees, replay keys, active score config, guardian controller fields, the derived governance controller commitment, and pending governance config.

## Security Boundary

This contract verifies domain-separated proof bindings and private score/band consistency. It does not include native secp256k1/secp256r1/EdDSA wallet signature verification primitives. The SDK/prover path must verify raw wallet signatures and construct the accepted identity proof hash.

See [`SECURITY.md`](./SECURITY.md) for the full production gate.

## Development

From repository root:

```bash
bun install
bun run --filter @veil/veil-contract test:compile
bun run --filter @veil/veil-contract test:run
```

From `packages/contract`:

```bash
bun run test:compile
bun run test:run
```

`test:compile` compiles the contract with `--skip-zk`:

```bash
compact compile --skip-zk src/main.compact ./src/managed/veil-protocol
```

For deployable artifacts:

```bash
bun run compile
bun run build
```

## Test Coverage Snapshot

Current tests cover:

- v1 admin/issuer/Spore surfaces are absent
- identity registration
- malformed identity rejection
- reputation update and check
- replayed reputation nonce rejection
- incorrect claimed band rejection
- replayed proof nonce/hash rejection
- governance timelock behavior
- forged governance controller proof rejection
