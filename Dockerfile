# syntax=docker/dockerfile:1
#
# Multi-stage build:
#   builder    — compiles the frontend and API server on the native platform.
#                ARM64-specific overrides (added for Replit's x86 environment)
#                are removed before installing so native binaries are fetched.
#   production — lean runtime image with only production dependencies.

# ── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /build

RUN npm install -g pnpm@9

# Copy workspace descriptor files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# The pnpm-workspace.yaml overrides exclude ARM64 native binaries for
# esbuild, rollup, tailwindcss oxide, and lightningcss because Replit runs
# on x86. Remove those exclusions so Docker can install the correct binaries
# for the platform it is actually building on (linux/arm64 on Raspberry Pi).
RUN sed -i \
      -e "/rollup>@rollup\/rollup-linux-arm64/d" \
      -e "/esbuild>@esbuild\/linux-arm64/d" \
      -e "/@tailwindcss\/oxide>@tailwindcss\/oxide-linux-arm64/d" \
      -e "/lightningcss>lightningcss-linux-arm64/d" \
    pnpm-workspace.yaml

# Copy all packages required for the build
COPY lib/ lib/
COPY artifacts/api-server/ artifacts/api-server/
COPY artifacts/web-client/ artifacts/web-client/
COPY scripts/ scripts/

# Use --no-frozen-lockfile because the lockfile was generated on x86 and
# does not include ARM64 package entries.
RUN pnpm install --no-frozen-lockfile

# Build the API server and web client for production
RUN BASE_PATH=/ NODE_ENV=production \
    pnpm --filter @workspace/api-server run build && \
    BASE_PATH=/ NODE_ENV=production \
    pnpm --filter @workspace/web-client run build


# ── Stage 2: production ───────────────────────────────────────────────────────
FROM node:20-slim AS production

# Install FFmpeg (transcoding) and curl (healthcheck)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg curl && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Remove the same ARM64 exclusions so production native deps (e.g. sharp) install correctly
RUN sed -i \
      -e "/rollup>@rollup\/rollup-linux-arm64/d" \
      -e "/esbuild>@esbuild\/linux-arm64/d" \
      -e "/@tailwindcss\/oxide>@tailwindcss\/oxide-linux-arm64/d" \
      -e "/lightningcss>lightningcss-linux-arm64/d" \
    pnpm-workspace.yaml

# Copy only the package manifests of the packages we need at runtime
COPY lib/ lib/
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY artifacts/web-client/package.json artifacts/web-client/package.json

# Install production-only dependencies natively for this platform
RUN pnpm install --no-frozen-lockfile --prod

# Copy the compiled JS output from the builder stage
# (JavaScript is platform-agnostic so cross-stage copying is safe)
COPY --from=builder /build/artifacts/api-server/dist/ artifacts/api-server/dist/
COPY --from=builder /build/artifacts/web-client/dist/ artifacts/web-client/dist/

# Default mount point for the music/video library
RUN mkdir -p /music

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT:-4000}/healthz || exit 1

ENV NODE_ENV=production

CMD ["node", "artifacts/api-server/dist/index.mjs"]
