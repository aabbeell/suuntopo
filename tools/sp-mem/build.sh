#!/usr/bin/env bash
# ABOUTME: Builds the sp-mem harness binaries (brew, default, lowmem) into build/ and the 32-bit struct-size table for each source variant.
# ABOUTME: Needs Duktape 2.7.0's source tarball in Homebrew's cache ("brew fetch -s duktape") and Apple clang with the armv7k target.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
BUILD="$HERE/build"
SRC_DIR="${SPMEM_DUKTAPE_SRC:-/tmp/sp-mem-src/duktape-2.7.0}"
SDK="$(xcrun --show-sdk-path)"
CFLAGS=(-std=c99 -O2 -Wall -Wno-unused-function)

if [ ! -f "$SRC_DIR/src/duktape.c" ]; then
  TARBALL="$(brew --cache -s duktape)"
  if [ ! -f "$TARBALL" ]; then
    echo "Duktape source tarball missing; run: brew fetch -s duktape" >&2
    exit 1
  fi
  mkdir -p "$(dirname "$SRC_DIR")"
  tar -xf "$TARBALL" -C "$(dirname "$SRC_DIR")"
fi

mkdir -p "$BUILD"

# splice_config OUT OVERRIDES...: duk_config.h with the override headers inserted at __OVERRIDE_DEFINES__
splice_config() {
  local out="$1"; shift
  if [ "$#" -gt 0 ]; then
    cat "$@" > "$out.overrides"
    awk -v f="$out.overrides" '/__OVERRIDE_DEFINES__/ { while ((getline line < f) > 0) print line; next } { print }' \
      "$SRC_DIR/src/duk_config.h" > "$out"
    rm -f "$out.overrides"
  else
    cp "$SRC_DIR/src/duk_config.h" "$out"
  fi
}

# probe_sizes CONFIG_DIR OUT PREFIX: 32-bit struct sizes of a configuration as #defines
probe_sizes() {
  local cfg="$1" out="$2" prefix="$3"
  clang -target armv7k-apple-watchos -isysroot "$SDK" -I"$cfg" -S -O1 -w -o "$cfg/probe32.s" "$HERE/harness/probe32.c"
  awk -v p="$prefix" '/^_t32_[a-z0-9_]+:/ { name = toupper(substr($1, 6, length($1) - 6)); getline; print "#define " p name " " $2 }' \
    "$cfg/probe32.s" > "$out"
  if ! grep -q "${prefix}HEAP " "$out"; then
    echo "probe32 parse failed for $cfg" >&2
    exit 1
  fi
}

# build_variant NAME [OVERRIDES_HEADER [ALT_OVERRIDES_HEADER]]
build_variant() {
  local name="$1" overrides="${2:-}" alt="${3:-}" dir="$BUILD/$1"
  local extra=()
  mkdir -p "$dir"
  if [ -n "$overrides" ]; then
    splice_config "$dir/duk_config.h" "$overrides"
  else
    splice_config "$dir/duk_config.h"
  fi
  cp "$SRC_DIR/src/duktape.h" "$SRC_DIR/src/duktape.c" "$dir/"

  # 32-bit struct sizes: armv7k uses AAPCS-style 8-byte double alignment, like a Cortex-M arm-none-eabi target.
  probe_sizes "$dir" "$dir/target_sizes.h" "T32_"

  # Optional second layout for the watch-fit estimate (struct sizes only; the engine itself is built without it).
  if [ -n "$alt" ]; then
    mkdir -p "$dir/alt"
    splice_config "$dir/alt/duk_config.h" "$overrides" "$alt"
    cp "$dir/duktape.h" "$dir/duktape.c" "$dir/alt/"
    probe_sizes "$dir/alt" "$dir/target_sizes_alt.h" "TA_"
    extra+=(-DSPMEM_HAVE_ALT)
  fi

  clang "${CFLAGS[@]}" -DSPMEM_INTERNAL -DSPMEM_VARIANT="\"$name\"" ${extra[@]+"${extra[@]}"} -I"$dir" \
    -o "$BUILD/sp-mem-$name" "$HERE/harness/sp-mem.c" -lm
  echo "built $BUILD/sp-mem-$name"
}

build_variant default
build_variant lowmem "$HERE/harness/config/lowmem.h" "$HERE/harness/config/watchfit.h"

# Homebrew's shared library (stock configuration): measured bytes only, no heap walk.
clang "${CFLAGS[@]}" -DSPMEM_VARIANT='"brew"' -I/opt/homebrew/include -L/opt/homebrew/lib \
  -o "$BUILD/sp-mem-brew" "$HERE/harness/sp-mem.c" -lduktape -lm
echo "built $BUILD/sp-mem-brew"
