# suuntopo_hwtest

**Status:** smallest possible test app. Purpose served — kept as a reference for the simplest viable SuuntoPlus app shape.

The first hardware test on the path to `suuntopo_canvas`. Strip everything down to: one hardcoded topo, one canvas, three buttons, and confirm the watch can render and navigate it at all.

## What it tests

- Canvas vector drawing of all the topo features (`slab`, `tree`, `cross`, `crack`, `overhang`, `ledge`, `rappel`) actually works on real hardware.
- Up / Down / Next button events arrive and update the active anchor.
- The single output variable `cnt` is enough to drive a redraw via `$.subscribe(...)` from the template.
- Auto-pan: the canvas re-centers on the selected anchor each time it changes.

## What it does not have

- No selector — the Salathe topo is hardcoded in `t.html`.
- No info panel.
- No localStorage / settings sync.
- No grade coloring.
- No HUD beyond the topo name and a `current/total grade length` line.
- No long-press handling, no zoom control.

## Controls

| Button | Effect |
|---|---|
| Up | next anchor (index `cur++`, capped at 2) |
| Down | previous anchor (`cur--`, floored at 0) |
| Next | wired but unused |

## Why it is the way it is

This was the initial validation step before building the full app. If this doesn't render on the watch, nothing further will. The next iteration (`suuntopo_hwtest2`) layered the multi-output subscribe pattern on top of the same drawing code.
