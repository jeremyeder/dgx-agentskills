#!/bin/bash
# Basic smoke test for spark-detect.sh
# Tests that the script runs without errors and produces expected output format
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOK="$REPO_ROOT/hooks/session-start/spark-detect.sh"

echo "Testing spark-detect.sh..."

# Test 1: Script is executable
if [ ! -x "$HOOK" ]; then
  echo "FAIL: spark-detect.sh is not executable"
  exit 1
fi
echo "PASS: Script is executable"

# Test 2: Script runs without error (even if Spark is unreachable)
OUTPUT=$(SPARK_MCP_URL="http://localhost:99999" SPARK_MCP_URL_TAILSCALE="" bash "$HOOK" 2>&1) || true
if [ -z "$OUTPUT" ]; then
  echo "FAIL: Script produced no output"
  exit 1
fi
echo "PASS: Script produces output: $OUTPUT"

# Test 3: Output contains expected keywords
if echo "$OUTPUT" | grep -qE "(available|WARNING|not reachable)"; then
  echo "PASS: Output contains expected status keywords"
else
  echo "FAIL: Output missing expected keywords: $OUTPUT"
  exit 1
fi

echo "All hook tests passed."
