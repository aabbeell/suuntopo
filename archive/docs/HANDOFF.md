# Suuntopo handoff (2026-10-04)

Handoff from the setup thread to the Suuntopo thread. Read with `tools/SHARED_RESOURCES.md` (rules for the shared VS Code bridge, the watch, and tool ownership) and `docs/suuntopo_canvas/SPEC.md` (binding decisions at the top; open questions in §18).

## State

- **App:** `src/suuntopo_canvas` v1.0, manifest name "Climbing Topo" (appId `climbi01`), author "O. Vitya". The editor is in `src/topo_editor`.
- **Design:** option B, chosen by Abel: one compact user slot (STP1 format, data.json under ~2 KB) plus built-in schematic topos loaded as ext files. Navigation uses long presses only, so pause, lap and display switching stay with the watch. Rendering is culled to stay within the Race S canvas budget.
- **Tests:** `node test/suuntopo_canvas/run.js` passes 102/102. sp-build is clean. Store package: `builds/suuntopo_canvas/v1.0/` and `store/suuntopo_canvas/listing.md`.
- **Memory (sp-mem, lowmem est32), after the round-4 memory pass, committed in cec672c:** 35.2 KB steady and 42.4 KB run peak by default; 37.5 KB steady and 51.9 KB run peak with a full slot plus the Fictional Wall; the reload scenario peaks at 67.9 KB. The estimated usable heap on a Race S is ~32 KB (range 25-40). The budget of 16 KB steady / 20 KB peak is not met. The profile (SPEC §8, §18 Q10 and Q16) lists the feature cuts and their savings: terrain capped at 163 points, a 15-pitch Wall, no glyphs or decorated lines (~29.5 KB), no terrain (~28 KB). The ~16 KB hwtest3 style means one compiled-in topo and no user slot.
- **On the watch:** installed over Bluetooth on 2026-10-04 (it went in as `suunto01`, because the Editor's appId mapping reused the old SuuntoPo id). **Not yet opened by Abel.**

## Decisions from Abel

- Memory: **option A**, test on the watch first and cut features only if it fails.
- Store name: **"Suuntopo"**. I flagged that "Suunto" in the name may be refused in store review; he kept it. Apply it with a "not affiliated with Suunto" line. Note that the appId becomes `suunto01`.
- Author **"O. Vitya"** on all apps.
- Still open: support email; FAQ and editor hosting (I suggested GitHub Pages from a small public repo; the editor URL must not contain "suunto"); SPEC §18 Q7 (rights to the Piccolo Fillar notes), Q8 (real routes as built-ins), Q13, Q14.

## Next steps

1. Watch test (take the watch lock): Abel opens Climbing Topo in a Climbing or Mountaineering mode, long-presses through pitches, opens built-ins from the Route list, and photographs anything clipped. Then read the log with `node tools/watch-log/watch-log.js <watch serial> --grep "suunto01|climbi|JsTot|relMem|JSalloc|Disable|oversize"`. Real canvas text renders differently from the simulator (seen on v0.3); the probe test also showed inline `<eval>` inside a text line breaking into its own block on the watch.
2. If it fails on memory, apply the cuts in SPEC §8 order and re-test.
3. Rename to Suuntopo, add the disclaimer, rebuild the store package.
4. Hosting for the editor and FAQ once Abel decides.

## Real-watch facts learned so far (all apps)

- Bluetooth deploy works (USB gives power only; the cable is suspected). The watch is unpaired from the phone app while we test. Re-pairing is Abel's call, and the next phone sync deletes every sideloaded app.
- Running two of our apps in one sport mode filled the JS heap (`JsTotMem 131072/133120`).
