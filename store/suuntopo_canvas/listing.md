# Suuntopo: store listing (v1.0)

This is the text and the asset list for the SuuntoPlus Sports Apps console (ApiZone profile page), first written 2026-10-03, revised after review rounds 1-3 and completed for submission on 2026-10-04. The field names follow `docs/suuntopo_canvas/SPEC.md` §15. Open items carry the number of the spec question (**Q**).

**Do not upload yet.** Two gates are still closed:
- the hardware gates H1, H2, H8 and H9 (`docs/suuntopo_canvas/HW_RESULTS.md`). On 2026-10-04 v1.0 loaded, drew and navigated on a Race S running alone in a Climbing mode, after the loader moved from 18 output subscriptions to 3; record the individual gates there;
- ~~the editor must be hosted (Q4)~~ done 2026-10-04: Abel chose to publish only the editor source, at https://github.com/aabbeell/topo-editor (public, no website); users download it and open index.html. The FAQ is the editor's "On the watch: how to and FAQ" panel.

## Console form (seen 2026-10-05, apizone.suunto.com → Profile → SuuntoPlus sports apps → Add new)

Fields, top to bottom, and what goes in each. The name comes from the manifest; the form has no name field.

**Upload-ready copies of the three files are in `store/suuntopo_canvas/upload/`** (numbered in form order). Refresh them whenever the banner, the hero screenshot or the source zip changes.

| Field | Value |
|---|---|
| Banner image (PNG, exactly 600 × 300) | `store/suuntopo_canvas/banner-600.png` (from `banner-600.html`: a wall at dusk with the route, belays and grades; title on the left) |
| Description (markdown) | `store/suuntopo_canvas/description.md`, pasted as is |
| Categories (max 3) | Outdoor, Training Tools (a single category made the server fail with "Index 1 out of bounds for length 1" on 2026-10-05; two is the working assumption) |
| Submission role | Made by Suunto Community |
| Needs an external device/sensor | No |
| App images (PNG, 466 × 466) | `screen-1-map.png`, then `screen-2-list.png` … `screen-5-help.png` if it takes several |
| Sports app package | `builds/suuntopo_canvas/v1.0/suunto01-source-v1.0.zip` |
| Submit | Agrees to Suunto's licence agreement: Abel presses it |

## Build files that are not uploaded

The built binaries `builds/suuntopo_canvas/v1.0/suunto01-{l,m,n,o,q,s}-en.fea` are for sideloading and the hardware test; they are not uploaded. Never upload anything from `v1.0/personal/` (rich Piccolo Fillar notes, Q7) or `v1.0/hw-test/` (full slot, lap advance On).

## Manifest (checked 2026-10-04)

| Field | Value | Check |
|---|---|---|
| `name` | Suuntopo | 8 B of 60; appId `suunto01`. Chosen by Abel (Q1, 2026-10-04). It contains the Suunto brand, which store review may refuse; the listing carries the not-affiliated line below. |
| `version` | 1.0 | 3 of 4 characters. Change it for every upload; the console rejects a version it already has. |
| `author` | O. Vitya | Decided (Q2, 2026-10-04), same on all three apps. |
| `description` (shown under the name on the watch) | Multi-pitch topo | 16 B of 100, under the ~22 characters Suunto recommends. |
| `type` / `usage` | `feature` / `workout` | A plain sports app (`.fea`); no Bluetooth device, so not `device`. |
| `modificationTime` | 1791106094 (2026-10-04 09:28 UTC) | Integer Unix seconds. Set a new one for every upload. The build library stamps its own build time into the `.fea`; the zip carries this value. |
| `languages` | `["en"]` | English only in v1.0. |
| `template` | `t.html` on n, o, q; `u.html` on s, m, l | `u.html` is the "Not supported on this watch" screen. |
| `settings` | "Topo line from editor" (string, 1,500 B), "Lap moves to next pitch" (inline enum Off/On) | No `valuePath` (it crashes the Suunto app). |
| `out` | 19 of 20; 1 logged (`pitch`) | |
| `activities` | **not set, on purpose** | Its effect is undocumented and it could hide the app from custom sport modes (SPEC §15, critique §2). Test T8 checks that it stays out. |

The offline build of these files (`tools/sp-build`) passes with no warnings on all six displays.

## Store name

Suuntopo

## Short description

Your multi-pitch route on the watch, belay by belay.

## Long description (single-line field, paste as one paragraph)

> Suuntopo shows a multi-pitch route on your watch, belay by belay. FEATURES: the pitch you are on is drawn in yellow and zoomed to fit, with its grade and length; hold UP for the next pitch and DOWN to go back; hold MIDDLE for the pitch notes, then the topo list; the approach and the descent are shown at Start and Top; lengths follow the watch's m/ft setting; optionally each lap moves to the next pitch; the pitch you are on is logged to your workout, and the summary shows the highest pitch you reached with a hold or a lap and stayed on for 30 seconds. The app never uses short presses, so pause, lap and display change work as usual; the watch's button lock also blocks the holds. WATCHES: Suunto Race, Race S, Race 2, Vertical 2, Ocean and Ocean Lite; 9 Peak Pro and Vertical use a smaller layout. Not for Suunto 9, 9 Baro, 9 Peak, 5, 5 Peak or 3 (they show "Not supported on this watch"). SENSORS: none needed; the app uses no sensor, Bluetooth device or phone connection. SET UP YOUR OWN TOPO: 1. On a computer, open the free editor at topo-editor.vercel.app and draw the topo. 2. Press "Copy for Suunto app" (one line, at most 1,500 bytes). 3. Send the line to your phone (message or email it to yourself, or use a notes app). 4. In the Suunto app, open Suuntopo's settings, paste it into "Topo line from editor" and sync the watch. 5. Start an exercise: your topo is the first card of the topo list. Without your own topo you can browse the built-in examples: a fictional demo, a fictional 30-pitch wall, and two schematic sketches of real routes. LIMITS: one topo of your own at a time; a newly synced topo shows up at the next exercise start; a large topo takes up to about 20 seconds to draw (the route comes first); a lap does not save your position, a hold does; English only. The fictional examples are marked "Not a real climb" and are not logged; schematic topos are simplified drawings, not guidebook copies. Check every real route on site, because topos drawn by users or shipped as examples can be wrong or out of date. Only add a topo from a guidebook or another publication if you have the rights holder's permission. Not a guidebook and not a navigation aid. Suuntopo is an independent app, not affiliated with or endorsed by Suunto. PRIVACY: the app sends no data anywhere; the pitch number goes into your workout file, which the Suunto app syncs like any workout; the editor runs in your browser and uploads nothing, not even a background photo. How-to and FAQ (buttons, button lock, error codes, loading): on the editor page, "On the watch: how to and FAQ". Support: borosaabel@gmail.com.

About 2,530 characters with the placeholders. Once the hardware gates pass, add "Tested on a Race S." after the watch list; do not add it before.

## Short version (about 615 characters, if the console limits the field)

> Suuntopo shows a multi-pitch route on your watch, belay by belay. For Suunto Race, Race S, Race 2, Vertical 2, Ocean, Ocean Lite (9 Peak Pro and Vertical: smaller layout); not for Suunto 9, 9 Baro, 9 Peak, 5, 5 Peak, 3. No sensors needed. Draw your topo in the free editor (topo-editor.vercel.app) on a computer, send the line to your phone and paste it into the app's "Topo line from editor" setting. Hold UP/DOWN for the next or previous pitch, MIDDLE for notes. Check real routes on site; add guidebook topos only with the rights holder's permission. Not a guidebook. Not affiliated with Suunto. No data leaves the app except your workout file. Support: borosaabel@gmail.com.

It keeps the required notes below, the watch list, the editor URL and the support contact.

## Required notes (binding decision 1)

These must stay in any shortened or translated version:
- The app is independent and not affiliated with or endorsed by Suunto (the name contains the Suunto brand; Abel, 2026-10-04).
- Real routes need verification on site.
- Adding topos from guidebooks requires the rights holder's permission.
- Built-in topos are labelled on the watch: "Not a real climb" (Fictional Demo, Fictional Wall) or "Schematic topo" (Jägerhorn N, Piccolo Fillar).

## FAQ

This is the store-facing summary. The full user FAQ is on the editor page (`src/topo_editor/index.html`, "On the watch: how to and FAQ"), published with the editor at github.com/aabbeell/topo-editor; if the two disagree, the editor page is the one to fix first.

**How do I get my own topo onto the watch?** Draw it in the editor on a computer, press "Copy for Suunto app", send the line to your phone, paste it into "Topo line from editor" in the app's settings in the Suunto app, and sync. Copy the whole line: a line cut short can lose terrain or the end of a note without an error.

**I synced a new topo, but the watch still shows the old one.** The watch reads the topo when the app starts. A newly synced topo appears at the next exercise start; an exercise already running keeps its topo.

**Nothing happens when I hold a button.** The app uses holds of about 0.6 s, not clicks. The watch's button lock blocks them too: unlock the buttons. If the lower button's hold does not unlock the watch on the app screen, change to another display first, then unlock as usual.

**How do I get back to Start?** Hold DOWN on the Map until it shows Start. A route left at Top opens at Start next time.

**What does "Loading NN%" mean?** The drawing is sent to the screen in pieces of about one second each. The route comes first, then the terrain; the largest topo takes about 20 s.

**What do the colours mean?** Yellow is the pitch you are on, orange-red is still to climb, brown is climbed, blue is the approach and the descent. White dots are belays; the ringed one is the belay you are heading for. The grade's colour gives its difficulty: blue easy, white moderate, yellow hard, orange very hard, grey none.

**What is logged?** The workout logs the pitch you are on, and the summary shows the highest pitch. A pitch counts once you reached it with a hold or a lap in this workout and stayed on it for 30 s. The fictional example topos are not logged.

**My topo card shows an error code.** E1 old or unknown format, E2 name, E3 route line, E4 belays, E5 pitches, E6 damaged paste, E7 too large or bad text, E9 the watch could not read it. The card says what to do; the editor FAQ explains each code.

**Does it need a sensor or the phone during the climb?** No. It works offline on the watch, with no sensor and no Bluetooth device.

**Which watches?** Race, Race S, Race 2, Vertical 2, Ocean and Ocean Lite get the full layout; 9 Peak Pro and Vertical a smaller one. Suunto 9, 9 Baro, 9 Peak, 5, 5 Peak and 3 show "Not supported on this watch". The store cannot block installs by model.

**Can I load a topo from a guidebook?** Only with the rights holder's permission. The built-in real routes are schematic sketches drawn for this app, not guidebook copies.

**Is my data sent anywhere?** No. The app has no network or phone connection of its own. The pitch number is part of your workout file, which the Suunto app syncs like any workout. The topo line is kept in the app's settings in the Suunto app. The editor runs in your browser and sends nothing.

## Release notes (v1.0)

First release.
- Draw a multi-pitch topo in the web editor and load it as one line (up to 1,500 bytes) through the app's settings in the Suunto app.
- Map view: the current pitch in yellow, zoomed to fit, with its grade, length and position ("Pitch 2/4"); approach at Start, descent at Top.
- Info view: pitch notes, approach and descent.
- Topo list with your topo, four built-in examples (two fictional, two schematic real routes) and two Help cards.
- Long presses only: pause, lap and display change stay with the watch. Optional lap advance (setting, default Off).
- The current pitch is logged to the workout; the summary shows the highest pitch.
- Full layout on Race, Race S, Race 2, Vertical 2, Ocean, Ocean Lite; smaller layout on 9 Peak Pro and Vertical; older watches show "Not supported".

## Screenshots (466 × 466, simulator, display q, 2026-10-04)

Shot with the bridge `screenshot` tool from `test/suuntopo_canvas/sim-fixture.js` scratch builds of the source in the zip, 10 s after start so every drawing had finished loading; the simulator log showed no errors. All show the fictional demo, so no real-route drawing appears in the store.

| File | State | Shows |
|---|---|---|
| `screen-1-map.png` | `--dbg 1,1,2` | Map at pitch 2: current pitch yellow, target belay ringed, crack and corner, "Pitch 2/4", "5b 30 m" |
| `screen-2-list.png` | shipped state | Topo list: the whole demo drawn, "Not a real climb", "Hold MIDDLE: map", "5c 4 pitches", "1/6" |
| `screen-3-notes.png` | `--dbg 2,1,3` | Info: "P3 5c 35 m" and the pitch notes |
| `screen-4-map-roof.png` | `--dbg 1,1,3` | Map at pitch 3: the traverse under a roof, a ledge, "5c 35 m" |
| `screen-5-help.png` | `--press 1,1,1,1,1,2` | Help card 5/6: the button holds and the button lock |

The same Map state was also shot on n and o (240 and 280 px) to check that nothing clips; those stay out of the store set. The full review set across displays is in `builds/suuntopo_canvas/v1.0/screens/`.

## Banner

`banner-600.png`, 600 × 300 as the console requires, rendered from `banner-600.html` with the SuuntoPlus Editor's headless Chrome (`chrome-headless-shell --headless --force-device-scale-factor=1 --window-size=600,300 --screenshot=banner-600.png file://…/banner-600.html`). A granite wall at dusk with the route in the app's colours, belays, grades and the current pitch glowing; the title, tagline and two badges on the left. No Suunto marks. The earlier 1920 × 1080 banner is in `archive/store/`.

## Before upload

- [ ] Hardware gates H1, H2, H8 and H9 passed and recorded in `docs/suuntopo_canvas/HW_RESULTS.md`; the rest of H1-H12 run (spec §16c). Then add "Tested on a Race S." to the long description.
- [x] Editor live at https://topo-editor.vercel.app (Vercel, 2026-10-05; HTTPS, Vercel's DDoS protection), source at https://github.com/aabbeell/topo-editor (2026-10-04); its link is in both descriptions. Re-copy index.html, stp1.js and watch.js there whenever the editor changes.
- [x] Editor URL on the watch: not applicable; topo-editor.vercel.app is 22 characters, over the 17 that fit on display n, so Help 2 keeps "(see store page)."
- [x] Q1 name (Suuntopo) and Q2 author (O. Vitya), decided 2026-10-04.
- [x] Q5 support contact: borosaabel@gmail.com (Abel, 2026-10-04).
- [ ] The source package is store-safe as it stands: Piccolo Fillar has neutral notes (test T8 fails otherwise). Never upload `builds/suuntopo_canvas/v1.0/personal/` unless Q7 is confirmed in writing; Q8 decides whether real routes ship at all.
- [x] Q12: seen in the console on 2026-10-05: banner 600 × 300 PNG, one 466 × 466 app image, markdown description with no stated limit.
- [ ] Rebuild the zip if any file in `src/suuntopo_canvas` changed since 2026-10-04 11:28, with a new `modificationTime`; `unzip -l` must list exactly the 18 files above.
- [ ] A new `version` and `modificationTime` for every later upload.

## Links

Also at the end of `description.md`. The GitHub links work once the repos are public.

- Source: https://github.com/aabbeell/suuntopo
- Topo editor: https://topo-editor.vercel.app (source in the suuntopo repo, src/topo_editor)
- Other apps by O. Vitya: https://github.com/aabbeell/suunto-airtemp (AirTemp for Suunto), https://github.com/aabbeell/suunto-variolink (VarioLink for Suunto)
- Developer tools: https://github.com/aabbeell/suuntoplus-agentic-dev-env
