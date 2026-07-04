# @veil-protocol/sdk

TypeScript SDK for integrating cross-chain DeFi protocols with Veil Protocol v2.

The SDK is not a dashboard-only helper. It exposes the stable integration surface for:

- joining the Veil Midnight contract from protocol backends or apps
- validating and normalizing `Bytes<32>` inputs
- building typed circuit argument tuples
- deriving Veil identity, reputation, and governance proof hashes through contract utility circuits
- submitting identity registration, reputation proof, reputation check, and governance transactions
- checking deploy-time circuit and verifier-key lists

## Core Exports

```ts
import {
  VeilClient,
  BAND_ORDER,
  bandMeetsMinimum,
  buildIdentityFromSigner,
  collectReputationWitness,
  collectReputationWitnessFromAddresses,
  deriveVeilId,
  hashChainState,
  readEthereumSignals,
  readCKBSignals,
  computeConsistencyScore,
  requestSponsorship,
  registerIdentity,
  proveReputation,
  checkReputation,
  batchCheckReputation,
  DEFAULT_PROOF_SERVER,
  DEFAULT_FEE_SPONSOR,
  type VeilConfig,
  type VeilIdentity,
  type ReputationDecision,
  type ReputationWitness,
  type EthereumSignals,
  type CkbSignals,
  type ReputationReaderOptions,
  type ScoreBand,
  type ReputationPurpose,
} from '@veil-protocol/sdk';
```

Lower-level contract tooling is also exported for CLIs and deployment systems:

```ts
import {
  PRIVATE_STATE_ID,
  FULL_CONTRACT_CIRCUITS,
  makeFullCompiledContract,
  submitIdentityRegistration,
  submitReputationProof,
  submitReputationCheck,
} from '@veil-protocol/sdk';
```

## Protocol Flow

1. Join a deployed Veil contract with your Midnight providers.
2. Register an identity with `registerIdentity`.
3. Build and submit a reputation proof with `proveReputation`.
4. Request a banded decision with `checkReputation`.

All hash, commitment, nonce, salt, namespace, and purpose values must be exactly 32 bytes.

## Integrator Example

```ts
const client = new VeilClient(config, midnightProvider, {
  deriveLockHashFromAddress: resolveCkbLockHash,
  reputationReader: readProtocolSignals,
});

const registration = await client.register(signer);
const proof = await client.proveReputation(signer);
const decision = await client.checkReputation(registration.veilId, {
  minimumBand: 'silver',
  purpose: 'incentive',
});

if (decision.meetsThreshold) {
  // Apply protocol-specific access, incentive, or governance policy.
}
```

The SDK only reads public chain state, submits Midnight transactions, and optionally calls the proof
server or fee sponsor. It does not depend on a Veil backend for oracle decisions.

## Reputation Readers

The built-in readers are intentionally conservative and dependency-light. They can probe public RPCs,
build deterministic non-zero chain commitments, and compute consistency from available timestamps.
Production protocols should inject richer readers backed by their own indexers.

```ts
const witness = await collectReputationWitnessFromAddresses(
  evmAddress,
  ckbAddress,
  config,
  {
    ethereumReader: readFromProtocolIndexer,
    ckbReader: readFromCkbIndexer,
  },
);
```
