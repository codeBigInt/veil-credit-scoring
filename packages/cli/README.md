# Veil CLI

Live docs: https://docs-veil-credit-scoring.netlify.app


CLI testing package for the Veil v2 reputation protocol.

This package follows the launcher/config pattern from `example-bboard`, but uses `nite-api` for contract deploy/join/circuit calls. It is intended as the local smoke-test surface before building the SDK and updating the UI.

## Scripts

- `bun run standalone`
- `bun run preview-remote`
- `bun run preprod-remote`
- `bun run typecheck`
- `bun run build`

## Notes

- Constructor deploy args are seeded with defaults in `src/index.ts`: score config, governance-controller commitment, and config timelock.
- Private state id is fixed to `veil_ps`.
- `Deploy Veil contract` always uses the staged bootstrap flow because the full v2 contract currently has 15 provable circuits.
- After bootstrap deployment, the CLI installs only the full-contract verifier keys that are missing from the bootstrap contract.
- The v2 menu supports identity registration, reputation proof submission, reputation checks, score-config proposal/application, and state inspection.
- Run `bun --filter @veil/veil-contract compile` before live deployment so both full and bootstrap ZK artifacts exist.

## v2 Smoke Test Flow

1. Choose `Deploy Veil contract` for the bootstrap deployment path.
2. Choose `Register identity`.
3. Choose `Prove reputation` using the defaults for a Gold-band local smoke test.
4. Choose `Check reputation` using minimum band `2` or `3`.
5. Inspect ledger/private state.

The CLI derives the required identity proof hash, witness commitment, reputation proof hash, and governance proof hashes using the contract's canonical helper circuits.
