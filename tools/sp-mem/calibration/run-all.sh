#!/usr/bin/env bash
# ABOUTME: Runs every sp-mem calibration experiment in order and prints their tables (about 2 minutes).
# ABOUTME: Needs the harness built (../build.sh) and, for the app and fingerprint experiments, the sources from fetch-sources.sh.
set -euo pipefail
cd "$(dirname "$0")"
for exp in exp-u8alloc.js exp-literal.js exp-fingerprint.js exp-toggle-leak.js exp-budget.js exp-apps.js; do
  echo "################ $exp"
  node "$exp"
  echo
done
