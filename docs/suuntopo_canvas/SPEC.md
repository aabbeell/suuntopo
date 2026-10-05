# suuntopo_canvas v1.0: product and technical specification

## BINDING DECISIONS (2026-10-03, after this spec was written; these override the spec below)

1. **Topo storage is option B, chosen by the user:** ONE user topo slot in settings, in the compact format, sized so the whole data.json stays under ~2 KB (so roughly maxLength 1,500 B for the topo string), PLUS a small library of built-in topos shipped inside the app package as separate files of at most ~3.5 KB each (ext*.js data files loaded with evalFile from main.js, or another transport you prove works; evalFile only works from main.js, so design and document how built-in topo data reaches the template). This replaces the 5 x 4,000 B slots in §0 and §9. The built-in library exists for usefulness and for testing with several different topos: ship at least 3 built-in topos of different shapes and sizes (short single pitch, long multi-pitch with traverses, one near the size limit). Use the fictional demo plus original schematic topos you draw yourself; you may base routes on the user's own climbing notes in <personal vault>/10_Mountaineering (read only) where they contain pitch-by-pitch data. Never copy published topo drawings; label built-in topos as schematic, and note in the store listing that real routes need verification and that adding topos from guidebooks requires the rights holder's permission. The editor must export the compact one-slot format and enforce the size budget, and also be able to emit a built-in topo file.
2. Render budget: cull to the viewport and keep every canvas under the measured Race S budget (about 2 x strokes + lineTo <= 200 per canvas per frame, <= 24 lineTo per path); the template code itself must stay small (v0.3's 16.5 KB template needed ~80 KB peak to compile).
- Platform rules found after this spec was written are in `docs/research/deep-dive/` (limits.md, ble-gatt.md, refresh-rate.md, ble-discovery.md, suuntopo-crash.md). They are binding and override this spec where they differ. The most important:
  - No single allocation above ~4,000 B (string, array of more than ~500 elements, typed-array buffer, compiled function or ext file); oversize requests fail outright and try/catch does not contain them. Keep anything (re)created during an exercise under ~2 KB.
  - data.json (settings + localStorage, one file) must stay under ~2 KB, never above ~3.5 KB; every localStorage call allocates a buffer the size of the whole file, so call it only in onLoad, on rare user actions or at exercise end.
  - Never use `output` as a bare value: only `output.<name>` inside lifecycle functions (or passed as an argument to a module-level helper). Never write outputs from the BLE handler, closures or ext files, never alias `output`.
  - Every appConn call goes in try/catch (an uncaught BLE error disables the app); no appConn call before event 100; 107 means 'registered locally' only; treat 106 and 115 alike; one GATT request in flight; a handler firing faster than 1 Hz must allocate nothing (no new, literals, string concatenation or closures).
  - The display is guaranteed to update only once per evaluate (~1 Hz).
  - Race S: 2 SuuntoPlus app slots per sport mode.
- **Memory budgets (binding, measured with the calibrated Duktape harness; its numbers match real watch allocation logs byte for byte):** run `bash <projects>/SUUNTOPO/tools/sp-mem/build.sh` once, then `node <projects>/SUUNTOPO/tools/sp-mem/sp-mem.js <appDir>` (see its README; write scenarios for your app). Use the lowmem est32 columns. Targets: BLE display app peak <= 12 KB and steady <= 10 KB; canvas topo app peak <= 20 KB and steady <= 16 KB including the topo; every compiled function block <= ~1.9 KB; no allocation per BLE notification; no cyclic garbage per frame (hoist callbacks out of draw loops). For reference: SUUNTOPO v0.3 is 31 KB steady with empty slots and has a 6.9 KB function block (both fail); the hardware-test app hwtest3 that ran fine on the user's Race S is 15.7 KB steady.


Status: **implemented as v1.0 on 2026-10-03; review rounds 1, 2 and 3 fixed on 2026-10-04 (§21-§23); memory round 4 on 2026-10-04 (§8).** Verified in Node (108 tests) and in the simulator on q, o and n (the not-supported screen on s, m and l). **Not yet run on a watch** (hardware checklist §16c; H1, H2, H8 and H9 are release gates). The spec covers the watch app in `src/suuntopo_canvas` and the editor changes in `src/topo_editor` that the app depends on.

**How this spec was updated after implementation.**
- Where implementation showed the design was wrong, or the binding decisions above replaced it, the section says so in a **v1.0 as built** note, and changed statements are marked *(Changed)*.
- Sections 0, 4, 8, 9, 11, 16 and 17 were rewritten.
- §20 lists every deviation with its reason.
- The rest of the text is the original design and still holds.

Scope: Vitya asked for a production-ready app that can be published in the store. That request is the permission CLAUDE.md requires before restructuring code. Section 2 lists every large restructure with its reason. Existing code is evolved wherever that is possible.

## How to read the evidence tags

Every platform claim carries one of these tags:

| Tag | Meaning |
|---|---|
| `[doc Lnnn]` | `reference/suuntoplus_reference_docs.md`, line nnn. This is the authoritative source. |
| `[forum nnnnn #k]` | forum.suunto.com topic nnnnn, post k. The cached copies were read during this session. |
| `[gaps §x]` `[critique §x]` `[store §x]` `[fp]` | The research files under `docs/research/`: `suuntopo-gaps.md`, `critique.md`, `store.md` and `forum-projects.md`. Where they disagree, critique wins. |
| `[probe A/B/C]` | Experiments run for this spec on 2026-10-03 with `tools/sp-build` and the simulator bridge. See §19. |
| `(inferred)` | My own conclusion. Not confirmed by a primary source. |
| `(measured)` | Measured on hardware by a forum developer. |

---

## 0. Key decisions in one page

**v1.0 as built (2026-10-03).** This list was rewritten after implementation. Items 2, 3, 7, 8, 9 and 10 changed from the design, and §20 gives the reason for each change.

1. **Clicks are never overridden.** Native pause (upper click), lap (lower click) and next display (middle click) keep working on the app screen. All app navigation uses long presses on up, down and middle (§6). Test T7 asserts that `t.html` has no `onClick` and that every pushButton has `longType="action"`. Unchanged.
2. **main.js owns the topos, parsing, navigation and all text. The template only draws.** *(Changed: the design gave the template the parser.)*
   - The simulator template cannot read storage [probe B].
   - `evalFile` exists only in main.js, so the built-in topo library (decision 8) can only be read there.
   - main.js parses the open topo once. It writes the text with `setText`/`setStyle` from ext files, and streams the geometry to the template as numeric outputs (§4.5).
   - The template keeps one 1,932-byte `Uint8Array` of geometry, never sees a topo string, and has no parser.
3. **The compact single-line format `STP1` is kept** (§4.3) and parsed with `charCodeAt`, without regex.
   - The size limits changed: the settings slot holds 1,500 bytes, a built-in file at most 3,500 characters, and the parser rejects more than 3,500 characters (E7).
   - Text limits are counted in characters, not bytes.
4. **All text goes in HTML elements in native font classes; the canvas draws geometry only.** Unchanged.
5. **Three canvas tiles with a hard budget per tile.** Unchanged: the cap is 150 units per tile and a path is stroked at 20 operations.
   - The guard is hard: `op()` and `dot()` drop any operation that would pass the cap.
   - A dry run reserves the route and the belays before terrain is drawn (§7).
6. **Navigation goes belay to belay.** idx runs 0..n+1 and the Map auto-fits the current pitch. Unchanged.
7. **There are three views in a cycle: Map, then Info, then the topo list, then Map.** *(Changed: the design's "Route" carousel drew every card.)*
   - Only the card of the **open** topo draws the whole topo.
   - Every other card shows its name, grade, pitch count and a label as text. A middle long press opens it.
   - Streaming a topo to the template takes one chunk per second (§4.5), so it is not possible to draw each card while browsing.
   - The list also holds the error card for a broken slot and the Help card.
8. **A built-in topo library ships instead of one demo inside the template** (binding decision 1). There are four ext files, read with `evalFile`:
   - `ext4.js` Fictional Demo: 4 pitches, localized text tokens.
   - `ext5.js` Jägerhorn N: 1 pitch, schematic.
   - `ext6.js` Piccolo Fillar, La Diretta + Bisaccia: 15 pitches with traverses, schematic.
   - `ext7.js` Fictional Wall: 30 pitches, 3,222 characters (3,246 since round 2).

   The two fictional topos are labelled "Not a real climb" and the two real routes "Schematic topo". No published topo drawing was copied (§11).
9. **One settings slot `topo0` (maxLength 1,500) plus one inline enum** "Lap moves to next pitch" (default Off) (binding decision 1; §9). *(Changed from 5 slots of 4,000 B.)*
10. **G1 (template reading storage) no longer gates anything.** The template never reads storage. *(Changed.)* The new hardware gates are:
    - H1: numeric outputs carry the stream on a real watch.
    - H9: memory.
11. **Displays n, o and q get the app. s, m and l get a one-line "not supported" template** (`u.html`). Unchanged.
12. **The manifest name is "Climbing Topo"** (appId `suunto01`). It is a placeholder until Vitya decides (Q1).

---

## 1. Target users and use cases

**Primary user.** A climber on a multi-pitch rock or alpine route, wearing a Race S (466×466 AMOLED). Other q watches (Race, Race 2, Vertical 2, Ocean) work the same. Gloves are possible. They glance at the watch at belays, not while climbing [fp: omunoz feedback, "climbers keep the watch in a pocket"]. They do not want to take the phone out on the wall [forum 14766 #11].

**Secondary users.**
- 9 Peak Pro (n, 240 px) and Vertical (o, 280 px). These must not break and get the same features, but the layout is only verified in the simulator.
- Climbers who already mark a lap at every belay. They can let the lap move the topo forward.

| # | Use case | What the app must do |
|---|---|---|
| U1 | At the base: "which route, how long, what's the approach?" | The Route view shows the whole topo, its grade and pitch count. Info at Start shows the approach note. |
| U2 | At belay k: "what does pitch k+1 look like?" | Hold up once. The map frames pitch k+1, highlighted, with the target belay marked, plus grade and length. |
| U3 | "Where exactly does it go?" | Hold middle to open Info: the pitch notes (gear, line), in pages of about 90 characters. |
| U4 | "Where am I on the whole route?" | The Route view shows the whole line with done, current and upcoming pitches. |
| U5 | Mark a lap at each belay | A native lap click works on every screen. If the setting is On, the lap also moves the topo forward. |
| U6 | Pause, end, other data screens | A native click on upper or middle works on every screen. Crown rotation also works on watches with a crown. |
| U7 | Top-out: "how do we get down?" | The Top position shows the descent note and any drawn walk-off. |
| U8 | Prepare at home | Draw the topo in the web editor, copy one line, paste it into "Topo 1..5" in the Suunto app, and sync. |
| U9 | Review after the climb | The FIT file has a "Pitch" graph over time. The summary shows "Highest pitch". |

Out of scope for 1.0: photo backgrounds (2-image limit, no image sync [doc L1581] [fp]), live altitude or position on the topo, rappel mode, and sharing by URL or QR (P2, §18).

---

## 2. What stays, what changes, and why

**v1.0 as built.** R2, R6, R8 and R9 came out differently:
- **R2.** There is still one parser, but it runs in main.js (`ext1.js` + `ext9.js`), not in the template.
- **R6.** `ms` carries the drawing state and nothing else. A topo hash and a chunk stream (§4.5) replaced the seq numbers and the E_STATE events.
- **R8.** The demo is a built-in ext file (`ext4.js`), not a constant in the template.
- **R9.** The sync tool is `src/topo_editor/sync-watch.js`, and it also takes the parser from `ext1.js` and `ext9.js`.

See §0 and §20.

**Stays.**
- The `main.js` plus single-template structure.
- Subscriptions made in `onActivate` [doc L1464-1466; forum 15320].
- Settings strings as the transfer channel.
- The feature vocabulary (crack, chimney, corner, roof, ledge, slab, bolt, tree and the rest).
- The idea of separate map and notes views.
- The editor's drawing tools, undo and background tracing.

| # | Restructure | Why (evidence) |
|---|---|---|
| R1 | JSON topo → `STP1` compact string, parsed into one `Float32Array` | JSON.parse builds hundreds of small objects. The usable Race S heap may be about 28 KB (measured) [critique §0.1; forum 15279 #0; forum 14940 #8]. The reference recommends one large typed array [doc L949-960]. Regex fails on the watch [forum 14940]. A single-line field fits the store's single-line text fields [forum 14766 #37]. |
| R2 | Two independent topo parsers (main.js + template) → the template is the only parser | The two parsers disagree, which is a crash path [gaps §2 item 1]. main.js no longer needs topo contents (§4.5). |
| R3 | One full-screen canvas with all text → 3 canvas tiles for geometry, HTML divs for text | Canvas budget overflow blacks out the canvas silently (measured) [forum 15279]. Each canvas has its own budget [forum 15279 #0; forum 14766 #33]. Canvas text renders about 2× larger on the watch (measured) [forum 15262 #1]. Native font classes are the legible sizes [doc L1958-1963]. Accented glyphs are only guaranteed in `sp-b-cjk` [doc L1936]. |
| R4 | Waypoint navigation → belay-to-belay with auto-fit; free zoom removed | Defects 4 and 5 [gaps §2]. Belay-to-belay was the original goal (`docs/idea.md`). |
| R5 | Button overrides on clicks → long presses only | Overriding clicks takes away pause and end on that screen [forum 14766 #36-37; critique §3c]. |
| R6 | 5 state outputs → 1 packed `ms` output with a sequence number, plus events back | Writing the same value again does not fire the subscription [`src/suuntopo_hwtest2/README.md`]. Several REFRESH-triggering subscriptions race each other [gaps §2 item 3]. |
| R7 | Text list selector → Route carousel | It reuses the renderer, frees the middle click, and shows a picture of each topo. Error and empty states become cards. |
| R8 | Hardcoded Salathé + data.json copy → one fictional demo in the template, data.json slots empty | Salathé was a duplicate and placeholder data on a real route [gaps §3 "demo"; P0-5]. The simulator template cannot read data.json [probe B]. |
| R9 | Editor preview has its own renderer → it runs the watch renderer, extracted from `t.html` by a sync tool | The preview had drifted from the watch [gaps §2 item 10; P0-13]. |
| R10 | App name `suuntopo_canvas` → store name (§15) | Store rules and trademark risk [store §2.1; critique §3c]. |

No backward compatibility is added. The watch rejects old JSON as `E1 old format`. Whether the editor should import old v0 project JSON is an open question for Vitya (§18, Q3).

---

## 3. Platform constraints designed to

| Constraint | Value used | Evidence |
|---|---|---|
| Display q | 466×466 round AMOLED. Race, Race S, Race 2, Vertical 2, Ocean | [doc L43-47] |
| Displays n / o | 240 / 280 px, UI2 (MIP colours (inferred)) | [doc L33-42; store §3.6] |
| UI1 (s, m, l) | Not maintained | [doc L16] |
| Settings | Supported on n, o, q only | [critique §2; `suunto-plus.js supportsSettings`] |
| JS | ES5 / Duktape. No arrow functions, let/const, template literals, Date or regex | [doc L964-966; store §2.2; forum 14940] |
| Typed arrays | Only `Int8Array`, `Uint8Array` and `Float32Array` are documented. **No `Int16Array`.** | [doc L949] |
| Helpers | Defined as `var f = function(){}`. Top-level declarations are reserved for callbacks. | [doc L970-981; store §2.2] |
| Per-frame allocation | None inside render or nav functions. Loop variables are declared at load. | [forum 15279 #0] |
| Canvas API | beginPath, closePath, moveTo, lineTo, stroke, fill, fillRect, fillText, measureText, arc, arcTo, rotate, translate, scale. Hex colours only. **No `strokeRect`.** | [doc L1631-1656] |
| Canvas budget (Race S) | ≤ ~24 lineTo per path. 2·strokes + lineTo ≤ ~200 per canvas per frame. Exceeding it blacks out the canvas, fillText and fillRect included. | (measured) [forum 15279 #0, #3] |
| Simultaneous refresh of several canvases | Can fill `WBMAIN pool id:0` and make the watch sluggish | (measured) [forum 15279 #3] |
| Heap | Race S: about 28 KB of allocatable data on top of one app (measured). The 133,120 B shared heap was measured on other watches. | [critique §0.1, §1] |
| Output values | Numbers only | [probe C; forum 14766 #92] |
| main.js → UI | Numeric outputs, plus `setText` from main.js (not used here) | [doc L937, L1296-1307] |
| UI → main.js | `$.put('/Zapp/{zapp_index}/Event', id, null, 'int32')` → `onEvent` | [doc L1086-1110, L1502] |
| Output propagation | Outputs set outside `evaluate` may reach the screen only after the next evaluate, about 1 s later | [doc L1044, L1129] (documented for onAccelerometer; inferred for other callbacks) |
| Subscriptions | Made in `onActivate`. They are severed after laps and overlays. | [doc L1464-1466; forum 15320] |
| setText | Works only on a visible view whose element already has non-space text | [doc L1307] |
| localStorage | `getItem`/`setItem` store strings. Settings are stored as strings, and enums as an index. | [doc L2182, L2229, L2235-2245] |
| Settings `maxLength` | UTF-8 bytes | [doc L2224] |
| Enum settings | Inline `values` only. `valuePath` crashed the Suunto app. | [critique §1; forum 14766] |
| Settings testing | Only possible after a store upload. Sideloaded apps are wiped on phone sync. | [forum 14768 #2; store §1.5] |
| Logged outputs | ≤ 5 (the validator allows 6) | [doc L101, L2067; critique §1] |
| Summary outputs | Hard limit 8; about 4-5 in practice | [doc L2081] |
| `out` count | ≤ 20 (validator error). The doc says 25. | [critique §1; doc L937] |
| `in` count | ≤ 10. A wrong path stops the app loading. | [doc L133] |
| Images | ≤ 2 per app | [doc L1581] (none used) |
| Manifest | name ≤ 60 B, description ≤ 100 B (about 22 chars recommended), version ≤ 4 chars | [doc L62-77; store §2.1; forum 14770] |
| Apps per sport mode on Race S | 2 | [critique §0.4] |
| Buttons | up, next, down, upleft, downleft. Click ≤ 0.6 s; `onLongPressStart` fires at 0.6 s. | [doc L1811, L1848-1863] |
| Button lock | `type`/`longType` `action` events are blocked by the lock | [doc L1815-1819] |
| Crown rotation | Cannot be captured. It scrolls displays. | [fp "Simulator vs watch"] |
| Lap triggers | 0 normal, 23 silent, 24 invisible (with vibration), 25 muted. `HAS_SILENT_LAP` token. | [doc L1528-1544] |
| Compile tokens | `{{ DISPLAY_ID }}`, `{{ IS_UI1 }}` and language `{{key}}`. They work inside template `onLoad` script and in main.js. | [doc L1539-1549; probe A] |
| Languages | 22 + `id`. **No `hu` or `sk`.** | [doc L2435-2457; critique §2] |
| Memory errors | `releaseMemoryCb (exec. zapp)` = JS heap; `(exec. ui)` = UI memory | [doc L3335-3340] |
| Source package | Top-level files only: main.js, manifest.json, data.json, *.html, *.png, ext*.js, `<lang>.json` | [store §1.2] |

---

## 4. Architecture and data flow

**v1.0 as built.** This section was rewritten after implementation. The design put the parser and the navigation in the template, with main.js knowing nothing about topo contents. Implementation reversed that, for three reasons:
- The template cannot read storage in the simulator [probe B].
- `evalFile`, the only way to ship the built-in library (binding decision 1), works only in main.js.
- The design's own fallback F2 (§4.2) turned out to be practical.

Sections 4.3 (format) and 4.6 (persistence) keep their structure but carry corrections.

### 4.1 Components

```
 Topo editor (browser)              Suunto app (phone)             Watch
 ---------------------              ------------------             -----
 draw + validate (stp1.js)          setting "Topo line from editor" -> data.jsn: topo0, lapAdv, sv
 encode STP1, 1,500 B budget  --->  paste, sync
 preview = watch renderer (watch.js, generated from t.html + ext1/ext9)
 "Download built-in file" -> extN.js (a developer adds it to the package)

 +---------------------------- main.js (zapp context) ------------------------------------------+
 | onLoad   ext0.js: read topo0, lapAdv, sv (or dbg); parse the slot; validate the saved position|
 |          open the saved topo, else the slot topo, else the Fictional Demo (in ext0.js)        |
 | onEvent  1/2/3 long press -> ext2.js navigation -> open a topo (ext1.js + ext9.js parse;      |
 |          built-in strings from ext4.js-ext7.js) -> save sv                                    |
 |          text: ext3.js (topo cards), ext11.js (error and Help cards), ext8.js (Map),          |
 |          ext10.js (Info) with setText/setStyle                                                |
 |          2000000+h: template holds topo h; 3000000+h: template (re)activated; 5/6 units       |
 |          (3000000 alone: it holds nothing, so the stream restarts at chunk 0, route first)   |
 | evaluate one stream chunk of the open topo per tick until the template reports it complete   |
 |          (outputs ck, d0..d13, d14); 30-tick hold for the summary                             |
 | onLap    lap advance when lapAdv = On; pause/end: save sv; getSummaryOutputs: Highest pitch    |
 +---------------------------------------------|------------------------------------------------+
                outputs ms, mh, ck, d0..d14    v      ^ events $.put('/Zapp/{zapp_index}/Event')
 +---------------------------- template t.html (UI context) ------------------------------------+
 | onActivate: $.get UnitsMode -> 5/6; subscribe to 18 outputs; send 3000000+(hash, 999999 or 0)  |
 | stream receiver: check word -> 3 bytes per word into GB (Uint8Array 1932); report 2000000+hash  |
 | ms -> camera (Map: current pitch; list card: whole topo) -> REFRESH c0, c1 +100 ms, c2 +200 ms |
 | drawTile x3 under the 150-unit cap; loading line #ld while the topo is incomplete              |
 | pushButtons up/down/next: onLongPressStart -> send(1/2/3); no onClick                         |
 +----------------------------------------------------------------------------------------------+
```

main.js reads at most one topo string at a time: the open one, kept in `str`. *(Round 4: for the slot it keeps only the card, `name|grade|pitches` in `user`, and reads the slot from storage again when it opens it.)* Browsing the list reads each built-in card from a card index in ext3.js and loads no topo file (round 1).

### 4.2 Gate G1: replaced by the output stream

The design's G1 asked whether the template can read settings on the watch. v1.0 does not depend on the answer: the template never reads storage. Geometry reaches it through numeric outputs, which is the design's fallback F2 turned into the main path.
- **Simulator:** verified. Every built-in and the fixtures stream completely, and screenshots show the drawings.
- **Hardware:** unverified. H1 is now the stream test (§16c).

The design rejected F2 as "slow". As built, a chunk carries 14 words of 24 bits, and one chunk goes per `evaluate` (about 1 s). Measured in the Node rig, a topo takes this many chunks (seconds):

| Topo | Characters | Words | Chunks (s) |
|---|---|---|---|
| Jägerhorn N | 417 | 29 | 3 |
| Fictional Demo | 938 | 75 | 6 |
| Full settings slot (fixture `slot-1500.stp`, 12 pitches) | 1,500 | 109 | 8 |
| Piccolo Fillar | 1,767 (986 with the neutral notes shipped since round 2) | 120 | 9 |
| Fictional Wall | 3,222 (3,246 since round 2) | 255 | 19 |
| Stress fixture (3,500 characters, most terrain) | 3,500 | 496 | 36 |

The route arrives first, because the words are ordered header, stances, route, terrain. The template draws the route as soon as the route words are in (ready level 1) and shows "Loading NN%" until the terrain is in. *(Round 3: also when the template mounts after main.js has been streaming. On the watch that is the normal first view, because `evaluate` runs from sport-mode selection while the template loads only when the user opens the app display, and it happens again after every template reload. A template that holds nothing reports `3000000`, and main.js restarts the stream at chunk 0. Before, main.js went on from wherever its chunk pointer was, so the route waited for the stream to wrap around, up to 18 s for the Fictional Wall, while the line said "Loading 99%" over a black canvas: the percentage counted chunks before chunk 0 had given the chunk count. The percentage now counts from chunk 0 and shows 0% until then.)* Text appears immediately, because main.js writes it.

### 4.3 Transfer format STP1

**Container.** One line, at most **3,500 characters** (E7 above that). *(Changed from 4,000 bytes.)* The 3,500 is the built-in file budget.
- The settings slot is limited to 1,500 bytes by its `maxLength`, so that data.json stays under 2 KB (binding decision 1).
- The editor enforces 1,500 B for the slot and 3,500 B for a built-in file.

```
topo   = "STP1" *( "|" record )
record = TAG BODY        ; TAG = one ASCII letter; BODY = everything up to the next "|" or end
```

**Text and records.**
- The text inside any record must not contain `|`. The editor replaces it with `/`.
- A reader ignores unknown record tags and unknown feature letters.
- An empty record (`||`) and a trailing `|` are tolerated.
- A **duplicate** `N`, `R` or `B` is an error (E2, E3, E4). *(Clarified: the design did not say.)*

**Numbers.** Decimal integers: an optional `-`, then 1-4 digits. No spaces.

**path.** `x,y[,dx,dy]*`. The first pair is absolute and every later pair is relative to the previous point.
- Every resulting coordinate must lie in 0..4095, otherwise the error is E6.
- One world unit equals one q pixel at zoom 1.0.

**Text limits are in characters (UTF-16 code units), not bytes.** *(Changed: the parser runs on JavaScript strings, so it can only count characters.)* The editor still counts bytes for the slot and file budgets.

| Tag | Body | Required | Limits | Meaning |
|---|---|---|---|---|
| `N` | text | yes, once | 1..32 characters | Route name |
| `W` | text | no | ≤ 32 characters | Crag / wall (parsed, not shown in 1.0) |
| `G` | text | no | ≤ 10 characters | Overall grade |
| `A` | text | no | ≤ 200 characters | Approach note, shown in Info at Start |
| `D` | text | no | ≤ 200 characters | Descent note, shown in Info at Top |
| `R` | path | yes, once | 2..120 points | Route polyline from approach start to walk-off end |
| `B` | int list | yes, once | 2..61 entries, strictly increasing, last < points | Stance indices into R. Pitch k runs from `B[k-1]` to `B[k]`; n = len(B) − 1 |
| `P` | `band~grade~len~info` | exactly n records, in order (at most 60) | band 0..4; grade ≤ 10 characters; len 1-3 digits, metres (0 = unknown); info ≤ 200 characters | Pitch k |
| `F` | type letter + paths separated by `;` | no | ≤ 40 F records, ≤ 100 paths, ≤ 400 points over all F | Terrain feature group |

Text fields must not hold control characters (below U+0020); a control character counts as a bad field (E5 in `P`, E7 in `W`/`G`/`A`/`D`, E2 in `N`).

`band` is computed by the editor from the grade and the grade system:
- 0 = none
- 1 = easy: UIAA ≤ IV+, French ≤ 4c, YDS ≤ 5.6
- 2 = moderate: up to UIAA VI−, French 5c, YDS 5.9
- 3 = hard: up to UIAA VII, French 6b, YDS 5.10d
- 4 = very hard: above that

**Feature letters and styles.** These are unchanged from the design table, except:
- **`q` (contour fill) is parsed but not drawn.** A fill is expensive on the budget and invisible on MIP; the editor warns when a topo has one.
- Point glyphs, grass and scree are skipped below zoom 0.6.
- Decorated lines draw as plain lines below zoom 0.6 (§7).

| Letter | Feature | Geometry | Priority |
|---|---|---|---|
| `r` `o` `l` `k` `h` `d` `a` | roof, overhang, ledge, crack, chimney, corner, arete | path | 1 |
| `p` `g` | ramp, couloir | path | 2 |
| `s` | slab | closed path | 3 |
| `c` `q` | contour, contour fill (not drawn) | path | 4 |
| `b` `n` `v` | bolt, piton, rappel anchor | points | 2 |
| `x` `t` | chockstone, tree | points | 3 |
| `w` `z` | grass, scree | points | 4 |

**Error codes.** The parser never throws. main.js also wraps it in `try` and maps anything unexpected to E9.

| Code | Condition (as built) |
|---|---|
| E1 | Not a string, does not start with `STP1`, or `STP1` is not followed by `|` or the end (this includes old JSON) |
| E2 | `N` missing, empty, longer than 32 characters, duplicated, or holding a control character |
| E3 | `R` missing or duplicated, fewer than 2 points, or more than 120 |
| E4 | `B` missing or duplicated, fewer than 2 entries, more than 61, not increasing, or a stance beyond the last route point |
| E5 | A bad `P` field, more than 60 `P` records, or a `P` count ≠ n |
| E6 | Number syntax error, or a coordinate out of 0..4095 |
| E7 | More than 3,500 characters, a `W`/`G`/`A`/`D` text over its limit, more than 40 F records, 100 paths or 400 points |
| E9 | Unexpected exception (main.js `try`) |

**Error precedence.** Parsing runs in two stages, so the first error found decides the code. *(Added: the design did not specify an order.)*
- **Stage 1** (`ext1.js`) reads the header, size and text records, in record order: E1, E7 size, then E2, E5 (pitch records) and E7 (text).
- **Stage 2** (`ext9.js`) reads the geometry, in record order: E3, E4, E6 and E7 (terrain).
- **Final checks** come last: E3 for a missing R, E4 for a missing B or a stance out of range, and E5 for a pitch count ≠ n.

**Hash.** `h = (Σ c_i · ((i mod 31) + 1)) mod 65521` over the UTF-16 code units. A result of 0 is mapped to 1. Unchanged.

**Demo.** The shipped demo is `src/suuntopo_canvas/ext4.js`. With English tokens it is 938 characters, and the canonical copy is `test/suuntopo_canvas/fixtures/demo.stp` (test T8). The demo's geometry was redrawn during implementation, and pitch 3 (5c) is band 2, not 3: 5c is moderate by the band table. The design's worked example is therefore outdated.

**Size check.** A 1,500-byte slot holds about 12 pitches with short notes (fixture `slot-1500.stp`). Long routes with notes belong in a built-in file of up to 3,500 characters: the Fictional Wall has 30 pitches in 3,222 (3,246 since round 2). *(The design's 35-pitch example in 4,000 B no longer fits the slot.)*

### 4.4 Parsed layout

*(Rewritten: the parse happens in main.js, and the template holds only stream words.)*

**main.js.** Three typed arrays, allocated once in `onLoad` and reused for every topo:
- **`W` (Float32Array 644).** The geometry words, each below 2^24, exactly as they are streamed:
  - word 0: `nR + nB·128 + nF·8192`
  - word 1: the total number of feature points
  - stances, 3 per word: `s0 + s1·128 + s2·16384`
  - route points, `x·4096 + y`
  - the feature table, one entry per path: `type·1024 + count`
  - feature points, `x·4096 + y`

  Stage 2 writes each region at its largest possible offset (stances 2, route 23, table 143, points 243), then compacts them. `R[3]` holds the word count.
- **`R` (Float32Array 200).**
  - `R[0]` parse code, `R[1]` pitches, `R[2]` hash, `R[3]` words.
  - `R[4..11]` text spans (start, end) of N, G, A and D.
  - From `R[16]`, 3 floats per pitch: `band·1000 + len`, `gradeStart·256 + gradeLen` and `infoStart·256 + infoLen` (spans in the topo string).
- **`S` (Float32Array 17).** View, card, idx, page, pages, open topo, pitches, hash, cards, units, slot code, built-in count, lap setting, and the saved position. They are listed in the header of `main.js`.

The topo string itself stays in `str`, and text is cut from it only when it is displayed.

**Template.** `GB` (Uint8Array 1,932) holds the received words, 3 bytes each. It is read through `wd(w)`. Nothing else is allocated per topo.

### 4.5 Protocol between main.js and the template

**Round 1 (2026-10-04).** These changes override the text below:
- **`mh` is the stream id:** content hash + 65536 × topo (0 slot, 1-4 built-in), at most 327,664, so two topos with the same content hash never share it. `sv`, the check word and the 2000000/3000000 events use the stream id. *(Before, a slot topo with a built-in's hash kept the slot's drawing under the built-in's name.)*
- **Order really is irrelevant now.** A new stream id resets the receiver and checks the chunk already held in `rx` again. *(Before, a one-chunk topo whose words arrived before its hash never loaded, because its outputs never change again.)* The template also subscribes `ms` and `mh` first.
- **At least two chunks alternate** (`chunk = (chunk + 1) % max(2, K)`), so even a one-chunk topo changes its outputs every second under on-change delivery.
- **On every activation** the template releases the tokens it still holds before subscribing again (an activation without `onDeactivate` used to add 18 subscriptions), keeps one callback per output for its lifetime, and reads `mh` and `ms` with `$.get` once, for subscriptions that do not deliver the current value.
- **One refresh chain at a time:** `#c0` refreshes at once, `#c1` and `#c2` follow 60 ms apart; a change during the chain restarts it at `#c0` instead of starting a second chain (two chains used to refresh two tiles at once and send REFRESH to a nonexistent `#c3`).
- **Residual:** if the watch's subscriptions deliver no current value on activation, a word index that holds the same value in every chunk is never delivered after a template reload, and that topo stalls until another is opened. The `$.get` covers `mh` and `ms` only; H1 and H3 show which behaviour the watch has.
- **Events:** 4 is lap advance (from `onLap`, handled by ext2.js like the presses).
- **Failures:** a navigation file or text writer that fails to load (`evalFile` throws) leaves the state, or skips the text; `onEvent` writes the outputs in every case. A topo that fails to load leaves the list on its card with the previously open topo opened again.

**Round 3 (2026-10-04).** These changes override the text below:
- **Route first after a mount or reload.** The activation report says what the template holds: `3000000 + hash` (complete), `3999999` (part of a topo, from its chunk 0) or `3000000` (nothing). For nothing, main.js restarts the stream at chunk 0, unless chunk 0 was the last chunk written: under on-change delivery, writing the same values again would not be delivered, and a subscription that delivers the current value already gave it. A template that holds part of a topo (an overlay during a load) does not restart the stream, so an overlay costs nothing (T5 checks both; restarting on every activation made the Fictional Wall take 22-35 s instead of 19 s). 999999 is never a stream id (at most 327,664).
- **Activation order.** `onActivate` reads `UnitsMode` first; `activate()` subscribes, then sends the report and paints, and reads `mh` and `ms` with `$.get` last. A `$.get` on an output that throws on the watch (unverified, §20) then skips neither the report nor the paint nor the units.
- **`onDeactivate`** ends the refresh chain first (`tile = 3; run = 0`) and wraps each `$.unsubscribe` in `try`, as `activate()` does. Before, an unsubscribe that threw (a token severed by a lap popup, forum 15320) left the chain flag set; with the chain's timer dropped by the firmware no tile was ever refreshed again.
- **Not done:** a `try` around each `$.subscribe`. The reference documents a failed subscription as a system-event line (`ZappProvider::sub FAILED … -> get`), not as an exception, and the official examples subscribe unguarded.

*(Rewritten.)* **Outputs** (`manifest.out`): 19, all numeric. The validator limit is 20.

| Name | Value |
|---|---|
| `ms` | Drawing state: `64 + idx` for the Map, `128 + idx` for the whole open topo on its list card, `0` for nothing (Info, other cards, no open topo) |
| `mh` | Hash of the open topo (0 = none). When it changes, the template drops what it holds. |
| `ck` | Index of the chunk in `d0..d14` |
| `d0`..`d13` | 14 geometry words of the chunk, from `W[ck·14]` |
| `d14` | Check word: `h = hash·7 + ck·131 + 1; for each d_i: h = (h·31 + d_i) mod 16777213` |
| `pitch` | Logged: idx on the slot topo and the schematic built-ins, 0 on the fictional ones and when no topo is open. `log: true`, "Pitch", `Count_Twodigits`. |

**Events from the template to main.js** (`$.put('/Zapp/{zapp_index}/Event', e, null, 'int32')`).

| Event | Meaning |
|---|---|
| 1 / 2 / 3 | Long press up / down / middle |
| 5 / 6 | Units are metric / imperial (from `$.get('/Settings/Unit/UnitsMode')` in `onActivate`) |
| `2000000 + hash` | The template holds every chunk of topo `hash` |
| `3000000 + hash`, `3999999` or `3000000` | The template was (re)activated, holding topo `hash` complete, part of a topo from its chunk 0 (round 3), or nothing. main.js redraws all text. For nothing it restarts the stream at chunk 0 (round 3). |

**Rules.**
- main.js streams chunks `0, 1, 2, …` cyclically from `evaluate` while a topo is open and the template has not reported it. One chunk goes per tick.
- **The template commits a chunk on any callback if its check word matches.** This makes the order in which outputs arrive irrelevant. It also makes the receiver work both when every output is delivered every second (the simulator) and when only changed outputs are delivered (the documented behaviour on the watch). Test T5 runs both delivery modes.
- When main.js opens a topo with a new hash, it forgets the template's last completion report: the new `mh` makes the template drop everything. *(Found by the 1,000-session fuzz test: going back to a topo after a half-streamed one used to stall.)*
- Activation reports what the template still holds. An overlay or a lap popup (re-activation) therefore costs no restream, while a template reload restreams.
- All text is written by main.js in the event that changed it. The design assumed long presses would redraw locally without main.js. As built, every press goes through main.js.
  - Text changes take one event round trip.
  - The drawing changes when the template receives the new `ms`. The reference says outputs set outside `evaluate` may reach the screen only after the next `evaluate`, which can be up to about 1 s.
  - The real delay on a watch is hardware item H3.

### 4.6 Persistence

- **Key `sv`.** Format `2,<view>,<topo>,<idx>,<pitches>,<hash>`, where topo is 0 for the slot and 1-4 for the built-ins. *(Changed from the design's slot numbering and `1,` version.)*
- **Who writes it, and when.** main.js `save()` writes it on long presses, pause and end, and never in `evaluate`. *(Round 1: not on laps either, because the lap popup is a busy moment for memory, and only when the string changed, so browsing the list writes nothing. A failed write no longer restarts the stream.)* *(Changed: the design wrote it throttled from `evaluate`. The deep-dive rule says localStorage only in onLoad, on rare user actions and at exercise end, because every call allocates a buffer the size of the whole data file.)*
- **Restore in `onLoad`** (ext0.js plus `start()`; round 4: ext0.js also opens the topo, with main.js's `open()`, and `start()` opens the demo when nothing is open after it). A saved position is valid when:
  - the version is 2;
  - its topo exists (topo 0 only while the slot parses);
  - its view is 0-2.

  What happens next:
  - **Valid position, same hash:** the saved view comes back. *(Round 1: a route saved at Top, finished, starts again at Start; it used to need n+1 long presses to get back down.)*
  - **Valid position, different hash** (the topo changed): that topo opens on its list card at idx 0.
  - **No valid position:** the slot topo opens on its list card. When the slot is empty or broken, the demo opens instead.
- **Simulator fixtures.** If the key `dbg` exists it overrides `sv`, in the same format. It is written only by `test/suuntopo_canvas/sim-fixture.js`. Test T8 asserts that the shipped data.json has no `dbg`.

---

## 5. Screens and layout

**v1.0 as built.** The layout follows this section, with these changes (details in §20 items 6-11):
- The "Route view" is the **topo list**. It draws only the open topo's card; the other cards are text only.
- Element positions:
  - `#tn` sits at 5%, `#h1` at 80% *(round 2; it sat at 82% and touched `#h2` on n and o)* and `#h2` at 90%.
  - There are **six** text lines, `#l0`…`#l5`, at 26-71%.
  - There is a new loading line `#ld` at 74%, between the drawing and `#h1` *(Changed in round 1: it sat at 47%, over the current pitch; round 2: 74%, clear of `#h1` at 80%)*.
- `LPP` is 6, and `NAME_CHARS` on n is 14.
- Elements are hidden with both `'#id'` and `'#id *'` selector forms.
- On a list card, `#it` carries the label: "Not a real climb" (fictional built-ins) or "Schematic topo" (real routes). The slot topo has no label.
- All text is written by main.js (ext3.js, ext8.js, ext10.js; round 4: ext11.js for the error and Help cards), not by the template.
- *(Changed in round 1.)* There are **two Help cards** at the end of the list. Help 1 shows the buttons: "Hold UP: next / Hold DOWN: back / Hold MIDDLE: / open, notes, list / Button lock stops / these holds." Help 2 shows how to load a topo: "Draw your topo in / the web editor / (see store page), / paste the line in / the Topo setting, / then sync." *(Round 3: "Draw your topo in / the web editor / (see store page). / Send the line to / your phone, paste / it in Topo line." The editor works on a computer and the setting lives in the phone app, so the card says how the line gets from one to the other. The setting is now called "Topo line from editor"; its path `topo0` is unchanged, so nothing migrates.)*
- *(Round 1.)* A list card of a topo that is not open shows "Hold MIDDLE: open" in `#l2`, in the dim text colour. Topo cards give the pitch count in words ("5c  4 pitches", "IV  1 pitch") and fall back to "P" when that does not fit the name budget. Info marks a page that has another page after it with "more" ("1/4  more") instead of "(1/2)". *(Round 2: replaced by "Notes 1/2", below.)*
- *(Round 1.)* When the slot holds a topo that does not parse and no saved topo was restored, the list opens on its error card, so a failed paste is the first thing the user sees.
- *(Round 2.)* **The line under the drawing (`#ld`)** is the template's. On the open topo's list card it shows "Loading NN%" until the topo is complete and then "Hold MIDDLE: map", so the first screen says the app runs on holds. On the Map it shows the progress only until the route can be drawn (ready 0), so it never covers the current pitch; the terrain then appears without a progress line. On every other screen it is hidden.
- *(Round 2.)* **Map:** `#tn` shows the position ("Pitch 2/4", "Start", "Top") in white, because every hold changes it; `#h1` keeps grade and length; `#h2` is hidden. The topo's name is on its list card and in Info.
- *(Round 2.)* **Info:** `#h2` counts the pages of notes ("Notes 1/2") and only when there is more than one; the title `#it` already names the pitch.
- *(Round 2.)* **Error cards** end with what to do: E2-E5 and E7 add "Fix it in the editor."; E6 says "Damaged paste. Copy the whole line again."; E9 "Could not be read. Restart the exercise.".
- *(Round 3.)* **Hold MIDDLE on the error card** moves to the open topo's list card (the Fictional Demo after a failed paste), where its name and "Not a real climb" show that it is not the pasted topo. It used to open the demo's Map, which shows neither, so the demo looked like the user's topo. A grey "Hold UP: next" on the error card was not added: ext3.js would need a colour per line, and it is at 2,071 of its 2,100 B guard. *(Round 4: the error card is written by ext11.js, 1,307 B.)*
- *(Round 3.)* **The bottom tile `#c2` ends at 79%** (62-79%, height 17%; it ran to 84%), and the Map fits the current pitch into 250 px of height instead of 270 px. The target ring then ends at about 79%, so nothing is drawn under `#h1` at 80%: before, the done pitch and the terrain below the start belay ran into the grade and length (a terrain chevron sat on Jägerhorn N's "IV").
- *(Round 3.)* **UI1 watches** (s, m, l) show "Not supported" and "on this watch" as two centred lines; the single 27-character line ran past the right edge on s and l.


### 5.1 Navigation model

- **Position idx.** 0 = Start (approach), 1..n = pitch k, n+1 = Top.
- **"Current pitch" at idx = k.** The pitch from stance `B[k-1]` up to stance `B[k]`. You stand at `B[k-1]`, and `B[k]` is the target.
- **At Start.** Pitch 1 is drawn as "upcoming" and the start stance is marked as target.
- **At Top.** Every pitch is drawn "done", and the top stance and the descent walk are emphasised.

**Views.**
- **0 Route.** A carousel of topos: the non-empty user slots in slot order (valid ones and error cards), then Demo, then Help. Each topo is drawn whole.
- **1 Map.** The current pitch, auto-fitted.
- **2 Info.** The notes for the current idx: approach at Start, pitch notes, descent at Top. Up to 4 pages.

**Cycle (middle long press).**
- Map → Info page 1 → … → last page → Route → Map.
- Leaving Route opens the topo being browsed. If that is the topo already open, idx is kept. Otherwise idx starts at 0.
- On an error card or the Help card, a middle long press opens the previously open topo, if there is one. If there is none, the press does nothing. *(Round 3: on the error card it moves to the open topo's list card instead, §5.)*

**Start-up.**
- If `ms` restores a valid state, that view is shown.
- Otherwise the app opens the Route view on the first non-empty slot, or on Demo when every slot is empty.

**Auto-fit.**
- Map frames the bounding box of the current pitch's route vertices: from `B[k-1]` to `B[k]`. At Start it frames from vertex 0 to `B[1]`; at Top, from `B[n-1]` to the last vertex.
- The box is placed in the map area centre (W/2, 0.50·H). Zoom is `z = clamp(min(0.80·W/bw, 0.62·H/bh), 0.35k, 2.0k)`, where bw and bh are at least 40 units and k = W/466.
- The Route view fits the whole route polyline, with z clamped to [0.08k, 2.0k].

### 5.2 Common frame

All positions are percentages, so one template serves n, o and q. The canvases fill 100% width; drawing scales by k = `ctx.width/466` (n 0.515, o 0.601, q 1.0).

Element pixel positions below are for q. n and o follow from the same percentages. Font sizes come from the class mapping [doc L1921-1936, L1958-1963].

| id | Element | Class | top | width | q px (top) | Font q / n,o | Content |
|---|---|---|---|---|---|---|---|
| `#bg` | div | – | 0 | 100% | 0 | – | background `#000000` |
| `#c0` `#c1` `#c2` | canvas tiles | – | 16% / 39% / 62% | 100% | 75 / 182 / 289; heights 107 / 107 / 79 (round 3; 103 before) | – | geometry only |
| `#tn` | div | `sp-b-cjk p-hc` | 7% | 66% | 33 | f-b-m 35 / 19 px | topo name, or the view title |
| `#h1` | div | `sp-b-cjk p-hc` | 84% | 66% | 391 | 35 / 19 | grade + length (band colour) |
| `#h2` | div | `sp-t-s p-hc` | 92% | 50% | 429 | f-t-s 27 / 14 | "Pitch 3/12", "Start", "Top", carousel "2/4" |
| `#it` | div | `sp-b-cjk p-hc` | 16% | 80% | 75 | 35 / 19 | Info title "P3  5b  30 m" |
| `#l0`…`#l4` | div | `sp-b-cjk p-hc` | 26 / 35 / 44 / 53 / 62% | 80% | 121 … 289 | 35 / 19 | text lines (Info, error card, Help card) |

**Element rules.**
- Text elements start with the content `-`, because `setText` needs existing non-space text [doc L1307].
- Unused elements are hidden with `setStyle('#id *', 'visibility', 'HIDDEN')` and shown with `'VISIBLE'`. This uses the selector form and the uppercase value of the only documented example [doc L1398-1406]. The lowercase form is unverified on hardware.
- Elements are never set to an empty string or to spaces.
- Text elements come after the canvases in the DOM, so text draws on top of geometry (inferred).

**Character budgets.** These were computed from the circle chord at each line's centre and an average glyph width of 0.52 em. The template applies them, and tests assert them with the longest localized strings.

| Budget | q | o | n |
|---|---|---|---|
| `NAME_CHARS` (`#tn`) | 15 | 15 | 13 |
| `HUD_CHARS` (`#h1`) | 15 | 15 | 13 |
| `H2_CHARS` (`#h2`) | 12 | 12 | 11 |
| `CPL` (Info characters per line) | 18 | 20 | 17 |
| `LPP` (lines per page) | 5 | 5 | 5 |

**Truncation.** `fitText(s, max)` returns `s` unchanged if it fits. Otherwise it returns `s.substring(0, max-3) + '...'`. Plain ASCII dots avoid any glyph risk.

**Wrapping.** `wrap(s, CPL)` breaks at spaces and hard-breaks any word longer than CPL. Pages = ceil(lines/5). After 4 pages the last line ends in `...`.

The percentages are starting values. Implementation tunes them with simulator screenshots, within ±2%. Acceptance criterion A6 checks that no text is clipped by the circle on q, o or n.

### 5.3 Map view (view 1)

- **Tiles.** These draw the auto-fitted pitch (§7).
- **`#tn`.** The topo name.
- **`#h1`.**
  - At idx = k: `<grade>  <len> m` (or `ft`), in the band colour (§5.7). An unknown length is omitted.
  - At Start and Top: `<G>  <Σlen> m`, in white.
- **`#h2`.** `{{wPitch}} k/n`, `{{wStart}}` or `{{wTop}}`.
- **Hidden.** `#it` and `#l0`…`#l4`.

### 5.4 Info view (view 2)

- **Tiles.** Each tile draws only the black `fillRect`, for 2 units.
- **`#tn`.** The topo name.
- **`#it`.**
  - Pitch: `{{pAbbr}}k  <grade>  <len> m`, in the band colour.
  - Start: `{{wApproach}}`.
  - Top: `{{wDescent}}`.
- **`#l0`…`#l4`.** One page of wrapped notes, in `TEXT`. If there are no notes, `#l1` shows `{{noNotes}}` in `TEXT_DIM`.
- **`#h2`.** `k/n (p/P)` when there is more than one page, otherwise `k/n`.
- **`#h1`.** Hidden.

### 5.5 Route view (view 0)

**Topo card.**
- **Tiles.** The whole route. If this is the open topo, the current pitch is highlighted; otherwise every pitch is drawn as upcoming.
- **`#tn`.** The name.
- **`#h1`.** `<G>  n {{pAbbr}}`, in white.
- **`#h2`.** `i/N`, the position in the carousel.

**Error card** (non-empty slot that fails to parse).
- **Tiles.** Black.
- **`#tn`.** `{{wTopo}} s+1`.
- **`#l0`…`#l4`.** The error text from §4.3 plus `(E4)`. The error text uses colour `ERR`.
- **`#h2`.** `i/N`.

**Help card.**
- **Tiles.** Black.
- **`#tn`.** `{{wHelp}}`.
- **`#l0`…`#l4`.** `{{help1}}`…`{{help5}}`. For example: "Draw a topo in the", "SuuntoPo editor, copy it,", "paste into Topo 1-5 in", "Suunto app SuuntoPlus", "settings, then sync." The final URL line waits for the hosting decision (§18, Q4).

### 5.6 UI1 fallback

`u.html` (displays s, m, l) holds one centred `sp-b-m` div with the text `{{notSupported}}`. `getUserInterface` returns `('{{ IS_UI1 }}' === '1') ? 'u' : 't'`. main.js skips all storage work on UI1. Probe A showed this pattern builds and packages per display.

### 5.7 Colours and fonts

The palette is chosen at compile time with `var DISP = '{{ DISPLAY_ID }}'` [doc L1542; probe A]. Every colour is a 6-digit hex value [doc L1652].

| Token | q (AMOLED) | n, o (MIP, sim-only verified) | Use |
|---|---|---|---|
| BG | #000000 | #000000 | background (black saves AMOLED power) |
| TERRAIN | #A6A6A6 | #FFFFFF | priority 1-2 lines |
| TERRAIN_DIM | #8A8A8A *(round 2; was #616161, 3.4:1)* | #AAAAAA | slab, couloir, contour, scree (6.1:1 on q; T4 keeps terrain at 4.5:1 or more) |
| FILL | #1A1A1A | (not drawn) | contour fill |
| GLYPH | #D9D9D9 | #FFFFFF | bolt, piton, rappel, chockstone |
| VEG | #6FA86F | #55FF55 | tree, grass |
| ROUTE_NEXT | #FF5A36 | #FF0000 | upcoming pitches |
| ROUTE_CUR | #FFD400 | #FFFF00 | current pitch |
| ROUTE_DONE | #B05A48 *(round 1; was #8A3A2A, 2.7:1)* | #AA5555 | climbed pitches (4.4:1 on q) |
| ROUTE_WALK | #5AC8FA *(round 1; was #6E6E6E)* | #55AAFF *(was #AAAAAA)* | approach and descent: a blue no terrain uses; 5 px for the walk of the position (approach at Start, descent at Top), 2.5 px otherwise |
| BELAY | #FFFFFF | #FFFFFF | stance dot |
| BELAY_CUR | #FFD400 | #FFFF00 | target stance |
| TEXT / TEXT_DIM | #FFFFFF / #B3B3B3 | #FFFFFF / #AAAAAA | text |
| ERR | #FF7A59 | #FF5555 | error card |
| BAND 0-4 | #B3B3B3, #5AC8FA, #FFFFFF, #FFD400, #FF9500 | #AAAAAA, #55AAFF, #FFFFFF, #FFFF00, #FFAA00 | grade text |

**MIP colours.** Dark colours render as black on MIP displays (measured) [forum 15279 #2]. Every MIP colour therefore has at least one channel at ≥ 0xAA.

**Grade bands.** They avoid red against green. Light blue, white, yellow and orange stay distinguishable with deuteranopia (inferred). The grade text is always shown, so colour is never the only cue.

**Line widths.** q values in px; on n and o they are multiplied by max(k, 0.6).

| Element | Width / size |
|---|---|
| Route upcoming | 5 |
| Route current | 7 |
| Route done | 4 |
| Route walk | 2 |
| Terrain | 2.5 |
| Ledge | 5 |
| Contour | 1.5 |
| Glyph | half-extent 8, stroke 2.5 |
| Belay | radius 6 (target 9) |

**Fonts.**
- `sp-b-cjk` carries all user text: names, grades and notes. It is the only class guaranteed to cover every supported character [doc L1936].
- `sp-t-s` carries short app strings.
- No canvas `fillText` is used anywhere, so the open questions about canvas font sizes and glyphs do not apply [gaps §2 item 11; forum 15262].

---

## 6. Buttons

**The safety rule.** The template defines **no `onClick` handler on any button**, so all three clicks keep their native function. This assumes that a pushButton which defines only long-press events leaves the click event to the system.

- **The documentation implies it.** The reference overrides only `onClick` to take over the lap button, then says "You could also override the long button presses … by replacing the onLongPressStart" [doc L1092-1108]. It also says "if no event handler defined, default … controlling is used" [doc L1819].
- **Hardware must confirm it** (H2). Test T7 asserts that `t.html` contains no `onClick`.
- **If H2 fails, 1.0 stops.** If defining long-press handlers turns out to swallow the clicks, there is no documented API to recreate pause, so the mapping must be redesigned with Vitya. The only documented partial recovery is recreating lap on the lower click with `$.put('/Activity/Trigger', 0)` [doc L1533].

| Button (Race S) | Click | Long press (`onLongPressStart`, 0.6 s [doc L1857]) |
|---|---|---|
| Upper (`up`) | **native:** pause/resume | Map, Info: idx + 1 (max n+1), page = 0. Route: next card. |
| Lower (`down`) | **native:** lap. If "Lap moves to next pitch" = On, `onLap` advances idx (§10). | Map, Info: idx − 1 (min 0), page = 0. Route: previous card. |
| Middle (`next`) | **native:** next display = leave the app screen | Cycle the view (§5.1) |
| Crown rotation (watches with a crown) | **native:** scroll displays. It cannot be captured [fp]. | – |

**Attributes.** All three pushButtons carry `longType="action"`, so the user's button lock blocks the app's long presses [doc L1817]. That protects against accidental pitch changes when the watch is pressed against rock [gaps §3]. `longPressDuration` is left at the default; the 0.6 s `onLongPressStart` timing is already proven by v0.3 on a Race S. If H6 shows accidental triggers, switch to `longPressDuration="1"` with `onLongPressFull` [doc L1858-1863].

**Ends of the range.** A long press past an end does nothing: up at Top, down at Start, or the edges of the carousel. There is no sound. `playIndication` cannot be silent [doc L1257-1274].

**Lost on this one screen.** The native long-press functions of the three buttons:
- Lower long press opens the control panel; upper long press changes the activity [`docs/suunto_wiki.md` lines 41-43].
- Middle long press is "previous display".

All of them stay available on every other display, one middle click away.

**Pause, lap and exit at a glance.** Pause = upper click, lap = lower click, leave = middle click or crown. Nothing on the app screen ever replaces those, which meets the brief's "do not trap the lap/pause buttons". The store text and the demo's first note say so.

**Conflict to report.** The repo wiki and the gaps report give lower = lap and upper = pause [`docs/suunto_wiki.md`; gaps §3]. The vault note "Suunto Race S fields and widgets" says "lap the transitions with the upper button". The design does not depend on which is right, because all clicks stay native. H2 records which button laps.

**AOD and display off.**
- Clicks while the AMOLED display is off are disabled by default [doc L1830], and the app defines no clicks.
- How long presses behave with the display off or in AOD is undocumented. H7 checks it.
- `disabledWhileAOD` passes validation [probe A], but it is documented for clicks only, so it is not used.

---

## 7. Rendering and canvas budget

**v1.0 as built.** The renderer follows this section, with these differences:
- **A hard guard.** `op()` and `dot()` drop any operation that would take the tile past 150 units, so even a wrong reservation cannot black out a tile.
- **The reservation is a dry run.** `costOf(drawRoute)` and `costOf(drawBelays)` run the real drawing code with drawing switched off. Terrain is then drawn by priority while it fits, with a margin of 3 units per feature.
- **The route is drawn current pitch first,** then upcoming, done, the descent walk and the approach. Under pressure, the hard guard therefore drops the tail, not the current pitch. The design's second decimation level and group dropping were not needed: decimation is 3 px, or 6 px below zoom 0.6.
- **No `closePath`.** A slab closes by drawing back to its first point.
- **A belay dot** *(round 1)* is a 1 px segment with round caps and line width 2r, batched in one path: about 2 units, using only stroke and lineTo, whose costs are measured. Its radius shrinks with zoom (2.5-6 px). *(Before, every stance was an arc plus a fill: 120 of the 150 units of a Fictional Wall list tile were arcs and fills of unmeasured cost.)* Round caps are set once per tile (`lineCap = 'round'`, in the reference's list); their look on the watch is part of H5.
- **The target ring** *(round 2)* is drawn the same way: a 20 px white dot under a 14 px yellow one, each a round-capped 1 px segment in its own path (8 units). It used two arcs and two fills (12 assumed units). **A frame now uses only stroke, moveTo and lineTo, plus the background `fillRect`;** T4 asserts that no frame has an arc or a fill, so an arc cost higher than assumed cannot black out the tile with the target.
- **Long patterned segments** *(round 2)*. Zig-zag (crack) and ticks (roof, overhang, ramp) step along the whole segment in screen pixels, so their CPU time grew with the segment's length on screen, not with what is visible: a valid 1,495-byte slot topo with long crack segments made about 1.1 million `vis()` calls per paint (489 ms in Duktape on a Mac; Race S unmeasured) while the tile budget saw nothing, because the feature was dropped anyway. Now a segment gets its pattern only when it nears the tile and is at most two tile widths long on screen; a longer one draws plain, and a feature stops as soon as the tile budget is spent. The same topo makes 417 `vis()` and 440 `op()` calls per paint (T4 bounds the sum at 20,000). No fixture or built-in loses a pattern at any position on q, o or n (checked); the loss is limited to a single piece longer than about 3.5 times the current pitch's height, and the editor warns about crack, roof, overhang and ramp pieces longer than 466 units.
- **Contour fill (`q`) is not drawn.**
- **Refresh.** `#c0` refreshes at once, then `#c1` at +100 ms and `#c2` at +200 ms *(round 3; +60 and +120 ms before)*, through one self-rescheduling function. The tiles refresh only when the drawing state, the ready level or the hash changes. 100 ms puts each refresh in its own 10 Hz tick, which is the fix that cured `WBMAIN pool id:0 full` on a Race S [forum 15279 #3, #5] and the rule in `docs/research/deep-dive/refresh-rate.md`; with 60 ms, two of the three could land in one tick. The watch's `setTimeout` resolution is unknown, so H9 looks for `pool id:0 full` after the rapid holds.
- **Patterned length per tile** *(round 3)*. The round-2 bound was per segment. A crack segment shorter than two tile widths whose bounding box nears the tile while its line misses it ran all its zig-zag steps without spending a budget unit, so a valid 1,500-byte slot of 159 such segments made 22,000-44,000 `vis()` + `op()` calls per paint (23 ms per 3-tile paint in Duktape on a Mac, 11-22 times the shipped worst case). Now only zig-zag and tick segments count, and each tile steps along at most 8,000 px of patterned segments (in 466 px units, dry runs included); past that, segments draw plain. The crafted slot now makes about 3,450 calls per paint; no fixture or built-in comes near the cap (largest 1,476 px, the stress fixture), so none loses a pattern (T4 asserts both).
- **Measured** with sp-mem on the shipped package over the tour scenario: at most `2·stroke + lineTo` = 50 per tile and 19 lineTo per path. *(Round 2, tour with the Fictional Wall: at most 75 on `#c1`, 19 lineTo per path, no arc, one `fillRect` per frame. Round 3: unchanged, 50 / 75 / 53 on `#c0` / `#c1` / `#c2`.)*


**Tiles.**
- There are 3 canvas objects, each `ctx => drawTile(ctx, i)`. They stack as horizontal bands covering the map area (16%-84%; round 3: 16%-79%, so nothing is drawn under `#h1`).
- matram measured independent budgets for adjacent canvases on a Race S [forum 15279 #0].
- Overlapping layered canvases are unverified, so they are not used.
- If an overflow ever happens despite the cap, it blacks out one band, not the whole map.

**Cost model.** These are units per tile per frame.
- Measured: stroke = 2, lineTo = 1 [forum 15279].
- Assumed until H5 calibrates them:
  - moveTo = 1
  - fill = 2
  - fillRect = 2
  - closePath = 1
  - arc = 4

All of these constants live in one table in the shared block.

**Caps.**
- `TILE_CAP = 150` units per tile: 25% margin under ~200.
- `PATH_MAX = 20` lineTo + moveTo per path (the measured limit is ~24). When a path reaches 20 it is stroked or filled, and a new path begins.
- At most 3 tiles × 150 = 450 units per frame.

**Draw order and reservation per tile.** Let `T` be the tile rectangle mapped back into world coordinates, plus a 12 px margin.

1. **Background.** `fillRect` in BG: 2 units.
2. **Reserve the route.** For each route group (walk, done, current, upcoming), count the units of its vertices in `T` after screen-space decimation. Decimation drops a vertex less than 3 px from the last drawn one.
   - If the route groups need more than 100 units, decimate again at 6 px.
   - Then drop the walk group and the done group, in that order.
   - Current and upcoming are never dropped.
3. **Reserve the belays.** Stances in `T`: arc + fill = 6 each. The target stance gets a larger arc.
4. **Terrain.** It gets `TILE_CAP − reserved − 2` units.
   - Iterate priority 1 → 4. Within a priority, follow data order, which is grouped by type, so batches are long.
   - Skip a feature whose bounding box misses `T`. That is the culling step.
   - Compute each feature's exact cost before drawing it: path length on screen ÷ spacing for zig-zag, teeth and hatch styles, 2 per glyph segment, n + 1 for plain paths.
   - A feature that does not fit is skipped. Drawing then continues with cheaper ones.
5. **Draw.** Terrain first, then the route groups, then the belays. Lines on top keep the route readable. The budget was already guaranteed in steps 2-4.

**Level of detail.**
- Below z < 0.6k (usually the Route view), decorated styles draw as plain lines: no zig-zag, teeth or hatch.
- Point glyphs, grass, scree and contour fills are skipped at that zoom.

**Variables.** All renderer and loop variables are declared once in `onLoad`, and no arrays or closures are created per frame [forum 15279 #0]. Coordinates use pre-declared transform variables: `sx = (x - fx)*z + cx`, `sy = (y - fy)*z + cy - tileTop`. There is no `setTransform`, which the forum reports broken in the simulator [fp].

**Refresh.**
- On any visual state change: `REFRESH #c0` immediately, `#c1` after 60 ms, `#c2` after 120 ms *(round 3: 100 ms and 200 ms)*. The timers use `setTimeout` [doc L1656] with three predeclared functions, so no closures are created.
- Tiles are refreshed only when camera, idx or view changed; a pure text change does not refresh them.
- This staggering is the mitigation that cured `pool id:0 full` [forum 15279 #3].

**Removed.** The vignette, because the display is physically round and BG is black. It cost 4 arcs and 4 fills per frame. Also removed: the progress-dot arc (replaced by the "k/n" text) and all canvas text.

---

## 8. Memory and size budget

**v1.0 as built.** The design's targets below were replaced by the binding budgets at the top of this spec and by measurement. These numbers were measured on 2026-10-03:
- Sizes are from `sp-build`, enforced by test T8.
- Memory is from `tools/sp-mem` on the shipped package, using the lowmem est32 columns, which match watch allocation logs.

| Item | Limit used | Measured |
|---|---|---|
| `t.xml` (q) | T8 guard 10,700 B (research target 8-10 KB) | 10,588 B, **over the 8-10 KB target** |
| Template `onLoad` script | T8 guard 7,100 B (research target about 6 KB) | 6,999 B, **over the target** |
| Largest template function | 2,000 B | 1,006 B (`drawLine`) |
| `main.js`, minified | 2,000 B | 1,861 B |
| Code ext files, minified | 1,900 B each | 410-1,560 B |
| Built-in topo files | 3,500 B each | 439-3,243 B (ext7 3,243 B) |
| Largest Duktape compile request, code | 2,499 B (T8 guard, measured with the sp-mem harness) | 2,436 B (ext10.js); main.js 2,356 B |
| Largest compile request, topo file | 3,600 B | 3,414 B (ext7.js) |
| data.jsn with a full slot and a saved position | 2,048 B | under 2 KB (T8) |
| Elements in t.html | 16 | 15 |

**Memory** (sp-mem, display q, shipped form, lowmem est32 app bytes above the engine baseline).

**Round 1 correction (2026-10-04).** The tour row below was measured with a slot topo that did not parse: `sp.storage.setItemFromFile` keeps the fixture's trailing newline, which v1.0 rejected (E6, finding fixed in round 1 by trimming). The tour therefore never opened or streamed the Fictional Wall. Measured again on the same actions with a clean slot, v1.0 as reviewed and v1.0 after round 1:

| Scenario | Version | Steady | Load peak | Run peak | Largest live block |
|---|---|---|---|---|---|
| Default (empty slot, demo open, 60 ticks) | v1.0 reviewed | 37.7 KB | 45.9 KB | 45.6 KB | 2,592 B (`W`) |
| Default | after round 1 | 38.7 KB | 46.9 KB | 47.6 KB | 2,592 B (`W`) |
| Tour, slot parses, Wall opened and streamed | v1.0 reviewed | 40.2 KB | 45.1 KB | 56.6 KB | 3,235 B (the Wall string `str`) |
| Tour, slot parses, Wall opened and streamed | after round 1 | 41.2 KB | 46.1 KB | 57.8 KB | 3,235 B (`str`) |

- Round 1 added about 1 KB of code (the stream-order, refresh-chain, subscription, failure and logging fixes). It removed the per-press compile of built-in topo files while browsing the list (ext3.js now reads a card index), but the peak is set by opening the Wall: compiling ext7.js (3,440 B request) while the previous topo's string is still live.
- **While the Fictional Wall is open, its 3.2 KB string stays live** (`str`, which the text writers index into). That is above the ~2 KB dependable block size. Keeping text as separate records, or capping built-in files at ~1.8 KB, would remove it; both are open (§18).
- **Measured option, not taken:** dropping point glyphs and the decorated line styles (ticks, zig-zag, double lines) saves 2.4 KB steady and 2.7 KB load peak (37.9 → 35.5 KB on the v1.0 tour). It costs topo features, so it waits for H9.
- **Deferred:** storing `W` as a 1,932-byte `Uint8Array` (saves 644 B and brings `W` under 2 KB) needs a word-read helper in main.js, which is at 1,969 of 2,000 B with 8 of 8 helpers, plus parser and editor changes.

**Round 2 (2026-10-04): cyclic garbage.** The binding rule "no cyclic garbage per frame" held for frames, but every long press, activation and lap left several KB that reference counting cannot free: a function and its automatic prototype refer to each other, and an inner helper and its call's scope refer to each other. That garbage stays until a full mark-and-sweep, and whether the firmware runs one per callback is unknown (`tools/sp-mem/README.md`: the cyclic garbage column, not the run peak, is the number to drive to zero). Fixes: main.js `ext()` sets the loaded function's `prototype` to null; every code ext file sets each inner helper's `prototype` and variable to null before it returns (T7 checks every return path); ext0.js uses main.js's loader instead of its own; the template keeps its units callback (no function per activation) and sends units only when they changed. Measured with `test/suuntopo_canvas/sp-mem-garbage.js` on the tour (host bytes, lowmem, shipped form):

| Action (tour ticks) | Round 1 average / max | Round 2 average / max | Floor: same tour, trivial text writers and navigation |
|---|---|---|---|
| All ticks | 2,596 / 17,970 B | 1,948 / 13,307 B | 260 / 840 B |
| First tick after mount | 7,449 B | 5,788 B | 420 B |
| Wait (frames, stream) | 0 B | 0 B | 0 B |
| Hold UP (list and Map) | 7,882 / 9,188 B | 5,887 / 7,140 B | 840 B |
| Hold MIDDLE (incl. opening the Fictional Wall) | 9,182 / 17,970 B | 6,938 / 13,307 B | 840 B |
| Lap | 6,976 B | 5,010 B | 840 B |

- **What is left is the harness's `evalFile`, as far as can be measured.** sp-mem compiles each ext file as `function(){return (…)}`, whose wrapper and its automatic prototype form a cycle that keeps the file's compiled code alive. With trivial text writers and navigation files every hold leaves exactly 840 B (two loads of 420 B); with the real files the remainder grows with the size of the files loaded. Whether the watch's `evalFile` leaves the same cycle is unknown; the app cannot reach it. 
- **Memory after round 2** (lowmem est32): default 38.7 KB steady (unchanged), 46.9 KB load peak, 48.0 KB run peak (47.6 before); tour with the Wall open 41.2 KB steady (unchanged), 46.1 KB load peak, 55.6 KB run peak (57.8). The largest compiled function block grew from 1,716 to 1,836 B (still under the binding ~1.9 KB).
- **Sizes after round 2:** `t.xml` 10,924 B (T8 guard raised once to 11,000 B: refresh chain recovery, units on change, the open card's Map hint and the bound on long patterned segments add 253 B; dropping the arcs saved 120 B), onLoad 7,299 B (guard 7,300 B kept, 1 B to spare), main.js 1,996 B (guard 2,000 B kept), code ext files 504-2,066 B (guard raised to 2,100 B for ext3.js: helper cleanup and an action on every error card). Compile requests, the binding limit, stay at or under 2,376 B (ext10.js; ext3.js 2,328 B, main.js 2,256 B; guard 2,499 B). The built-in topo files are 439-3,267 B.
- **Hardware.** H9 now includes 30 rapid long presses on the list and 5 laps, then a search of the system events for `relMemCb`, `ReleaseMem` and `JSalloc` (§16c).

**Round 3 (2026-10-04).** Sizes: `t.xml` 10,997 B (guard 11,000 B kept), onLoad 7,336 B (guard raised to 7,350 B), main.js 2,012 B (guard raised to 2,048 B, the research limit "2 KB or less" itself), ext2.js 539 B, ext3.js 2,071 B (the longer Help 2 text). Compile requests are unchanged at most 2,376 B (main.js 2,256 B). Factoring the tick offset in `drawLine` saved 16 B and brought its compiled block back to 1,880 B est32 (1,836 B in round 2; 1,904 B before the factoring), under the binding ~1.9 KB. Memory (sp-mem, lowmem est32, shipped form): default 39,214 B steady (38,722 B in round 2), 47,289 B load peak, 48,473 B run peak; tour with the Wall 41,740 B steady (41,248 B), 46,485 B load peak, 56,101 B run peak (55,606 B). About 160 B of the +492 B is the template's top-level scope table, which grew a step with the one new variable (`steps`); it is now a 2,304 B block (2,144 B before), above the ~2 KB dependable allocation, as it already was.

**Round 4 (2026-10-04): memory.** Six changes from the profiling plan, none visible to users (screenshots on q, o and n byte-identical to round 3, §16b):
1. **The template subscribes with `rv.bind(null, i)`** instead of a closure per output (18 outputs). A closure has its own scope record and prototype; a bound function has neither. The closure stays as the fallback for a firmware without `Function.prototype.bind` (unverified on the watch, H1), which keeps about 570 B of the 2.2 KB this saves without a fallback.
2. **Every template function drops its automatic prototype** at load (`f.prototype = null`, 23 functions, about 50 B each). T4 checks every one.
3. **The renderer has its own function scope:** `makeRenderer`, called once in the shared block to make `drawTile` and then dropped with its prototype (an immediately called function would leave its function and prototype as a cycle that refcounting cannot free). 47 names there, 41 in the template's scope (T7 guards both at 55). A Duktape scope record of 56 or more names gets a hash part: the template's record with 87 names was a 2,304 B block, over the ~1.9 KB block rule; the two records are now 624 B and 540 B (est32, measured with a probe template of 47 and 41 names). The saving assumes the firmware compiles the template's onLoad script as one function body, as sp-mem models it (`tools/sp-mem/README.md`, Limits). Cost: lookups without a hash part are linear, and a tile takes about 24% longer to draw in lowmem Duktape on a Mac (Fictional Wall over every Map position 0.50 → 0.62 ms per tile; stress fixture 0.87 → 1.09 ms). Declaring the hottest variables first would win back about 5 points (measured, not done). The Race S time is H9's to check. Tests reach the renderer's names through a test-only hook (`t.r` in `test/suuntopo_canvas/lib/harness.js`); the shipped script is unchanged by it. `src/topo_editor/watch.js` was regenerated with `sync-watch.js`; `units` and `skipped` stay in the template's scope for the editor preview.
4. **The list's error and Help cards have their own writer, `ext11.js`;** `ext3.js` writes topo cards only. A press compiles the smaller file it needs: the first list text after a mount, the default run peak, falls 1.9 KB. Steady +144 B (the choice in main.js).
5. **ext0.js opens the start-up topo** (the saved one or the default) with main.js's `open()`, which it now receives. `start()` keeps the state init, so the card counts never depend on ext0.js, and opens the demo when nothing is open afterwards (ext0.js did not load, or no topo did; T5).
6. **main.js keeps only the slot's card** (`user` = `name|grade|pitches`, grade from the first G record as before) and reads the slot from storage again when it opens it (a long press or start-up). A full slot no longer stays live while another topo is open. If the stored line no longer parses when opened, the list stays on the slot card with the previous topo open again (T5).

Memory, lowmem est32, shipped form, before → after. Steady, load peak and run peak (a lower bound: the harness forces a GC each tick):

| Scenario | Steady | Load peak | Run peak |
|---|---|---|---|
| Default (empty slot, demo on its card, 60 ticks) | 39,214 → 35,212 | 47,289 → 42,357 | 48,473 → 42,371 |
| Tour (`sp-mem-tour.js`: slot walk.stp, Fictional Wall opened and streamed, pitches, Info, laps) | 41,740 → 37,510 | 46,485 → 41,569 | 56,101 → 51,902 |
| Worst (`sp-mem-worst.js`: full 1,500 B slot, Wall open, its whole-topo card) | 43,023 → 37,518 | 47,839 → 42,917 | 57,494 → 51,911 |
| Slot map (`sp-mem-slotmap.js`: full slot on the Map, 10 pitches) | 39,777 → 35,785 | 47,853 → 42,931 | 50,227 → 45,006 |
| Reload (`sp-mem-reload.js`: Wall open, then a template reload) | 41,552 → 37,532 | 47,289 → 42,338 | 76,878 → 67,899 |
| Long session (`sp-mem-long.js`: 30 min, holds, laps, pause, overlays, one reload) | 38,534 → 34,547 | 46,541 → 41,626 | 73,163 → 64,481 |

- **Per change,** default steady / load / run: bind −1,641 / −1,645 / −1,597; prototypes −1,196 / −1,002 / −1,155; renderer scope −1,096 / −2,070 / −1,156; ext11.js +144 / +149 / −1,882; ext0.js open and the slot card −238 / −249 / −338 (worst scenario −1,741 steady); `makeRenderer` dropped after use instead of an immediately called function +25 / −115 / +26 (reload: run peak −116, 208 B less cyclic garbage).
- **Blocks.** Scope records 1,628 B in all (4,092 B): the renderer's 624 B and the template's 540 B replace the 2,304 B record; main.js's is 276 B. Prototype objects 936 B (2,248 B). Largest live block 2,592 B (`W`), 3,259 B with the Wall open (its string). Largest compiled function block 1,880 B (`drawLine`, unchanged); main.js dispatcher 1,592 B. Live growth 0 B per tick in every scenario.
- **Cyclic garbage** (host bytes per tick, stock harness): default 69 average / 4,132 max (97 / 5,793 before); tour 1,744 / 13,343 (1,960 / 13,343): waits 0, hold UP 5,158 (5,925), hold MIDDLE 6,412 (6,976), lap 5,028 (5,046). All of it is the harness's `evalFile` wrapper: with ext files compiled in eval mode (a diagnostic copy of the harness), every tick of the tour leaves 0 B. The reload tick leaves 38,642 B (44,662 B): the old template's scope and closures, alive while the new one compiles.
- **Canvas** unchanged: at most 75 units (`2·stroke + lineTo`) per tile and 19 lineTo per path (tour).
- **Sizes.** `t.xml` 11,527 B (T8 guard 11,550 B), onLoad 7,866 B (guard 7,900 B), main.js 1,975 B (guard 2,048 B), code ext files 539-1,522 B. Compile requests at most 2,376 B (ext10.js; main.js 2,256, ext0.js 2,028, ext3.js 1,456, ext11.js 1,420). T8 now measures each template function's own source with acorn, nested functions excluded (largest `drawLine`, 1,047 B).
- **The binding budget is not met:** 35-38 KB steady and 42-52 KB run peak against 16 KB and 20 KB. What it would take, measured on top of round 4 (scratch copies, not shipped, made before the `makeRenderer` change, which moves these by at most 0.12 KB; default / worst, steady / load / run):
  - **Cap terrain at 163 points (406 geometry words) and release `W` once the template holds the topo,** rebuilding it from `str` after a reload: default 32,070 / 40,960 / 40,282, worst 34,376 / 41,523 / 49,736, reload run peak 63,678. A slot topo with more than 163 terrain points (400 now) fails with E7; the editor, the stress fixture and T1/T4 change; main.js grows to 2,099 B, over its guard. Releasing `W` without the cap was not taken: it re-allocates 2,576 B mid-exercise on every topo open and template reload, above the ~2 KB rule.
  - **Plus a 15-pitch Fictional Wall (1.7 KB):** worst 32,833 / 41,523 / 48,000, and no live block above 1,880 B. Binding decision 1 asks for one built-in near the size limit.
  - **Plus no point glyphs and no decorated lines** (cracks, roofs, chimneys and the rest drawn plain): default 29,532 / 38,039 / 37,658, worst 30,295 / 38,603 / 45,327.
  - **Plus no terrain at all:** default 27,685 / 35,734 / 35,794, worst 28,448 / 36,298 / 43,456.
  - **16 / 20 KB needs the runtime stream gone:** no settings slot and no built-in library, one topo compiled into the template, as in hwtest3 (15.7 KB). That contradicts binding decision 1. Each long press compiles ext files at 7-10 KB est32, so a 20 KB peak also needs about 11 KB steady.
  - These are Vitya's decisions (§18, Q16).
- **Scenarios** are in `test/suuntopo_canvas/` (`sp-mem-*.js`); `sp-mem-measure.js` runs default, tour, worst, slot map and reload (and the long session when named) and prints these columns.

Original v1.0 measurement:

| Scenario | Steady | Load peak | Run peak | Largest live block |
|---|---|---|---|---|
| Default (empty slot, demo open, 60 ticks) | 37.7 KB (watch-fit 35.3 KB) | 45.9 KB | 45.5 KB | 2,592 B (`W`, 644 floats) |
| Tour (`test/suuntopo_canvas/sp-mem-tour.js`: every topo opened, Fictional Wall streamed, pitches, Info, laps; *in fact the slot failed and the Wall was never opened, see above*) | 37.9 KB | 46.1 KB | 51.6 KB | 2,592 B |

- **Where the bytes are.** Mounting the template costs 26.5 KB, mostly compiled functions. main.js plus onLoad cost 11.4 KB.
- **Per frame.** The canvas peaks at `2·stroke + lineTo` = 50 per tile, under the cap of 150.
- **The binding targets are not met.** They are a canvas topo app peak ≤ 20 KB and steady ≤ 16 KB. v1.0 is 2.4× the steady target and above v0.3's 31 KB.
  - Compile blocks do meet their limit: every compiled block is at most 2,499 B, and the 6.9 KB block that failed v0.3 is gone.
  - Calibration notes suggest about 32-37 KB is free for one app before an exercise on a Vertical 2 with co-apps. The Race S is unmeasured.
  - **H9 is the release gate.** If H9 fails, the next step is a smaller template: drop decorated terrain styles and glyphs, and merge the tiles' code paths. That would cost features, so it waits for evidence.
- **`W` is 2,576 bytes.** It is allocated once in `onLoad`, on a fresh heap, and never re-created. It is over the "about 2 KB for anything re-created during an exercise" guideline only in size, not in timing.
- **Largest transient requests.** 3,520 B during load (template compile) and 3,414 B (compiling the 3.2 KB Fictional Wall file mid-exercise). Both are under the 4,000 B hard limit. Whether a 3.4 KB `evalFile` succeeds on a fragmented heap mid-exercise is a hardware question (H9).

---

## 9. Settings and data.json

**v1.0 as built** (binding decision 1). *(Rewritten: the design had 5 slots of 4,000 B.)*

```json
"settings": [
  { "shownName": "Topo line from editor", "path": "topo0", "type": "string", "maxLength": 1500 },
  { "shownName": "Lap moves to next pitch", "path": "lapAdv", "type": "enum", "values": ["Off", "On"] }
]
```

*(Round 3: the setting was named "Topo", which told a store user nothing about where the line comes from. The path is unchanged.)*

**data.json (shipped).**

```json
{ "topo0": "", "lapAdv": "0", "sv": "" }
```

**Notes.**
- **One slot, 1,500 bytes.** With a full slot and a saved position, data.jsn stays under 2 KB (T8). That matters because every localStorage call allocates a buffer the size of the whole file.
  - A topo that does not fit goes into the built-in library as an ext file (§11, §14).
  - The phone field's real paste limit can only be tested after a store upload (H13).
- **Built-in topos are not settings.** They ship in the package as `ext4.js`-`ext7.js` and are read with `evalFile` from main.js. Adding one needs a new build. The editor's "Download built-in file" writes the file.
- **Enum storage.** *(Round 1.)* The reference stores an enum as an integer index [doc L2229], and the editor's storage class returns `null` from `getItem` for a non-string. ext0.js reads `getItem`, falls back to `getObject`, and tests `Number(v) === 1`, so both a phone-synced integer and a string work. (v1.0 compared `getItem(...) === '1'`, so a store install would never have turned lap advance on.) *(Round 2: data.json ships the string `"0"`, as the reference's settings example does ("everything but objects are stored as strings"); an integer made the build library warn "Invalid type 'number' for 'lapAdv', expected object or string" on every build. The hardware-test data keep the integer 1, so H8 still exercises the `getObject` path of a phone sync; their build shows that warning on purpose.)*
- **Lap default is Off.** Unchanged (Q6).
- **Persisted state `sv`** is internal, not a setting (§4.6).
- **Units** are not a setting. The template reads `UnitsMode` in `onActivate` and sends event 5 or 6. Lengths show in m, or in ft = round(m × 3.281).
- **Two settings is the minimum.** Settings syncs have caused "Maximum SuuntoPlus Apps reached" [store §2.4], so fewer is better.

---

## 10. FIT logging and summary

**v1.0 as built.**
- *(Round 1.)* **A position restored from an earlier exercise is neither logged nor counted** until a long press moves the idx or opens a topo, or a lap advances (flag `moved`). Without this, every later climbing workout reported the old route's top pitch as its "Highest pitch", even with the app display never opened.
- *(Round 1.)* Lap advance runs through ext2.js as event 4 and does not write `sv`.
- main.js writes `pitch` in `onEvent` and `onLap`. (There is no E_STATE event any more.)
- The **fictional** built-ins (Fictional Demo, Fictional Wall) log 0 and never count for "Highest pitch". The schematic built-ins log like the slot topo.
- The 30-tick hold rule is as designed. Top counts as n.


**Logged output.** `pitch`, with `log:true`, shownName "Pitch" and format `Count_Twodigits`.
- main.js sets it from E_STATE: idx for user topos (slots 0-4), 0 for the demo or when no topo is open.
- It is written once per second, and only when the value changes [doc L2067].
- After sync, the Suunto app shows a step graph of pitch over time.

**Lap advance.**
- In `onLap` [doc L1061-1063]: if lapAdv = On and a topo is open (slot 0-5) and n > 0, then idx = min(idx + 1, n + 1), view = Map, seq++. The new state is output on `ms` and sv is marked dirty.
- `onAutoLap` [doc L1076] does nothing: a distance autolap is not a belay.
- The app never triggers laps itself. The native lap click is always there (§6).

**Summary output** (`getSummaryOutputs` [doc L1176-1197]).

```js
[ { id: 'p', name: '{{sumPitch}}', format: 'Count_Twodigits', value: best } ]
```

It is returned only when `best > 0`; otherwise the result is `[]`.

**How `best` is computed.**
- `best` = the highest idx in 1..n that was held for ≥ 30 consecutive `evaluate` ticks while recording. Top counts as n.
- Recording is set by `onExerciseStart`/`onExerciseContinue` and cleared by `onExercisePause`/`onExerciseEnd`.
- The 30-second hold filters out looking ahead at later pitches.
- Demo pitches never count.

---

## 11. Simulator demo, built-in topos and fixtures

**v1.0 as built.** *(Rewritten: the design's single demo in the template and `tools/sim-fixture.js` were replaced.)*

**What the simulator does.** These were verified during implementation:
- main.js reads data.json, including `dbg`.
- The template is never asked to read storage.
- **`evalFile` in the simulator.**
  - It runs the file as `new Function('return (' + text + ')(...arguments)')` in the webview's global scope. An ext file must therefore be a function expression, and main.js calls `evalFile(path)(args)`.
  - Inside such a function `localStorage` is the *browser's* storage, not the app's. So main.js passes its own `localStorage` to ext0.js as an argument.
  - `setText` and `setStyle` work from ext functions.
- **The simulator loads the ext files unbuilt.** `{{key}}` and `{{ DISPLAY_ID }}` tokens in them are not substituted. Scratch copies made by `sim-fixture.js` substitute them per display.
- **Delivery.** The simulator fires every output subscription every second, whatever the value. The watch is documented to fire on change. The stream receiver handles both (§4.5).

**Built-in topos** (shipped; identical on watch and simulator).

| File | Topo | Label on its card | Source |
|---|---|---|---|
| `ext4.js` | Fictional Demo, 4 pitches, localized texts | Not a real climb | invented |
| `ext5.js` | Jägerhorn N, 1 pitch (IV) | Schematic topo | drawn from the author's own route notes |
| `ext6.js` | Piccolo Fillar, La Diretta + Bisaccia, 15 pitches with traverses | Schematic topo | drawn from the user's own route note; grades and lengths from that note |
| `ext7.js` | Fictional Wall, 30 pitches, dense terrain, 3,246 characters (near the file limit; 3,222 before round 2 reworded its approach) | Not a real climb | invented |

- **No published drawing was copied.** The geometry of ext5 and ext6 is an original schematic drawn by hand in `test/suuntopo_canvas/fixtures/make-builtins.js`, which writes ext5-ext7.
- **Logging.** The fictional topos (1 and 4) log pitch 0 and never count for "Highest pitch". The schematic ones log like a user topo.
- **Rights check pending.** The Piccolo Fillar pitch notes paraphrase the vault note. That note is itself guidebook-derived, so a rights check is open before store upload (§18). *(Round 2: the shipped `ext6.js` carries neutral notes by default — approach "Schematic sketch, not a guide. Check the route on site.", descent "Check the descent on site.", no pitch notes — and T8 fails if it does not. `make-builtins.js --personal` writes the rich notes for a personal build only; personal packages are in `builds/suuntopo_canvas/v1.0/personal/` and must never be uploaded. The Fictional Wall's approach now reads "Fictional 30-pitch wall to try a long route on the watch. Not a real climb.")*

**Debug state (fixtures only).** A data.json key `"dbg": "2,<view>,<topo>,<idx>,<pitches>,<hash>"` makes main.js start in any view, topo and idx. `sim-fixture.js` computes the hash.

**Scratch builds.** `node test/suuntopo_canvas/sim-fixture.js <outDir> [--display q|o|n] [--slot file.stp] [--dbg view,topo,idx] [--press 3,1] [--data data.json]`:
- copies the source package into `outDir` and substitutes the ext tokens for the display;
- optionally fills the slot and the start state;
- `--press` replays long presses 1.5 s after main.js state reaches the template, used for the Help, error and Info page-2 screenshots.

It refuses to write into `src/`. Nothing it writes is committed or packaged.

**Store screenshots.** These come from such scratch builds (§15). The reviewed set is in `builds/suuntopo_canvas/v1.0/screens/`.

---

## 12. Errors and edge cases

**v1.0 as built.** These rows of the table changed:

| Case | Behaviour as built |
|---|---|
| Slot empty | The list holds the four built-ins and Help, and the demo is open |
| Slot over 3,500 characters (only possible by editing data.json; the phone field stops at 1,500 B) | Error card E7 |
| The saved topo changed since the last session | Hash mismatch: that topo opens on its list card at idx 0 |
| Lap while the template is not shown | main.js advances. The template gets the new `ms` when it is next activated (subscribing delivers the current value: seen in the simulator only) |
| Template parse fails | Not applicable: the template does not parse. main.js shows the error card for the slot and opens the demo. |
| Template reloaded or overlaid mid-stream | Activation reports what the template still holds, and the stream resumes or restarts |
| Switching topo mid-stream, then going back | The new hash resets the template, and going back restreams (T5 regression test) |
| `localStorage` throws | ext0.js falls back to an empty slot and no saved position, so the demo opens. *(Round 4: opening the slot later reads it again; if that throws, or the stored line no longer parses, the list stays on the slot card with the previous topo open.)* |
| *(Round 2)* Text with `<` or `&` (a hand-edited line; the editor turns `<` into `‹` and `&` into `+`) | `setText` reads markup and character entities, so the parser rejects them: E2 in the name, E5 in a pitch, E7 in W, G, A or D |
| *(Round 3)* Template mounted after main.js streamed alone (the first view of the app display, a template reload) | The template reports that it holds nothing; main.js restarts the stream at chunk 0, so the route comes first (§4.5) |
| *(Round 3)* Hold MIDDLE on the error card | Moves to the open topo's list card (§5) |
| *(Round 3, known limit)* A paste cut off in its tail | STP1 has no end marker, so a line cut inside the terrain records or the last pitch note can still parse: terrain goes missing, a note is cut short, or a feature point moves because a number lost digits. A cut inside the route or belay records, or one that leaves a bad number, gives E4 or E6. Measured on every prefix: 10-18% of the prefixes of the shipped topos parse. An end record carrying a hash of the line would catch every cut; it changes the format, the editor, the built-ins and every fixture, so it waits (§18 Q14). The FAQ says to copy the whole line. |


The BLE items in the task template map onto this app as follows. Disconnects: N/A, the app has no sensor. No sensor found: N/A. Stale data: the persisted position after a topo has changed, covered below.

| Case | Behaviour |
|---|---|
| All slots empty | Route view: Demo card, then Help card |
| Slot holds old JSON or other text | Error card, E1 |
| Slot truncated or malformed | Error card with its code. The parser never throws, and a top-level `try` maps anything unexpected to E9. |
| Slot larger than 4000 B (possible only via data.json) | E7 |
| Persisted slot changed since last session | Hash ≠ `mh` → Route view at that slot, idx 0 |
| Persisted idx > new n | Clamped to n+1 |
| Lap while the template is not mounted or another display is shown | main.js advances and bumps seq. The template applies it on the next `onActivate` (subscribe gives the current value). |
| Lap at Top | Stays at Top |
| Lap while no topo is open | Ignored |
| Overlay or lap popup over the app | `onActivate` runs again → resubscribe and full refresh [forum 15320] |
| Exercise not started (prestart) | Navigation works. Logging and summary are inactive. |
| App evicted or reloaded mid-route | main.js restores from `sv` (written at most 10 s before) *(Corrected in round 3: `sv` holds the position of the last long press, pause or end. Laps are not saved (§4.6), so a climber who moves only by laps goes back to the last hold after a reload, the logged pitch reads 0 until a hold or lap moves on, and "Highest pitch" counts from the reload. §18 Q13.)* |
| Template parse fails for the open slot (data changed under it) | Error card + E_ERROR → main.js logs it |
| Notes longer than 4 pages | The last line ends in `...` |
| Word longer than CPL | Hard-broken |
| Grade or name longer than its char budget | `fitText` with `...` |
| Vertical or horizontal pitch (zero-width bounding box) | bw and bh are floored at 40 units |
| A pitch too long to fit at zmin = 0.35k | Its middle part is drawn. The editor warns (§14). |
| Feature budget exceeded in a tile | Lowest-priority features are skipped and the route stays visible. The editor warns before export. |
| Accented text | `sp-b-cjk` (H10) |
| Units changed in watch settings | Picked up on the next `onActivate` |
| UI1 watch | "Not supported on this watch" (`u.html`) |
| Button lock on | The app's long presses are blocked. Clicks behave natively. |
| Unknown record or feature letter | Ignored |
| `localStorage` throws | Every access is wrapped in `try`. main.js falls back to the defaults; the template shows the slot as empty. |

---

## 13. Localization

**v1.0 as built.**
- New keys: `wSchematic` "Schematic topo", `wFictional` "Not a real climb", and `wLoading` "Loading".
- The help lines now name the single "Topo" setting.
- The demo's text keys are used in `ext4.js`, not in the template.
- `{{key}}` and `{{ DISPLAY_ID }}` in ext files are substituted by the build (T8 checks the packages). The simulator does not substitute them (§11).


**Mechanism.** `{{key}}` is replaced at build time from `<lang>.json` at the app root, in HTML text, inside template script and in main.js [doc L2416; probe A]. Watch-side strings live only in `en.json`; nothing user-facing is hard-coded.

**Keys for 1.0.**
- Words: `wPitch`, `wStart`, `wTop`, `wApproach`, `wDescent`, `wTopo`, `wHelp`, `pAbbr`.
- Messages: `noNotes`, `notSupported`, `sumPitch`.
- Error texts: `e1` … `e9`.
- Help card: `help1` … `help5`.
- Demo topo: `demoName`, `demoWall`, `demoA`, `demoD`, `demo1` … `demo4`.

The manifest `description` and the settings `shownName` values stay English in 1.0 (§15).

**String rules.** Test T6 enforces all of these.
- No ASCII `'`, `"`, `\`, `<`, `>`, `&`, `{`, `}`, `|`, `~`, and no newline.
  - An ASCII apostrophe in a value broke the build ("JSMIN Error: Unterminated string literal") [probe A]. Use the typographic ’ instead.
  - `|` and `~` would break the STP1 demo.
- Every key used appears in `en.json`, and every key in `en.json` is used.
- With the longest numbers substituted, each string fits its char budget (§5.2).

**Languages.**
- 1.0 ships `en` only (`"languages": ["en"]`).
- Hungarian and Slovak are not watch languages [doc L2435-2457; critique §2]. The Hungarian main user therefore gets English, which is the build fallback [store §2.5].
- 1.1 candidates are `de`, `fr`, `it`, `es`, `cs` and `pl`, each only after a native speaker reviews it. The forum reports criticism of poor translations [fp "Publishing"].

**User content.** Topo names, grades and notes are shown as typed, in `sp-b-cjk`, and are never translated.

**Plurals.** Avoided by design: "Pitch 3/12" and "12 P". *(Round 1: list cards use `pOne`/`pMany`, "1 pitch" and "12 pitches", with "P" as the fallback; a translation needs both forms, or the fallback.)*

---

## 14. Editor changes (`src/topo_editor`)

**v1.0 as built** (`src/topo_editor/index.html`, `stp1.js`, `watch.js`, `sync-watch.js`; see `EDITOR_SPEC.md`).

**Done.**
- P0-1: Anchors stay x,y in the project. `stp1.js` sorts them by their nearest route vertex at export, so the click order no longer matters (T10).
- P0-2: "Copy for Suunto app", "Download topo .txt", a UTF-8 byte counter ("Topo: N / 1500 B"), and **"Download built-in file (ext.js)"** with its 3,500 B limit.
- P0-3: Errors block copying. Warnings cover a name over 15 characters, labels, a contour fill, and a start belay that carries pitch data.
- P0-6: The round trip runs through the watch parser.
- P0-7: Feature export.

**Partly done.**
- P0-4: The grade systems are UIAA, French, YDS and Other. British technical and Saxon fall under "Other" (band 0, or a manual band per pitch).
- P0-5: The preview runs the watch renderer, from `watch.js`, generated by **`src/topo_editor/sync-watch.js`** (not `tools/sync-editor.js`). It shows the Map tiles of the selected position, units per tile, and how many shapes were left out. It does not show Info or list views.

**Not done.** The "notes over 3 pages" and "pitch needs z < 0.35" warnings.

P1 is unchanged.


**P0 for 1.0.**

1. **Stances as route indices.** This fixes the anchor-order bug [gaps §2 item 9].
   - Anchors become a sorted set of route-vertex indices.
   - Toggling an anchor inserts it in route order, whatever the click order. Deleting or inserting a route point remaps the indices.
   - Pitch data (band, grade, length in m, notes) belongs to the stance that **ends** the pitch.
   - The pitch list is always shown in route order.
   - Approach and descent notes, the route grade and the grade system are top-level fields.
2. **Compact export.**
   - A "Copy for Suunto app" button writes the STP1 single line to the clipboard, and "Download .txt" saves the same string. Pretty JSON export is no longer used for the watch.
   - The byte counter uses `new TextEncoder().encode(s).length`. It replaces `JSON.stringify(...).length` [gaps §2 item 10].
3. **Validation before export.** Errors (the §4.3 limits and E2-E7) block copying. Warnings do not:
   - name longer than `NAME_CHARS`
   - notes longer than 3 pages
   - a pitch that needs z < 0.35
   - features dropped in any view (item 5)
   - labels present (not exported)

   Text is sanitised: `|` becomes `/`, control characters are removed, whitespace is trimmed, and the text is normalised to NFC. Grades may not contain `~`.
4. **Grade bands.** A per-topo grade-system selector: UIAA, French, YDS, British technical, Saxon, Other. A band is computed for each pitch from a mapping table and can be overridden per pitch.
5. **The preview is the watch renderer.**
   - `tools/sync-editor.js` copies the block between `// BEGIN SHARED` and `// END SHARED` from `t.html`'s `onLoad` into `src/topo_editor/watch.js`. That block holds the palette, cost table, codec, auto-fit, drawTile and text helpers.
   - `watch.js` is generated, committed, and starts with ABOUTME lines that say so. The editor loads it with `<script src="watch.js">`.
   - The preview draws the watch's three tiles on a 466×466 internal canvas, scaled to 240 CSS px. It overlays the HUD texts and offers Map, Info and Route views and idx stepping.
   - The zoom is the watch's auto-fit, which fixes the 1.0 vs 1.2 scale mismatch [gaps §2 item 10].
   - The preview shows units per tile, e.g. "tile 2: 143/150", and lists every pitch whose tile hits the cap.
6. **Round-trip check.** On every export, encode → `parseTopo` (from watch.js) → compare counts and texts. A mismatch blocks export.
7. **Feature export.** Rect features become 2-point paths; a slab rect becomes a 4-point closed path; a diagonal arete becomes a 2-point path. Contour and contour fill export as paths. Label is editor-only.

**P1, after 1.0.**
- Pointer events, for touch and pen.
- A project file (JSON v1 with the background-image corners) for re-editing.
- Import of an STP1 string.
- Public hosting (GitHub Pages; URL to be decided, §18 Q4).

---

## 15. Store listing plan

**v1.0 as built.**
- The draft store text, with the verification and rights notes required by binding decision 1, is `store/suuntopo_canvas/listing.md`. It supersedes the long description below.
- The source package also contains `ext0.js`-`ext11.js`, 18 files in all (T8 checks the exact list; round 4 added `ext11.js`).
- Built packages are in `builds/suuntopo_canvas/v1.0/` (appId `suunto01`).
- *(Store submission, 2026-10-04.)* The source package is `builds/suuntopo_canvas/v1.0/suunto01-source-v1.0.zip`, made with `createSourcePackage` and checked file by file against the source; the screenshots (`screen-1-map.png` … `screen-5-help.png`) and a 1920 × 1080 banner (size not documented; rendered from `banner.html`) are in `store/suuntopo_canvas/`; `modificationTime` is 1791081833. `listing.md` maps each file to its console field. Upload still waits for H1, H2, H8, H9 and Q4.


**Name.** Proposed: **"Climbing Topo"**, 13 bytes. The local `getAppId` turns it into `suunto01`: it strips spaces, `-`, `.` and non-ASCII, then takes 6 lowercase characters [`suunto-plus.js`]. Alternatives: "Pitch Topo" → `pitcht01`, "Belay Topo" → `belayt01`. "SuuntoPo" is avoided as a trademark risk (inferred) [critique §3c]. Vitya decides (Q1).

**Manifest fields.**

| Field | Value |
|---|---|
| `description` (shown on the watch) | "Multi-pitch topo": 16 B, within the ~22 characters recommended [forum 14770] |
| `version` | "1.0". Each upload needs a new version [store §1.4]. |
| `author` | public developer name (Q2; currently "O. Vitya") |
| `modificationTime` | the Unix time of the release (valid integer [store §1.4]) |
| `type` / `usage` | `feature` / `workout` |
| `languages` | `["en"]` |
| `activities` | **not set**. Its effect is undocumented and could hide the app from custom sport modes [critique §2] (inferred risk). |

**Long description** (store field, single-line, draft):

> Climbing Topo shows your multi-pitch route on the watch, belay by belay. Draw the topo in the free web editor (link below), copy one line, paste it into Topo 1-5 in the Suunto app (SuuntoPlus settings), and sync. On the app screen: hold UP for the next pitch, hold DOWN to go back, hold MIDDLE for pitch notes and the topo list. Short presses are never used by the app: pause, lap and display change work as usual. Optional: let each lap move to the next pitch. Logs the current pitch to your workout. Works on Race, Race S, Race 2, Vertical 2, Ocean; 9 Peak Pro and Vertical use a smaller layout. Not a guidebook: topos are drawn by users and may be wrong; always check the route on site. No data leaves your watch except the workout file. Support: <email/GitHub, Q5>.

**Screenshots.** 466×466 PNG [store §1.2], from simulator scratch builds of the demo (§11):
1. Map at pitch 2: crack, corner, current pitch highlighted.
2. Info at pitch 2.
3. Route view with the current pitch.
4. Map at Top with the descent walk.

The Editor's own screenshot tool is not required [forum 14767 #1-2].

**Banner.** The dimensions are only visible in the signed-in console [store §4]. The design: black background, the demo route line art in the app palette, the app name, and no Suunto or third-party marks ("unauthorized images" block publication [store §1.2]).

**Package.**
- Built with "Create Source Package" from `src/suuntopo_canvas`. It contains only the top-level `main.js`, `manifest.json`, `data.json`, `t.html`, `u.html` and `en.json` [store §1.2].
- The `.fea` build artifacts in `src/suuntopo_canvas/` are gitignored, and the package filter does not match them.
- Before upload: check the package contents with `unzip -l`.
- *(Round 2.)* The source package is store-safe as it stands: `ext6.js` has neutral notes (T8). `builds/suuntopo_canvas/v1.0/personal/` holds packages with the rich Piccolo Fillar notes for Vitya's own watch; they are never uploaded.

---

## 16. Test plan

**v1.0 as built.** *(Corrected: tests live in `test/suuntopo_canvas/`, not `tests/`; `sim-fixture.js` is in `test/suuntopo_canvas/`; `sync-watch.js` is in `src/topo_editor/`.)*

### 16a. Automated tests runnable here

**Setup.** Plain Node with `assert`, with no npm installs. The ES5 check uses the `acorn` that ships inside the installed SuuntoPlus Editor 1.42.0 extension.
- `node test/suuntopo_canvas/run.js` runs every `test/suuntopo_canvas/t*.test.js` and exits non-zero on any failure.
- `QUICK=1` cuts the T5 random sessions from 1,000 to 100 while iterating.

**Loading the real code** (`test/suuntopo_canvas/lib/harness.js`).
- **main.js and the ext files** run in `vm` contexts. `evalFile` behaves like the simulator's: the file is a function expression run in a global scope. Tokens are substituted from `en.json` per display, as the build does.
- **The template** is the `onLoad` attribute of `t.html`, run with these stubs:
  - `$`: subscribe, get, put
  - `setText`/`setStyle`: record the calls, and enforce non-blank text and visibility
  - `control` and `setTimeout`
  - a counting canvas context
- **`rig()`** connects main.js and the template the way the firmware does: events, `evaluate`, outputs, timers. It can deliver outputs "on change" (hardware) or "every tick" (simulator).
- **`lib/reference.js`** is an independent decoder that the watch parser is compared against.

| ID | File | What it checks |
|---|---|---|
| T1 | `t1-codec.test.js` | Every fixture and built-in decodes like the reference (counts, texts, hash, words). The corpus covers 1 and 60 pitches, 3,500 characters, accents, every feature letter, and approach and descent walks. |
| T2 | same | The malformed corpus gives the expected E-code and never throws (round 2: `<` and `&` in every text record). Tolerated inputs parse. Optional records do not leak from the previous topo. |
| T3 | same | 5,000 seeded mutations (byte flips, truncations, duplicated records) never throw. Each parse takes under 50 ms, and valid results match the reference. |
| T4 | `t4-render.test.js` | Every topo × position × Map and whole view × q, o and n stays within 150 units per tile and 20 ops per path. The stress topo drops terrain and stays within budget. Further checks: no canvas text, `strokeRect`, `closePath` or transforms; glyphs only at zoom ≥ 0.6; route drawn before the terrain arrives; corrupt chunks ignored. Round 2: no frame uses an arc or a fill; long patterned segments keep a paint under 20,000 `vis()` + `op()` calls on q, o and n; the demo keeps its zig-zag and ticks; terrain colours on q keep 4.5:1 against black. Round 3: short crack segments whose line misses the tile keep a paint under 20,000 calls; no fixture or built-in reaches the per-tile cap on patterned length; the tile heights come from t.html. Round 4: the renderer's names are read and replaced through a test-only hook into its scope (`t.r`), and the call-count tests fail if their counters never fire; no template function keeps its automatic prototype. |
| T5 | `t5-nav.test.js` | main.js, the ext files and the template wired together. Covers start-up, the list labels, belay navigation, Info pages and the view cycle, every built-in streaming in both delivery modes, overlays and template reloads, going back to a topo after a half-streamed one, feet, lap advance and reload, and a changed slot. Round 2: the refresh chain recovers when its timer is dropped on deactivation or `control()` throws; units are sent only when they changed; the invariants check the Map's position in `#tn`, Info's page count and the line under the drawing. Round 3: a template mounted or reloaded after main.js streamed alone gets the route within its route chunks + 1 s and never shows "Loading 99%" before it; an overlay during a load does not restart the stream; chunks before chunk 0 show 0%; an unsubscribe that throws in `onDeactivate` still ends the refresh chain, and a `$.get` that throws skips neither the report nor the paint; refreshes are at least 100 ms apart; MIDDLE on the error card moves to the open demo's card; the new Help 2 text. Round 4: while another topo is open main.js keeps only the slot card and reads the slot again to open it (and a slot that no longer parses leaves the list on its card); the slot card shows the first G record; ext0.js failing at start-up opens the demo; ext3.js writes topo cards and ext11.js the error and Help cards; the template delivers the stream with bound callbacks and with the closure fallback. Plus **1,000 seeded sessions × 200 actions** with invariants after every action and a settled stream at the end. |
| T6 | `t6-l10n.test.js` | Tokens and keys match. No build- or STP1-breaking characters. Every string fits its character budget on q, o and n. Error texts fit one page. Manifest limits. Round 3: each line of the UI1 not-supported screen is at most 16 characters. |
| T7 | `t7-static.test.js` | Checks the code rules: ABOUTME headers, ES5 only (acorn) with no `Date`, 16/32-bit typed arrays or regex literals, ext files are single function expressions, no `onClick`, `longType="action"`, attribute hygiene, at most 16 elements, no allocation in the renderer, and main.js helper count. Storage rules: `output.<name>` only in lifecycle functions, localStorage only in `save()` and `start()`, and the ext files touch no outputs or global storage. Round 2: only main.js's `ext()` calls `evalFile` and drops the loaded function's prototype; code ext files drop their inner helpers before every return; the template's onLoad declares each name once (a units callback named `units` had replaced the renderer's unit counter during round 2). Round 4: the renderer's own scope and the template's each declare a name once, in one scope only, at most 55 names each (Duktape's hash-part cliff); `drawTile`'s per-frame function allocates nothing; localStorage also in `open()`, which runs only from `press()` and `start()`. |
| T8 | `t8-build.test.js` | `sp-build` builds every display with no warnings from a clean package copy (round 2: both output streams, every line one of the build library's informational lines; the validator warns on stderr). Size guards (§8). Every compiled block ≤ 2,499 B in Duktape. Tokens are substituted in the built ext files. The demo equals `fixtures/demo.stp`. The shipped Piccolo Fillar has neutral notes (round 2). data.json is clean (lap advance the string `"0"`), and a full slot stays under 2 KB. Manifest (round 3: the setting "Topo line from editor"). Exact package contents. Round 4: each template function's own source is measured with acorn, nested functions excluded. |
| T9 | `t9-main.test.js` | main.js alone: slot parsing, saved position (match, mismatch, corrupt, `dbg`), the chunk stream and its check word, lap advance, storage written only on user actions, the logged pitch, the 30-tick "Highest pitch" rule, units, UI1. Round 2: every loaded file comes back without a prototype, and ext0.js gets main.js's loader. Round 4: ext0.js also gets main.js's `open()` and opens the start-up topo. |
| T10 | `t10-editor.test.js` | `src/topo_editor/stp1.js`: encode → watch parse → equal to the project. Covers belay order, sanitising, UTF-8 bytes, the 1,500 B and 3,500 B limits, limits that match the parser, grade bands, and the built-in file format. Round 2: `<` becomes `‹` and `&` becomes `+`; a crack, roof, overhang or ramp piece longer than 466 units gets a warning. |
| T11 | same | `watch.js` is current (`sync-watch.js --check`), parses like the app, and the preview stays within the tile budget. |

**Result of the final full run (2026-10-04, after the last round-3 code change):** 102 passed, 0 failed, with 1,000 sessions. *(Round 2 ended at 95 passed, round 1 at 83; v1.0 had 69.)* T11 also checks that the editor's preview tile heights match t.html, and `sync-watch.js` now takes the template's two `fitRange` calls from t.html instead of a copy.

### 16b. Simulator checks

**Tools.**
- Scratch builds come from `node test/suuntopo_canvas/sim-fixture.js` (§11).
- Screenshots come from `bridge-call.js screenshot`, followed by `sim_log`.

| # | Scratch build | Expected | Result 2026-10-03 |
|---|---|---|---|
| S1 | shipped state | Topo list on the Fictional Demo card with the whole route, "Not a real climb", "5c  4 pitches", "1/6" (round 1); once loaded, "Hold MIDDLE: map" under the drawing (round 2) | pass on q, o, n |
| S2 | `--dbg 1,1,2` | Map at pitch 2: pitch yellow, target stance ringed, crack and corner visible, "5b 30 m", "Pitch 2/4" (at the top since round 2) | pass on q, o, n |
| S3 | `--dbg 1,1,0` / `1,1,5` | Start and Top: approach and descent walks, route totals "5c 110 m" | pass on q |
| S4 | `--dbg 2,1,1` (+ `--press 3` for page 2) | Info: blue P1 title, 6 lines a page, "Notes 1/2" (round 2; "1/4  more" in round 1), page 2 | pass on q; page 1 on o, n (round 2: page 1 on q, o, n) |
| S5 | `--press 1,1` and `--press 1,1,1,1,1` | Help 1 (buttons) and Help 2 (topo), 6 lines each, nothing clipped. The simulator replays `--press` once per template load, so presses can repeat | 2026-10-04: Help 1 seen on q and o, Help 2 on q, o and n; nothing clipped |
| S6 | `--slot sixty.stp --dbg 1,0,30`; `--slot accents.stp --dbg 2,0,2` | 60 pitches with accented name truncated with "..."; accented Info text | pass on q |
| S7 | Piccolo Fillar Map and list; Fictional Wall list and Map; Jägerhorn Map | Traverses fitted; the 30-pitch overview readable with small belay dots | pass on q; Piccolo Map and Wall list on o, n |
| S8 | `--slot broken.stp` | Error card "Belays invalid. (E4)" in the error colour, shown first (round 1); "Belays invalid. Fix it in the editor. (E4)" (round 2) | pass on q, o, n |
| S9 | all | `sim_log` free of errors from this app | pass |

**Reviewing.** Every PNG was read. Text is not clipped by the circle on q, o or n, and the HUD text does not overlap the drawing.

**Round 2 (2026-10-04).** Every state above was shot again and read; the set in `builds/suuntopo_canvas/v1.0/screens/` is replaced. Changes seen: S1 shows "Hold MIDDLE: map" under the demo once it is loaded, with "5c 4 pitches" and "1/6" below it; on n the three bottom lines now have 3 px between them (round 1: `#h1` ran into `#h2`). S2 shows "Pitch 2/4" at the top and no bottom line; the target ring is two round dots. S4 shows "Notes 1/2". S8 shows "Belays invalid. Fix it in the editor. (E4)". New: `map-loading-q.png` (the Map before the route arrives, "Loading 10%") and `map-route-only-q.png` (route drawn, terrain still streaming, no progress line). Info page 2 was not shot: the simulator replays `--press` once per template load (4 loads), so presses come in fours and the 4-step MIDDLE cycle ends where it started; T5 checks "Notes 2/2". `sim_log` showed no errors from the app.

**Round 3 (2026-10-04).** Shot again and read on the round-3 build: `list-demo`, `map-pitch2`, `jagerhorn-map`, `help-topo` and `error` on q, o and n; `piccolo-map` on q, o and n; `map-start`, `map-top`, `info`, `slot-60-map`, `wall-map`, `map-loading` and `map-route-only` on q; new `unsupported-s/m/l.png` (two centred lines; the old single line was cut to "...on this watc" on s and lost its last letter on l). Seen: on every Map the drawing stops at 79%, above the grade and length (Jägerhorn N's approach and terrain no longer touch "IV"; the done pitch of the demo at pitch 2 ends at its belay on n); Help 2 shows the new six lines on q, o and n with room to spare. One `list-demo-o` attempt caught "Loading 0%" at 9 s; three retakes all completed the stream 7 s after the simulator's start, as the log shows, so the first was a timing artefact of the shared simulator. MIDDLE on the error card could not be shot: the simulator replays `--press` per template load, so one hold arrives as three (error card → demo card → Map → Info page 1, which is what the shot showed); T5 checks the single hold. The route-first fix cannot be seen in the simulator, which mounts the template at once; T5 checks it. `sim_log` showed no errors from the app.

**Round 4 (2026-10-04, memory).** Six states on q, o and n, shot with the bridge from `sim-fixture.js` scratch builds 10 s after start, before and after the round-4 changes: the Map at pitch 2 (`--dbg 1,1,2`), the shipped list state, Info at pitch 3 (`--dbg 2,1,3`), Help 2 (`--press 1,1,1,1,1,2`), the error card (`--slot` with `STP1|NBroken slot|GV`, E3) and the slot card while the demo is open (`--slot walk.stp --dbg 0,1,0 --press 2`). All 18 PNGs are byte-identical before and after, and the q shots of the Map, list, Info and Help are byte-identical to `store/suuntopo_canvas/screen-1-map.png`, `screen-2-list.png`, `screen-3-notes.png` and `screen-5-help.png`.

### 16c. Hardware checklist for Vitya (Race S)

*(Rewritten for one slot and the stream.)* Results go into `docs/suuntopo_canvas/HW_RESULTS.md` (the form exists since round 1): date, firmware, pass or fail, notes or a photo.

**Release gates (round 1).** H1 (stream), H2 (native clicks), H8 (subscriptions across laps) and H9 (memory with a second app) must pass and be recorded before any store upload, and before the listing claims any watch as tested. A failed gate blocks the release.

**Preparation.**
1. Deploy `builds/suuntopo_canvas/v1.0/hw-test/suunto01-q-en.fea`. It is the app with `test/suuntopo_canvas/fixtures/hw-data.json`, which holds a 1,500-byte, 12-pitch topo in the slot and lap advance On.
   - The watch must be unpaired from the phone app.
   - Keep the phone disconnected, because a sync wipes sideloaded apps.
   - For H1b, rebuild with `hw-data-broken.json` or `hw-data-old.json`: `node test/suuntopo_canvas/sim-fixture.js <dir> --data <file>`, then `sp-build`.
2. Add the app to a sport mode such as Climbing. Disable other SuuntoPlus apps for H1-H8. Start the exercise and scroll to the app display.
   - The hardware-test data stores lap advance as the integer 1, like a phone sync. If laps do nothing in H8, note it: the enum read is then wrong on hardware.

| # | Step | Pass if |
|---|---|---|
| **H1** | The app opens on the slot topo's list card. Wait up to 15 s. Then hold MIDDLE, hold UP a few times, and hold MIDDLE twice. | "Slot full" is listed, and its whole drawing appears: first the route with "Loading NN%", then the terrain. The Map shows pitch 1 drawn. **If the text appears but the drawing never does, stop and report**, noting whether "Loading NN%" appears: with "Loading" the stream id arrived but the chunks do not (output stream or its delivery); without it the template never learned the stream id (neither the subscription nor the `$.get` of `mh` delivered it). **If there is no text and no drawing at all (black screen), `evalFile` of an ext function expression or `onLoad` failed (ext0.js runs first): stop and report, with the system events.** *(Round 2.)* **If the slot card shows E9 for this known-good topo,** loading or running the parser files ext1.js or ext9.js failed (a `JSalloc` line in the system events, or an ext-file problem; ext0.js loads them through main.js's own loader since round 2): stop and report, with the system events. *(Round 4.)* The template subscribes with `rv.bind` and falls back to closures when the firmware has no `Function.prototype.bind`; both deliver the stream, but the memory figures of §8 assume `bind`. A debug build with `systemEvent('BIND ' + typeof rv.bind)` in `onActivate` tells which path runs. |
| H1b | `hw-data-broken.json` / `hw-data-old.json` builds | The list shows "Your topo" with E4 / E1, and the demo opens |
| H2 | On the Map: click UPPER, LOWER and MIDDLE, then turn the crown | All native (pause, lap, next display, scroll). Note which button laps. |
| H3 | Hold UP, DOWN and MIDDLE repeatedly on all three views; then switch to another display and back | As in §6. Note the delay from press to new text and to new drawing, and whether "Loading NN%" appears again after the display switch (a template reload restreams the topo). *(Round 3: after a reload the route should come first and the percentage count up from 0; it should never sit at 99%.)* |
| H4 | Button lock on, then hold UP. *(Round 3:)* Then, still on the app screen, try to unlock with the lower button's long press; if that does not unlock, press MIDDLE (or swipe) to another display and unlock there | Nothing changes on the hold; a click still leaves the app. Record whether the lower long press unlocks on the app screen (the app's `down` button has `longType="action"`, which may replace the watch's default lock control there) and whether MIDDLE or a swipe still change the display while locked: the FAQ's unlock advice depends on it |
| H5 | Open the Fictional Wall (list card 5), wait about 20 s, then step through all 30 pitches on the Map | No black tile, no missing route. *(Round 2: the target stance's ring is two round dots, white under yellow, drawn as round-capped line segments; note whether they look round.)* |
| H6 | Climb normally for 10 min | No accidental pitch changes |
| H7 | Display off, then AOD: hold UP | Note the behaviour |
| **H8** | Lap with LOWER at least 3 times on the app screen, then on another display and back; open another topo after the laps | Each lap advances one pitch and the drawing follows each time (subscriptions survive the lap popup); the other topo loads; an autolap does not advance. **Release gate.** |
| **H9** | Enable a second SuuntoPlus app in the same sport mode. Open every built-in, including the Fictional Wall, for 20 min. *(Round 2.)* Then, on the topo list, hold UP or DOWN 30 times in quick succession, and lap 5 times on the app screen. Then: Suunto Watch → View system events. | No `releaseMemoryCb`, `relMemCb`, `ReleaseMem`, `Exec. event … failed`, `JSalloc` failures or `WBMAIN pool` lines. Copy any `JsTotMem` lines. The rapid holds test whether cyclic garbage from loading ext files piles up on the watch (§8, round 2). *(Round 3: the tile refreshes are now 100 ms apart; a `pool id:0 full` line after the rapid holds means that is still too tight.)* *(Round 4: the renderer's variables have their own scope without a hash part, so a tile takes about 24% longer to draw in Duktape on a Mac. On the Wall's Map, note whether a hold redraws visibly slower than in round 3; the three tiles must still appear within about a second.)* **Release gate** (§8). |
| H10 | Daylight, arm's length: Map and Info, and an accented name | Readable; accents render |
| H11 | At pitch 3, end and save; start a new exercise | The app opens on the Map at pitch 3. Pitch logs 0 and the summary counts nothing until a hold or lap moves on (round 1). A route ended at Top opens at Start. *(Round 3: pause and end save the lapped position; a mid-exercise reload does not, because laps are not saved, §12.)* |
| H12 | Switch the watch to imperial | Lengths in ft |
| H13 (after store upload) | Install from the store on iOS and Android; send a 1,500-byte topo line from a computer to the phone (message, email or notes app), paste it into "Topo line from editor", sync, start an exercise | It appears; note how pasting works and whether the transfer cut or changed the line |
| H14 (last; the sync wipes the sideload) | Sync a workout from H8 | "Pitch" graph and "Highest pitch" summary |

---

## 17. Acceptance criteria for "store-ready"

**Status on 2026-10-03.** These are the original criteria, with a status column added after implementation.

| # | Criterion | Status |
|---|---|---|
| A1 | T1-T11 pass with `node test/suuntopo_canvas/run.js`, and the result is in the CHANGELOG | **Met:** 102/102 (2026-10-04, round 3); 108/108 after memory round 4 |
| A2 | `sp-build` builds n, o and q (`t.html`) and s, m and l (`u.html`) with no validation warnings; sizes within §8 | **Met for the build since round 2** (round 1 marked it Met while every build warned about the integer `lapAdv`, on stderr, which T8 did not read). **Partly met for sizes:** t.xml and onLoad are over the research targets (§8); round 3 raised the onLoad guard by 50 B and main.js's to the 2 KB research limit |
| A3 | Simulator checks S1-S9 pass on q, o and n; screenshots reviewed and kept under `builds/suuntopo_canvas/v1.0/screens/` | **Met** (§16b; some states q only; set refreshed in round 2; Map, list, Help 2 and error states refreshed in round 3, plus the not-supported screen on s, m and l) |
| A4 | H1-H12 pass on Vitya's Race S | **Open:** not run |
| A5 | No black tile with the heaviest topo (H5) and no memory errors with 2 apps (H9) | **Open.** The sp-mem steady state (38.7 KB default, 41.2 KB with the Wall open; round 4: 35.2 KB and 37.5 KB) is over the binding 16 KB target, so H9 is the gate. |
| A6 | No text clipped on q, o or n; user text in `sp-b-cjk`; no canvas `fillText` | **Met in the simulator** (T4 and the screenshots). Accented glyphs on hardware are H10. *(Round 3: the Map drew under `#h1` until the bottom tile was shortened; the not-supported screen was clipped on s and l; both fixed.)* |
| A7 | Pause, lap, next display and end stay native (H2) | **Met by design** (T7); hardware is H2 |
| A8 | No placeholder or real-route demo data; fictional topos labelled | **Met for the store package (round 2):** the source and `builds/suuntopo_canvas/v1.0/` carry neutral Piccolo Fillar notes by default and T8 enforces it; the rich notes exist only in `v1.0/personal/` (`make-builtins.js --personal`). Q7 decides whether they may ever ship; Q8 whether real routes ship at all. |
| A9 | Manifest: store name (Q1), description ≤ 22 characters, version "1.0", modificationTime, `languages: ["en"]`, inline enums, ≤ 20 outputs (19 used), ≤ 5 logged (1 used) | **Met**, except that the name is a placeholder until Q1 |
| A10 | Store assets: long description with disclaimer, rights note, privacy line and support contact; 4 screenshots; banner | **Partly met.** *(Store submission, 2026-10-04: five 466 × 466 screenshots, a 1920 × 1080 banner at a guessed size, a paste-ready long description with features, watches, sensors (none), setup, limits and privacy, a store FAQ and the release notes; the source package zip is built. Still open: support contact (Q5), editor URL (Q4) and the console's limits (Q12).)* Before that: text in `store/suuntopo_canvas/listing.md`, with the watch compatibility and a short version (round 2); one hero screenshot chosen, as only one screen image is attested; support contact (Q5), banner and the console's field limits open |
| A11 | Editor: STP1 copy, byte limit, stances in route order, preview from `watch.js`, budget display; hosted URL | **Met except hosting** (Q4). *(Round 3: the FAQ, the long description and Help 2 now say to use the editor on a computer and send the line to the phone; the FAQ explains the Map colours and that a synced topo shows up at the next exercise start.)* **Round 2: hosting is a hard upload gate** next to H1, H2, H8 and H9: without it a store user can only browse the four built-ins, and the FAQ is unreachable. |
| A12 | READMEs and EDITOR_SPEC updated; ABOUTME headers; CHANGELOG entry | **Met** |

---

## 18. Backlog and open questions

**v1.0 as built: added items.**
- **Q7. Rights.** The Piccolo Fillar built-in's pitch notes paraphrase a vault note that is itself based on guidebook material. Before store upload, Vitya must either confirm the notes are his own wording and knowledge, or replace them with neutral notes. The drawing itself is an original schematic. *(Round 1: `make-builtins.js --store` writes the neutral version: approach "Schematic sketch, not a guide. Check the route on site.", descent "Check the descent on site.", no pitch notes; grades and lengths stay.)*
- **Q9 (round 1). Built-in file size versus the mid-exercise rule.** Binding decision 1 allows built-in files of about 3.5 KB; the deep-dive rule caps anything re-created during an exercise at about 2 KB. Opening the Fictional Wall mid-exercise compiles a 3,440 B request and keeps a 3.2 KB string live. Either cap built-in files at about 1.8 KB, or accept it and let H9 test it. Browsing the list no longer compiles topo files (card index in ext3.js).
- **Q10 (round 1). Feature cut for memory.** Dropping glyphs and decorated line styles saves 2.4 KB steady (§8). Decide after H9.
- **Q11 (round 1). Editor hosting and the Help card.** Help 2 says "(see store page)"; the store text must carry the editor URL once Q4 is decided. The editor's title is now "Climbing Topo editor"; host it under a name without "suunto". *(Round 2: a release gate. Host `src/topo_editor` (index.html, stp1.js, watch.js, topo_signs/) over https — clipboard copy needs a secure context — put the URL in the long description and check that the page loads.)*
- **Q12 (round 2). Store form limits.** The research attests one 466 × 466 "Sports app - screen image" and a banner; the number of screenshots and the length limit of the long description are visible only in the signed-in console. Confirm both before upload; `listing.md` has a short version of about 500 characters ready.
- **Q8.** Ship real routes as built-ins at all, or only fictional ones? The store text already says real routes must be checked on site.
- **Memory.** If H9 fails, shrink the template (§8).
- **Q16 (round 4). Memory budget.** Round 4 reached 35.2 KB steady and 42.4 KB run peak by default, 37.5 KB and 51.9 KB with a full slot and the Fictional Wall, without changing what users see (§8). The binding 16 KB steady and 20 KB peak cannot be reached while topos are streamed at runtime. In order of cost to users, each measured on top of the one before (default steady): cap terrain at 163 points and release `W` while the template holds the topo, 32.1 KB (a slot topo with more than 163 terrain points fails with E7); a 15-pitch Fictional Wall, 32.8 KB with the Wall open (instead of 34.4 KB; changes binding decision 1's built-in near the size limit); no point glyphs and no decorated lines, 29.5 KB; no terrain, 27.7 KB. Only dropping the slot and the built-in library, one topo compiled into the template as in hwtest3 (15.7 KB), reaches 16 KB, and it contradicts binding decision 1. Decide after H9: if the app runs cleanly next to a second app at 35-38 KB, none of these is needed.
- **Q13 (round 3). Save the position after a lap?** Laps are not saved (round 1: the lap popup is a busy moment for memory; the deep-dive rule keeps localStorage out of `evaluate`). A climber who moves only by laps loses the position to a mid-exercise reload (§12). The fix would be one write a few seconds after each lap, made from `evaluate`, about 20 B of main.js. It breaks the "never in evaluate" rule, so it waits for Vitya's call and H9.
- **Q14 (round 3). End marker for STP1.** A paste cut in its tail can parse silently (§12). An end record with a hash of the line (`|E<hash>`) catches every cut; ext1.js already computes the hash. It changes the format: the editor, `reference.js`, the built-ins, every fixture and T1-T3, T10.
- **Q15 (round 3). Progress on the Map after the route.** On the Map the progress line hides once the route is drawn, so the Fictional Wall shows a bare route for about 13 s before its terrain. A 16th element at about 90% (T7 allows 16) would show "Loading NN%" there; it costs about 150 B of template on a template over its research target. Decide after H9 and H3 (whether a display switch reloads the template, which would make loads frequent).
- **Q8 note (round 3).** The store-safe Piccolo Fillar shows "No notes" on all 15 pitches in Info, and 5 pitches have no length (the source note has none). A neutral line per pitch would add about 400 B to the topo string kept live while it is open. Shipping only the fictional topos and Jägerhorn N, or adding the line, is part of Q8.
- **Repo hygiene.** Stale v0.3 build outputs (`suunto01-*.fea`) sit in `src/suuntopo_canvas/`. They are not in any package, but should be deleted.


**P1, after 1.0, in order of value for multi-pitch climbers.**
1. Editor: pointer and touch, project save with background corners, STP1 import, hosting.
2. Localization: de, fr, it, es, cs, pl, after native review.
3. A "next pitch preview" strip at the top of the Map: next grade and length (one more `#h0` line).
4. Optional silent lap per pitch when moving forward on the app screen, using `$.put('Activity/Trigger', 24)` [doc L1537]. It needs the H8 result first, to avoid double advances.
5. A pitch timer, from `evaluate` ticks since the idx last changed, shown in Info.

**P2.**
- Rappel mode (reverse order with rappel lengths)
- Several routes per wall
- Sharing by URL or QR
- OpenBeta or theCrag import
- Barometric hint for the current pitch
- Photo backgrounds for personal builds (2 images max [doc L1581])

**Repo hygiene** (outside this spec's code, from [gaps §3 "Housekeeping"]):
- CLAUDE.md "Key directories" paths and the copied "Jesse" line
- the path in `.claude/skills/build-suuntopo/SKILL.md`
- stray `suunto04-*` and `suuntopo_hwtest2.zip` build files
- the `hu.json` advice in `docs/suunto_wiki.md`

**Open questions for Vitya.**
- **Q1.** Store name: "Climbing Topo", "Pitch Topo", "Belay Topo" or another?
- **Q2.** Public author name for the manifest and the store?
- **Q3.** Should the editor import old v0.3 JSON projects (anchors with x,y)? It would be an editor-side converter, but it is still backward compatibility, which CLAUDE.md requires your approval for. Default: no. Redraw instead.
- **Q4.** Where to host the editor (e.g. GitHub Pages of `aabbeell/suuntopo`), and is the repo public? *(Round 2: a release gate, Q11.)*
- **Q5.** Support contact for the store text: email or GitHub issues?
- **Q6.** Is "Lap moves to next pitch" default **Off** right for you, given that you lap at belays yourself?

---

## 19. Probes run for this spec (2026-10-03)

The scratch apps live in the session scratchpad and were not committed.

| Probe | What | Result |
|---|---|---|
| Baseline | `sp-build` + simulator screenshot (q) of v0.3 | Builds: t.xml 18,765 B, main.js 678 B minified. The simulator shows only the hard-coded Salathé, not the data.json copy. |
| A | Build-only app: template `displays [n,o,q]` + `u.html` for s, m, l; pushButton with `type`/`longType="action"`, `longPressDuration`, `disabledWhileAOD`; inline enum; extra data.json keys; `{{key}}` in template script; `{{ IS_UI1 }}` in main.js | All valid and packaged per display. Tokens substituted in script and main.js. `sp-b-cjk` → `f-b-m`. **An ASCII `'` in a translation broke the build**; ’ and accents were fine. The build rewrites `modificationTime` in the packaged manifest. |
| B | Simulator: main.js and template `localStorage.getItem` | main.js reads data.json (`topo0` length 10). **The template gets `null` for data.json keys and for keys main.js wrote.** |
| C | Simulator: string and array outputs; `setText` from main.js | The values reach the template but log "Invalid type 'string' for output value 's', expected number". `setText` from `evaluate` works. `setText` from main.js `onLoad` left a black screen. |

Screenshots (scratchpad):
- `suuntopo_baseline_q.png`
- `lsprobe_q.png`
- `outprobe2_q.png`

---

## 20. Implementation notes (v1.0, 2026-10-03)

Each item below says where the implementation departed from the design above, or settled something the design left open, and why.

**Architecture and transport**
1. **Parsing and text moved to main.js; the template only draws** (§0 item 2, §4). The reasons are in §4.
2. **The ext file layout.** `evalFile` works only from main.js and only for `ext<digits>.js`. main.js keeps only the lifecycle functions and 8 small helpers, and loads everything else when needed:

   | File | Job | When it is loaded |
   |---|---|---|
   | ext0.js | start-up: settings, slot parse, saved position | onLoad |
   | ext1.js, ext9.js | parser stages 1 and 2 | opening a topo |
   | ext2.js | navigation | each long press |
   | ext3.js | list card text | the list is shown |
   | ext8.js | Map text | the Map is shown, or a lap |
   | ext10.js | Info text | Info is shown |
   | ext4.js-ext7.js | built-in topos | opening one, or browsing its card |

   No ext file touches outputs or global storage (T7).
3. **Code is split for the compile limit.** Duktape compiles each function as one request, and v0.3 failed with a 6.9 KB block. The parser is split in two, the text writers in three, and start-up is separate. Every code request is now ≤ 2,499 B, measured in Duktape by T8. The largest is ext10.js at 2,436 B.
4. **The stream protocol** (§4.5).
   - The check word makes the receiver independent of the order and frequency in which outputs are delivered.
   - Opening a topo with a new hash clears main.js's record of what the template holds. Without that, going back to a topo after a half-streamed one stalled the stream. The bug was found by the 1,000-session T5 run, and a regression test now covers it.
5. **`evalFile` in the simulator** runs the file in the global scope with the browser's `localStorage` (§11). That is why main.js passes `localStorage` to ext0.js, and why `sim-fixture.js` pre-substitutes tokens.
   - The simulator log also shows the template being activated up to three times at start-up with no `onDeactivate` in between, so the subscriptions are made several times.
   - This is harmless for correctness: a chunk is committed only once, and activation only reports state.
   - Whether the watch does the same, which would cost memory per duplicate subscription, is part of H9.
   - **A known soft stall, left in on purpose (low severity).**
     - **What happens.** main.js can open topo B and go back to topo A inside one `evaluate`: two long presses within a second, with on-change delivery. The template then never sees `mh = B`, so it keeps A complete. But main.js has cleared its record of the template's report, so it streams A's chunks again. The template ignores them because it already has them, and never re-reports. So the stream runs on until the next activation or topo change.
     - **Effect.** Correct drawing. Outputs churn once per second, with no allocation.
     - **Why not fixed now.** A fix would be the template re-reporting on an already-held chunk. In the simulator, which re-delivers every output every second, that would send an event every second forever. So it was not changed without hardware evidence.
     - **Testing.** T5's settle check looks at the template side, so it does not see this case.

**Screen and text**
6. **Hiding elements.** `setStyle('#id *', 'visibility', …)`, the reference's form, had no effect in the simulator; `'#id'` does. The code sets both forms.
   - Hiding by setting the text colour to black was tried and dropped, because the hidden text punched holes in the route line.
   - Which form works on the watch is H3 and H10 material.
7. **Positions, tuned with screenshots on q, o and n** (the design had ±2% room):

   | Element | Design | As built |
   |---|---|---|
   | `#tn` | 7% | 5% |
   | `#h1` | 84% | 82%; 80% (round 2) |
   | `#h2` | 92% | 90% |
   | `#l0`…`#l5` | 5 lines, 26-62% | **6 lines**, 26-71% |
   | `#ld` loading line | – | 47% (new); 76% (round 1); 74% (round 2) |
   | `#c2` bottom tile | 62-84% | 62-79% (round 3, so nothing is drawn under `#h1`) |

   The tiles stay at 16/39/62%.
8. **Character budgets.**
   - `LPP` is 6 lines a page (design 5).
   - `NAME_CHARS` is 14 on n (design 13); q and o stay 15.
   - `CPL` stays at 18 (q), 20 (o) and 17 (n).
   - Info has no 4-page cap. Notes are at most 200 characters, which is at most 2 pages on q.
9. **Fit.** The Map fits the current pitch into 0.8 of the width and 0.58 of the height (`hmax` 270 px on q), with zoom 0.35-2. *(Round 3: 0.54, `hmax` 250 px, so the target ring at the bottom belay ends at the shortened bottom tile's edge, 79%.)*
   - A list card fits the whole topo into 0.43 of the height (`hmax` 200 px), so the label line under the name stays free, with zoom down to 0.045 for 30-pitch routes.
   - Belay dots shrink with zoom (radius 2.5-6 px), so a long route's overview stays readable.
10. **The list draws only the open topo** (§0 item 7). The design's "Route" view drew every card, which the 1 chunk per second stream cannot do.
11. **The loading line.** While a topo is incomplete the template shows "Loading NN%" over the drawing. The route is drawn as soon as its chunks are in. *(Round 2: under the drawing; on the Map only until the route can be drawn; on the open topo's list card it becomes "Hold MIDDLE: map" once the topo is complete, §5.)*

**Format**
12. **STP1 corrections** (§4.3):
    - the limit is 3,500 characters (the slot holds 1,500 bytes);
    - text limits are in characters;
    - duplicate N, R and B are errors;
    - empty records and a trailing `|` are tolerated;
    - the feature table has one entry per path;
    - the error precedence is defined;
    - contour fill `q` is parsed but not drawn.
13. **Test fixtures changed.**
    - The stress fixture was trimmed to exactly 3,500 characters.
    - The 60-pitch fixture's name is exactly 32 bytes.
    - The demo's pitch 3 (5c) is band 2 by the band table, not 3.
    - The case "61 pitch records" is E5 (stage 1 counts the records before stage 2 sees the belays).
    - "B with 62 entries" is tested with 60 pitches and gives E4.

**Persistence and logging**
14. **`sv` is written only on user actions, pause and end** (§4.6), following the deep-dive rule that every localStorage call allocates a buffer the size of the whole data file. Its version is `2`.
15. **Logging.** The fictional built-ins (Demo, Wall) log pitch 0 and never count for "Highest pitch". The schematic built-ins and the slot log the idx.

**Measured limits**
16. Sizes and memory are in §8. In short, the compile requests meet their limits, while the template text size and the steady heap do not meet the binding targets. H9 decides.

**Hardware-only questions** (cannot be settled in the simulator; also listed in §16c):
- Do numeric outputs carry 24-bit values exactly, and are all 15 stream outputs delivered per `evaluate` (H1)?
- Do `setText` and `setStyle` from `onEvent` show at once, or only after the next `evaluate` (H3)?
- Which visibility selector works: `'#id'` or `'#id *'` (H3)?
- Does runtime `setStyle(…, 'color', …)` work (H10)?
- Do long-press-only buttons leave clicks native (H2)?
- Do subscriptions survive lap popups (H8)?
- What do moveTo and arc really cost on the canvas (H5)?
- What shape does the `UnitsMode` callback value have (H12)?
- What is it like to paste 1,500 B into the phone setting (H13)?
- *(Round 3.)* Does `$.unsubscribe` throw for a token a lap popup severed, does a `$.get` on an output throw, and does the firmware drop a view's timers on deactivation? The app is safe either way now (§4.5). Does the lower button's long press still unlock on the app screen (H4)? What is `setTimeout`'s resolution (the refresh spacing, H9)?

## 21. Review round 1 (2026-10-04)

Three reviews (platform, adversarial, product) were checked against the code; each confirmed defect has a regression test (T5, T9) that fails on the reviewed v1.0 and passes now. The sections above carry the details, marked *round 1*.

**Fixed in code.**
- Stream: a one-chunk topo whose words arrived before its stream id never loaded (§4.5); at least two chunks alternate; `mh` and `ms` are read with `$.get` on activation; the stream id includes the topo id, so equal content hashes cannot share a stream.
- Template: one refresh chain at a time (no simultaneous tiles, no REFRESH to `#c3`); subscriptions released before re-subscribing; callbacks made once; belays as round-capped segments, arcs only for the target (§7); loading line at 76%; done and walk colours (§5.7).
- main.js: a topo, navigation or text file that fails to load no longer locks the buttons or skips the outputs; a broken slot opens on its error card; the summary and the logged pitch ignore a position restored from an earlier exercise; a route saved at Top restores at Start; `sv` is written only when it changed, not on laps, and a failed write no longer restarts the stream; UI1 watches load, stream and save nothing.
- ext0.js: the slot is trimmed (newline, spaces, BOM); lap advance reads an integer enum.
- ext3.js: a card index for the built-ins, so browsing never compiles a topo file; pitch counts in words; "Hold MIDDLE: open" on cards that are not open; two Help cards (buttons, then loading a topo). ext10.js: "more" instead of "(1/2)".
- Editor: titled "Climbing Topo editor"; an "On the watch: how to and FAQ" panel (buttons, button lock, Loading, logging, error codes).
- Tests: the rig can deliver the stream id last, in one batch with the next chunk, or without current values on activation, and can make chosen ext files fail to load; the 1,000-session fuzz uses all of these.

**Not fixed, with the reason.**
- Memory is still about 2.5 times the binding steady target (§8). The remaining cuts cost features (Q10) or need main.js room (W packing); H9 is the release gate.
- Severed subscriptions after laps (forum 15320) are only partly covered: `ms` and `mh` are re-read on activation, the stream words are not polled. H8 decides whether full polling is needed.
- Hosting the editor, the store name, author, support contact, banner and the Piccolo Fillar notes are Vitya's decisions (Q1, Q2, Q4, Q5, Q7-Q11).

## 22. Review round 2 (2026-10-04)

Three reviews (platform, adversarial, product) were checked against the code. Each fixed defect has a regression test that fails on the round-1 code and passes now (checked by running the round-2 tests against a copy of round 1: 21 of 95 fail there; the 95th, below, guards a defect introduced and caught during round 2). The sections above carry the details, marked *round 2*.

**Fixed.**
- **Cyclic garbage per press, activation and lap** (platform P1): loaded functions lose their prototype; code ext files drop their helpers; ext0.js uses main.js's loader; the template keeps one units callback and sends units only on change. 25% less on average, the rest measured as the harness's own `evalFile` (§8). Not done: running the lap step in main.js instead of loading ext2.js, because a lap left the same garbage as a Map hold and main.js has 4 B left of its 2,000 B guard.
- **Markup in user text** (platform P1): the parser rejects `<` and `&` (E2, E5, E7); the editor writes `‹` and `+` (§12).
- **`lapAdv` stored as a number** (platform P1): data.json ships `"0"`; T8 reads both output streams and accepts only the build's informational lines (§9).
- **`evalFile` from an ext file** (platform P2): ext0.js uses the loader main.js passes it; H1 says what E9 on a known-good slot means.
- **Arcs for the target ring** (platform P2): two round-capped segments; frames use no arc or fill (§7).
- **CPU time of long patterned segments** (adversarial P1): patterns only on segments that near the tile and are at most two tile widths long; features stop when the budget is spent (§7).
- **Refresh chain lock-up** (adversarial P1): `onDeactivate` ends the chain, a stale timer stops at once, a throwing `control()` stays inside the chain.
- **Store-safe package** (product P1): neutral Piccolo Fillar notes by default, `--personal` for the rich ones, T8 check; v1.0 rebuilt.
- **No watch list in the store text** (product P1): `listing.md`'s long description names the watches.
- **No hint on the first screen** (product P1): "Hold MIDDLE: map" under the open topo's card (§5). The alternative of starting on Help 1 would have cost main.js bytes and changed start-up.
- Product P2s: `#h1` at 80% and `#ld` at 74% (no overlap on n and o), the Map's progress line only until the route is drawn, brighter dim terrain, "Notes 1/2", the position as the Map's top line, actions on the error cards, the Fictional Wall's wording, one hero image and a short description, the test count in §16a.

**Deferred, with the reason.**
- **Editor hosting** (product P0): publishing needs Vitya (Q4); it is now a hard upload gate in `listing.md` and A11.
- Banner, support contact and the console's field limits (Q5, Q12): Vitya, in the signed-in console.

**Still hardware-only.** Arc and fill costs no longer matter for frames, but round caps' look does (H5). Whether the firmware drops view timers on deactivation or throws from `control()` on an inactive view, and whether it runs a full mark-and-sweep per callback, are open; the fixes make the app safe either way, and H9 now looks for garbage piling up.

## 23. Review round 3 (2026-10-04)

Three reviews (platform, adversarial, product) were checked against the code; the reviewers' scripts were rerun on the fixed code. Each fixed defect that a test can see has a regression test that fails on the round-2 code (checked by running the round-3 tests against a scratch copy of the round-2 app: 13 of 102 fail there, among them the late mount, the 0% line, the throwing unsubscribe and `$.get`, the refresh spacing, the error card, the crack segments and the not-supported lines; the rest fail on the new Help text, setting name, tile height and step counter they also check). The overlay test passes on round 2 by design: it guards against the restart-always variant of the fix, which it rejects. 102 tests pass. The sections above carry the details, marked *round 3*.

**Fixed.**
- **Route first after a mount or template reload** (adversarial P1, platform P2; one defect): the activation report tells "holds nothing" from "holds part of a topo" (`3999999`), and main.js restarts at chunk 0 only for nothing, and not when chunk 0 was the last chunk written. Reviewers' measurements rerun: route after 6 s / 4 s / 2 s (Wall / full slot / demo) at every mount offset (was up to 18 s / 7 s / 5 s); never "Loading 99%"; an overlay during the Wall's load still completes at 19 s. The percentage counts from chunk 0 (0% before it). The platform reviewer's variant (restart whenever the template does not hold the topo) was not taken: it restreams on every overlay during a load (§4.5).
- **Activation and deactivation order** (platform P2, adversarial P2; one defect): `onDeactivate` ends the refresh chain before unsubscribing and wraps the unsubscribe; `activate()` reports and paints before the output `$.get`s; the units are read first. Not done: a `try` per `$.subscribe` (§4.5).
- **Refresh spacing** (platform P2): 100 ms instead of 60 ms (§7).
- **Crack segments that miss the tile** (adversarial P2): a per-tile cap on patterned length; the crafted slot drops from 22,000-44,500 to about 3,000-3,450 calls per paint (§7).
- **How the line gets to the phone** (product P1): the FAQ, both store descriptions and Help 2 say to use the editor on a computer and send the line to the phone; the setting is "Topo line from editor"; the FAQ says a synced topo shows up at the next exercise start. No "email to my phone" button: a `mailto:` body of up to 1,500 B, URL-encoded, can exceed what some mail clients accept.
- **Not-supported screen clipped on s and l** (product P2): two centred lines; T6 budget; screenshots on s, m and l.
- **Map drawn under `#h1`** (product P2): bottom tile 62-79%, Map fit 250 px (§5, §20).
- **MIDDLE on the error card** (product P2): moves to the open topo's card (§5).
- **FAQ** (product P2): the unlock advice now covers a lower long press that does not unlock on the app screen; a colour legend for the Map and the grade bands. H4 records what the watch does.

**Rejected.** None of the findings was wrong on the facts. One proposed fix was rejected, as above (restart on every activation).

**Deferred, with the reason.**
- **Store gates** (product P0, already tracked as Q2, Q4, Q5, A10, A11): hosting the editor, the author name, the support contact, the banner and H1, H2, H8 and H9 need Vitya and a watch. `listing.md` now also lists putting a short editor URL on Help 2 once it exists.
- **Lap position not saved** (adversarial P2): the fix writes storage from `evaluate`, against the deep-dive rule and round 1's decision; §12 and H11 are corrected, Q13 asks Vitya.
- **Silent tail truncation** (adversarial P2): needs a format change (Q14); documented in §12 and the FAQ.
- **Map progress after the route** (product P2): needs a 16th element and about 150 B of template (Q15).
- **Piccolo Fillar "No notes"** (product P2): part of Q8, with a memory cost (§18).

**Still hardware-only.** Whether `$.unsubscribe` or a `$.get` on an output throw, whether the firmware drops view timers, the `setTimeout` resolution behind the refresh spacing, and whether the lower long press unlocks on the app screen (H4). The route-first fix is visible only on a watch, where the template mounts after the stream has started (H1, H3).
