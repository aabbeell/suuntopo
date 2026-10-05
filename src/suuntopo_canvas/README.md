# suuntopo_canvas: Suuntopo v1.0

**Status:** v1.0 is implemented (2026-10-03), with review rounds 1, 2 and 3 fixed (2026-10-04, SPEC §21-§23). It is verified in Node (102 tests) and in the simulator on q, o and n, and has **not yet run on a watch**. Hardware items H1, H2, H8 and H9 are release gates; results go in `docs/suuntopo_canvas/HW_RESULTS.md`. This is the primary app. The full specification, including every deviation from the original design, is `docs/suuntopo_canvas/SPEC.md`.

Suuntopo shows a multi-pitch route on the watch, belay by belay. The canvas draws the route and the terrain; the grade, the length and the notes are text. It has three views:
- **Topo list.** The open topo is drawn whole, with "Hold MIDDLE: map" under it once it is loaded. Other topos are listed as text cards ("Hold MIDDLE: open"), and the list also holds an error card for a broken slot (shown first at start-up, with what to do) and two Help cards: the buttons, then how to load a topo.
- **Map.** The current pitch, auto-fitted, with the position ("Pitch 2/4") as the top line.
- **Info.** The pitch notes, or the approach at Start and the descent at Top; "Notes 1/2" when they take more than one page.

## Topos

- **One user topo** in the settings field "Topo line from editor" (`topo0`, at most 1,500 bytes). It is pasted from the topo editor (`src/topo_editor`) as a single `STP1` line.
- **Four built-in topos**, shipped as `ext4.js`-`ext7.js`:

  | File | Topo | Label |
  |---|---|---|
  | ext4.js | Fictional Demo, 4 pitches, localized | Not a real climb |
  | ext5.js | Jägerhorn N, 1 pitch | Schematic topo |
  | ext6.js | Piccolo Fillar, La Diretta + Bisaccia, 15 pitches with traverses | Schematic topo |
  | ext7.js | Fictional Wall, 30 pitches, 3.2 KB (near the file limit) | Not a real climb |

  The schematic topos are original drawings, made in `test/suuntopo_canvas/fixtures/make-builtins.js`. Real routes must be checked on site. The shipped Piccolo Fillar has neutral notes, so the source package is store-safe (test T8 checks). Its rich notes paraphrase guidebook-based material: `make-builtins.js --personal` writes them for a personal build (`builds/suuntopo_canvas/v1.0/personal/`), never for the store unless Vitya confirms the notes in writing (SPEC §18 Q7). Run `make-builtins.js` without the flag again before building a store package.

  The editor's "Download built-in file (ext.js)" writes a built-in file. To swap a built-in, save the file as `ext5.js`, `ext6.js` or `ext7.js`, update the card index (name~grade~pitches) in `ext3.js`, and rebuild. Test T5 fails when the index and the files disagree.

  Which built-ins count as fictional is decided by position, not by data. `main.js` and `ext3.js` treat an id that is 1 mod 3 as fictional: ids 1 (demo) and 4 (wall). That id gets the "Not a real climb" label and logs no pitches. So a real route saved as `ext7.js` would be mislabelled, and the test must be changed with it.

  A fifth built-in needs code changes:
  - Built-in t loads from `ext(t+3)`, and `ext8.js` is already the Map text.
  - The built-in count is `S[11]` in main.js.
  - The fictional test above must be revisited.

## Buttons

The app never uses clicks: pause, lap, next display and crown stay native on every screen. Long presses (0.6 s) navigate. They are `longType="action"`, so the button lock blocks them.

| Long press | Topo list | Map, Info |
|---|---|---|
| Up | next card | next pitch (Start, 1..n, Top) |
| Down | previous card | previous pitch |
| Middle | open the card's topo (Map) | Map → Info pages → topo list |

The setting "Lap moves to next pitch" (default Off) lets a native lap advance one pitch. It is an enum, which the phone stores as an integer; ext0.js reads both integer and string. data.json ships the default as the string `"0"`, as the reference's example does, so the build library does not warn.

## How it works

- **main.js** owns everything except drawing:
  - **Topos:** reading the slot and the built-ins, and parsing with `ext1.js` + `ext9.js`. While another topo is open it keeps only the slot's card and reads the slot again to open it.
  - **Navigation:** `ext2.js`.
  - **All text,** written with `setText`/`setStyle`: topo cards (`ext3.js`), the error and Help cards (`ext11.js`), Map (`ext8.js`) and Info (`ext10.js`).
  - **State:** start-up (`ext0.js`, which also opens the start-up topo; the demo opens if it cannot load) and the saved position `sv`, written on long presses, pause and end when it changed.
  - **Recording:** lap advance, the logged `pitch` and the "Highest pitch" summary. A position restored from an earlier exercise counts only after a hold or lap moves it.
- **t.html** only draws. main.js streams the open topo's geometry to it as numeric outputs: `mh` is the stream id (content hash + 65536 × topo), `ck` is the chunk index, `d0..d13` are 14 words of 24 bits, and `d14` is a check word. The outputs may arrive in any order. One chunk goes per second. The demo takes about 6 s and the Fictional Wall about 19 s. The route appears first, with "Loading NN%" until the terrain is in. The template:
  - checks each chunk;
  - stores the words in one 1,932-byte `Uint8Array`;
  - draws three canvas tiles, with a hard cap of 150 units per tile; the renderer keeps its state in its own function scope, so no scope record reaches the 56 names where Duktape adds a hash part;
  - sends long presses and stream status back as events.
- **u.html** is the "Not supported on this watch" screen for s, m and l, as two centred lines (one line was too wide for s and l).

Every ext file is a function expression that main.js loads with `evalFile` only when it is needed. That keeps every compiled block at or under 2,499 B, the Duktape limit measured by test T8. Only main.js's `ext()` calls `evalFile` (ext0.js gets that loader as an argument), and it sets the loaded function's `prototype` to null; every code ext file sets its inner helpers' `prototype` and variable to null before it returns. Both break reference cycles that would otherwise stay as garbage until a full mark-and-sweep (test T7, SPEC §8).

## Files

| File | Role |
|---|---|
| `manifest.json` | name, settings (`topo0`, `lapAdv`), 19 outputs (1 logged) |
| `data.json` | `{ "topo0": "", "lapAdv": 0, "sv": "" }` |
| `en.json` | every watch string |
| `main.js` | lifecycle, stream, persistence, logging |
| `ext0.js` | start-up: settings, slot parse and card, saved position, opening the start-up topo |
| `ext1.js`, `ext9.js` | STP1 parser, stages 1 and 2 |
| `ext2.js` | long-press navigation and lap advance |
| `ext3.js`, `ext8.js`, `ext10.js` | text of topo cards (with the built-in card index), Map and Info |
| `ext11.js` | text of the error card and the two Help cards |
| `ext4.js`-`ext7.js` | built-in topos |
| `t.html` | renderer and stream receiver (n, o, q) |
| `u.html` | UI1 fallback (s, m, l) |

The `suunto01-*.fea` files in this folder are stale v0.3 build outputs. They are not part of any package.

## Build, test, simulate

```
node test/suuntopo_canvas/run.js                       # all tests (QUICK=1 for a shorter T5)
node tools/sp-build/sp-build.js <package copy> <out>   # build; T8 builds from a clean copy
node test/suuntopo_canvas/sim-fixture.js <dir> --display q --dbg 1,1,2   # scratch app for the simulator
node tools/sp-mem/sp-mem.js <package copy> --scenario test/suuntopo_canvas/sp-mem-tour.js --json tour.json
node test/suuntopo_canvas/sp-mem-garbage.js tour.json    # cyclic garbage per tour action (SPEC §8)
node test/suuntopo_canvas/sp-mem-measure.js [appDir]    # memory on every scenario (lowmem est32, SPEC §8 round 4)
```

Release packages are in `builds/suuntopo_canvas/v1.0/`, with the store source package `suunto01-source-v1.0.zip` (the Editor's `createSourcePackage`; store text and images in `store/suuntopo_canvas/`), the hardware-test package (full slot, lap advance On, stored as an integer like a phone sync, so its build warns about `lapAdv` on purpose) is in `v1.0/hw-test/`, and packages with the rich Piccolo Fillar notes for Vitya's own watch are in `v1.0/personal/` (never upload these). Reviewed screenshots are in `v1.0/screens/`.

## Known limits

- **Memory.** sp-mem measures 35.2 KB steady with the demo open, and 37.5 KB steady with a 51.9 KB run peak when the Fictional Wall is opened and streamed (lowmem est32, SPEC §8, round 4; 38.7 KB and 41.2 KB before). That is above the binding 16/20 KB targets, which no feature cut short of dropping the runtime topo stream reaches. Hardware test H9 decides whether the app runs alongside another app; the measured cuts and their memory are in SPEC §8 round 4 and §18 Q16.
- **The template** (`t.xml`) is 11.0 KB (10,997 B), against a research target of 8-10 KB.
- **Cyclic garbage.** Each hold still leaves 5-7 KB (host bytes) until a full mark-and-sweep, about 25% less than round 1; what is left is measured as the harness's own `evalFile` wrapper keeping each loaded file's compiled code (SPEC §8). H9 checks the watch.
- **Long patterned segments.** A crack, roof, overhang or ramp piece longer than two screen widths on the zoomed-in Map draws as a plain line, and each tile steps along at most 8,000 px of patterned segments, which bounds the drawing work (SPEC §7); the editor warns about pieces over 466 units.
- **A lap is not saved.** The position is saved on holds, pause and end; a mid-exercise reload goes back to the last hold (SPEC §12, Q13).
- **A paste cut in its tail can parse** with terrain or the end of a note missing; STP1 has no end marker yet (SPEC §12, Q14).
- **The Fictional Wall's 3.2 KB string stays live while it is open**, above the ~2 KB dependable block (SPEC §18 Q9).
- **Hardware-only questions** are listed in SPEC §20 and the checklist in SPEC §16c.

## Version history

- **v1.0 round 4** (2026-10-04): memory (SPEC §8). Bound subscription callbacks with a closure fallback, no automatic prototypes on template functions, the renderer in its own scope, error and Help cards in `ext11.js`, ext0.js opens the start-up topo, and main.js keeps only the slot's card while another topo is open. 4.0 KB less steady and 4.9 KB less load peak by default, 5.5 KB less steady with a full slot and the Wall; nothing visible changed.
- **v1.0 round 3** (2026-10-04): review fixes (SPEC §23). The route comes first after the template mounts or reloads mid-stream; hardened activation and deactivation; tile refreshes 100 ms apart; a per-tile cap on patterned length; nothing drawn under the Map's grade line; MIDDLE on the error card goes to the open topo's card; Help 2 and the setting name ("Topo line from editor") say how the line gets to the phone; the not-supported screen on two lines.
- **v1.0 round 2** (2026-10-04): review fixes (SPEC §22). Less cyclic garbage per hold, activation and lap; `<` and `&` rejected in topo text; lap setting shipped as a string; ext0.js uses main.js's loader; target ring without arcs; bounded drawing work for long patterned segments; a refresh chain that recovers from dropped timers; neutral Piccolo Fillar notes by default; "Hold MIDDLE: map" on the first screen; the position as the Map's top line; "Notes 1/2"; error cards that say what to do; layout without overlaps on n and o; brighter dim terrain.
- **v1.0 round 1** (2026-10-04): review fixes (SPEC §21). Stream order independence and a unique stream id, one refresh chain, released subscriptions, belay dots without arcs (only the target keeps them), failed loads that no longer lock the buttons, no carry-over of the previous exercise's pitch, trimmed slot, integer lap setting, card index, two Help cards and hints, brighter done and walk colours.
- **v1.0** (2026-10-03): rewrite to SPEC v1.0. Covers the STP1 format, one 1,500-byte slot plus 4 built-in topos, main.js parsing with a chunked geometry stream, a three-tile budgeted renderer, long-press-only navigation, lap advance, the logged pitch and the summary.
- **v0.3**: JSON topos in three slots, template parsing, click overrides, a hard-coded Salathé topo.
