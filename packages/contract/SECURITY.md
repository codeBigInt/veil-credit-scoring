# Veil v2 Contract Security Notes

This package is a hardened v2 Compact contract implementation, but it is not externally audited.

## Enforced On-Chain

- Identity registration rejects zero IDs, zero public-key commitments, zero wallet-signature hashes, and invalid domain-separated identity proof bindings.
- Reputation updates bind the private witness inputs, chain data commitments, claimed band, current score config, and nonce into a deterministic proof hash.
- Claimed reputation bands are checked against the privately computed score interval.
- Signal inputs are range-checked before scoring.
- Scores must stay within `maxScore`; oversized witness attempts are rejected instead of wrapped or silently clamped.
- Replay protection tracks both `(veilId, nonce)` and `(veilId, proofHash)`.
- Score configuration changes require a valid DAO/governance-controller proof, timelocked proposal, and delayed application.

## External Verification Boundary

Compact code in this package does not include native secp256k1, secp256r1, EdDSA, Ethereum, CKB, Solana, or Bitcoin signature verification primitives. The contract therefore verifies domain-separated proof bindings, not raw wallet signatures.

For production deployment, the SDK/prover path must ensure:

- `walletSignatureHash` is produced from a valid wallet signature over the Veil registration message.
- `chainProofHash` is derived from the exact wallet signature hash, Veil ID, chain namespace, and public-key/lock-hash commitment.
- `ethChainCommitment` and `ckbChainCommitment` are commitments to canonical chain reads.
- The generated proof uses the same witness values submitted to `Reputation_prove`.

If Midnight exposes native signature verifier circuits later, `Identity_register` should verify the raw signature directly before accepting the identity.

## Adversarial Test Matrix

The current Vitest suite covers:

- v1 admin/issuer/Spore surfaces are absent.
- duplicate identity registration is rejected.
- zero identity and proof fields are rejected.
- missing chain commitments are rejected.
- malformed reputation bands are rejected.
- forged witness commitments are rejected.
- forged reputation proof hashes are rejected.
- incorrect claimed bands are rejected.
- replayed proof nonces are rejected.
- invalid reputation requesters and thresholds are rejected.
- governance config changes require the configured controller proof and cannot apply before the timelock expires.

## Circuit Argument Review

The current circuit arguments were reviewed for redundancy. They are retained because they are used
to compute score state, bind proofs, prevent replay, record freshness, or bind governance actions.
Removing any of the externally supplied hashes/nonces would move that responsibility into off-chain
SDK state and make the accepted proof boundary harder to audit.

## Production Gate

Before mainnet deployment:

- Add or integrate audited wallet-signature verification for each supported chain path.
- Audit the Compact contract and the SDK/prover code together.
- Add property/fuzz tests for score bounds, band intervals, replay keys, and governance timing.
- Publish compiled artifacts and reproducible build instructions.
- Freeze deployed scoring parameters behind a DAO, multisig, or governance contract that controls the configured `governanceControllerCommitment`, with a documented timelock.
