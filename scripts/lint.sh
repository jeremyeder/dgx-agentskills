#!/bin/bash
# Lint all code: TypeScript (eslint + prettier) and shell (shellcheck)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== TypeScript (eslint + prettier) ==="
cd "$REPO_ROOT/mcp-server"
npm run lint

echo ""
echo "=== Shell (shellcheck) ==="
cd "$REPO_ROOT"
find hooks scripts deploy -name "*.sh" -exec shellcheck {} +

echo ""
echo "All checks passed."
