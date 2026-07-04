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

- Constructor deploy args are seeded with defaults in `src/index.ts`: score config, guardian set hash, guardian threshold, controller version, and config timelock.
- Private state id is fixed to `veil_ps`.
- `Deploy Veil contract` deploys the single Veil v2 contract directly. The current prover-key surface is 8 circuits.
- The v2 menu supports identity registration, reputation proof submission, reputation checks, score-config proposal/application, and state inspection.
- Run `bun --filter @veil/veil-contract compile` before live deployment so deployable ZK artifacts exist.

## v2 Smoke Test Flow

1. Choose `Deploy Veil contract`.
2. Choose `Register identity`.
3. Choose `Prove reputation` using the defaults for a Gold-band local smoke test.
4. Choose `Check reputation` using minimum band `2` or `3`.
5. Inspect ledger/private state.

The CLI submits only public contract entrypoints. Canonical hash helpers are generated as SDK/contract `pureCircuits` where needed.
