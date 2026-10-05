# Changelog

All notable changes to this project. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); each app is versioned independently via its `manifest.json`. Entries below are added by the `/build-suuntopo` skill after every build.

## [Unreleased]

### suuntopo_canvas v1.0: watch fixes, rename, store prep (2026-10-04 to 2026-10-05)

- **Loader.** The template subscribed to 18 outputs and the Race S refused the 16th ("Too many sim. path-param calls"), so the topo stayed at "Loading 0%". It now subscribes to ms, mh and ck, asks main.js for one chunk at a time (event 4000000 + seq * 64 + k) and reads d0..d14 with sequential `$.get` calls, with a watchdog for lost requests. Tests 110/110; sp-mem steady -0.5 KB, load peak +0.4 KB.
- **Watch test.** Loads and navigates alone in a Climbing mode (11:21); unloaded for memory when sharing a mode with VarioLink. See `docs/suuntopo_canvas/HW_RESULTS.md`.
- **Rename.** Store name Suuntopo (app ID suunto01), with a not-affiliated-with-Suunto line in the listing, banner and editor.
- **Editor.** Source published at github.com/aabbeell/topo-editor; live at topo-editor.vercel.app.
- **Store.** Console form mapped (`store/suuntopo_canvas/listing.md`); 600 x 300 banner; markdown description; upload copies in `store/suuntopo_canvas/upload/`. First submit (2026-10-05) failed on Suunto's server with "Index 1 out of bounds for length 1"; retried with two categories.
- **Clean-up.** Hardware-test apps, the photo variant, v0.3 builds, the 1920 x 1080 banner and old plans moved to `archive/`.

### suuntopo_canvas v1.0 store submission package (2026-10-04, not yet tested on a watch, not uploaded)

Everything the store console takes, ready except the gates that need Vitya and a watch. Details in `store/suuntopo_canvas/listing.md`.

- **Package.** `builds/suuntopo_canvas/v1.0/climbi01-source-v1.0.zip` (24,347 B), made with the Editor's own `createSourcePackage` from `src/suuntopo_canvas`: exactly the 17 top-level files (manifest, main, data, en, t.html, u.html, ext0-ext10), each byte-identical to the source; `data.json` has no debug state and `ext6.js` the neutral Piccolo Fillar notes. Built again from the unpacked zip, it gives the same `.fea` contents as the release build. The release `.fea` files in `v1.0/` were rebuilt from the same source (only the `climbi01-*` files; `sp-build` also copies the stale `suunto01-*.fea` from the source folder, which stay out).
- **Manifest.** Checked against the store limits: name 13 B, version "1.0", description 16 B, `feature`/`workout`, both templates, inline enum, 19 outputs with 1 logged. `modificationTime` is now 1791081833 (2026-10-04). `activities` stays unset on purpose (undocumented, could hide the app; T8 checks).
- **Listing.** `listing.md` rewritten as the console text: store name, short description, a paste-ready long description (features, watches and displays, no sensors, five setup steps, limits, the required verification and rights notes, privacy), a ~615-character short version, a store FAQ that follows the editor's FAQ, the v1.0 release notes, and an upload table that says which file goes in which field.
- **Images.** Five 466 × 466 simulator screenshots on q in `store/suuntopo_canvas/` (Map at pitch 2 as the hero, topo list, pitch notes, Map at pitch 3 with the roof, Help card), all of the fictional demo, all fully loaded, no errors in the simulator log; the hero state also checked on n and o. Banner `banner.png`, 1920 × 1080, rendered from `banner.html` with the Editor's headless Chrome; the store's banner size is not documented, so the size is a guess (noted in `listing.md`).
- **Measured.** Tests: **102 passed, 0 failed** (full run). `sp-build`: no warnings on any display; `t.xml` 10,997 B, main.js 2,012 B, `climbi01-q-en.fea` 29,124 B.
- **Not done.** The upload gates are unchanged: H1, H2, H8 and H9 on a Race S, the hosted editor URL (Q4), name (Q1), author (Q2), support contact (Q5), and the console's field limits and banner size (Q12).

### suuntopo_canvas v1.0 review round 3 (2026-10-04, not yet tested on a watch)

Fixes from three reviews (platform, adversarial, product); details in `docs/suuntopo_canvas/SPEC.md` §23. 13 of the 102 tests fail on the round-2 code.

- **Stream.** evaluate() streams from onLoad, but the template mounts only when the app display is first opened (and again after a reload), so main.js carried on from a random chunk and the route waited for the stream to wrap around, up to 18 s for the Fictional Wall, under "Loading 99%". The activation report now says whether the template holds nothing (`3000000`), part of a topo (`3999999`) or the whole topo, and main.js restarts at chunk 0 only for nothing. Route after a late mount: 6 s / 4 s / 2 s (Wall / full slot / demo) at every offset; an overlay during a load still costs nothing. The loading line counts from chunk 0.
- **Template.** `onDeactivate` ends the refresh chain before unsubscribing and tolerates a throwing unsubscribe; activation reports and paints before reading outputs with `$.get`, and reads the units first. Tile refreshes are 100 ms apart (one per 10 Hz tick). Zig-zag and tick segments are capped at 8,000 px of patterned length per tile, so short crack segments that miss the tile can no longer cost 22,000-44,500 calls per paint (now about 3,450). The bottom tile ends at 79% and the Map fits 250 px, so nothing is drawn under the grade and length.
- **Screens and text.** Hold MIDDLE on the error card moves to the open demo's card instead of its Map. Help 2 says to send the line to the phone; the setting is "Topo line from editor". UI1 watches show "Not supported / on this watch" on two lines (cut off on s and l before). The editor FAQ covers moving the line from a computer to the phone, when a synced topo appears, unlocking from another display, and the Map and grade colours; the store descriptions match, and `listing.md` lists putting a short editor URL on Help 2.
- **Tooling.** `sync-watch.js` takes the template's `fitRange` calls from t.html; the harness reads the tile heights from t.html; T11 checks the editor preview's heights.
- **Measured.** Tests: **102 passed, 0 failed** (full run with 1,000 random sessions). `t.xml` 10,997 B (guard 11,000), onLoad 7,336 B (guard raised to 7,350), main.js 2,012 B (guard raised to the 2 KB research limit, 2,048), compile requests at most 2,376 B, largest compiled function block 1,880 B est32. sp-mem (lowmem est32): 39.2 KB steady with the demo (38.7 before), 41.7 KB steady and 56.1 KB run peak with the Fictional Wall (41.2 / 55.6). Builds in `builds/suuntopo_canvas/v1.0/`, `v1.0/hw-test/` and `v1.0/personal/`; Map, list, Help 2, error and not-supported screenshots refreshed in `v1.0/screens/`.
- **Not done.** Saving the position after a lap (Q13), an end marker against silently cut pastes (Q14), a progress line on the Map after the route (Q15), and neutral Piccolo Fillar pitch notes (Q8); the store gates (hosting, author, support, banner, H1, H2, H8, H9) need Vitya and a watch.

### suuntopo_canvas v1.0 review round 2 (2026-10-04, not yet tested on a watch)

Fixes from three reviews (platform, adversarial, product); details in `docs/suuntopo_canvas/SPEC.md` §22. Each fixed defect has a regression test that fails on the round-1 code (21 of the 95 tests).

- **Memory.** Every hold, activation and lap left several KB of cyclic garbage. main.js drops the prototype of each loaded file's function, the text writers and parsers drop their helpers before returning, ext0.js uses main.js's loader instead of calling `evalFile`, and the template keeps one units callback and sends units only when they changed. Cyclic garbage on the sp-mem tour: 2,596 → 1,948 B per tick on average, 17,970 → 13,307 B when opening the Fictional Wall; the rest is the harness's own `evalFile` wrapper (SPEC §8).
- **Text.** The parser rejects `<` and `&` (E2, E5, E7), because `setText` reads markup and entities; the editor writes `‹` and `+`.
- **Settings.** `data.json` ships `"lapAdv": "0"`: the integer made the build library warn on every build, which T8 missed because the warning goes to stderr. T8 now reads both streams and accepts only the build's informational lines.
- **Renderer.** The target ring is two round-capped segments instead of arcs and fills, so frames use only measured primitives. Crack zig-zags and roof, overhang and ramp ticks are drawn only on segments that near the tile and are at most two tile widths long, and a feature stops once the tile budget is spent: a valid slot topo with long cracks made about 1.1 million `vis()` calls per paint, now 417. The editor warns about pieces longer than 466 units. A refresh chain cut by a dropped timer or a throwing `control()` no longer stops every later refresh.
- **Screens.** "Hold MIDDLE: map" under the open topo's card once it is loaded; on the Map the position ("Pitch 2/4") is the top line and the progress line shows only until the route is drawn; Info shows "Notes 1/2"; error cards say what to do; `#h1` at 80% and `#ld` at 74% (no overlaps on n and o); dim terrain #8A8A8A on q (6.1:1).
- **Store.** The shipped Piccolo Fillar has neutral notes (T8 checks); `make-builtins.js --personal` writes the rich notes for `builds/suuntopo_canvas/v1.0/personal/`. The Fictional Wall's approach no longer says "for testing". `listing.md` names the watches in the long description, has a short version and one hero image, and makes the hosted editor a hard upload gate.
- **Measured.** Tests: **95 passed, 0 failed** (full run with 1,000 random sessions). sp-mem (lowmem est32): 38.7 KB steady with the demo open; 41.2 KB steady and 55.6 KB run peak (was 57.8 KB) with the Fictional Wall open. `t.xml` 10,924 B (guard 11,000), main.js 1,996 B, largest code ext 2,066 B (ext3.js, guard 2,100), compile requests at most 2,376 B. Builds in `builds/suuntopo_canvas/v1.0/`, `v1.0/hw-test/` and `v1.0/personal/`; screenshots refreshed in `v1.0/screens/`.
- **Not done.** Hosting the editor (Q4) needs Vitya; the banner, support contact and the console's field limits too.

### suuntopo_canvas v1.0 review round 1 (2026-10-04, not yet tested on a watch)

Fixes from three reviews (platform, adversarial, product); details in `docs/suuntopo_canvas/SPEC.md` §21. Each fixed defect has a regression test that fails on the reviewed code.

- **Stream.** A one-chunk topo whose words arrived before its stream id never loaded; the stream id now includes the topo id (two topos with equal content hashes kept the wrong drawing); at least two chunks alternate; the template reads `mh`/`ms` with `$.get` on activation, releases its subscriptions before re-subscribing, and runs one tile refresh chain at a time.
- **Robustness.** A topo, navigation or text file that fails to load no longer locks the buttons or skips the outputs; a failed `sv` write no longer restarts the stream; UI1 watches load and stream nothing.
- **Data.** The summary and the logged pitch ignore a position restored from an earlier exercise until a hold or lap moves it; a route saved at Top restores at Start; `sv` is written only when it changed and not on laps; the slot is trimmed (pasted newline, spaces, BOM); lap advance reads the integer enum the phone app stores (`data.json` ships `"lapAdv": 0`).
- **Screens.** Two Help cards (buttons, loading a topo); "Hold MIDDLE: open" on cards that are not open; a broken slot opens on its error card; "4 pitches" instead of "4 P"; "more" instead of "(1/2)"; brighter done pitches (4.4:1) and blue approach/descent walks; belay dots drawn without arcs; the loading line moved off the current pitch.
- **Editor.** Renamed "Climbing Topo editor"; new "On the watch: how to and FAQ" panel.
- **Store.** `make-builtins.js --store` writes Piccolo Fillar with neutral notes; acceptance A8 is Open until Q7 is decided; H1, H2, H8 and H9 are release gates, recorded in `docs/suuntopo_canvas/HW_RESULTS.md`.
- **Measured.** Tests: **83 passed, 0 failed** (full run with 1,000 random sessions). sp-mem: 38.7 KB steady with the demo open, 41.2 KB steady and 57.8 KB run peak with the Fictional Wall open (lowmem est32); the v1.0 tour figures (37.9/51.6 KB) never opened the Wall because its slot fixture failed to parse (SPEC §8). `t.xml` 10,791 B, main.js 1,969 B. Builds in `builds/suuntopo_canvas/v1.0/` and `v1.0/hw-test/`, screenshots refreshed in `v1.0/screens/`.

### suuntopo_canvas v1.0 "Climbing Topo" (2026-10-03, not yet tested on a watch)

Rewrite to `docs/suuntopo_canvas/SPEC.md` and its binding decisions. The spec was updated where implementation proved it wrong: §0, §4, §8, §9, §11, §16, §17 and the new §20.

- **Topos.** One settings slot (`topo0`, 1,500 B) in the compact one-line `STP1` format. Four built-in topos ship as `ext4.js`-`ext7.js`:
  - Fictional Demo, 4 pitches;
  - Jägerhorn N, 1 pitch, schematic;
  - Piccolo Fillar, 15 pitches with traverses, schematic;
  - Fictional Wall, 30 pitches, 3.2 KB.

  The fictional topos are labelled "Not a real climb" and the real routes "Schematic topo".
- **Architecture.** main.js parses the topo with `ext1.js` + `ext9.js` and writes all text from `ext3.js`, `ext8.js` and `ext10.js`. It streams the geometry to the template as checked numeric chunks (`ck`, `d0..d14`, one per second). The template only draws: three canvas tiles, a hard cap of 150 units each, terrain culled by priority.
- **Buttons.** Long presses only (up/down = belay, middle = Map → Info → topo list). Clicks stay native: pause, lap, next display.
- **Lap.** An optional lap advance (setting, default Off). The logged `Pitch` output and the "Highest pitch" summary skip the fictional topos. The position is saved only on user actions, pause and end.
- **UI1.** s, m and l get a "Not supported on this watch" template.
- **Editor.** STP1 export ("Copy for Suunto app", .txt, built-in `ext.js` file) with a UTF-8 byte budget, belays sorted along the route, grade systems with bands, and approach and descent notes. The preview runs the watch renderer (`watch.js`, generated by `sync-watch.js`).
- **Tests.** `node test/suuntopo_canvas/run.js` runs T1-T11 (codec, fuzz, render budget, wired navigation and stream with 1,000 random sessions, l10n, static rules, build and Duktape compile sizes, main.js, editor). Full run on 2026-10-04: **69 passed, 0 failed**. The full run found a stream stall when going back to a topo after a half-streamed one; it is fixed, with a regression test.
- **Build.** `sp-build` passes with no warnings: `builds/suuntopo_canvas/v1.0/` (`climbi01`) and `v1.0/hw-test/` (full slot, lap advance On). The screenshots reviewed on q, o and n are in `v1.0/screens/`.
- **Known limits.**
  - sp-mem measures 37.7 KB steady and a 51.6 KB run peak (lowmem est32), above the binding 16/20 KB targets.
  - `t.xml` is 10.6 KB, against a target of 8-10 KB.
  - The hardware checklist (SPEC §16c), above all H1 (stream) and H9 (memory), decides the release.

## [Baseline] — 2026-05-06

Repository restructured for sharing. Every app's most recent build prior to this point is preserved under `builds/<app>/v<manifest-version>/`.

### Apps and their baseline versions

- `suuntopo_canvas` — **v0.3** — Climbing topo viewer with selector (canvas-vector rendering)
- `suuntopo_image` — **v0.2** — Image-based topo viewer (fallback rendering path)
- `suuntopo_hwtest` — **v0.1** — Topo HW test app
- `suuntopo_hwtest2` — **v0.1** — HW test 2
- `suuntopo_hwtest3` — **v0.1** — HW test 3 (selector + multi-subscribe + localStorage)
- `topo_editor` — unversioned — Browser-based visual topo editor

### Project structure

- Reorganized top level into `docs/`, `reference/`, `src/`, `builds/`
- Added `README.md`, this changelog, and the `/build-suuntopo` skill
