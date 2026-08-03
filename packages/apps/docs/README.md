# Veil Docs

Static documentation site for Veil Protocol v2.

The docs default to the current v2 private reputation architecture. Archived v1 credit-scoring
context is only shown through the architecture version toggle.

## Live Site

https://docs-veil-credit-scoring.netlify.app

## Local Development

```bash
bun install
cd packages/apps/docs
bun run dev
```

## Static Build

```bash
bun run build
```

The app uses Next.js static export via `output: "export"`; deploy the generated `out` directory to Netlify.
