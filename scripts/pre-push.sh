#!/bin/sh
# Chegga manual / CI pre-push verification script
# Runs the full pre-push test and build checks.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f "$REPO_ROOT/.githooks/pre-push" ]; then
  exec sh "$REPO_ROOT/.githooks/pre-push" "$@"
else
  cd "$REPO_ROOT" || exit 1
  npm test && npm run build
fi
