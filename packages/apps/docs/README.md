# Veil Docs

Static documentation site for Veil Protocol.

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
