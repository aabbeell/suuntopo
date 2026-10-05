# suuntopo_image

**Status:** experimental. Not the app you want to install for everyday use — see the limitation below.

Photo-topo variant of the viewer. Same selector / topo / info UX as `suuntopo_canvas`, but the topo background is a real photograph of the wall instead of a programmatically drawn diagram, with the route line and anchors overlaid on top.

## Why it exists

A photo conveys the actual texture and features of the wall in a way vector drawings cannot. For some routes — especially photo-topos that already exist online — this is the most natural representation.

## Why it is experimental

**Topo images cannot be synced from the phone.** SuuntoPlus settings can carry strings (which is how `suuntopo_canvas` ships JSON topos), but the manifest `image` array references PNG files that the build packages directly into the `.fea`. As far as I have been able to find, there is no over-the-air image sync path — adding a new photo-topo means: drop the PNG into this folder, rebuild, redeploy over USB or Bluetooth.

Combined with the SuuntoPlus per-app limit of two images, that means the image variant is fixed at exactly two photo-topos per build, baked at compile time. Useful as a personal tool ("here is the route I'm doing this weekend"), unusable as a sharing format.

## What ships in this build

Two routes, hardcoded:

| Image | Route name | Wall | Grade | Anchors |
|---|---|---|---|---|
| `topo1.png` | Tupa Bleda | Tupa, SZ stena | V+ | 9 |
| `topo2.png` | Hodena rukavica | Tupa pilier, SZ stena | IV | 8 |

Anchors are stored as **relative coordinates** (0..1) of the source image rather than absolute pixels, so the same data renders correctly regardless of how the image is scaled to the round display.

Between every pair of anchors a midpoint waypoint is generated automatically, giving the up/down navigation finer pan steps than just jumping anchor-to-anchor (17 / 15 waypoints respectively).

## Controls

Same as `suuntopo_canvas`. Up/down step through waypoints (or selector items); crown enters a topo or toggles info; long crown returns to selector.

## File map

- `manifest.json` — declares the two PNGs as `c64` (64-color quantized RGB) images. Outputs the same five state variables as `suuntopo_canvas` (`appMode`, `selectorIdx`, `topoIdx`, `anchorIdx`, `viewMode`).
- `main.js` — state machine. Tracks `WP_COUNTS = [17, 15]` for waypoint bounds.
- `t.html` — renders the chosen background image plus an SVG-style overlay with the route polyline, anchor dots, grade labels, and HUD.
- `topo1.png`, `topo2.png` — must be pre-quantized to 64 colors, RGB without alpha, and small enough that the post-build `.fea` stays under the ~64 KB compressed image limit. Use Pillow: `img.convert('RGB').quantize(colors=64).convert('RGB')`.

## Version history

- **v0.2** — current. Two photo-topos, selector / topo / info modes, midpoint waypoints, relative anchor coordinates.
