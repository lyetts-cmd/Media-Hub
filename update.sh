#!/usr/bin/env bash
# update.sh — Pull the latest code and restart the Cadence Music stack.
# Usage: bash update.sh

set -euo pipefail

echo "==> Pulling latest code..."
git pull

echo "==> Rebuilding Docker image..."
docker compose build --pull

echo "==> Restarting services..."
docker compose up -d

echo "==> Running database migrations..."
docker compose exec -T app node artifacts/api-server/dist/migrate.mjs

echo ""
echo "==> Current container status:"
docker compose ps

echo ""
echo "Update complete. Cadence Music is running."
