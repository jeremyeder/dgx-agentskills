#!/bin/bash
# Deploy DGX MCP Server to Spark
# Run from repo root: ./deploy/install.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ ! -f "$REPO_ROOT/.env" ]; then
  echo "ERROR: .env not found at $REPO_ROOT/.env"
  echo "Copy .env.example to .env and configure it first."
  exit 1
fi

# shellcheck source=/dev/null
source "$REPO_ROOT/.env"

: "${SPARK_HOST:?SPARK_HOST not set in .env}"
: "${SPARK_USER:?SPARK_USER not set in .env}"

MCP_PORT="${MCP_PORT:-3100}"

echo "Deploying dgx-mcp-server to ${SPARK_HOST}..."

# Sync project to Spark (preserves directory structure)
rsync -avz --exclude node_modules --exclude .git --exclude dist \
  "$REPO_ROOT/" \
  "${SPARK_USER}@${SPARK_HOST}:~/dgx-agentskills/"

# Copy Spark-side .env if not already present
ssh "${SPARK_USER}@${SPARK_HOST}" \
  "cd ~/dgx-agentskills && [ -f .env ] || cp deploy/.env.example .env"

# Build and start
ssh "${SPARK_USER}@${SPARK_HOST}" \
  "cd ~/dgx-agentskills && docker compose up -d --build"

# Verify
echo "Waiting for MCP server to start..."
sleep 3

if curl -s --connect-timeout 5 "http://${SPARK_HOST}:${MCP_PORT}/health" > /dev/null 2>&1; then
  echo "MCP server deployed and healthy at http://${SPARK_HOST}:${MCP_PORT}"
else
  echo "MCP server not responding — check: ssh ${SPARK_USER}@${SPARK_HOST} docker logs dgx-mcp-server"
  exit 1
fi
