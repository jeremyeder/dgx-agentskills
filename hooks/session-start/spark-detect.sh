#!/bin/bash
# DGX Spark session-start hook
# Checks if the MCP server is reachable and reports status
# Timeout: 2 seconds max to avoid blocking session start

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"

# Load config
if [ -f "$PLUGIN_ROOT/.env" ]; then
  # shellcheck source=/dev/null
  source "$PLUGIN_ROOT/.env"
fi

URL="${SPARK_MCP_URL:-http://your-spark.local:3100}"
URL_TS="${SPARK_MCP_URL_TAILSCALE:-}"

if curl -s --connect-timeout 2 "$URL/health" > /dev/null 2>&1; then
  echo "DGX Spark available at $URL"
elif [ -n "$URL_TS" ] && curl -s --connect-timeout 2 "$URL_TS/health" > /dev/null 2>&1; then
  echo "DGX Spark available via Tailscale at $URL_TS"
else
  echo "WARNING: DGX Spark not reachable at $URL"
fi
