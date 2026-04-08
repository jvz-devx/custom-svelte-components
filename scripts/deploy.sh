#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../.credentials"

IMAGE="ghcr.io/jvz-devx/custom-svelte-components:latest"
CONTAINER="svelte-components"
GHCR_TOKEN="$(gh auth token)"

echo "==> Deploying $IMAGE to $SERVER_HOST"

ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_HOST" bash <<REMOTE
  set -e

  echo "==> Logging into GHCR..."
  echo "$GHCR_TOKEN" | sudo docker login ghcr.io -u jvz-devx --password-stdin

  echo "==> Pulling image..."
  sudo docker pull "$IMAGE"

  echo "==> Stopping old container..."
  sudo docker stop $CONTAINER 2>/dev/null || true
  sudo docker rm $CONTAINER 2>/dev/null || true

  echo "==> Starting new container..."
  sudo docker run -d \
    --name $CONTAINER \
    --restart unless-stopped \
    -p 3000:3000 \
    $IMAGE

  echo "==> Cleaning up..."
  sudo docker image prune -f

  echo "==> Status:"
  sudo docker ps --filter name=$CONTAINER --format "table {{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
REMOTE

echo ""
echo "========================================="
echo "  Live at http://$SERVER_HOST:3000"
echo "========================================="
