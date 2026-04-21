# Veil CLI

CLI testing package for the Veil credit scoring protocol.

This package follows the launcher/config pattern from `example-bboard`, but uses `nite-api` for contract deploy/join/circuit calls.

## Scripts

- `bun run standalone`
- `bun run preview-remote`
- `bun run preprod-remote`
- `bun run typecheck`
- `bun run build`

## Notes

- Constructor deploy args are seeded with defaults in `src/index.ts`.
- Private state id is fixed to `veil_ps`.
- This CLI uses local witness/private state implementation in `src/contract-witness.ts`.
