FROM oven/bun:1.3.10-debian AS deps

WORKDIR /app

COPY package.json bun.lock ./
COPY packages/backend/package.json packages/backend/package.json
COPY packages/cli/package.json packages/cli/package.json
COPY packages/contract/package.json packages/contract/package.json
COPY packages/apps/docs/package.json packages/apps/docs/package.json
COPY packages/apps/veil-ui/package.json packages/apps/veil-ui/package.json

RUN bun install --frozen-lockfile

FROM deps AS build

COPY packages/backend packages/backend

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
