# Suuntopo: hardware test results

This is the form for the hardware checklist in `SPEC.md` §16c. Fill one row per item; the steps and the pass conditions are in the spec. The formal hw-test package has not been run yet; the informal runs of 2026-10-04 are recorded below the table.

**Release gates.** H1, H2, H8 and H9 must pass before any store upload, and before the store listing says the app was tested on a watch. A failed gate blocks the release.

## Setup

| Field | Value |
|---|---|
| Date | |
| Watch and firmware | Race S, |
| Package | `builds/suuntopo_canvas/v1.0/hw-test/suunto01-q-en.fea` (slot: 12-pitch, 1,500-byte topo; lap advance stored as the integer 1) |
| Other SuuntoPlus app in the sport mode (H9) | |
| Phone disconnected (sync wipes sideloaded apps) | yes / no |

## Results

| # | Gate | Result (pass / fail / not run) | Notes, delays, photos |
|---|---|---|---|
| H1 | **yes** | not run | If the drawing never appears: did "Loading NN%" appear? Does the slot card show E9 for this known-good topo (parser files failed to load)? |
| H1b | | not run | |
| H2 | **yes** | not run | Which button laps? |
| H3 | | not run | Delay from hold to new text, and to new drawing; does "Loading" come back after switching displays? |
| H4 | | not run | |
| H5 | | not run | Belay dots and the target ring (white under yellow): round, or square/flat? Any black tile? |
| H6 | | not run | |
| H7 | | not run | |
| H8 | **yes** | not run | Laps on the app screen: does the drawing follow each one? Does another topo load after the laps? |
| H9 | **yes** | not run | Include 30 quick holds on the list and 5 laps (round 2). Copy every `JsTotMem`, `relMemCb`, `ReleaseMem`, `JSalloc` and `WBMAIN pool` line |
| H10 | | not run | |
| H11 | | not run | Pitch logged and summary in the second exercise before the first hold |
| H12 | | not run | |
| H13 | | not run | After store upload only |
| H14 | | not run | Last; the sync wipes the sideload |

## System events

Paste the relevant lines from Suunto Watch → View system events here, with the item number.

## Informal runs, 2026-10-04 (Race S, release build, not the hw-test package)

| Time | Setup | Result | Log evidence |
|---|---|---|---|
| 10:01 | v1.0 with 18 output subscriptions, Climbing mode | **Fail**: stuck at "Loading 0%"; long presses worked | `ERR WBMAIN : Too many sim. path-param calls`, `Output/d2 507`, `ERR DUKTAPE : WB:subs` |
| 10:52, 10:55 | Pull-stream build (3 subscriptions) in the same sport mode as VarioLink | **Fail (counts against H9)**: three thin lines, no reaction to presses; the watch unloaded both apps | `ERR APPLICATION : Zapp:relMemCb (exec:ui)`, `RelMem->unload` for variol01 and suunto01 |
| 11:21 | Pull-stream build alone in a Climbing mode, built-in demo topo | **Pass** (Abel: "works fine"): drawing loads, navigation works | No path-param, 507, relMem or JsTotMem lines between 11:05 and 11:59 |

So H1 passed informally on the demo topo (the full 1,500-byte slot is not yet tried), H2 and H8 are not run, and H9 failed with a second app of ours in the same mode. Until H9 passes, the listing must not claim a tested watch, and the store text could say to use Suuntopo as the only SuuntoPlus app in its sport mode.

