#!/usr/bin/env bash
# ABOUTME: Downloads the published app sources the calibration experiments use (climb-logger commits with Vertical 2 logs, other GitHub SuuntoPlus apps) into /tmp/sp-mem-gh.
# ABOUTME: Source text only (codeload tarballs); builds each climb-logger commit with lib/build-lib.js so exp-fingerprint.js and exp-apps.js can run.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="${SPMEM_GH:-/tmp/sp-mem-gh}"
mkdir -p "$DEST/climb" "$DEST/apps" "$DEST/tmp"

fetch() { # fetch <owner/repo> <ref> <dir>
  local repo="$1" ref="$2" dir="$3"
  [ -d "$dir" ] && return 0
  mkdir -p "$dir"
  curl -fsSL "https://codeload.github.com/$repo/tar.gz/$ref" | tar -xz -C "$dir" --strip-components=1
}

# climb-logger (wylandplex/suuntoplus-climb-logger): builds that appear in its docs/watch-logs with JSalloc / JsTotMem lines.
CLIMB_SHAS="eaae480 c63fe4a a9bfc2b 9f9d8e1 1ea8db5"
for sha in $CLIMB_SHAS; do
  fetch wylandplex/suuntoplus-climb-logger "$sha" "$DEST/climb/src-$sha"
  app="$DEST/climb/app-$sha"
  if [ ! -f "$app/main.js" ]; then
    mkdir -p "$app"
    (cd "$DEST/climb/src-$sha" && cp manifest.json main.js data.json ./*.html ext*.js "$app/" 2>/dev/null || true)
  fi
  if [ ! -f "$DEST/climb/b-$sha/main.js" ]; then
    TMPDIR="$DEST/tmp" node "$HERE/../lib/build-lib.js" "$app" "$DEST/climb/out-$sha" > /dev/null 2>&1
    mkdir -p "$DEST/climb/b-$sha"
    unzip -o -q "$DEST/climb/out-$sha/climbl01-q.fea" -d "$DEST/climb/b-$sha"
  fi
  echo "climb-logger $sha: shipped main.js $(wc -c < "$DEST/climb/b-$sha/main.js") B"
done
# The climb-logger watch logs (Vertical 2, FW 2.53.42) live in the repo at docs/watch-logs/ (fetched with the newest commit).
fetch wylandplex/suuntoplus-climb-logger master "$DEST/climb/src-master"

# Other published SuuntoPlus apps (default branch).
for repo in SuuntoSpace/indoor-climbing SuuntoSpace/lactate-power-test surfboomerang/SuuntoPlusApps Isotop7/suunto-plus-workout-chart \
  isazi/TrailPredictor isazi/skitouring michaels19802/LiftCue ayamshanov/AnchorAlarm-for-Suunto zestuart/suunto-form \
  SellA/BoschEBikeSuunto panoskrt/SuuntoPlusVeloClimb nousmc/Swim-Drills slavikpi/nuki_suunto; do
  ref="$(curl -fsSL "https://api.github.com/repos/$repo" | sed -n 's/.*"default_branch": *"\([^"]*\)".*/\1/p' | head -1)"
  fetch "$repo" "${ref:-main}" "$DEST/apps/$(echo "$repo" | tr '/' '_')"
  echo "app $repo ($ref)"
done
