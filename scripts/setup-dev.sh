#!/bin/bash
# Bootstrap development environment
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Setting up dgx-agentskills development environment ==="

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js 20+ required"; exit 1; }
command -v shellcheck >/dev/null 2>&1 || echo "WARNING: shellcheck not found — install for shell linting"

# Install MCP server dependencies
echo "Installing MCP server dependencies..."
cd "$REPO_ROOT/mcp-server"
npm install

# Build
echo "Building MCP server..."
npm run build

# Copy .env if not present
if [ ! -f "$REPO_ROOT/.env" ]; then
  cp "$REPO_ROOT/.env.example" "$REPO_ROOT/.env"
  echo "Created .env from .env.example — edit it with your Spark's hostname."
fi

echo ""
echo "Development environment ready."
echo "  Run tests:  cd mcp-server && npm test"
echo "  Run lint:   ./scripts/lint.sh"
echo "  Deploy:     ./deploy/install.sh"
