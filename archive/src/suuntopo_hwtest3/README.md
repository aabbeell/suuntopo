# suuntopo_hwtest3

**Status:** test app, purpose served. The last validation step before `suuntopo_canvas` v0.3.

Full UX flow — selector, topo map, info panel — running on hardware, but with everything hardcoded. No localStorage, no settings sync. Used to confirm the three-mode state machine and the crown-based mode-switching feel right on the watch before layering settings sync on top.

## What it tests vs. hwtest2

`suuntopo_hwtest2` proved the multi-output subscribe pattern works. This iteration adds the actual UX:

- **Three view modes** (`appMode = 0/1/2` for selector / topo / info) with crown short-press cycling forward and crown long-press going back.
- **Selector view** rendered and navigable with up/down even though there is only one topo.
- **Info view** with a placeholder description.
- **`modeCounter` workaround.** When the same `appMode` value is written twice in a row (e.g. user goes selector → topo → selector → topo), `$.subscribe` does not fire on the second transition because the value did not change. This file works around it by encoding `output.appMode = appMode * 100 + modeCounter` and decoding on the template side. The full app inherits this pattern.

## What it has

- Single hardcoded Salathe topo.
- Selector → topo → info appMode flow with crown short / long press.
- Up/down navigation in selector and topo.
- All five output variables wired identically to `suuntopo_canvas` (one of them encoded with the counter trick).

## What it does not have

- No localStorage or settings sync — adding more topos requires editing `t.html` directly.
- No grade coloring, no HUD progress arc, no zoom — kept minimal so the test focused on the mode-switching mechanics.

## Controls

| Button | In selector | In topo | In info |
|---|---|---|---|
| Up | previous item | next anchor | next anchor |
| Down | next item | previous anchor | previous anchor |
| Crown (short) | enter topo | go to info | go to topo |
| Crown (long) | — | go to selector | go to topo |

## Outcome

Mode switching works on hardware once the same-value redraw issue is worked around with the counter encoding. The full `suuntopo_canvas` app is essentially this app plus settings sync, grade coloring, the info-panel content, the HUD progress arc, and zoom.
