# topo_editor

Browser-based visual editor for drawing climbing topos. Single self-contained `index.html` — open it in any modern browser, no build step, no server, no dependencies.

## What it does

- Draw a route as a polyline of waypoints, with selected points promoted to belay anchors.
- Place topo features (crack, chimney, slab, ledge, overhang, bolt, piton, rappel, tree, …) with click-and-drag rect/diagonal/point tools.
- Tag each anchor with grade, length, and a free-form info description that the watch app shows in its info panel.
- Drop in a background photo with a 4-corner perspective transform if you want to trace from a real photo.
- Export the result as JSON. Paste that JSON into `topo0` / `topo1` / `topo2` in the SuuntoPlus settings of `suuntopo_canvas` and sync — the watch picks it up next time the app loads.

## Watch preview

A 240 px round preview on the right shows what the current view looks like on the watch at 1:1 scale (240 px = 466 watch units). With the **viewport overlay** mode on, a yellow circle on the canvas tracks your mouse and shows what the watch screen would frame at any point — useful for laying out anchors so the next one is just visible from the previous.

## Output

JSON shape with `name`, `wall`, `grade`, `pitches`, `width`, `height`, `anchors[]`, `route[]`, `features[]`. The watch renderer (`src/suuntopo_canvas/t.html`) parses this directly. The full schema and per-feature shape, including how rect features are converted to lines on the watch, is in **[EDITOR_SPEC.md](EDITOR_SPEC.md)**.

## Files

- `index.html` — the entire editor.
- `EDITOR_SPEC.md` — data format, tools, keyboard shortcuts, watch-app compatibility notes.
- `topo_signs/` — reference images of the symbol palette used inside the editor.

## Running it

```
open src/topo_editor/index.html
```

Or serve the folder over `python -m http.server` and visit `localhost:8000` if your browser blocks file:// for the FileReader / clipboard APIs.
