# @veil-reputation-protocol/sdk

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
} from '@veil-reputation-protocol/sdk';
```

Lower-level contract tooling is also exported for CLIs and deployment systems:

```ts
import {
  PRIVATE_STATE_ID,
  FULL_CONTRACT_CIRCUITS,
  deriveVeilIdHash,
  makeFullCompiledContract,
  submitIdentityRegistration,
  submitReputationProof,
  submitReputationCheck,
} from '@veil-reputation-protocol/sdk';
```

## Protocol Flow

1. Join a deployed Veil contract with your Midnight providers.
2. Register an identity with `registerIdentity`.
3. Build and submit a reputation proof with `proveReputation`.
4. Request a banded decision with `checkReputation`.

All hash, commitment, nonce, salt, namespace, and purpose values must be exactly 32 bytes.
`deriveVeilId` and `deriveVeilIdHash` require the deployed Veil contract address because the contract address is part of the identity domain.

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

The SDK does not lock you into Veil-owned indexer URLs for public-chain activity. It reads from
`config.chains`; every configured non-`ckb` entry is treated as an EVM-compatible chain, so protocols
can add Ethereum, Base, Arbitrum, Optimism, or any other EVM RPC without changing the contract.

```ts
const witness = await collectReputationWitnessFromAddresses(
  evmAddress,
  ckbAddress,
  config,
  {
    ethereumReader: readFromProtocolIndexer,
    ckbReader: readFromCkbIndexer,
    readerPolicyHash: myRegisteredPolicyHash, // see "Where does the proof data come from?" below
  },
);
```

## Where does the proof data come from? (Reader Policy Hash)

Before it proves anything, the SDK looks at a user's wallet history and turns it into numbers
(wallet age, protocols used, etc). The piece of code that does that lookup is called a **reader**.

Every reputation proof now has to say which reader produced its numbers, using a `readerPolicyHash`
— basically a short ID for "whose recipe was this." The Veil contract keeps an allow-list of IDs it
trusts, set by governance. If a proof's ID isn't on that list, the contract rejects the proof outright.
This isn't just a note attached to the proof — it's baked into the same math the proof already uses,
so it can't be swapped out after the fact.

**If you use the SDK's built-in reader (the default), you don't need to do anything.** It automatically
stamps its own ID (`veil.default-rpc.v1`), and that ID is already on the contract's allow-list from day
one.

**If you bring your own reader** (your own indexer, your own data pipeline, anything passed as
`ethereumReader` or `ckbReader` above), you must also:

1. Pick a unique ID for it and get it added to the contract's allow-list — call
   `addSupportedReaderPolicy` (this is a governance action, so it needs approval, same as adding a new
   chain).
2. Pass that same ID as `readerPolicyHash` whenever you collect a witness with your custom reader.

If you forget step 2, the SDK will refuse to build the proof and tell you exactly what's missing —
it won't silently mislabel your custom data as coming from the default reader.

**Why this matters for your app:** without this, there'd be no way to know whether the numbers behind
a "gold band" proof were collected honestly, or by some reader nobody has reviewed. With it, every
accepted proof is provably tied to a reader your governance process has actually approved.
