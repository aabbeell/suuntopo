# Shared resources across the SuuntoPlus app threads

Three work threads (VarioLink, Air Temperature, Suuntopo) run on the same Mac. Some things exist only once. These rules keep the threads from breaking each other's work.

## What exists once, and who owns it

| Resource | Where | Owner thread | Rule for the other threads |
|---|---|---|---|
| VS Code window with the SuuntoPlus Editor and the MCP bridge | `127.0.0.1:39317` (bridge source: `SUUNTOPO/tools/suunto-mcp-bridge`) | Suuntopo | Use it freely: tool calls are queued one at a time. Never kill or restart the VS Code extension host; ask the Suuntopo thread. A restart drops the watch's Bluetooth link and any queued call for 10-20 s. |
| Simulator (one panel, one headless page) | inside that VS Code | shared | Fine to share through the queue. Use screenshot names prefixed with your app key. |
| The Race S on Bluetooth (unpaired from the phone; serial <watch serial>) | SDS server `ws://127.0.0.1:9801` | whoever holds the watch lock | Hold the lock for every `deploy` and every `watch-log` read (below). Never re-pair or unpair the watch, or touch Bluetooth settings, without Abel. |
| `SUUNTOPO/tools/` (sp-build, sp-mem, bridge, watch-log, safe-area) | SUUNTOPO repo | Suuntopo | Others use them read-only and request changes from the Suuntopo thread. |
| `SUUNTOPLUS-SENSORS/tools/` and `docs/research/` | sensors repo | VarioLink | Air Temperature uses them read-only and requests changes. |
| `SUUNTOPLUS-SENSORS` working copy | projects folder | VarioLink | See "Sensors repo" below. |
| `AIR-TEMPERATURE` working copy (repo aabbeell/air-temperature, app in `src/air_temperature`) | projects folder | Air Temperature | Deploy Air Temperature only from `src/air_temperature` (the app ID follows the folder path). |

## Watch lock

The watch can only take one install or log read at a time. Hold the lock **only while installing, uninstalling or reading the log**, and release it the moment that is done. Never hold it through Abel's tests: he tests all three apps together, so the newest build of every app must stay on the watch, and a thread queued behind a held lock keeps his fix off it. Tell the coordinator after each install so Abel gets one "ready to test" for all three.

```bash
# take it (atomic); if it fails, someone else holds it: read the owner file and wait
mkdir /tmp/suunto-watch.lock && echo "<thread name> $(date +%T)" > /tmp/suunto-watch.lock/owner
# ... deploy / uninstall / watch-log only ...
rm -rf /tmp/suunto-watch.lock   # release
```

**No duplicates on the watch (Abel, 2026-10-04).** A new build replaces the app already installed, in place, under the same app ID, so only one copy shows on the watch. The SuuntoPlus Editor's deploy assigns the app ID per source folder path: VarioLink deployed from a new scratch folder on 2026-10-04 and got variol02, a second "VarioLink" next to variol01. **Always deploy each app from the same folder path**, and before telling Abel an app is installed, check that the deploy log's `Plugin ....zip` line shows the app's usual ID (`variol01`, `airtem03`, `suunto01`). Never install a second copy Abel can't tell apart by name. If a separate variant is truly needed, give it a clearly different display name and remove it when the test is done.

A lock older than 30 minutes with no activity may be broken. Say so in your thread when you do it.

## Sensors repo (VarioLink; Air Temperature moved to its own repo on 2026-10-05)

- **Path ownership.** VarioLink owns `src/ble_vario`, `test/ble_vario`, `docs/ble_vario`, `store/ble_vario`, `builds/ble_vario` and the probe apps (`src/probe_*`, `docs/probe`). Air Temperature owns the same five folders for `ble_temperature`. VarioLink owns `tools/`, `docs/research/`, `CLAUDE.md` and `README.md`.
- **Commit only your paths:** `git add <your paths>` and `git commit -m ... -- <your paths>`. Never `git add -A`, `git stash`, `git checkout .` or `git reset` in this checkout.
- **Pushing:** plain `git push origin main`; work on `main` (single-user repo, as in SUUNTOPO). Do not `git pull --rebase`: the other thread's uncommitted files make it fail, and since every push comes from this one checkout the remote cannot run ahead. If a push is ever rejected, stop and ask in your thread rather than stashing.
- The index is shared too: the other thread may have files staged. Always commit with an explicit pathspec (`git commit -- <your paths>`) so you never commit its staged files.
- No separate worktrees. Both apps build through the same bridge and tools by absolute path, and iCloud plus several worktrees has caused trouble before.

## Memory facts every thread needs

- Race S: 2 SuuntoPlus apps per sport mode. With VarioLink v1.0 and Air Temperature v1.0 enabled together, the watch logged `WRN UI_FRAMEWORK : JsTotMem 131072/133120`, so the heap was practically full.
- Measure with `node SUUNTOPO/tools/sp-mem/sp-mem.js <appDir>` (lowmem est32 columns). Read the real watch with `node SUUNTOPO/tools/watch-log/watch-log.js <watch serial> --grep "JsTot|relMem|JSalloc|Disable"` while holding the watch lock.
- The watch caps simultaneous resource subscriptions ("path-param calls") per sport mode, shared by the mode's own data screens and every SuuntoPlus app in it. In a Climbing mode on 2026-10-04 Suuntopo v1.0 got 15 output subscriptions before the 16th failed (`ERR WBMAIN : Too many sim. path-param calls`, then `Zapp/0x1a/Output/d2 507` and `ERR DUKTAPE : WB:subs`); `$.subscribe` throws on refusal. Keep each template to a few subscriptions, wrap every `$.subscribe` in try/catch, and read bulk data with sequential `$.get` calls instead. Suuntopo now uses 3.
- Only main.js gets `{file_path}` substituted. An ext file that calls `evalFile('{file_path}/extN.js')` fails on the Race S (`ScriptingContext: opening {file_path}/ext10.js failed`, then `Zapp run evt 1` and the app is disabled), although the simulator allows it (Air Temperature, sensors repo a7bfc83). Load every ext file from main.js, or pass main.js's loader into the ext function as Suuntopo does (`ext(0)(..., ext, open)`).
- App IDs: The app ID is the first 6 letters of the manifest `name` (spaces, `-`, `.` and non-ASCII removed, lower-cased) plus a two-digit suffix (suunto-plus.js `getAppId`); the suffix is the first free counter for a new folder (VarioLink deployed from a new folder became variol02). The Editor keeps a folder-to-ID registry in `~/Library/Application Support/Code/User/globalStorage/suunto.suuntoplus-editor/apps.json` (entries with a directory and an id): a registered folder keeps its ID whatever the name; a new folder gets the first 6 letters of the name plus the first free counter. So "Suunto VarioLink", "Suunto AirTemp" and "Suuntopo" would all start with `suunto01` and replace each other on the watch. **Keep "Suunto" out of the first 6 letters of a name (e.g. "VarioLink for Suunto"), check the built ID is unique before every deploy, and always deploy from the same folder.**
- Runtime visibility: when you show or hide an element, set it on the element and on its contents in the same call pair: `setStyle('#id', 'visibility', V); setStyle('#id *', 'visibility', V)`. Showing only `'#id'` left the text invisible on the Race S (Air Temperature, 2026-10-04), while the simulator drew it. This applies to divs and spans alike, and to elements that start hidden in the template (style `visibility:hidden`). Source: SuuntoPlus Editor reference, section 'setStyle(target, propertyName, propertyValueExpression)' (`~/.vscode/extensions/suunto.suuntoplus-editor-1.42.0/developer-doc/reference.html`, around line 1399). Its example shows a div that starts with `visibility:hidden` via `setStyle('#feedback *', 'visibility', 'VISIBLE')`. Suuntopo ext10/ext11 already do both. (Watch confirmation pending.)
