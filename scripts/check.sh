#!/usr/bin/env bash
# Syntax-check and run unit tests (zero npm dependencies).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> parse browser JavaScript as ES modules"
node --no-warnings --experimental-vm-modules scripts/check-esm.mjs js sw.js

echo "==> audit i18n catalogs"
node scripts/i18n-audit.mjs
node scripts/prune-i18n-catalogs.mjs

echo "==> node --test"
node --test tests/*.mjs

echo "==> git diff --check"
git diff --check
git diff --cached --check

echo "OK"
