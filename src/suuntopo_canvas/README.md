# suuntopo_canvas

**Status:** primary app. This is the one you should install on a watch.

Canvas-vector rendering of climbing topos with a route selector, topo map view, and per-pitch info panel. One hardcoded reference topo (Salathe / El Cap) plus up to three more synced over the SuuntoPlus phone settings as JSON strings — no rebuild needed to add a new route.

## What it does

- **Three view modes** controlled by `appMode`:
  - `0` — selector: vertical list of all available topos with grade and pitch count
  - `1` — topo map: pan-and-zoom canvas centered on the current waypoint
  - `2` — info: full pitch description text (the `info` field from the topo JSON)
- **Route line** drawn in red as a polyline through the `route` array.
- **Anchors** drawn as colored dots, sized up when the current pitch is on them. Grade-colored: green (I-II), white (III), yellow (IV), red (V+).
- **Topo features** rendered programmatically — slab, tree, cross, crack, overhang, ledge, rappel, chimney, arete, bolt, piton, contour line, contour fill, etc. Each feature is wrapped in a try/catch so a malformed one cannot kill the render.
- **HUD layer**: topo name top-center, current-pitch line `N/total grade length` bottom-center, progress dots on the right arc of the screen.
- **Vignette** over the edges of the circular display so map content fading near the bezel does not look abrupt.

## Controls

| Button | In selector | In topo / info |
|---|---|---|
| Up (short) | previous topo in list | next waypoint (toward summit) |
| Up (long) | — | zoom in |
| Down (short) | next topo in list | previous waypoint (toward base) |
| Down (long) | — | zoom out |
| Crown (short) | enter selected topo | toggle topo ↔ info |
| Crown (long) | — | back to selector |

## Data flow

Topos are loaded from two sources, in this order:

1. The hardcoded `topos[]` array inside `t.html` (Salathe).
2. `localStorage` keys `topo0`, `topo1`, `topo2`, populated by SuuntoPlus settings sync from the phone. The loader tries `localStorage.getItem(key)` + `JSON.parse` first (settings come in as strings), then falls back to `localStorage.getObject(key)` for direct object storage.

`data.json` in this folder is the canonical settings shape and ships an example Salathe topo in `topo0`. To add real routes: open the topo editor, draw a route, **Export JSON**, paste into `topo0` / `topo1` / `topo2` in the watch settings, sync.

The data format itself (anchors, route, features) is documented in `src/topo_editor/EDITOR_SPEC.md`.

## File map

- `manifest.json` — declares `topo0..topo2` as `string` settings (max 100000 chars each) and exports `appMode`, `selectorIdx`, `topoIdx`, `anchorIdx`, `zoomLvl` as outputs the template subscribes to.
- `main.js` — pure state machine. Holds `appMode`, indices, zoom level. Reacts to button events and writes new state to outputs. No drawing.
- `t.html` — all rendering. Subscribes to the five outputs, redraws the canvas on every change.
- `data.json` — example settings payload (Salathe in `topo0`).

## Version history

- **v0.3** — current. Selector / topo / info modes, three synced topo slots, grade coloring, progress arc, vignette, info panel, long-press zoom.
- Earlier versions were single-topo and lacked the selector — see the hwtest series below for the path that got us here.
