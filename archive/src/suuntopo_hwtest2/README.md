# suuntopo_hwtest2

**Status:** test app, purpose served.

The second hardware test. Same Salathe topo and same drawing code as `suuntopo_hwtest`, but the state-to-template communication is restructured to mirror what the full `suuntopo_canvas` app would need.

## What it tests vs. hwtest1

`suuntopo_hwtest` only had one output variable (`cnt`). The full app needs five — one for each piece of state the template has to react to: `appMode`, `selectorIdx`, `topoIdx`, `anchorIdx`, `zoomLvl`. This test rewires the same single-anchor navigation to write to all five outputs and subscribe to all five from the template, to confirm:

- Multi-output `$.subscribe(...)` works on hardware (the simulator handles it fine; the watch is the real question).
- Setting an output to the same value it already had does **not** trigger a redraw — important context for `suuntopo_hwtest3`, where this caused state changes to silently drop.
- The five-output state-machine pattern is sound before adding selector / info / sync logic on top.

## What it has

- Hardcoded Salathe topo (same as hwtest1).
- Up / Down navigate `anchorIdx` between the three anchors.
- All five output variables are written on every event, even though only `anchorIdx` actually changes.
- All five are subscribed in `t.html`, but only `anchorIdx` drives anything visible.

## What it still does not have

- No selector. Even though `selectorIdx` is wired through, there is no selector view.
- No info panel.
- No localStorage / settings sync.
- No mode switching with the crown button.

## Controls

| Button | Effect |
|---|---|
| Up | next anchor |
| Down | previous anchor |

## Outcome

Multi-output subscribe works on the watch. Same-value-no-redraw confirmed — addressed in `suuntopo_hwtest3` with a counter trick on the `appMode` output.
