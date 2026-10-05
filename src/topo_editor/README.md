# topo_editor

The Suuntopo topo editor. User guide, deployment and the watch preview are described in the [main README](../../README.md#topo-editor); tools, data formats and shortcuts in [EDITOR_SPEC.md](EDITOR_SPEC.md).

## Files

- `index.html`: the editor.
- `stp1.js`: the STP1 encoder (text sanitising, grade bands, limits, built-in file). It runs in the browser and in Node; test T10 uses it.
- `watch.js`: **generated**; do not edit. The watch app's renderer (from `t.html`) and parser (`ext1.js`, `ext9.js`). Regenerate with `node src/topo_editor/sync-watch.js`.
- `sync-watch.js`: the generator.
- `topo_signs/`: reference images of the symbol palette (not deployed).
