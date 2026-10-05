# Developer notes

How Suuntopo is built, what the real watch allows, and how to extend it. Read this before changing `src/suuntopo_canvas/`.

## Tooling

Everything runs from the command line on a Mac. The tools are in this repo's `tools/` and, as a reusable snapshot, in [suuntoplus-agentic-dev-env](https://github.com/aabbeell/suuntoplus-agentic-dev-env) (clone it next to this repo):

- **Build and validate**: `node tools/sp-build/sp-build.js src/suuntopo_canvas [outDir]` (the SuuntoPlus Editor's own build library, all six displays).
- **Simulator screenshots and deploys**: the `suunto-mcp-bridge` VS Code extension and its client, `node tools/suunto-mcp-bridge/call.js <build|deploy|screenshot|sim_log> '<json>'`. VS Code must be open on this folder.
- **Watch log**: `node tools/watch-log/watch-log.js [serial] --grep "suunto01|JsTot|relMem|path-param|Disable"`.
- **Memory**: `node test/suuntopo_canvas/sp-mem-measure.js` (sp-mem: real Duktape 2.7, lowmem, 32-bit estimate) over the scenarios in `test/suuntopo_canvas/sp-mem-*.js`.
- **Round-screen check**: `node tools/safe-area.js <screenshots>`.
- **Watch quirks**: `tools/SHARED_RESOURCES.md` and the agentic-setup repo's `docs/WATCH_QUIRKS.md`. Store submission: its `suuntoplus-store-submission` skill.

## Daily loop

```bash
node test/suuntopo_canvas/run.js                 # 110 tests: codec, renderer budget, navigation, stream, build, editor; must be 0 failures
QUICK=1 node test/suuntopo_canvas/run.js         # faster, a tenth of the random sessions
node test/suuntopo_canvas/sp-mem-measure.js      # memory before and after any template change
node src/topo_editor/sync-watch.js               # regenerate the editor's watch.js after renderer or parser changes
node test/suuntopo_canvas/sim-fixture.js <dir> --slot file.stp   # scratch build with a topo in the slot, for screenshots or a watch test
```

Deploy only from `src/suuntopo_canvas` (or the same scratch folder each time): the watch assigns the app ID per source folder, and another folder installs a second "Suuntopo". The store package is `createSourcePackage` of that folder; see `store/suuntopo_canvas/listing.md`.

## Architecture

- **Two halves.** `main.js` owns the topo library (one settings slot plus four built-in ext files), navigation, persistence, lap advance and FIT logging. The template `t.html` owns the drawing: three canvas tiles refreshed 100 ms apart.
- **Topo format.** One `STP1` line (at most 1,500 bytes in the `topo0` setting), parsed by `ext1.js` then `ext9.js` into 24-bit geometry words: header, stances, route points, a feature table and feature points.
- **Pull stream.** The template subscribes to only three outputs: `ms` (drawing state), `mh` (stream id) and `ck`. It asks for one chunk at a time with event `4000000 + seq * 64 + k`; `main.js` writes chunk k to `d0..d13`, its check word to `d14` and the request to `ck`; the template reads `d0..d14` with sequential `$.get` calls and keeps the chunk when the check word matches. A watchdog re-sends a request that gets no answer. The route chunks come first, so the route draws before the terrain.
- **Cold code in ext files.** Navigation (`ext2.js`), text writers (`ext3.js` cards, `ext8.js` Map, `ext10.js` Info, `ext11.js` errors and help), slot reading (`ext0.js`) and the built-ins (`ext4-7.js`) load per use. Only `main.js` calls `evalFile`; `ext0.js` gets main.js's loader passed in.
- **Buttons.** Only long presses, so pause, lap and display change stay native and the watch's button lock blocks the holds.

## Watch limits that shaped the design

- **Subscriptions.** A sport mode allows only so many simultaneous resource subscriptions, shared with the mode's own screens. v1.0 subscribed to 18 outputs and the Race S refused the 16th (`Too many sim. path-param calls`), leaving "Loading 0%". Hence the 3-subscription pull stream.
- **Memory.** About 35 KB steady by the sp-mem estimate; it works alone in a Climbing mode but is unloaded (`relMemCb`) when another of our apps shares the mode. Suuntopo should be the only SuuntoPlus app in its mode.
- **Canvas budget.** Each tile has a hard draw-call budget; terrain is culled per tile and long decorated lines are capped.
- **Settings** cannot be edited for a sideloaded app; bake a test topo into `data.json` with `sim-fixture.js --slot`.

Full detail and history: `docs/suuntopo_canvas/SPEC.md` (binding decisions at the top, open questions in §18) and `docs/suuntopo_canvas/HW_RESULTS.md`.

## Adding a built-in topo

1. Draw it in the [editor](https://topo-editor.vercel.app) (source in `src/topo_editor/`) and use **Download built-in file (ext.js)** (at most 3,500 bytes).
2. Add it as a new ext file, raise the built-in count in `ext0.js`/`main.js`, and add it to `test/suuntopo_canvas/lib/harness.js` `TOPO_EXT`.
3. Real routes must be your own drawings with neutral notes unless you have the rights holder's permission (SPEC Q7, Q8).
4. Run the tests and the memory scenarios, then a watch run.

## Related projects

- [suuntoplus-agentic-dev-env](https://github.com/aabbeell/suuntoplus-agentic-dev-env): the build, deploy, simulator, memory and watch-log tooling these apps use, and the store-submission skill
- [AirTemp for Suunto](https://github.com/aabbeell/suunto-airtemp): air temperature and humidity from a Bluetooth sensor
- [VarioLink for Suunto](https://github.com/aabbeell/suunto-variolink): paragliding vario display for Bluetooth varios
