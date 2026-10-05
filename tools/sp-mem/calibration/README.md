# sp-mem calibration

Experiments that tie the harness to numbers logged on real watches. Each script prints its own table; `run-all.sh` runs them all (about 30 s once the sources are fetched).

```
bash tools/sp-mem/build.sh                      # harness binaries (lowmem now also carries the watch-fit layout)
bash tools/sp-mem/calibration/fetch-sources.sh  # GitHub app sources into /tmp/sp-mem-gh (override with SPMEM_GH)
bash tools/sp-mem/calibration/run-all.sh
```

`fetch-sources.sh` downloads source text only (codeload tarballs) and builds five climb-logger commits with `lib/build-lib.js`. The climb-logger watch logs it refers to are in that repo under `docs/watch-logs/` (Vertical 2, FW 2.53.42, Weather and Movement co-enabled).

## Experiments

| Script | Reproduces | Key output (regression values, 2026-10-03) |
|---|---|---|
| `exp-fingerprint.js` | `JSalloc:<n>` sizes logged while the watch compiled climb-logger's main.js (4 builds) | largest compiled-function data block, lowmem est32 = watch n + 4 for all four: 2352/2348, 2368/2364, 2396/2392, 2640/2636. Watch 2095 and 4381 are exact bytecode-buffer growth steps of the lowmem configuration (PREFER_SIZE, no PC2LINE) and of no other configuration tested |
| `exp-u8alloc.js` | matram's Race S test: 7 x `Uint8Array(4000)` fit (15279 #0) | 4,068 B est32 lowmem (4,056 watch-fit, 4,084 default) per array; 7 arrays = 28.5 KB, 8 = 32.5 KB |
| `exp-literal.js` | matram's app with 12 min of HR as a literal in main.js could not be activated (14940 #8) | 720 values: value stack 6,480 B and temporary Array part 5,760 B on the watch, both above the ~4.1 KB single-block cap; 144 values stays below 1.2 KB |
| `exp-toggle-leak.js` | skyfi's in-menu toggle probes P0/P1/P4/P4b (15490; Weather and Movement were enabled in every series) | one instantiated scope: P1 4.9-6.2 KB, P4 5.6-10.0 KB, P4b 2.6-4.9 KB est32 (synthetic sources). The watch's own JsTotMem lines rule out a whole scope per re-enable: they differ by 132 B across two extra disabled climb-logger instances (~30 KB each in the harness) and by 2,800 B across 20 P4b re-enables. Each line is a snapshot taken when usage crosses a threshold, so these are bounds, not a per-re-enable measurement |
| `exp-budget.js` | free heap for one app from climb-logger's `JsTotMem 131192/133120` (07-08e log, pre-exercise, harness mounts the same `setup` template) and from matram's test | Vertical 2 + Weather + Movement, pre-exercise: 34.6-37.1 KB lowmem est32 (32.3-34.6 KB watch-fit) for one app; during an exercise less (the same build failed a re-enable in exercise on 07-09). matram's Race S: 28.4-32.5 KB free at that moment plus his own app |
| `exp-apps.js` | official examples and published GitHub apps (`apps.json` holds each one's reported on-watch behaviour) | e.g. climb-logger 9f9d8e1 32.7 KB steady / 35.2 KB peak; suunto-form (BLE, verified on Vertical 2) 9.8 / 11.9 KB |
| `exp-compile-requests.js` | any shipped main.js or ext file: every allocation request >= 1 KB while compiling, matched against watch JSalloc sizes | `node exp-compile-requests.js <file.js[:main|:ext]> ...` |

Helpers: `lib.js` (run a probe script in a harness binary, read its report), `apps.json` (app list for `exp-apps.js`).

## What the calibration establishes

- **Engine configuration.** The watch's Duktape behaves like the harness `lowmem` variant: its bytecode buffer grows by 1/16 plus 64 B from 16 instructions without line-number entries (PREFER_SIZE, no PC2LINE), and its compiled-function data blocks are byte-identical in payload. The `default` variant is ruled out as a model of the watch. Use the lowmem (or watch-fit) columns.
- **Header size.** Every function-data request on the watch is 4 B smaller than lowmem est32, so its fixed-buffer header is 12 B, not 16. `watch-fit` reproduces that with 16-bit heap pointers and 4-byte alignment (`harness/config/watchfit.h`); it is one configuration that fits, not a proven one, and it shrinks other headers too (objects 24 B instead of 32, functions 40 B instead of 56). It reads 7-13% below lowmem.
- **Scale.** climb-logger's reading puts the rest of the heap (firmware share, Weather, Movement) at about 96-101 KB on a Vertical 2 on FW 2.53.42 before an exercise, which leaves about 32-37 KB est32 for one more app; less during an exercise. matram's Race S figure is consistent with that. JsTotMem's unit (requested or allocator bytes) is unknown; the anchor folds climb-logger's per-block overhead into the rest, so it transfers best to apps with a similar bytes-per-block mix.
- **Build attribution.** The four climb-logger builds are matched to their logs by commit time and log name; the identical +4 B offset across all four is what makes the match credible.
- **Single blocks.** A request above ~4.1 KB is refused outright (4,226 and 4,381 B logged as "oversize"; 4,000-element arrays work), and most other failures are 2-3 KB requests on a heap that is not full. The report's "single-block sizes" section flags both.

## Not calibrated

- The Race S itself: no `JsTotMem` line from a Race S exists. It runs the same FW 2.53.42 as the Vertical 2 logs, but its heap total, its firmware share and its allocator are inferred.
- Whether the watch allocator is a contiguous heap or a pool (decides whether matram's 7 arrays mean 28 KB free or 7 free large blocks); hardware test T3 in `SUUNTOPLUS-SENSORS/docs/research/deep-dive/limits.md` settles it.
- Template UI memory outside the JS heap, the firmware's per-app context cost, and what an in-menu disable actually retains.
