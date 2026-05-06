# SUUNTOPO

Interactive climbing topo viewer for Suunto watches (Race S, Race, Race 2, Vertical 2), built as a [SuuntoPlus Sports App](https://www.suunto.com/sports-apps/). Displays climbing route diagrams (topos) on the 466×466 px AMOLED screen, navigable between belay stations using physical buttons.

**Status:** Phase 2-3 — canvas watch app with topo selector, visual web editor, sync via `data.json`.

**Author:** O. Vitya

## Layout

```
SUUNTOPO/
├── docs/         Project planning: idea, implementation plans, test plans, hardware notes
├── reference/    SuuntoPlus platform reference (API docs, examples) — external material
├── src/          Source code for every watch app + the web editor
│   ├── suuntopo_canvas/     Primary canvas-vector topo viewer
│   ├── suuntopo_image/      Image-based topo viewer (fallback)
│   ├── suuntopo_hwtest/     Hardware test app v1
│   ├── suuntopo_hwtest2/    Hardware test app v2
│   ├── suuntopo_hwtest3/    Hardware test app v3 (selector + multi-subscribe + localStorage)
│   └── topo_editor/         Browser-based visual topo editor (single HTML file)
├── builds/       Versioned .fea / .zip build artifacts per app
├── CHANGELOG.md  Project-wide changelog, updated by the /build-suuntopo skill
└── CLAUDE.md     Repo instructions for Claude Code agents
```

## Building & deploying a watch app

Each `src/<app>/` directory is a SuuntoPlus app (manifest + template + main.js). Build and deploy via the **SuuntoPlus Editor** VS Code extension:

1. Open the folder in VS Code with the SuuntoPlus Editor extension installed.
2. Right-click the app folder in the SuuntoPlus side panel → **Build** (or use the command palette: `SuuntoPlus: Build SuuntoPlus App`).
3. The build produces six `.fea` files (one per display variant: `-l`, `-m`, `-n`, `-o`, `-q`, `-s`) plus a `.zip` package, alongside the source.
4. Right-click the app → **Deploy to Watch** (USB or Bluetooth).

Display ID **`-q`** corresponds to the 466×466 AMOLED (Race S, Vertical 2) — that is the primary target.

## Versioning a build

The `/build-suuntopo` skill (see `.claude/skills/build-suuntopo/SKILL.md`) automates the post-build workflow:

- Bumps the `version` in the app's `manifest.json`
- Moves the freshly built `.fea` / `.zip` artifacts into `builds/<app>/v<version>/`
- Generates a changelog entry by diffing source vs. the previous tagged version
- Optionally collects a tester feedback note
- Commits, tags `<app>-v<version>`, and pushes

Run `/build-suuntopo <app>` after building inside VS Code.

## Topo editor

`src/topo_editor/index.html` is a self-contained browser app for drawing climbing topos. Output is JSON that pastes directly into the watch app's `data.json` settings. See `src/topo_editor/EDITOR_SPEC.md` for the data format.

## Reference material

- `reference/suuntoplus_reference_docs.md` — full SuuntoPlus API reference (extracted from the Editor extension)
- `reference/suuntoplus_editor_commands.md` — every VS Code command exposed by the extension
- `reference/suunto_plus_examples/` — 13 official example apps
- Suunto developer forum: <https://forum.suunto.com/category/62/suunto-plus-development>

## Hardware constraints (short version)

- ES5 JavaScript only (no arrow functions, no `Date`, no `sessionStorage`)
- Max 2 images per app, max 64 colors per image (RGB, no alpha)
- Max 10 input resources, max 5 logged variables, max 15 apps installed at once
- Display: 466×466 circular, refresh capped around 10 Hz on hardware
- CSS on watch is much narrower than in the simulator — see `docs/suunto_development.md`

The simulator is more featureful than the watch. Always test on hardware before declaring a build done.
