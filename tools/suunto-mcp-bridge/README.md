# SuuntoPlus MCP Bridge

A tiny VS Code extension that lets Claude Code drive the SuuntoPlus Editor extension. It runs an MCP server inside VS Code on `http://127.0.0.1:39317/mcp` (localhost only) while VS Code is open.

## Tools

| Tool | What it does |
|---|---|
| `build` | Builds an app (validate, minify, package) and returns the build log and the `.fea`/`.dev` files |
| `deploy` | Builds an app and installs it on the connected watch (USB); sideloads vanish on the next phone sync |
| `open_simulator` | Opens the SuuntoPlus Simulator panel on an app and starts capturing its log |
| `screenshot` | Runs the app fresh in a headless simulator and returns a PNG of the watch display ~2 s after start (`display: "q"` for the 466 px watches) |
| `sim_log` | Returns the latest lines of the simulator log |

`app` is either an absolute path or a folder name under `src/` (for example `suuntopo_canvas`).

The screenshot shows the app's start screen (after `wait_seconds`, default 2), not the state of the visible simulator panel. PNGs are also saved to `$TMPDIR/suunto-mcp-bridge/`. The first screenshot downloads a headless Chrome into the SuuntoPlus Editor's storage.

## Install

```bash
cd tools/suunto-mcp-bridge
npx @vscode/vsce package --allow-missing-repository --skip-license -o /tmp/suunto-mcp-bridge.vsix
"/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" --install-extension /tmp/suunto-mcp-bridge.vsix
```

Then reload the VS Code window. Claude Code picks the server up from the repo's `.mcp.json`.

## Caveat

The simulator hooks use internals of SuuntoPlus Editor 1.42.0 (the panel object returned by `suuntoplus.simulatorDefault` and its headless page; the editor's own `screenshot()` and its forwarding of view updates to the headless page are broken in 1.42.0, so the bridge drives the page itself and replaces that forwarding). Every tool result carries a warning when a different version is installed; after a Suunto update, check the tools still work.

On Apple silicon the SuuntoPlus Editor's watch-connection server is an Intel binary, so Rosetta must be installed (`softwareupdate --install-rosetta --agree-to-license`); without it the editor's activation stalls.
