#!/usr/bin/env bash
# Bethesda Patcher Autoresearch Scorer
# Runs the test suite and extracts precision/recall/F1 from the scorer test
# Exit code: 0 if all pass, 1 if any fail

set -euo pipefail
cd "$(dirname "$0")/../src-tauri"

echo "=== Running Bethesda Patcher Tests ==="
OUTPUT=$(cargo test --lib commands::bethesda_patcher::tests -- --nocapture 2>&1)
EXIT_CODE=$?

# Extract scorer output
echo "$OUTPUT" | grep -A6 "AUTORESEARCH SCORER" || true

# Extract test results
RESULT_LINE=$(echo "$OUTPUT" | grep "^test result:" | tail -1)
echo "$RESULT_LINE"

# Parse passed/failed
PASSED=$(echo "$RESULT_LINE" | grep -oP '\d+ passed' | grep -oP '\d+')
FAILED=$(echo "$RESULT_LINE" | grep -oP '\d+ failed' | grep -oP '\d+')
TOTAL=$((PASSED + FAILED))

echo ""
echo "=== SCORE ==="
echo "passed=$PASSED"
echo "failed=$FAILED"
echo "total=$TOTAL"

if [ "$FAILED" -gt 0 ]; then
    echo "status=REGRESSION"
    exit 1
else
    echo "status=OK"
    exit 0
fi
