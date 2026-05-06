# Changelog

All notable changes to this project. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); each app is versioned independently via its `manifest.json`. Entries below are added by the `/build-suuntopo` skill after every build.

## [Unreleased]

## [Baseline] — 2026-05-06

Repository restructured for sharing. Every app's most recent build prior to this point is preserved under `builds/<app>/v<manifest-version>/`.

### Apps and their baseline versions

- `suuntopo_canvas` — **v0.3** — Climbing topo viewer with selector (canvas-vector rendering)
- `suuntopo_image` — **v0.2** — Image-based topo viewer (fallback rendering path)
- `suuntopo_hwtest` — **v0.1** — Topo HW test app
- `suuntopo_hwtest2` — **v0.1** — HW test 2
- `suuntopo_hwtest3` — **v0.1** — HW test 3 (selector + multi-subscribe + localStorage)
- `topo_editor` — unversioned — Browser-based visual topo editor

### Project structure

- Reorganized top level into `docs/`, `reference/`, `src/`, `builds/`
- Added `README.md`, this changelog, and the `/build-suuntopo` skill
