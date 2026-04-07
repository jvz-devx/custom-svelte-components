#!/bin/bash
set -euo pipefail

# Load credentials
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../.credentials"

IMAGE="ghcr.io/jvz-devx/custom-svelte-components:latest"
CONTAINER="svelte-components"

echo "==> Deploying $IMAGE to $SERVER_HOST"

# SSH and deploy
ssh-keygen -R "$SERVER_HOST" 2>/dev/null || true
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_HOST" bash -s <<EOF
  set -e

  echo "==> Pulling image..."
  docker pull "$IMAGE" || {
    echo "Pull failed — trying with auth..."
    echo "$SERVER_PASSWORD" | docker login ghcr.io -u jvz-devx --password-stdin
    docker pull "$IMAGE"
  }

  echo "==> Stopping old container..."
  docker stop $CONTAINER 2>/dev/null || true
  docker rm $CONTAINER 2>/dev/null || true

  echo "==> Starting new container..."
  docker run -d \
    --name $CONTAINER \
    --restart unless-stopped \
    -p 3000:3000 \
    $IMAGE

  echo "==> Cleaning up..."
  docker image prune -f

  echo "==> Done! Running:"
  docker ps --filter name=$CONTAINER --format "table {{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
EOF

echo "==> Live at http://$SERVER_HOST:3000"
