# Reader policy: `veil.default-rpc.v1`

This document describes exactly what the SDK's built-in reader does, so that:

- **Governance** has something concrete to review before approving this policy hash on a contract.
- **Integrators** know precisely what they're trusting when they let the default reader run for their users.
- **Anyone changing the reader code** knows when a change is a patch versus when it must become a new,
  separately-approved policy (`veil.default-rpc.v2`, etc.).

If the described behavior below and the actual code (`ethereum.ts`, `ckb.ts`, `index.ts` in this
directory's parent) ever disagree, that's a bug in one of the two — see [Conformance](#conformance).

## Identity

| | |
|---|---|
| Policy ID | `veil.default-rpc.v1` |
| Source | `packages/sdk/src/reputation/reader/{index,ethereum,ckb}.ts` |
| Registered hash | `DEFAULT_READER_POLICY_HASH` in `packages/sdk/src/contract/index.ts` — currently `padStringToBytes32('veil.default-rpc.v1')` (a chosen identifier, not a hash of this file — see [Known limitations](#known-limitations)) |

## Data sources

Two chain families, read independently and combined:

- **EVM-compatible chains** — one JSON-RPC call per chain configured in `VeilConfig.chains` (anything
  that isn't `ckb`). Uses only `eth_getTransactionCount(address, 'latest')`. No other RPC method is
  called. No indexer, no block explorer, no historical log scan.
- **CKB** — one JSON-RPC call: `get_tip_block_number`. This checks that the configured CKB RPC is
  reachable; it does not query the given address's own activity at all (see below).

No API keys, no Veil-hosted infrastructure, no non-public data. Every RPC URL is supplied by the
caller in `VeilConfig.chains`.

## Signal-by-signal behavior

This is the part most worth reading closely, because several signals are **not** actually derived from
history yet — they're conservative stand-ins.

| Signal | What actually produces it | Honest limitation |
|---|---|---|
| `walletAgeInDays` | `Date.now() - firstActivityTimestamp`, where `firstActivityTimestamp` comes from `firstTxTimestamp` (EVM) and any recorded `txTimestamps`. | `firstTxTimestamp` is **not read from chain data** — it's set to `Date.now()` at read time (see `emptyEthereumSignals()` in `ethereum.ts`). The only way `walletAgeInDays` becomes non-zero today is via a `txTimestamps` entry earlier than "now," and the built-in reader never produces one. **In practice, this is always `0` with the default reader.** |
| `distinctProtocols` | `new Set([...ethSignals.contractsInteracted, ...ckbSignals.contractsInteracted]).size` | Neither `readEthereumSignals` nor `readCKBSignals` ever populates `contractsInteracted` — both always return `[]`. **Always `0` with the default reader.** |
| `daoVoteCount` | `ethSignals.governanceVotes.length` | `governanceVotes` is never populated by the built-in reader. **Always `0`.** |
| `lpTenureInDays` | Derived from `ethSignals.lpPositions` | `lpPositions` is never populated. **Always `0`.** |
| `crossChainCount` | `ethSignals.activeChains + (ckbSignals.txCount > 0 ? 1 : 0)` | `activeChains` counts EVM chains where `eth_getTransactionCount` returned > 0 — this is the one signal the default reader genuinely measures. CKB never contributes: `txCount` is never set by `readCKBSignals` (it only checks the tip block number, not the address). |
| `txConsistencyScore` | `computeConsistencyScore(allTimestamps)` over the merged EVM + CKB timestamps | Needs 3+ timestamps spread across distinct weeks in the last 90 days to score above 0. The default reader only ever produces at most one timestamp per EVM chain (always "now," not a real history), so this **only exceeds 0 in the edge case of 3+ configured EVM chains all reporting activity in the same read**, and even then the score is small and not reflective of real historical consistency. |

**Net effect:** the only thing the default reader meaningfully measures today is *"does this address have
a non-zero transaction count on each configured EVM chain?"* — a presence check, not a history read.
Everything else defaults to zero. This is intentional as a safe, dependency-free starting point (see
`README.md`'s "Reputation Readers" section), but it means a `veil.default-rpc.v1` proof carries very
little real signal, and production integrators should not treat it as a meaningful reputation source —
see the SDK README for how to supply a real indexer-backed reader instead.

## Chain commitment

`chainCommitment = sha256(stableStringify({ ethereum: ethSignals, ckb: ckbSignals }))` — a plain
deterministic hash of the full signal objects returned by the two readers above (`hashChainState` in
`utils/hash.ts`). It seals whatever the readers actually returned, whether or not that data is
meaningful (see table above).

## Failure behavior

- An EVM chain that errors or times out is silently dropped — `Promise.allSettled` merges only the
  chains that succeeded. A single bad RPC endpoint does not fail the whole read.
- CKB RPC failures are caught and reported as `networkReachable: false`; nothing else changes.
- If no EVM chains are configured at all, every EVM-derived signal defaults to zero rather than throwing.

## Known limitations

- **The policy hash is a name, not a fingerprint.** `padStringToBytes32('veil.default-rpc.v1')` doesn't
  change if this reader's code changes — nothing currently forces a code change to also change the
  registered hash. A future version should derive the hash from this spec file plus the test vectors
  below (`hash(SPEC.md + test-vectors.ts)`), so that any behavioral change automatically produces an
  unregistered hash and requires fresh governance approval before it can be used.
- **Most signals are stubs**, as documented in the table above. This spec exists partly to make that
  fact impossible to miss, rather than something a reader has to reverse-engineer from source.
- **No cryptographic proof of the underlying chain data.** This reader trusts whatever its configured
  RPC endpoint returns. See the project's reader-trust discussion for the broader menu of ways to
  strengthen this (multi-reader consensus, staking, hardware attestation, or verifying raw chain data
  inside the proof circuit itself).

## Conformance

`test-vectors.ts` in this directory pins down exact input → output pairs for the behavior described
above. `packages/sdk/src/__tests__/reputation/reader/policies/veil.default-rpc.v1.conformance.test.ts`
runs the real reader code against every vector and asserts an exact match.

If you change reader logic and a vector's expected output needs to change: that's a signal you're no
longer describing `veil.default-rpc.v1` — bump the vectors *and* this spec together, and treat the result
as a new policy ID pending its own governance approval, rather than editing this one silently.
