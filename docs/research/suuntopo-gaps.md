# SUUNTOPO gap analysis: from POC to a store-ready SuuntoPlus app

Project root: `<projects>/SUUNTOPO`. Everything here was read locally. I did not run git; the history comes from `.git/logs/HEAD`. API facts were checked against `reference/suuntoplus_reference_docs.md` and the SuuntoPlus Editor 1.42.0 extension (`schema/manifest.json`, `templates/`). Anything marked **(inferred)** is my conclusion and not documented.

---

## 1. What the app does today

### 1.1 Repo state
- **Git history:** 8 reflog entries. 4 are from 2026-05-06 (restructure, the build skill, READMEs). 4 are from 2026-10-03, all about the MCP bridge in `tools/suunto-mcp-bridge`. There are **no tags**, so the `/build-suuntopo` release skill has never been run. There is also no `builds/<app>/latest` symlink. `CHANGELOG.md` holds only the "Baseline" entry.
- **App source dates:** the canvas app was last changed in March 2026 (`main.js` and `t.html` on Mar 17, `manifest.json` and `data.json` on Mar 16).
- **Builds:** `builds/suuntopo_canvas/v0.3/` holds `suunto01-{l,m,n,o,q,s}.fea` plus a zip. It also holds stale `suunto04-*.fea` files from Mar 16. The `-q.fea` package (an uncompressed zip) contains `data.jsn` (1727 B), `main.js` (678 B), `manifest.jsn` and `t.xml` (18.7 KB). Fresh copies of the same size were built today into `src/suuntopo_canvas/` (they are gitignored).
- **Other apps:**
  - `suuntopo_image` v0.2 is experimental, with two baked-in PNG photo topos.
  - `suuntopo_hwtest`, `hwtest2` and `hwtest3` (all v0.1) are hardware probes.
  - `topo_editor/index.html` is a single-file web editor of about 2000 lines.

### 1.2 `suuntopo_canvas` (primary app, v0.3)

**Architecture**
- `main.js` is a pure state machine with no drawing.
- `t.html` does all the rendering. The roughly 850 lines of drawing JavaScript live inside the `<uiView onLoad="...">` attribute string.
- They talk only through 5 output resources: `appMode`, `selectorIdx`, `topoIdx`, `anchorIdx` (which is actually a route waypoint index) and `zoomLvl`. The template subscribes to them in `onActivate` and calls `control('#tc','REFRESH')`.
- Rendering uses one full-screen `<object id="tc" type="canvas" build="ctx => drawScreen(ctx)">`.

**Views (`appMode`)**

| Mode | View | What it shows |
|---|---|---|
| 0 | Selector | Title "SUUNTOPO" (32px). List rows at y=155+60·i: name (22px), "grade N pitches" (16px), with a ">" marker on the selected row. Hint "CROWN = select". No scrolling or truncation. |
| 1 | Map | Features, then the red route polyline, then anchor dots (current one yellow and larger, others coloured by grade) with grade labels, then a vignette mask. HUD: topo name at the top (12px), "pitch/total grade length" at the bottom (14px), and progress dots on an arc at 3 o'clock, spaced 14° apart. The view centres on the current route **waypoint**. Zoom is `zoomLvl/10`: default 1.2, range 0.5–3.0, step 0.2. |
| 2 | Info | Pitch number and grade (40px), the length, `info` text word-wrapped at 22px and cut off silently around y=h−80, the position line, and a "^  v" hint. |

**Buttons** (template lines 893–903, sent as events 1–6 to `onEvent`)

| Button | Selector | Map / Info |
|---|---|---|
| up click | previous row | next waypoint (`anchorIdx++`) |
| up long (onLongPressStart, 0.6 s) | — | zoom in (map only) |
| down click | next row | previous waypoint |
| down long | — | zoom out (map only) |
| next (middle) click | open the topo (waypoint reset to 0) | toggle map ↔ info |
| next long | — | back to selector |

The app overrides the upper, lower and middle buttons, both click and long press, for as long as its view is shown.

**Data model** (`EDITOR_SPEC.md`)
- Top-level fields: `{name, wall, grade, pitches, width, height, anchors[{x,y,grade,length,info}], route[[x,y]...], features[...]}`.
- Feature types: rect `{type,x,y,w,h}`, diagonal arete `{x1,y1,x2,y2}`, point `{x,y}` (`label` also has `text`), and polyline `{points}` for `contour` and `contour_poly`.
- About 22 feature types are drawn programmatically, each wrapped in its own try/catch: crack, chimney, corner, couloir, overhang, roof, ledge, slab, arete, ramp, contour, contour_poly, bolt, piton, rappel, chockstone, tree, grass, cross (shown as "Scree" in the editor) and label.
- 1 editor unit is meant to equal 1 watch pixel.
- The current pitch is worked out by snapping each anchor to its nearest route vertex (`findRouteIdx`). The current pitch is then the last anchor whose vertex index is at or below the current waypoint, so anchor *i* is treated as the **start** of pitch *i*.

**How topos reach the watch**
1. Draw the topo in `topo_editor/index.html` (a desktop browser, mouse only).
2. Click **Export JSON**. The modal shows pretty-printed JSON; you can copy it or download it.
3. Paste it into one of three phone settings declared in `manifest.json`: `topo0`, `topo1` or `topo2`. Each is a `string` with `maxLength` 100000. Per the docs, `maxLength` is counted in **UTF-8 bytes**.
4. The phone syncs the settings to the watch, where they are stored in the app's `data.json` storage.
5. When the app loads, **two separate parsers** read them:
   - `main.js onLoad` uses `localStorage.getItem` + `JSON.parse`, falling back to `getObject`. It only needs `.route`, and it updates `TOPO_COUNT` and `ROUTE_COUNTS`.
   - The template's `onLoad` (`parseTopo`) requires the string to start with `'{'` and to have `name`, `anchors` and `route`. It pushes valid topos after a hardcoded copy of Salathe.
6. `data.json`, which ships inside the package as `data.jsn`, puts the Salathe example in `topo0`. **(inferred)** A fresh install therefore lists Salathe twice: the hardcoded copy plus the `topo0` copy.

**Hardware test record**

| Probe | Recorded result |
|---|---|
| `hwtest` | Minimal canvas plus up/down. Its README lists what it tests, not explicit results. |
| `hwtest2` | Multi-output `$.subscribe` works on the watch. Writing the same value again does **not** fire the subscription. |
| `hwtest3` | Selector, map and info mode switching works on hardware **with** a counter workaround: `appMode*100 + modeCounter`. |

- **The canvas v0.3 app does not use that counter**, although the hwtest3 README says the full app inherits it. The docs and code disagree here.
- No hardware result is recorded for any of these:
  - settings sync of JSON strings
  - the size limits of `data.json`, the package or `localStorage`
  - canvas performance or memory limits (the Phase 0 tests in `docs/phase0_test_plan.md` and `implementation_plan_v2.md`)
  - the vignette, the zoom-scaled fonts, the grade colours, or `strokeRect`
- All README screenshots are **simulator** captures, and the selector screenshot is from an older dataset. CLAUDE.md itself says settings cannot be edited in the simulator, so the core data pipeline has never been checked end to end on a watch.

### 1.3 Other apps
- **`suuntopo_image`**
  - Two `c64` PNGs (313×880 and 200×396). Anchors are stored as 0..1 relative coordinates, and midpoint waypoints are generated between them.
  - It uses DOM views moved with `setStyle left` instead of `unload`.
  - It is limited by the 2-image cap and has no over-the-air image sync, so it cannot be used to share topos.
  - Its Slovak text has the diacritics stripped. **(inferred)** That looks like a font workaround.
- **`topo_editor`**
  - Tools: select, route (left-click adds a point, right-click adds a point plus an anchor), anchor toggle, the feature tools, and contours.
  - Pitch list with grade, length and info fields.
  - Background image with a 4-corner perspective transform.
  - 50-level undo, import/export and download.
  - A 240px watch preview with a viewport overlay, and a status-bar size counter.

---

## 2. Concrete defects found in the current code

1. **Topo count and index mismatch between `main.js` and `t.html`.**
   - `main.js` (lines 20–37) sets `TOPO_COUNT = slot+2` for any slot that parses and has `.route`.
   - The template only appends slots that pass its stricter checks: the string must start with `'{'`, and `name`, `anchors` and `route` must be present.
   - Example: `topo0` empty and `topo2` valid. `main.js` allows selector indices 0–3, but the template has 2 entries. Opening index 3 gives `topos[3]` = undefined, which throws in `drawMap`.
   - A pasted JSON with a leading space or newline is accepted by `main.js` (`JSON.parse` tolerates the whitespace) but rejected by the template, which triggers the same crash.
   - `ROUTE_COUNTS` is also misaligned, so navigation falls back to a bound of 10.
2. **Unguarded dereferences crash the whole build function** (only individual features are inside try/catch):
   - `topo.features.length` crashes if `features` is missing.
   - `topo.anchors[curPitch].grade` crashes for an empty `anchors` array. `[]` is truthy, so it passes validation.
   - `topo.route[wpIdx]` crashes for an empty route.
   - `grade.replace` and `info.split` crash for non-string values.
   - In the selector, a missing `pitches` value prints "undefined pitches".
3. **Possible render race on topo switch (inferred).** The `appMode`, `topoIdx` and `anchorIdx` callbacks each trigger REFRESH. `topoIdx` does not call `updatePitch`. If REFRESH runs synchronously between callbacks, a stale `currentPitch` from a longer topo indexes past the end of the new topo's `anchors`, and `anchor.grade` throws.
4. **Navigation is by route vertex, not by belay.** README line 25 and the original idea in `docs/idea.md` describe belay-to-belay navigation. In practice, the number of presses equals the number of vertices drawn, and long straight pitches skip over terrain.
5. **Info view up/down still moves by waypoint**, so the page often does not change. That looks like an unresponsive button.
6. **`gradeColor` bug.** `String.replace` only replaces the first match. "I.-II." becomes "III." and "II-III." becomes "IIIII", so easy mixed grades show **red** (hard). It also only understands UIAA Roman numerals: French, YDS and other systems all show red.
7. **Progress dots** use a fixed 14° spacing. 26 or more pitches wrap the whole circle, and about 20 already collide with the top and bottom HUD. Salathé itself has about 35 pitches.
8. **Pitch semantics are ambiguous.**
   - Canvas data: anchor *i* is the start of pitch *i*. The Salathe base anchor carries "IV 33m", and the top anchor carries a pitch that leads nowhere.
   - Image app data: the first anchor has an empty grade and midpoints belong to the next anchor, so anchor *i* is the **end** of a pitch. Real topos (`docs/example_topo/drawn_topo1*.png`) work this way.
   - The editor exports `pitches = anchors.length`, which is off by one whenever the base is marked as an anchor.
9. **Editor anchor integrity.**
   - Anchors are separate coordinate copies, matched to route points within ±2–3 px.
   - The anchor tool **appends** new anchors at the end, so anchors end up out of route order. The watch assumes route order.
   - The export does not sort or validate anything.
10. **Editor preview and watch disagree.**
    - The preview renders at scale 1.0 (240px = 466 units), but the watch default zoom is 1.2.
    - The preview uses a separate renderer (`drawFeatureEditor`), so the two can drift apart.
    - Export is pretty-printed (`null, 2`), while the status bar counts minified size. Neither counts UTF-8 bytes, which is what `maxLength` uses.
11. **Canvas calls the platform does not document.**
    - `strokeRect` (t.html:629, used for slabs) is not in the supported list in the reference docs (`fillRect` is). On a watch that lacks it, the per-feature try/catch would silently hide every slab.
    - The vignette relies on `arc(...,true)` (anticlockwise). Whether the anticlockwise argument is honoured is not documented.
    - Font sizes are continuous: `Math.round(ss(20))+'px'`. The docs warn that unsupported sizes render as squares on some watches.
12. **Legibility and power.**
    - HUD text is 12–16px. The smallest native UI2 body and title fonts on the 466 display are 27–29px (`f-t-s`, `f-b-s`).
    - The background is `#1A1A1A`, not black, on AMOLED.

---

## 3. Gaps between the POC and a production, store-ready app

### Features
- Belay-to-belay navigation, plus optional fine panning along long pitches.
- Highlight the current pitch segment, and number the pitches on the map.
- A whole-route overview and auto-fit zoom.
  - Today the scale depends on the background image resolution, because the editor sets `width`/`height` from the image.
- Approach and descent pages, and a rappel (descent) mode that runs anchors in reverse.
- Gear and belay notes per pitch.
- More than 3 topo slots, or a library, with selector scrolling.
- State persistence. Per the docs, `localStorage` survives between workouts, and the app is unloaded at exercise end. Nothing is saved today, so every relaunch starts at the selector.
- Workout integration (none today):
  - a silent lap per pitch (`$.put('Activity/Trigger',23)`)
  - logging the pitch number (`out[].log`, max 5)
  - `getSummaryOutputs` (practical limit of about 4–5 entries)
  - a manifest `activities` filter, e.g. 16 Climbing, 74 Mountaineering, 96 Hiking, 77/78 ski mountaineering and touring
- Units: lengths are free strings, with no metric/imperial handling via `/Settings/Unit/UnitsMode`.
- Grade systems: no per-topo `gradeSystem` field.

### UX and design
- Fonts are far below native sizes, and there is no truncation for the round bezel.
- Grey-on-dark features (`#555`, `#252525`) will be hard to read in sunlight. **(inferred)** On the Vertical's MIP display they may disappear.
- Red/green grade colours are not colour-blind safe.
- HUD text is drawn without a backplate, so the route line crosses it (visible in `docs/images/topo.png`).
- No empty state or onboarding text explaining how to add topos.
- No error feedback when a slot fails to parse.
- No zoom-level indicator.
- Info text is cut off silently, with no paging.
- Button overrides are a UX risk:
  - In the app view the user loses pause/resume (up), lap (down; on the Race family the lower button is the lap button) and display switching (middle).
  - The long presses (up, down, middle) may also override activity change, the control panel and previous-display, which could trap a gloved user. This needs hardware verification.
  - `implementation_plan_v2.md` said the lap button would stay free, but the implementation takes it.
- `pushButton type="normal"` is not blocked by the action button lock, so accidental presses against rock will change the pitch.

### Robustness and edge cases
- No schema validation, no version field, and no migration path.
- The two parsers disagree (section 2, item 1).
- No guards for empty arrays, non-string fields, NaN or huge coordinates, or duplicate features.
- Behaviour when settings change while the app is running is undefined.
- `anchorIdx` is misnamed (it is a waypoint index).
- The demo topo is duplicated.
- The demo is labelled as a real route (El Capitan's Salathé) but carries fake placeholder data. Shipping that is a misleading-information and safety risk.

### Performance and memory
- Every redraw draws **all** features of the whole topo. There is no viewport culling.
  - Each crack tick, roof hatch and similar mark is its own `beginPath`/`stroke`.
  - Batching one path per feature type and culling by bounding box would cut the cost a lot.
- Up to 3 × 100 KB JSON strings are parsed twice (in the `main.js` context and the UI context) and kept fully in memory.
  - The reference names the failure modes: `Zapp: releaseMemoryCb (exec. zapp)` means JS heap exhausted, `(exec. ui)` means HTML/UI memory exhausted.
  - The real limits are untested.
- `evalFile('ext*.js')` can only be called from `main.js`, so it cannot feed the canvas template directly.
- Button-to-redraw latency is unmeasured. **(inferred)** The reference says that for `onAccelerometer` the output updates reach ESW only after `evaluate()` (about 1 s). If `onEvent` outputs batch the same way, that would also explain hwtest3's missed same-value transitions.

### Data pipeline and editor
- The editor is desktop-only and mouse-only (no touch or pointer events) and is not hosted anywhere.
- The JSON then has to reach the phone and be pasted into the Suunto app's settings text field. Whether that field accepts and syncs multi-KB strings is unknown.
- No compact export (short keys, integer or delta coordinates), no UTF-8 byte check against `maxLength`, and no pre-export validation (route of at least 2 points, at least one anchor, anchor order).
- The background image and corner positions are not saved with the project, so re-editing means re-aligning by hand.
- Grade, length and info are free text with no structure.
- No shared rendering code with the watch.
- No import from other sources such as OpenBeta or theCrag.
- No sharing workflow (URL or QR).

### Localization
- All watch strings are hardcoded English in `fillText`: "SUUNTOPO", "CROWN = select", "pitches" (no pluralisation).
- Platform localization is **compile-time** `{{id}}` substitution from `<lang>.json`, chosen when the app is built ("Build For All Languages"). **(inferred)** It may also apply inside the template `onLoad` script, since that is HTML text.
- **Hungarian (`hu`) and Slovak are not in the supported language list.** Neither the reference list nor the `languages` enum in the manifest schema has them. Czech, Polish, German, French and Italian are supported.
- Canvas `fillText` in "monospace" may not include accented glyphs. **(inferred)** The image app's stripped diacritics point that way. The docs name `sp-b-cjk` as the HTML font class that contains every supported character, so user text such as names and info may need to be HTML `setText` elements instead of canvas text.

### Store requirements (local evidence only)
- **Submission:** done through the Editor's "Create Source Package" command (submitted to Suunto), and the app should be built with "Build For All Languages".
- **Manifest rules:**
  - name ≤ 60 bytes; currently "suuntopo_canvas", which shows as-is on the watch
  - description ≤ 100 bytes
  - version ≤ 4 characters; currently "0.3"
  - `modificationTime` is currently a stale 1710432000 (March 2024)
  - the schema also allows `activities`, `languages`, `authorId`, `externalId` and `localDate`; none are used today
- **Preview image:** the official "New SuuntoPlus Sport App" template ships `pre-q.c64.png` (272×272). **(inferred)** That is the app preview image. The project has none.
- **Display support:** with no `displays` restriction, packages are built for s/m/l/n/o/q. The layout is hardcoded for 466px, and the reference says UI1 (s/m/l) is no longer maintained.
- **Listing content:** no safety or "verify on site" disclaimer, no store copy, no privacy statement, no licence. User-made copies of guidebook topos also raise copyright questions.

### Testing
- No automated tests and no ES5 lint. The ES5 rules can only be checked by hand, and the drawing code sits inside an HTML attribute where it cannot be linted directly.
- No topo JSON schema, no fuzz corpus, and no rendering regression tests.
- The MCP bridge can build, open the simulator and screenshot the **start screen** about 2 s after launch. Per its README it cannot press buttons.
- No hardware test checklist or log, and the build skill's `--feedback` has never been used.

### Housekeeping and documentation drift
- **CLAUDE.md:**
  - its "Key directories" section points to old paths (`suuntopo/`, `suuntoplus_editor/`, a root `implementation_plan.md`)
  - it still contains a copied "Jesse's approval" line
- **`.claude/skills/build-suuntopo/SKILL.md`** does `cd <repo root>`, which is the wrong path now.
- **`t.html` files** use plain comments, not the required `ABOUTME:` header.
- **`main.js`** says "SUUNTOPO v2", which is temporal naming and does not match manifest version 0.3.
- **`builds/`** contains stray artifacts (`suunto04-*` in canvas v0.3, `suuntopo_hwtest2.zip` in the hwtest3 folder).
- **`docs/suunto_wiki.md`** suggests `hu.json` localization, which the platform does not support.

---

## 4. Prioritized backlog

### P0: must have for the store

| # | Item | Acceptance criteria |
|---|---|---|
| P0-1 | **One source of truth for the topo list.** Use one shared validation function in both contexts (or move button handling into the template; see the risks). Make every draw path clamp `topoIdx`, `waypoint` and `pitch`. Add the output counter or pack the state if hardware shows missed same-value changes. | In the simulator, every combination of empty, invalid, leading-whitespace and valid content in `topo0..2` lists exactly the valid topos, and opening each one never throws. A scripted 200-press random button sequence shows no black screen. |
| P0-2 | **Versioned topo schema (v1).** Fields: `v`; `start` point; `belays` as route-vertex indices; `pitches[i]` = segment belay i → i+1 with `grade`, `lengthM` (number) and `info`; `gradeSystem`. Publish a JSON Schema. Supporting v0 needs explicit approval from Vitya (repo rule on backward compatibility). | The schema file exists. Editor and watch both validate against it. The Salathe/demo topo converts. The pitch count equals the number of belay segments. |
| P0-3 | **Belay-to-belay navigation.** Up/down jumps to the next or previous belay. The camera follows the polyline. Long pitches may get intermediate steps of about 60% of the screen that snap at belays. The current pitch segment is highlighted. | Presses from base to top equal N belays (plus defined intermediate steps). The HUD pitch number always matches the highlighted segment. The info view changes pitch on every press. |
| P0-4 | **Defensive rendering and visible errors.** Guard every dereference. The selector shows "Topo 2: invalid / too large / empty" for bad slots. | A fuzz corpus of 20 or more malformed topos renders in the simulator with no exception. Error rows are shown. |
| P0-5 | **Demo and empty state.** Ship exactly one clearly fictional "Demo route" (not in both the hardcoded list and `data.json`). Leave `data.json` slots as `""`. Add onboarding text pointing to the Suunto app settings and the editor URL. | A fresh install shows one demo entry plus a hint. No real route name carries placeholder data. |
| P0-6 | **Legibility pass.** Black (#000) background. A small set of fixed font sizes, verified on hardware, of about 27–29px or more for body and HUD. Ellipsis truncation to the round chord. A progress indicator that scales to 40+ pitches (e.g. "12/35" plus an arc fill). A backplate behind HUD text. A colour-blind-safe palette. | Daylight photos from the watch are readable at arm's length. Names up to 40 characters never clip. A 35-pitch topo has no overlaps. |
| P0-7 | **Button-mapping safety.** Check on hardware what the overrides remove: pause, lap, control panel, display switch, exit. Pick a mapping that always lets a gloved user leave the view and end the workout. Decide how button lock should behave. | Written hardware results in `docs/`. Every system escape works with buttons only. |
| P0-8 | **Persist state.** Save topo id/hash, belay index and zoom to `localStorage` on change. Restore in `onLoad`. | After ending and restarting a workout, the app reopens on the same topo and pitch. A changed topo falls back cleanly to the selector. |
| P0-9 | **Transfer format and limits.** Compact minified export with short keys and integer coordinates. A UTF-8 byte counter checked against the limit measured on hardware. "Copy for Suunto app" as a single action. Set `maxLength` to the measured safe value. | The phone-to-watch round trip is verified on iOS **and** Android at the chosen limit. The editor blocks oversize exports. |
| P0-10 | **Hardware validation of undocumented APIs** (a new hwtest4). Check: `JSON.parse` and `localStorage` in the UI context; `strokeRect`; anticlockwise `arc`; arbitrary px font sizes; accented glyphs (á é ő ű č ž); feature-count stress until `releaseMemoryCb`; redraw latency. | Results recorded. Unsupported calls replaced (e.g. slabs drawn with `moveTo`/`lineTo`). A documented maximum feature budget enforced by the editor. |
| P0-11 | **Display scope.** Either declare the app `q`-only, or lay out relative to `ctx.width` with a high-contrast palette for `o`. | Simulator screenshots at q (and o/n if supported) with nothing clipped. Store compatibility list matches. |
| P0-12 | **Store packaging.** Real name and description within byte limits. Version "1.0". Current `modificationTime`. `activities` (16, 74 and others as decided). `languages`. Preview image `pre-q.c64.png`. Store text with a safety disclaimer ("not a guidebook; verify on site"), privacy note (no data collected) and a licence. | "Build For All Languages" and "Create Source Package" both succeed with no warnings. Checklist confirmed with Suunto (partners@suunto.com). |
| P0-13 | **Editor ready for end users.** Hosted publicly (e.g. GitHub Pages). Anchors sorted and stored by route index. Validation before export. Preview zoom matches the watch default. One shared renderer module for preview and watch, kept in sync by a build step. | A new user can produce and install a topo by following the store description alone. The preview matches watch screenshots within a few px. |

### P1
- Route overview and auto-fit zoom, plus a zoom indicator.
- Grade labels placed on segments, pitch numbers, and a key-pitch marker.
- Info paging for long text. Approach and descent pages.
- Grade systems (UIAA, French, YDS, British, Saxon) normalised for colour; fix the `gradeColor` bug. Imperial units via `/Settings/Unit/UnitsMode`.
- Workout integration: optional silent lap per pitch, logged current pitch, summary of pitches climbed. **Acceptance:** the Suunto app shows pitch splits after sync.
- Performance: bounding-box culling and one path per feature type. **Acceptance:** redraw time measured on hardware stays under the threshold set in P0-10 at the maximum feature budget.
- Localization: en plus supported languages (de, fr, it, cs, pl). Move user text to HTML `setText` with `sp-b-cjk` if canvas glyphs fail.
- Touch and mobile support in the editor (pointer events). Save background image and corners in a project file separate from the watch export.
- More slots or a packed library string, with selector scrolling.
- Tests: ES5 lint (`eslint` with `ecmaVersion: 5`) over `main.js` and the extracted template script. Node unit tests with a mock canvas context. A schema test corpus. Simulator screenshot regression through the MCP bridge, which would need button-press support added.
- Repo hygiene: update CLAUDE.md paths, fix the build skill's path, add ABOUTME headers to `t.html`, clean up stray build artifacts, and record per-build hardware feedback in CHANGELOG.

### P2
- Rappel or descent mode that runs anchors in reverse.
- Multiple routes and variations per wall.
- Topo sharing by URL or QR. Import from OpenBeta or theCrag.
- Hybrid photo background. Limited by the 2-image cap and the lack of image sync, so only useful for personal builds.
- Barometric altitude hint for the current pitch.
- Optional touch gestures.
- AOD-specific minimal rendering.
- Light theme (`cm-fg`/`cm-bg`).

---

## 5. Risks and things that need a real watch
1. **Settings sync is the single point of failure.** It is untested how large a string the Suunto iOS and Android settings field accepts and syncs, whether pasting there is usable at all, and how long syncing takes. If the practical limit is small, topos need aggressive compaction, or a different channel. The Guides cloud API needs partner approval and cannot draw custom graphics.
2. **The UI context's JS capabilities are undocumented.** `JSON`, `localStorage`, `strokeRect`, anticlockwise `arc`, font sizes and accented glyphs could all behave differently on hardware.
3. **Memory and performance:** no measurements exist for complex topos (exec.ui and exec.zapp exhaustion).
4. **Output subscription semantics:** hwtest2/3 saw same-value and missed-transition behaviour, and the canvas app dropped the workaround.
5. **Button override side effects:** pause, lap, control panel, display switching, button lock, and AOD/display-off clicks (`enabledWhileDisplayOff` / `disabledWhileAOD`).
6. **Battery and burn-in** over an 8–12 h climbing day with the app view on.
7. **Device and display matrix:** Race S, Race, Race 2, Vertical 2, Ocean (q), and possibly Vertical (o) and 9 Peak Pro (n). Middle-button availability varies by device (`{DEVICE_BUTTON_COUNT}` runtime token).
8. **Store process unknowns:** review criteria, how app IDs and author IDs are assigned, preview image requirements, and policy on apps that override system buttons.
9. **Legal and safety:** route data accuracy and liability, and copyright on user-traced guidebook topos.
10. **Rewrite risk:** the repo's CLAUDE.md forbids rewriting implementations or adding backward compatibility without Vitya's explicit permission. P0-1, P0-2 and a move of button handling into the template all need that sign-off first.

---

## 6. CLAUDE.md rules implementers must follow
- **ABOUTME header:** every code file starts with 2 lines beginning `ABOUTME: `. In HTML use `<!-- ABOUTME: ... -->`; `t.html` currently breaks this rule.
- **ES5 only:**
  - no arrow functions, `let`/`const`, template literals, destructuring, `Date` or `sessionStorage`
  - the one sanctioned arrow is the platform attribute `build="ctx => fn(ctx)"`
  - custom functions must be `var fn = function(){}`, because `function` declarations are reserved for platform callbacks
- **Text:** use `setText('#id', ...)`. Assigning `output.textField = ...` works in the simulator but not on the watch. `setText` only works if the element already has non-space text.
- **CSS on the watch:** only width, height, color, background-color, opacity, border (solid, all sides) and visibility, in px and % units. Image scaling through CSS does not work on the watch.
- **Images:** at most **2** per app, PNG, at most **64 colours**, RGB with no alpha, pre-quantized, about 64 KB compressed at most.
- **Canvas:**
  - hex colours only
  - call `control('#id','REFRESH')` after changes
  - no gradients, shadows, patterns or `transform()`; only `setTransform`
- **Template switching:** after `unload('_cm')`, wait 1–2 evaluate cycles before `setText`/`setStyle`.
- **Subscriptions:** subscribe in `onActivate`, never in `onLoad`.
- **Platform limits:** 10 inputs, 25 outputs (5 logged), 15 apps per watch.
- **Testing:** settings and `playIndication` cannot be tested in the simulator; always test on hardware.
- **Working style:**
  - make the smallest reasonable change, and nothing unrelated
  - match the surrounding style; never remove comments; no temporal names such as "new" or "v2"
  - no rewrites or backward compatibility without explicit permission
  - address the user as Vitya; ask before assuming
  - commit messages must not mention Claude


## Key facts
- The topo list in main.js and in t.html is built independently. main.js counts any slot that parses and has .route; the template also requires the string to start with '{' plus name/anchors/route. A valid topo2 with topo0 empty, or a pasted JSON with a leading space, lets the selector index a non-existent topo, which crashes drawMap. [src/suuntopo_canvas/main.js:20-37, t.html:42-67]
- Up/down step through route vertices (anchorIdx is a waypoint index), not belay to belay, so presses per pitch depend on how many points were drawn. [main.js:2,40-55; t.html:224-230]
- Settings come in as strings: topo0..topo2 are type string with maxLength 100000, and maxLength is counted in UTF-8 bytes. Phone settings cannot be edited in the simulator, and no hardware result for settings sync exists anywhere in the repo. [manifest.json; reference_docs.md:2224; CLAUDE.md]
- data.json (packed as data.jsn in the .fea) ships Salathe in topo0 and t.html also hardcodes Salathe, so a fresh install lists it twice (inferred), and the demo is a real famous route with placeholder data. [builds/suuntopo_canvas/v0.3/suunto01-q.fea; t.html:10-37]
- strokeRect (used for slabs at t.html:629) is not in the documented canvas API list (fillRect is); per-feature try/catch would hide every slab if the watch lacks it. [reference_docs.md:1631-1656]
- Hardware results recorded: multi-output $.subscribe works; writing the same value does not re-fire the subscription; mode switching works with an appMode*100+counter workaround. The canvas v0.3 app does not use the counter, although the hwtest3 README says it does. [src/suuntopo_hwtest2/README.md; src/suuntopo_hwtest3/README.md; src/suuntopo_canvas/main.js]
- The canvas HUD and selector use 12-22px monospace and a #1A1A1A background; the smallest native UI2 fonts on the 466 display are about 27-29px (f-t-s/f-b-s), and the docs warn unsupported font sizes render as squares. [t.html:159-289; reference_docs.md:1892,1951-1963]
- Localization is compile-time {{id}} substitution from <lang>.json. Hungarian (hu) and Slovak are NOT supported languages; Czech, Polish, German, French and Italian are. [reference_docs.md:2415-2460; extension schema/manifest.json languages enum]
- evalFile only works from main.js and file names must start with 'ext', so it cannot feed the canvas template directly; memory exhaustion shows as 'Zapp: releaseMemoryCb (exec. zapp)' (JS) or '(exec. ui)' (HTML/UI). [reference_docs.md:1204-1226,3334-3340]
- The manifest schema allows activities[] (e.g. 16 Climbing, 74 Mountaineering, 96 Hiking), languages[], authorId and externalId; store submission goes through the Editor's 'Create Source Package'; the official sport-app template ships a 272x272 pre-q.c64.png preview image (role inferred). [~/.vscode/extensions/suunto.suuntoplus-editor-1.42.0/schema/manifest.json, README.md, templates/New-SuuntoPlus-Sport-App]
- gradeColor uses single-match String.replace, so 'I.-II.' and 'II-III.' (easy grades) render red (hard); it only understands UIAA Roman grades. [t.html:119-126]
- Progress dots use a fixed 14 degree spacing, so routes with about 26+ pitches wrap the whole display and about 20 collide with the HUD. [t.html:291-317]
- The editor appends anchors in click order (not route order), links anchors to route points by +-2-3px coordinate matching, exports pretty-printed JSON, and previews at scale 1.0 while the watch defaults to 1.2. [src/topo_editor/index.html:1262-1270,1303,1729-1760,1896-1899]
- The app overrides up, down and middle button clicks and long presses in its view. implementation_plan_v2 said the lap button would stay free, but on the Race family the lower ('down') button is the lap button. [t.html:893-903; docs/implementation_plan_v2.md; docs/suunto_wiki.md]
- No release has gone through /build-suuntopo (no git tags, no latest symlink); the skill's step 1 cd's to a stale path, <repo root>. [.git/refs/tags empty; .claude/skills/build-suuntopo/SKILL.md]
- Every code file needs a 2-line 'ABOUTME:' header (t.html files violate this). ES5 only, except the documented build="ctx => fn(ctx)" attribute. Custom functions must be var-assigned. Use setText, not output.textField. Watch CSS is limited to width/height/color/background-color/opacity/border/visibility in px/%. Max 2 PNGs, 64 colours, RGB with no alpha. [CLAUDE.md; reference_docs.md:972-985]

## Open questions
- What is the largest topo string the Suunto iOS and Android app settings field accepts and syncs reliably (1/10/50/100 KB), and is pasting multi-KB JSON there usable at all?
- Do JSON.parse and localStorage work in the template (UI) JS context on real hardware? Only main.js use is documented.
- Does the watch support ctx.strokeRect and the anticlockwise argument of ctx.arc? Neither is in the documented canvas API.
- Which canvas font sizes and glyphs render on the watch (continuous zoom-scaled px sizes; accented characters such as á, ő, č, ž)?
- How many features or draw calls can a topo have before redraw becomes sluggish or releaseMemoryCb (exec. ui / exec. zapp) fires, and what is the button-to-redraw latency?
- Does the canvas app (without the hwtest3 appMode counter) miss mode transitions on hardware? Is control('#tc','REFRESH') synchronous, which matters for the topo-switch stale-pitch crash?
- With up/down/middle clicks and long presses overridden in the app view, can a gloved user still pause, mark a lap, open the control panel, switch displays and leave the app with buttons only? How does the watch's button lock interact?
- Can button handling run directly in template JS (pushButton onClick calling template functions) on hardware, removing the main.js output round trip? That would need Vitya's approval as an architecture change.
- Does the 272x272 pre-q.c64.png in the official template serve as the store/app-list preview, and what are Suunto's store review requirements (assets, IDs, policy on overriding system buttons, disclaimers)?
- Which displays should the store build target: q only, or also o (Vertical, MIP colours) and n (9 Peak Pro)?
- Which activity IDs should the app appear in (16 Climbing, 74 Mountaineering, 96 Hiking, 77/78 ski)?
- Pitch semantics: should a belay's data describe the pitch below it (the real-topo convention) or above it (current canvas data)? Is migration of the v0 format wanted, given the repo rule requiring explicit approval for backward compatibility?
- Is the localization {{id}} substitution applied inside the template onLoad script (where the canvas strings live), and is the lack of Hungarian/Slovak support acceptable for the primary audience?

## Sources
- <projects>/SUUNTOPO/src/suuntopo_canvas/t.html — All rendering, topo loading (parseTopo), views, HUD, feature renderer, button wiring; source of most defects listed
- <projects>/SUUNTOPO/src/suuntopo_canvas/main.js — appMode/selector/waypoint/zoom state, independent topo counting that disagrees with the template
- <projects>/SUUNTOPO/src/suuntopo_canvas/manifest.json — topo0..2 string settings (maxLength 100000), 5 outputs; data.json ships Salathe in topo0
- <projects>/SUUNTOPO/src/suuntopo_hwtest3/README.md — Only recorded hardware results: multi-subscribe works, same-value no redraw, mode switching with counter workaround
- <projects>/SUUNTOPO/src/topo_editor/index.html — Data format, anchor handling, export/preview behaviour
- <projects>/SUUNTOPO/reference/suuntoplus_reference_docs.md — Canvas supported API list, settings/localStorage semantics (UTF-8 maxLength), lifecycle, evalFile/unload, pushButton/AOD, CSS font sizes, localization languages, memory errors, activity IDs
- ~/.vscode/extensions/suunto.suuntoplus-editor-1.42.0/schema/manifest.json — activities, languages, authorId/externalId fields; name<=60, description<=100, version<=4
- ~/.vscode/extensions/suunto.suuntoplus-editor-1.42.0/README.md — Create Source Package for submission, Build For All Languages; template ships pre-q.c64.png 272x272
- <projects>/SUUNTOPO/docs/implementation_plan_v2.md — Intended architecture, button plan (lap left free), untested Phase 0 limits; idea.md states belay-to-belay navigation goal
- <projects>/SUUNTOPO/CLAUDE.md — Implementer rules, forum-sourced sim-vs-hardware caveats, stale paths, release workflow never used
- <projects>/SUUNTOPO/builds/suuntopo_canvas/v0.3/suunto01-q.fea — Package contents: data.jsn, main.js, manifest.jsn, t.xml (18.7KB); stray suunto04-* builds alongside
- <projects>/SUUNTOPO/.git/logs/HEAD — 8 commits, 2026-05-06 and 2026-10-03; no tags
