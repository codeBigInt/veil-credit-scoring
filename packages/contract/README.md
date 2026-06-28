# Veil v2 Reputation Contract

Compact smart contract for Veil v2: a private, band-based reputation layer on Midnight.

Veil v2 is not a credit-scoring contract. It has no issuer registry, no admin issuer approval, no repayment/liquidation event feed, and no user-facing Spore DOB flow. Users register a Veil identity, submit privately committed reputation signals, and expose only a reputation band or threshold decision to integrators.

## Package Layout

- [`src/main.compact`](./src/main.compact): exported v2 contract entrypoint.
- [`src/bootstrap.compact`](./src/bootstrap.compact): staged-deployment bootstrap entrypoint with a smaller circuit surface for verifier-key installation.
- [`src/modules/Identity.compact`](./src/modules/Identity.compact): permissionless identity registration.
- [`src/modules/Reputation.compact`](./src/modules/Reputation.compact): reputation proof submission and threshold checks.
- [`src/modules/Governance.compact`](./src/modules/Governance.compact): timelocked score-config governance through a DAO/controller commitment.
- [`src/modules/Utils.compact`](./src/modules/Utils.compact): canonical hash derivation and internal invariants.
- [`src/witness.ts`](./src/witness.ts): private reputation state and Merkle path witnesses.
- [`SECURITY.md`](./SECURITY.md): security model, external verification boundary, and audit checklist.

## Constructor

```compact
constructor(
  _scoreConfig: CustomStructs_ScoreConfig,
  _governanceControllerCommitment: Bytes<32>,
  _configTimelockEpochs: Uint<64>,
)
```

- `_scoreConfig`: initial scoring weights and band thresholds.
- `_governanceControllerCommitment`: commitment controlled by a DAO, multisig, or governance contract. This is not a single deployer wallet.
- `_configTimelockEpochs`: delay before a proposed score config can be applied.

The constructor validates score bounds and rejects a zero governance controller.

## Exported Circuits

The full contract currently exports 15 provable circuits. Because that exceeds the practical first-deploy surface used by the CLI, the package also builds `src/bootstrap.compact`; the CLI can deploy bootstrap first and then install the full verifier keys through circuit maintenance.

### Identity

`Identity_register(...) -> VeilIdentityRecord`

Registers a new identity. The contract stores a public identity record and a commitment, while replay-protecting the domain-separated identity proof.

Parameters:

- `_veilIdHash`
- `_chainNamespace`
- `_publicKeyOrLockHashCommitment`
- `_walletSignatureHash`
- `_chainProofHash`
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

Queues a score-config update if the provided governance proof matches the configured DAO/controller commitment.

`Governance_applyScoreConfig(_currentEpoch)`

Applies the pending config after the timelock expires. Anyone can call this once the proposal is executable.

`Governance_cancelScoreConfig(...)`

Cancels a pending config if the provided governance proof matches the configured controller.

## Public Helper Circuits

The exported `Utils_*` circuits are canonical encoding helpers for SDKs, tests, and CLI tooling:

- `Utils_deriveVeilId`
- `Utils_deriveIdentityProofHash`
- `Utils_deriveReputationWitnessCommitment`
- `Utils_deriveReputationProofHash`
- `Utils_deriveScoreConfigHash`
- `Utils_deriveScoreConfigHashFor`
- `Utils_deriveGovernanceActionHash`
- `Utils_deriveGovernanceProofHash`
- `Utils_deriveBand`
- `Utils_deriveCommunityWeightBps`

Internal assertion helpers remain unexported.

`src/bootstrap.compact` exports only the circuits needed to initialize and stage the contract before the full verifier-key set is installed.

## Circuit Argument Audit

The v2 circuit argument lists are intentionally explicit. No argument was removed in the latest audit because each external argument is used by at least one of these invariants:

| Circuit | Arguments retained because |
|---|---|
| `Identity_register` | `veilIdHash`, chain namespace, lock/public-key commitment, wallet signature hash, proof hash, and epoch are all stored or bound into the identity proof/replay key. |
| `Reputation_prove` | Signal values compute the private score; chain commitments prevent empty source data; witness salt, witness commitment, proof nonce, proof hash, and claimed band are replay and proof-binding inputs; epoch records freshness. |
| `Reputation_check` | Requester hash, purpose hash, minimum band, and epoch bind the decision to an integrator policy request. |
| `Governance_proposeScoreConfig` | New config, epoch, action hash, proof hash, and nonce bind the proposed config to the DAO/controller proof and timelock. |
| `Governance_applyScoreConfig` | Current epoch is required to enforce the timelock. |
| `Governance_cancelScoreConfig` | Action hash identifies the pending proposal to cancel. |

The only arguments that could be abstracted away are values currently computed off-chain by SDK helpers
(`chainProofHash`, `witnessCommitment`, `proofHash`, and governance hashes). They remain explicit so
integrators, tests, and CLI tooling can independently derive and inspect the exact binding accepted by
the contract.

## Private State

Private state is stored by `veilIdHash`:

```ts
reputationScores: Record<string, ReputationScore>
```

The on-chain ledger stores identity records, commitment trees, replay keys, active score config, governance controller commitment, and pending governance config.

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

`test:compile` compiles both the full and bootstrap contracts with `--skip-zk`:

```bash
compact compile --skip-zk src/main.compact ./src/managed/veil-protocol
compact compile --skip-zk src/bootstrap.compact ./src/managed/veil-protocol-bootstrap
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
- forged witness commitment rejection
- forged proof hash rejection
- incorrect claimed band rejection
- replayed proof nonce/hash rejection
- governance timelock behavior
- forged governance controller proof rejection
