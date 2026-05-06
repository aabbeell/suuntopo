# SUUNTOPO Editor — Specification

## Overview

Browser-based visual editor for creating climbing topo data files. Outputs JSON compatible with the SUUNTOPO watch app (SuuntoPlus Sports App for Suunto Race S). Single HTML file, no dependencies.

## Tool Categories

### 1. Pitch (route + anchors)
- **Route Line** (R key): Left-click adds waypoints, right-click adds waypoint + anchor. Polyline.
- **Anchor** (A key): Click on route point to toggle as belay station.

### 2. Topo Features (signs)
**Rect-based** (click+drag to set position and size):
Crack, Chimney, Corner, Couloir, Overhang, Roof, Ledge, Slab, Ramp

**Diagonal** (click+drag any angle):
Arete

**Point-based** (click to place):
Bolt, Piton, Rappel, Chockstone, Tree, Grass, Scree, Label

### 3. Rock Contours
- **Contour Line**: Polyline (click points, Enter to finish)
- **Contour Fill**: Polygon (click 3+ points, Enter to close and fill)

### 4. Pitch Info
- **Grade** + **Length**: shown on canvas next to anchor dots
- **Description**: textarea, stored in JSON for watch info panel, NOT drawn on canvas

## Data Format

```json
{
  "name": "Salathe",
  "wall": "El Cap",
  "grade": "V",
  "pitches": 3,
  "width": 1000,
  "height": 3000,
  "anchors": [
    { "x": 75, "y": 1217, "grade": "IV", "length": "33m", "info": "Description text" }
  ],
  "route": [[75, 1217], [177, 1086], [157, 971]],
  "features": [
    { "type": "crack", "x": 251, "y": 723, "w": 9, "h": 120 },
    { "type": "arete", "x1": 100, "y1": 500, "x2": 200, "y2": 300 },
    { "type": "bolt", "x": 235, "y": 1320 },
    { "type": "contour", "points": [[140, 1400], [130, 1300]] },
    { "type": "contour_poly", "points": [[100, 500], [200, 480], [190, 600]] }
  ]
}
```

**Feature shapes:**
- Rect: `{type, x, y, w, h}` — axis-aware rendering
- Diagonal: `{type, x1, y1, x2, y2}` — any angle (arete)
- Point: `{type, x, y}` — label also has `text`
- Line: `{type, points[]}` — contour, contour_poly

## Scaling & Coordinate System

- **1 editor unit = 1 watch pixel**
- Watch display: 466×466 px circular
- Grid: major lines every 466 units (= 1 watch screen), minor every 116 units
- Default canvas: 1000×3000 (adjustable, or set by background image)

## Editor Features

### Selection & Editing
- **Select tool** (S key): Click, shift+click, or marquee drag to multi-select
- Mixed selection: features + route points selected together
- Drag to move all selected items
- Delete/Backspace removes selection
- Arrow keys nudge (1px, Shift+arrow = 10px)
- Ctrl+A selects all
- Double-click label to edit text, double-click anchor to focus grade input

### Canvas
- White/paper background (#f5f5f0) with grid
- Pan: Alt+drag or middle-click
- Zoom: scroll wheel
- Background image with 4-corner perspective transform (drag corners independently)

### Watch Preview
- 240px round preview, fixed 1:1 scale (240px = 466 world units)
- Renders exact same signs as editor canvas (shared drawFeatureEditor function)
- **Viewport overlay mode**: yellow circle on canvas shows watch visible area, follows mouse

### Import/Export
- Export JSON (modal + copy to clipboard)
- Download JSON (file download)
- Import JSON (paste or file picker)
- Load Background Image (with perspective corner handles)

### Undo/Redo
- Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y)
- 50-level undo stack
- Unsaved changes warning on tab close

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| S | Select tool |
| R | Route tool |
| A | Anchor tool |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+A | Select all |
| Enter | Finish line/polygon |
| Escape | Cancel / deselect |
| Delete | Remove selected |
| Arrows | Nudge (Shift = 10px) |

### Status Bar
- Current tool, cursor position, zoom level, selection count, data size (bytes/KB)

## Watch App Compatibility

The watch renderer (`suuntopo_canvas/t.html`) supports:
- Rect features via `rectToLine()` conversion (crack, overhang, ledge, chimney, etc.)
- Slab with native `strokeRect()` for rect format
- Diagonal arete with `{x1, y1, x2, y2}`
- Contour poly with filled polygon
- All point features (bolt, piton, rappel, chockstone, tree, grass, cross, label)
- Try-catch per feature to prevent one bad feature from killing the render

### Watch HUD Layout
- **Top center**: topo name (small, dim)
- **Bottom center**: pitch info "1/3 IV 33m" (grade-colored)
- **Right arc** (3 o'clock): progress dots along display edge, centered, growing up/down
