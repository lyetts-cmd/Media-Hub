# syntax=docker/dockerfile:1
#
# Multi-stage build:
#   builder  — compiles the frontend and API server (always runs on linux/amd64
#              to avoid ARM64 Rollup native-module issues at compile time)
#   production — lean runtime image that installs platform-native production
#              dependencies (correct arm64 binaries on Raspberry Pi)

# ─── Stage 1: builder (always amd64 so Vite/Rollup compile cleanly) ──────────
FROM --platform=linux/amd64 node:20-slim AS builder

WORKDIR /build

RUN npm install -g pnpm@9

# Copy workspace descriptor files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Copy all packages required for the build
COPY lib/ lib/
COPY artifacts/api-server/ artifacts/api-server/
COPY artifacts/web-client/ artifacts/web-client/
COPY scripts/ scripts/

# Install all dependencies (including devDeps needed for compilation)
RUN pnpm install --frozen-lockfile

# Build the API server and the web client for production
RUN BASE_PATH=/ NODE_ENV=production \
    pnpm --filter @workspace/api-server run build && \
    BASE_PATH=/ NODE_ENV=production \
    pnpm --filter @workspace/web-client run build


# ─── Stage 2: production (native platform — arm64 on Raspberry Pi) ───────────
FROM node:20-slim AS production

# Install FFmpeg (WMA/APE transcoding) and curl (healthcheck)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg curl && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace manifests so pnpm can resolve inter-package dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Copy only the package manifests of the packages we need at runtime
# (lib packages are workspace dependencies of the API server)
COPY lib/ lib/
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY artifacts/web-client/package.json artifacts/web-client/package.json

# Install production-only dependencies natively on this platform.
# On arm64 (Raspberry Pi) this pulls the correct arm64 binaries for
# packages like 'sharp'. No compilation happens here.
RUN pnpm install --frozen-lockfile --prod

# Copy the compiled JS output from the builder stage.
# JavaScript is platform-agnostic so cross-stage copying is safe.
COPY --from=builder /build/artifacts/api-server/dist/ artifacts/api-server/dist/
COPY --from=builder /build/artifacts/web-client/dist/ artifacts/web-client/dist/

# Default mount point for the music library (bind-mounted at runtime)
RUN mkdir -p /music

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT:-4000}/ || exit 1

ENV NODE_ENV=production

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
