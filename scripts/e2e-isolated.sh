#!/usr/bin/env bash
#
# Run the browser e2e suites against a throwaway copy of the local database.
#
# The suites grade real cards and add real words — exactly what we want them to
# exercise — but that must never touch the database you study with. This script
# clones db/custom.db into a temp file, boots the production standalone server
# against the clone (via LEXILEARN_DB_URL, see src/db/env.ts), runs every suite,
# then tears the clone down.
#
# Usage:
#   scripts/e2e-isolated.sh           # run against the current build
#   scripts/e2e-isolated.sh --build   # rebuild first (npm run build)
#
# Requirements: a built bundle (.next/standalone/server.js), python3 +
# playwright, and chromium (python3 -m playwright install chromium).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${LEXILEARN_E2E_PORT:-3100}"
BASE="http://127.0.0.1:${PORT}"
SRC_DB="$ROOT/db/custom.db"
# One temp directory holds the db clone and all logs, so cleanup is a single
# rm -rf — appending extensions to mktemp output would leak the base files.
TMP_DIR="$(mktemp -d -t lexilearn-e2e-XXXXXX)"
TMP_DB="$TMP_DIR/study.db"
SERVER_LOG="$TMP_DIR/server.log"
SUITE_LOG="$TMP_DIR/suite.log"
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [[ "${1:-}" == "--build" ]]; then
  echo "▶ building production bundle…"
  npm run build || exit 1
fi

if [[ ! -f .next/standalone/server.js ]]; then
  echo "✗ .next/standalone/server.js is missing — run: npm run build" >&2
  exit 1
fi

# Clone the study database so the suites run against realistic data. Copying the
# WAL/SHM sidecars keeps a recently-written database consistent.
if [[ -f "$SRC_DB" ]]; then
  cp "$SRC_DB" "$TMP_DB"
  [[ -f "$SRC_DB-wal" ]] && cp "$SRC_DB-wal" "$TMP_DB-wal"
  [[ -f "$SRC_DB-shm" ]] && cp "$SRC_DB-shm" "$TMP_DB-shm"
  echo "▶ cloned study db → $TMP_DB"
else
  echo "▶ no db/custom.db yet — the server will create a fresh one at the clone path"
fi

echo "▶ starting server on $BASE (LEXILEARN_DB_URL=$TMP_DB)"
NODE_ENV=production PORT="$PORT" HOSTNAME=127.0.0.1 \
  LEXILEARN_DB_URL="file:$TMP_DB" \
  node .next/standalone/server.js > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 40); do
  curl -sf -o /dev/null "$BASE/" && break
  sleep 0.5
done
if ! curl -sf -o /dev/null "$BASE/"; then
  echo "✗ server never came up. Log:" >&2
  cat "$SERVER_LOG" >&2
  exit 1
fi

FAILED=0
for suite in tests/e2e/test_phased.py tests/e2e/test_router_e668.py tests/e2e/test_deep_integration.py; do
  echo
  echo "═══ ${suite} ═══"
  : > "$SUITE_LOG"
  if ! LEXILEARN_E2E_BASE="$BASE" python3 "$suite" 2>&1 | tee "$SUITE_LOG"; then
    FAILED=1
  fi
  if grep -q '^\[FAIL\]' "$SUITE_LOG"; then
    FAILED=1
  fi
done

echo
if [[ "$FAILED" -ne 0 ]]; then
  echo "✗ e2e suites reported failures"
  exit 1
fi
echo "✓ all e2e suites passed — db/custom.db was never touched"
