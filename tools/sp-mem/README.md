# sp-mem: SuuntoPlus app memory harness

`sp-mem` runs a SuuntoPlus app's JavaScript in real Duktape 2.7.0, the engine the watch uses ("Duktape BLE API err" in watch logs). It counts every byte the engine allocates. The output is app memory in two forms:

- **Measured** on this Mac (64-bit pointers).
- **Estimated** for a 32-bit ARM watch build, from a walk of every live heap object.

It also counts canvas draw calls per frame, so templates can be checked against the forum's Race S canvas budget.

```
node tools/sp-mem/sp-mem.js <appDir> [--scenario scenarios/x.js] [--display q] [--ticks N] [--set key=value] [--json out.json]
```

## Setup (once)

```
brew install duktape        # 2.7.0: headers and the libduktape used by the "brew" variant
brew fetch -s duktape       # source tarball into Homebrew's cache (for the source-built variants)
bash tools/sp-mem/build.sh  # builds build/sp-mem-{default,lowmem,brew}; about 10 s
```

`build.sh` unpacks the tarball to `/tmp/sp-mem-src/` (override with `SPMEM_DUKTAPE_SRC`). It needs Apple clang, which ships an `armv7k` backend, and the Command Line Tools macOS SDK. No Python is needed. Duktape's `configure.py` is Python 2 and is not used (see Limits).

The runner also needs:

- the SuuntoPlus Editor 1.42.0 extension in `~/.vscode/extensions` (its build library)
- `tools/sp-build/sp-build.js`
- `unzip`

## What a run does

1. **Build.** The runner builds the app with `sp-build` into `/tmp/sp-mem-run-*`, with `TMPDIR` pointed there so the build library's temp files stay inside. It picks the package `<appId>-<display>[-en].fea` by the appId the build reports, because app folders can hold stale packages of older appIds.
   - If `sp-build` rejects `ext*.js` files, the runner falls back to `lib/build-lib.js`. Those files are bare `function(...){}` expressions loaded by `evalFile`, and sp-build validates them as scripts. The fallback runs the same library steps and skips only that check, and the report says so.
2. **Extract.** The runner unzips the package and takes:
   - the **shipped** `main.js` (minified)
   - every template `*.xml`
   - `data.jsn`
   - `ext*.js`
   - the manifest
3. **Convert templates.** Each template becomes one generated JS view file (see Method).
4. **Run.** The runner runs every combination of form and variant in the C harness, in one Duktape heap each:
   - forms: `shipped`, the minified dispatcher the watch runs; `source`, your `main.js` with the `{{ }}` tokens applied by the build library
   - variants: `lowmem`, `default`, `brew`
5. **Report.** It prints tables. `--json` also writes everything machine-readable. `--keep` keeps the work directory.

Default scenario: load, `onLoad`, `onExerciseStart`, `getUserInterface` and template mount, then 60 `evaluate` ticks, then `onExerciseEnd` and `getSummaryOutputs`.

## Reading the report

| Row / column | Meaning | Measured or estimated |
|---|---|---|
| `host live` | Bytes the engine holds after two full GCs (requested sizes; allocator headers and malloc slack excluded) | measured |
| `app host` | `host live` minus the `baseline` checkpoint (engine + runtime stub + scenario, before main.js is compiled) | measured |
| `app est32` | The same delta computed from the heap walk with 32-bit struct sizes (below) | estimated |
| `app est32 watch-fit` | The lowmem walk re-sized with a layout that has the watch's 12-byte buffer header (16-bit heap pointers, 4-byte alignment; see Calibration). Reads 7-13% below lowmem | estimated |
| `step` | Change since the previous checkpoint | as its column |
| `load peak` | Highest live bytes during compile + onLoad + template mount, above baseline, before GC | host measured; est32 scaled by the checkpoint's est32/host ratio |
| `run peak` | Highest live bytes inside any tick (events, evaluate, subscriptions, canvas redraws), above baseline. Assumes a full GC after every tick (the harness forces one); a **lower bound** when `cyclic garbage` is above zero | as above |
| churn per tick | Allocation count and bytes per tick. `harness-only` comes from 5 dry ticks with no app loaded; `~app` = total minus harness-only | measured (host) |
| cyclic garbage | Host bytes per tick that only the tick-end mark-and-sweep frees (refcounting cannot: closures and scope records that reference each other). Value-stack shrink and activation/catcher freelists are subtracted. Stock Duktape runs a voluntary mark-and-sweep only after about 50 allocations per live object, so unless the firmware forces a GC per callback this garbage piles up across ticks until an allocation fails | measured (host), internal variants only |
| live growth (2nd half) | Live-after-GC slope over the second half of the run: a leak indicator | measured |
| by kind | Steady-state app bytes split into strings, objects, scopes (closure variable environments, i.e. module-level `var`s), functions (headers + bytecode/constants), property tables, array parts, buffers (typed arrays), engine | walk, both columns |
| allocator headers | App live blocks × 4-8 B (a watch allocator's per-block overhead is unknown) | estimated range |
| canvas table | Per canvas, the max over frames of each draw call, `max lineTo/path`, and `2*stroke+lineTo`. Flags: >200 (whole canvas dropped on Race S), >24 lineTo per path, calls outside the reference's supported list. Every frame's counts (tick, canvas, all ops) are in `--json` under `frames` | measured (counts) |
| single-block sizes | Largest live app block (engine blocks such as the value stack excluded: their size at a checkpoint is set by the driver's call depth), largest compiled-function data block (the watch requests this minus 4 B when compiling), largest transient request during load and within a tick. Flags blocks above ~2 KB (most watch failures) and above the ~4.1 KB cap (refused outright) | walk est32; requests measured (host) |
| checks | Walk coverage (residual bytes, size mismatches), app errors, refused allocations, brew-vs-default agreement | |

## Method

### Counting allocator (`harness/sp-mem.c`)

The heap is created with custom alloc/realloc/free functions. Each block carries a header holding its requested size, and the headers form a list so that live blocks can be enumerated. The allocator tracks:

- live bytes
- peak bytes
- live block count
- allocation events (alloc and growing realloc)
- cumulative requested bytes

Natives exposed to JS as `SPH.*`:

- `checkpoint(label)`: two `duk_gc` calls, then record live, phase peak and heap walk in C memory, then reset the peak.
- `live()`, `peak()`, `resetPeak()`, `gc()`
- `tickBegin()`, `tickEnd(t)`: per-tick churn and peak, then a GC.
- `load(path, kind)`: compiles a file from a C buffer, so the source never becomes a JS string. Kinds: global program, function body (`function(){` + src + `}`), or `evalFile` expression.
- `lsGet`, `lsSet`, `lsKind`: localStorage held in C memory, like `data.jsn` on the watch. `getItem` therefore allocates a fresh string each call; nothing is pre-interned.
- `recOpen`, `recNext`: byte recordings in C memory, delivered as BLE notifications.
- `cvMethod(op)`: native canvas methods that count calls per frame.
- `setLimit(bytes)`: simulated OOM. Duktape gets NULL, runs an emergency GC and retries.
- `maxReq()`, `resetMaxReq()`: the largest single request (alloc, or new size of a growing realloc) since the last checkpoint, tick start or reset.

Records are kept in C and written as JSON at exit, so recording results never touches the JS heap. Besides live and peak bytes, each checkpoint records `phaseMaxReq` (largest request in the phase) and, from the walk, `maxAppBlockT32`, `maxAppFnBlockT32` (largest app compiled-function block) and `appTopBlocks` (the 8 largest blocks allocated or grown after `baseline`, with category; engine blocks excluded). Each tick records `maxReq` as a 7th field and `msGarbage` (cyclic garbage freed by the tick-end GC, -1 in the brew variant) as an 8th, and `bigRequests` lists every request of 1 KB or more with its phase and tick, for comparison with the watch's `JSalloc:<n>` lines.

### Lifecycle and calling convention (`runtime/driver.js`, `runtime/stub.js`)

**Shipped form.** The build turns `main.js` into a function body. Top-level `var`s come first, then `return function(_e,_,_d){ if(2===_e){...} ... if(4096===_e) return {...} }`.

- The harness compiles that body as a function, calls it once, and keeps the returned dispatcher. The firmware must do something equivalent: the simulator rewrites `return function` to `function main`.
- The first line `// N` is the bitmask of implemented events (1 evaluate, 2 onLoad, 4 onLap, 128 onExerciseStart, 4096 getUserInterface, 16384 onEvent, ...). Events outside the mask are not called.
- `_` is one **Array**: manifest `in` values at `[0..p-1]`, then `out` values at `[p..p+s-1]`. The minifier rewrote `output.x` to `_[p+i]`. `_d` is the onEvent id.
- Module-level `var`s become variables of a closed-over environment record, one property entry each. They show up under "scopes" in the report.
- Terser inlines single-use helpers into the dispatcher. That is one reason the shipped form is smaller than the source form; the report's "shipped vs source" table shows the difference.

**Source form.** `main.js` with the build's `{{ }}` tokens applied runs as a global program. The callbacks are called by name with plain `input`/`output` objects, as the simulator does.

**Templates.** The shipped `t.xml` (machine-written XML, scripts XML-escaped) becomes one generated view file per template:

- The `uiView` `onLoad` script is the body of one function, so its `var`s are the shared scope.
- `onActivate`/`onDeactivate`, every `pushButton` handler, canvas `build`, `<eval>` `onValueChanged` and `outputFormat="script x => ..."`, and other `on*` handlers become inner functions. They register into numbered slots with `__v(slot, fn)`.
- Arrow attributes (`ctx => drawScreen(ctx)`) become `function(ctx){return (drawScreen(ctx));}`. Duktape 2.7 has no arrow functions, so the firmware must translate these itself; this mirrors that assumption.
- `{zapp_index}` becomes `0`.

**Order per tick.** Each tick runs, in this order:

1. scenario `onTick`
2. BLE events (only those queued before the tick, so connect → 100 → regUuid → 107 → enaCharNotf → 109 advances one step per tick)
3. queued main events (`$.put('/Zapp/0/Event', id)` → onEvent; `/Activity/Trigger` → onLap)
4. `evaluate`
5. new-subscription first values
6. resource subscriptions
7. timers
8. `unload('_cm')` remount
9. redraw of canvases marked by `control('#id','REFRESH')`
10. tick end (record, GC)

After any main.js callback, changed outputs are pushed to template `$.subscribe` callbacks and `<eval>` scripts.

**Runtime stub globals.**

- `$` (get, put, subscribe, unsubscribe)
- `setText`, `setStyle`, `getStyle`, `setVis`, `control`, `unload`
- `open`, `close`, `next`, `previous`, `first`, `last`, `select`, `navigate`, `gaugeControl`
- `playIndication`, `systemEvent`, `trace`, `translate`, `formatValue`, `sportAppActivityEvent`
- `enabledZappId`, `evalFile`, `setTimeout`, `clearTimeout`, `localStorage`
- `appConn`: up to 3 connections, each with its own handler, with events routed by the characteristic's `regUuid` connection.
- canvas ctx: methods are native functions; `measureText` returns a new `{width}`. The ctx properties exist before the baseline, so app assignments don't grow the object.

All stub bookkeeping slots are allocated before the baseline. The per-tick hot path allocates nothing in JS except what the app causes.

### Variants

| Variant | Engine | Heap walk |
|---|---|---|
| `brew` | Homebrew `libduktape` (stock config) | no; measured only, cross-check (matches `default` to the byte) |
| `default` | Same source, stock `duk_config.h` | yes |
| `lowmem` | `harness/config/lowmem.h` spliced in at duk_config.h's `__OVERRIDE_DEFINES__` marker | yes, plus the watch-fit layout (`harness/config/watchfit.h`, struct sizes only) |

What `lowmem.h` contains:

- Duktape's `config/examples/low_memory.yaml` options that don't change which built-ins exist: no PC2LINE, no fileName property, lightfunc built-ins, no activation/catcher caches, no value-stack slack, a fixed 128-entry string table, no literal cache, and so on.
- The 16-bit fields `REFCOUNT16`, `STRHASH16`, `STRLEN16`, `BUFLEN16` and `OBJSIZES16`.
- `HSTRING_CLEN` off; Duktape then requires `LAZY_CLEN`.

Buffer objects stay on, because SuuntoPlus has Uint8Array, Int8Array and Float32Array.

### The 32-bit estimate (est32)

**How the sizes are obtained.** `build.sh` cross-compiles `harness/probe32.c` with each variant's `duk_config.h` for `armv7k-apple-watchos` to assembly. armv7k aligns doubles to 8 like a Cortex-M `arm-none-eabi` target; `armv7-apple-ios` would not. The sizes are read into `build/<variant>/target_sizes.h`.

**How the walk works.** At each checkpoint the harness visits every engine allocation:

- the heap struct and string table
- every string
- every object, by its real subtype
- property tables (entry part, array part, hash part)
- compiled-function data (constants, inner-function pointers, bytecode)
- buffers, bound-function args
- thread value stacks, activations and catchers

It reads each block's real host size from the allocator header and checks it against the struct formula ("size mismatches"). It then computes the 32-bit size with the probe's sizes. Examples:

- property table: `e*(ptr+propvalue+1) + pad + a*tval + h*4`
- string: `hstring + len + 1`
- function data: `consts*tval + funcs*ptr + instrs*4`

Blocks not reached are reported as residual. In every run so far the walk covered 100% of live bytes with 0 mismatches.

**Struct sizes, host vs 32-bit** (bytes):

| | ptr | tval | propvalue | hstring | hobject | harray | hcompfunc | hdecenv | hbufobj | hbuffer_fixed | activation | duk_heap | 1-entry prop table |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| default, host | 8 | 16 | 16 | 32 | 56 | 64 | 104 | 80 | 88 | 32 | 96 | 5760 | 32 |
| default, 32-bit | 4 | 8 (packed) | 8 | 28 | 40 | 48 | 64 | 52 | 60 | 24 | 48 | 2944 | 20 |
| lowmem, host | 8 | 16 | 16 | 16 | 48 | 56 | 96 | 72 | 80 | 24 | 96 | 1624 | 32 |
| lowmem, 32-bit | 4 | 8 (packed) | 8 | 12 | 32 | 40 | 56 | 44 | 52 | 16 | 48 | 872 | 20 |

The probe also emits the property-table macro for sample sizes. The harness checks its formula against them at startup and reports a warning on any difference.

**The factor is not one number.** It depends on what the app holds:

- string bytes and bytecode don't shrink
- tvals and pointers halve
- headers shrink 30-40%

Observed est32/host ratios of app bytes are 0.66-0.74. Use the est32 columns, not a fixed factor.

**Engine baselines** (empty heap, RAM built-ins, no stub):

| | host | est32 |
|---|---|---|
| default | 102,571 B | 68,199 B |
| lowmem | 41,425 B | 26,489 B |

On the watch the built-ins are probably in ROM or otherwise not charged to an app. The report's baseline also contains the stub and driver, so compare **app** rows with watch budgets, not baselines.

### Calibration against watch logs

`calibration/` holds the experiments and their regression values (`calibration/README.md`). In short:

- **The watch's engine matches `lowmem`.** climb-logger's watch logs record the failing request when main.js did not compile (`JSalloc:<n>`). For four builds, n equals the harness's largest compiled-function data block (lowmem est32) minus 4 B, byte for byte. The logged sizes 2,095 and 4,381 are exact steps of lowmem's bytecode-buffer growth (PREFER_SIZE, no PC2LINE), and of no other configuration tested. Treat `default` as an upper bound only.
- **The watch's fixed-buffer header is 12 B**, 4 B less than lowmem's. The `watch-fit` column models that with 16-bit heap pointers and 4-byte alignment, one configuration that gives 12 B.
- **Scale.** On a Vertical 2 (FW 2.53.42) with Weather and Movement enabled, a `JsTotMem 131192/133120` reading next to climb-logger before an exercise leaves about 32-37 KB est32 for one more app, less during an exercise (`calibration/exp-budget.js`).
- **Single blocks.** Requests above ~4.1 KB are refused as "oversize"; most other failures are 2-3 KB requests on a fragmented heap. The report's single-block section checks both.

### Canvas counting

Each draw call is one native call counted into the current frame. A frame is one call of the canvas `build` function: at mount, and after each `control('#id','REFRESH')`. `max lineTo/path` resets at `beginPath`.

The two flagged budgets are matram's Race S measurements (forum 15279):

- about 24 `lineTo` per path
- `2·stroke + lineTo` ≤ ~200 per canvas per frame, beyond which everything on that canvas is dropped silently

## Scenarios

A scenario is a JS file run inside the harness before the baseline. It calls `scenario({...})`:

```js
scenario({
  name: 'mine',
  ticks: 60,                       // overridden by --ticks
  setup: function (sp) { ... },    // before the baseline: seed storage, open recordings, set inputs
  onTick: function (sp, t) { ... } // each tick, before BLE delivery and evaluate
});
```

`sp` (also the global `SP`) offers:

- **Buttons and events**
  - `sp.press('up'|'down'|'next'|..., 'onClick'|'onLongPressStart'|...)`: runs the mounted template's pushButton handler
  - `sp.trigger(tag, event, target, targetData)`: other template handlers
  - `sp.event(id)`: onEvent directly
  - `sp.lap()`
- **Storage**
  - `sp.storage.setItem(key, value)`, `setObject`, `setItemFromFile(key, path)`, `setObjectFromFile`
  - Values live in C memory. `data.jsn` is loaded first, so a scenario overrides it.
- **Inputs and resources**
  - `sp.input(name, valueOrFn(t))`: manifest `in` values (default 0)
  - `sp.resource(path, valueOrFn(t, k), perTick)`: `$.get`/`$.subscribe` resources such as `/Dev/Time/Tick10hz`
- **BLE**
  - `sp.ble.setDataType('array'|'uint8array'|'buffer')`
  - `sp.ble.open(path)` → handle
  - `sp.ble.feed(charId, handle, {lines, maxLen, perTick, loop})`
  - `sp.ble.notify(charId, bytes)`
  - `sp.ble.emit(charId, eventId, bytes)`, e.g. 101 DISCONNECTED
  - `sp.ble.readResponse(charId, bytes)`
  - `sp.ble.setAutoConnect(false)`
- **Utilities**
  - `sp.file('rel/path')`: relative to the scenario file
  - `sp.param(key, default)`: values from `--set key=value`
  - `sp.checkpoint(label)`
  - `SPH.print(...)`: shown under "scenario / harness output"

Keep big data out of JS variables that stay alive. A topo kept in a scenario variable would be interned before the baseline, and the app's identical string would then cost nothing. Load it with `setItemFromFile` or build it inside `setup`, as `topo-size.js` does.

Included scenarios:

- `default.js`
- `buttons.js`
- `ble-lines.js`: line-per-notification feed from `recordings/lk8ex1-synthetic.txt` at `rate` lines per tick, plus 4-byte packets on characteristic 2 and a disconnect/reconnect. The recording is **synthetic**: valid `$LK8EX1` checksums, values shaped like the UltraBip log in SUUNTOPLUS-SENSORS, but not a real capture.
- `topo-size.js`: a synthetic SuuntoPo topo of `points`/`anchors`/`features`, stored as `topo0`.

## Verified runs (2026-10-03)

**`reference/suunto_plus_examples/Buttons`, default scenario.** Shipped form, est32 app bytes:

| | lowmem config | default config |
|---|---|---|
| main.js loaded | 580 B | 724 B |
| UI mounted / steady | 1,538 B | 2,083 B |
| load peak | ~2.6 KB | ~5.9 KB |

- Host measured: 812 / 2,330 B (lowmem), 992 / 3,043 B (default).
- No growth over 60 ticks. With `buttons.js` the outputs end at topCount=24, bottomCount=20, as scripted.

**`MultiSensor` with `ble-lines.js`.**

- Both connections come up, notifications flow (value1=510, value2=52), and the ext*.js files load through `evalFile`.
- Steady est32: 3.2 KB (lowmem).
- Run peak about 8.1 KB est32 with Array payloads, 5.4 KB with `--set type=uint8array`.

**`src/suuntopo_canvas`, snapshot.** Read-only, appId `climbi01`, main.js 21:07, t.html 21:18 local time. The app was being edited by another session at the time.

- Steady state: about 49.5 KB est32 (lowmem), 61 KB est32 (default).
- Load peak: about 65 KB est32 (lowmem), scaled.
- Shipped vs source: the source form costs 3.4 KB more.
- Its three canvases stay far inside the budget (`2*stroke+lineTo` ≤ 26).

`topo-size.js` was written for the previous version (package `suunto01`, built 19:10). It does not open a topo in the current navigation, so it needs adapting once the app settles.

On that older package, 20 → 250 route points moved steady state from 37.9 to 52.8 KB est32 (lowmem). The single full-screen canvas reached `2*stroke+lineTo` 252 → 482, over budget.

## Limits and unknowns

- **The watch's engine build is only partly known.** Watch logs fingerprint the lowmem configuration and a 12-byte buffer header (see Calibration). Still not known:
  - the remaining options (whether 16-bit heap pointers or something else gives the 12-byte header; ROM built-ins; external strings)
  - the watch allocator's per-block overhead and whether it is a contiguous heap or a pool
  
  Forum hints at a stripped build: regex in main.js fails, Date is absent, ES5 only.
- **No ROM build.** `configure.py` and `genbuiltins.py` in the 2.7.0 tarball are Python 2, which is not installed here. ROM built-ins and options that add or remove built-in objects were therefore not built. They only change the baseline, which the app rows subtract.
- **Calibrated on a Vertical 2, not on the Race S.** All byte-exact anchors come from a Vertical 2 on FW 2.53.42 (the Race S's current firmware too). No Race S `JsTotMem` line exists; matram's Race S test (seven 4,000 B Uint8Arrays, 4,068 B est32 each) is consistent with the Vertical 2 figure but does not state its co-apps.
  - The simulator's resource list contains `/Ui/Script/MemoryPool/{Size,Reserved,Allocated,Peak}` (untested on hardware). A tiny template that reads `Allocated` before and after mounting an app, run on the Race S, would calibrate the Race S directly.
- **Allocator overhead is excluded.** Per-block headers and rounding of the watch's allocator are not counted; the report gives the block count and a 4-8 B/block range. Budgets derived from a few large blocks (matram's seven `Uint8Array(4000)`) are nearly pure payload, so an app with hundreds of small blocks needs that range on top of its est32 to compare.
- **GC timing is forced, not modelled.** Every tick ends with a full GC, so run peaks hold one tick's garbage at most. Stock Duktape 2.7 with refcounting triggers a voluntary mark-and-sweep only after about 50 × (live objects + strings) + 1,024 allocations. In a review run (2026-10-03, a scratch build in /tmp with the per-tick GC removed; not a harness option), SuuntoPo v0.3 grew about 3 KB host per map frame (empty topo slots) and about 50 KB per frame (one 10 KB topo) until the voluntary GC; the variant with hoisted `alongLine` callbacks did not grow. Whether the firmware forces a GC after each callback is unknown, so the `cyclic garbage` column, not the run peak, is the number to drive to zero.
- **est32 peaks are scaled, and the scaling errs high.** A walk of the pre-GC heap at the worst tick (review run, scratch build in /tmp, not a harness option; SuuntoPo v0.3) gave run-peak est32 0.5-6% below the scaled figure (garbage scope records shrink more on 32-bit than the steady mix). Load peaks cannot be walked mid-compile; bracket them as est32 at `UI mounted` + (load peak host − mounted host) × 0.5…1.0.
- **Template modelling is an assumption.** One compiled function per handler, sharing the onLoad scope. The firmware might compile per attribute, keep handler source, or hold the template text as a JS string while compiling. In that last case, add the template script size to the load peak. DOM/UI memory (the "exec. ui" pool) is separate and not modelled.
- **Behavioural assumptions:**
  - a new `$.subscribe` gets the current value once
  - subscriptions fire on change only
  - `setTimeout` fires at the next 1 s tick
  - `getObject` goes through JSON text (adds a temporary string to the peak)
  - BLE `data` is an Array by default (unverified on the watch)
  - template `{zapp_index}` becomes `0`
  - a trailing `;` in an arrow attribute (`ctx => draw(ctx);`, shipped by published apps) is dropped; how the firmware treats it is unverified
  - `setInterval` is not stubbed (the Graph example uses it and reports one app error)
- **Harness overhead is small but not zero.**
  - Output and input names and template element ids sit in the pre-baseline job description, so the app's identical literals are pre-interned: a few bytes per name. In the source form the output-object keys also benefit. A review run (2026-10-03) counted the pre-baseline stub/driver strings whose refcount the app raised: 45 strings, 816 B est32 for SuuntoPo v0.3 (2.6% of its steady state), 5 strings, 91 B for Buttons. Most are firmware API names (canvas methods, `localStorage`, `$`, `REFRESH`) that the watch interns anyway; one-letter identifiers are the rest.
  - Driver calls show up in churn. Dry ticks measure them, which is why `~app` churn subtracts them; the `lowmem` config has no activation cache and no value-stack slack, so every call allocates.
  - Peaks include a few hundred bytes of driver transients.
- **String and buffer length cap in `lowmem`.** `STRLEN16`/`BUFLEN16` cap strings and buffers at 64 KB. A settings string above that fails in `lowmem` only; SuuntoPo once declared `maxLength` 100,000. Whether the watch has this cap is a hypothesis, not a measurement.
- **Stale packages.** App folders can contain packages from older builds, and the build tools copy them into the output. sp-mem selects by the appId the build reports; anything else that picks "the `-q.fea`" can silently measure an old build.
- **Not implemented:**
  - accelerometer
  - nested `uiView` popups opened with `open()` (their handlers compile but are not driven)
  - inputs other than numbers
