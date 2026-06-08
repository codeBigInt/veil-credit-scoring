FROM oven/bun:1.3.10-debian AS deps

WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive
ENV PATH="/root/.compact/bin:/root/.local/bin:${PATH}"

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates xz-utils zstd unzip gzip bzip2 \
  && rm -rf /var/lib/apt/lists/*

RUN curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/download/compact-v0.5.1/compact-installer.sh | sh \
  && compact update 0.31.0 \
  && compact --version

COPY package.json bun.lock ./
COPY packages/backend/package.json packages/backend/package.json
COPY packages/cli/package.json packages/cli/package.json
COPY packages/contract/package.json packages/contract/package.json
COPY packages/apps/docs/package.json packages/apps/docs/package.json
COPY packages/apps/veil-ui/package.json packages/apps/veil-ui/package.json

RUN bun install --frozen-lockfile

FROM deps AS build

COPY packages/contract packages/contract
COPY packages/backend packages/backend

RUN cd packages/contract && bun run compile && bun run build

RUN rm -rf packages/backend/src/contract-build \
  && mkdir -p packages/backend/src/contract-build \
  && cp -Rf packages/contract/dist/. packages/backend/src/contract-build/

RUN cd packages/backend && bun run build

FROM oven/bun:1.3.10-debian AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/package.json package.json
COPY --from=deps /app/bun.lock bun.lock
COPY --from=build /app/packages/backend/package.json packages/backend/package.json
COPY --from=build /app/packages/backend/dist packages/backend/dist

WORKDIR /app/packages/backend

EXPOSE 3001

CMD ["bun", "start"]
