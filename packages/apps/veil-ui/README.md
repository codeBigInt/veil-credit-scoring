# Veil UI

Frontend dashboard and landing page for Veil Protocol.

## Links

- Live docs: https://docs-veil-credit-scoring.netlify.app
- Integration guide: https://docs-veil-credit-scoring.netlify.app/docs/integration
- API reference: https://docs-veil-credit-scoring.netlify.app/docs/integration/api-reference

## Local Development

```bash
bun install
cd packages/apps/veil-ui
bun run dev
```

Open `http://localhost:3000`.

## Required Environment

See `.env.example` for the current frontend configuration. Set `NEXT_PUBLIC_BACKEND_URL` to the deployed Veil backend API and `NEXT_PUBLIC_ZK_CONFIG_BASE_URL` to the hosted ZK artifact base URL when using remote artifacts.
