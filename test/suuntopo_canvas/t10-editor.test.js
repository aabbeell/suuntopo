// ABOUTME: T10-T11: the topo editor's STP1 encoder (src/topo_editor/stp1.js) round-trips through the watch parser, sorts belays,
// ABOUTME: sanitises text, counts UTF-8 bytes and enforces the slot and built-in limits; watch.js matches the watch app sources.

'use strict';
const assert = require('assert');
const path = require('path');
const vm = require('vm');
const h = require('./lib/harness');
const R = require('./lib/reference');

const EDITOR = path.join(h.ROOT, 'src/topo_editor');
const STP1 = require(path.join(EDITOR, 'stp1.js'));
const sync = require(path.join(EDITOR, 'sync-watch.js'));

// An editor project like the editor's state: anchors are coordinates on route points, in any order.
function project(order) {
  const route = [[150, 1500], [210, 1440], [225, 1330], [205, 1230], [240, 1120], [250, 1010], [200, 940], [170, 850]];
  const anchors = [
    { x: 210, y: 1440, grade: '', length: '', info: '' },
    { x: 205, y: 1230, grade: '4c', length: '25m', info: 'Slab | easy' },
    { x: 250, y: 1010, grade: '5b', length: '30', info: 'Crack' },
    { x: 170, y: 850, grade: '6a+', length: '35 m', info: 'Roof ~ traverse', band: '4' }
  ];
  return {
    name: 'Ősz test', wall: 'Wall', grade: '6a+', gradeSystem: 'french', approach: 'Walk 20 min', descent: 'Rappel',
    route, anchors: (order || [0, 1, 2, 3]).map((i) => anchors[i]),
    features: [
      { type: 'crack', x: 255, y: 1040, w: 9, h: 180 },
      { type: 'slab', x: 180, y: 1270, w: 70, h: 140 },
      { type: 'arete', x1: 330, y1: 1480, x2: 320, y2: 700 },
      { type: 'bolt', x: 228, y: 1440 },
      { type: 'bolt', x: 223, y: 1232 },
      { type: 'contour', points: [[95, 1520], [130, 1250], [120, 1000]] },
      { type: 'label', x: 100, y: 100, text: 'note' }
    ]
  };
}

module.exports = (test) => {
  test('T10 the encoder output parses on the watch and decodes to the project (route order, pitch data, terrain)', () => {
    const r = STP1.encode(project(), {});
    assert.deepStrictEqual(r.errors, []);
    const p = h.parse(r.text);
    assert.strictEqual(p.code, 0, 'watch parse error E' + p.code);
    const d = R.decode(r.text);
    assert.deepStrictEqual(R.fromParsed(r.text, p.W, p.R), d);
    assert.strictEqual(d.name, 'Ősz test');
    assert.deepStrictEqual(d.stances, [1, 3, 5, 7]);
    assert.deepStrictEqual(d.pitches.map((x) => [x.band, x.grade, x.len, x.info]), [[1, '4c', 25, 'Slab / easy'], [2, '5b', 30, 'Crack'], [4, '6a+', 35, 'Roof ~ traverse']]);
    assert.deepStrictEqual(d.features.map((f) => R.FEATURE_LETTERS[f.type]), ['k', 's', 'a', 'b', 'b', 'c']);
    assert.deepStrictEqual(d.features[0].points, [[260, 1040], [260, 1220]], 'a tall crack rect becomes a vertical line');
    assert.strictEqual(d.features[1].points.length, 4, 'a slab rect becomes a closed outline');
    assert(r.warnings.some((w) => /Labels/.test(w)));
  });

  test('T10 clicking belays in any order gives the same topo line', () => {
    const a = STP1.encode(project([0, 1, 2, 3]), {}).text;
    for (const order of [[3, 2, 1, 0], [2, 0, 3, 1], [1, 3, 0, 2]]) assert.strictEqual(STP1.encode(project(order), {}).text, a);
  });

  test('T10 text is sanitised: no record separator, no control characters, NFC; built-in files avoid quotes', () => {
    assert.strictEqual(STP1.clean(' a|b\u0007c '), 'a/b c');
    assert.strictEqual(STP1.clean('Ösz'), 'Ösz');
    assert.strictEqual(STP1.clean("it's \\x", true), 'it’s /x');
    const p = project();
    p.grade = 'VI~VII';
    assert(/\|GVI-VII\|/.test(STP1.encode(p, {}).text), 'tilde in a grade');
  });

  // Review round 2: the watch's setText reads markup and entities, and its parser rejects '<' and '&' (T2).
  test('T10 text with markup characters is sanitised so the watch shows it as written and parses it', () => {
    assert.strictEqual(STP1.clean('R&D <b>Wall</b> > 5c'), 'R+D \u2039b>Wall\u2039/b> > 5c');
    const p = project();
    p.name = 'R&D <b>Wall</b>';
    p.wall = 'Sun & Moon';
    p.grade = '<6a';
    p.approach = 'Grade <6a then &amp; easier > 5c';
    p.descent = '<i>Walk</i> off';
    p.anchors[1].grade = '<5a';
    p.anchors[1].info = 'Cams & nuts';
    const r = STP1.encode(p, {});
    assert.deepStrictEqual(r.errors, []);
    assert(!/[<&]/.test(r.text), r.text);
    assert.strictEqual(h.parse(r.text).code, 0, 'the sanitised line parses on the watch');
  });

  // Review round 2: the watch draws a patterned piece longer than two tile widths plain (SPEC §7); the editor says so.
  test('T10 a crack or roof piece too long for its pattern on the zoomed-in Map gets a warning', () => {
    const p = project();
    assert(!STP1.encode(p, {}).warnings.some((w) => /plain line/.test(w)), 'the 180-unit crack is short enough');
    p.features.push({ type: 'crack', x: 400, y: 200, w: 8, h: 467 });
    assert(STP1.encode(p, {}).warnings.some((w) => /plain line/.test(w)));
    const q = project();
    q.features.push({ type: 'arete', x1: 400, y1: 100, x2: 400, y2: 900 });
    assert(!STP1.encode(q, {}).warnings.some((w) => /plain line/.test(w)), 'a plain line type has no pattern to lose');
  });

  test('T10 the byte counter is UTF-8; the slot stops at 1500 B and a built-in file at 3500 B', () => {
    assert.strictEqual(STP1.utf8Bytes('Ősz'), 4);
    const p = project();
    // A contour of 300 points adds about 2 KB: too much for the slot, fine for a built-in file.
    p.features.push({ type: 'contour', points: Array.from({ length: 300 }, (x, i) => [100 + 37 * (i % 9), 200 + 11 * i]) });
    const r = STP1.encode(p, {});
    assert(r.bytes > 1500 && r.bytes < 3500, 'test topo size ' + r.bytes);
    assert(r.errors.some((e) => /1500/.test(e)), 'slot limit enforced');
    assert.deepStrictEqual(STP1.encode(p, { builtin: true }).errors, [], 'fits as a built-in file');
    assert.strictEqual(r.bytes, Buffer.byteLength(r.text));
  });

  test('T10 limits match the watch parser (name, belays, route points, pitch text)', () => {
    const p = project();
    p.name = 'n'.repeat(33);
    assert(STP1.encode(p, {}).errors.some((e) => /E2/.test(e)));
    const q = project();
    q.anchors = q.anchors.slice(0, 1);
    assert(STP1.encode(q, {}).errors.some((e) => /E4/.test(e)));
    const t = project();
    t.anchors[2].info = 'i'.repeat(201);
    assert(STP1.encode(t, {}).errors.some((e) => /E5/.test(e)));
    assert.strictEqual(h.parse(STP1.encode(t, {}).text).code, 5, 'the watch agrees');
  });

  test('T10 grade bands follow the mapping table of each grade system', () => {
    const cases = [['IV+', 'uiaa', 1], ['V-', 'uiaa', 2], ['VI-', 'uiaa', 2], ['VI', 'uiaa', 3], ['VII', 'uiaa', 3], ['VII+', 'uiaa', 4],
      ['4c', 'french', 1], ['5a', 'french', 2], ['5c', 'french', 2], ['6a', 'french', 3], ['6b', 'french', 3], ['6b+', 'french', 4],
      ['6a/6b', 'french', 3], ['5.6', 'yds', 1], ['5.9', 'yds', 2], ['5.10', 'yds', 3], ['5.10d', 'yds', 3], ['5.11a', 'yds', 4],
      ['E1 5b', 'other', 0], ['', 'french', 0], ['?', 'uiaa', 0]];
    for (const [g, s, b] of cases) assert.strictEqual(STP1.gradeBand(g, s), b, g + ' ' + s);
  });

  test('T10 a built-in file is one function returning the topo line, loadable like ext4.js-ext7.js', () => {
    const r = STP1.encode(project(), { builtin: true });
    const file = STP1.builtinFile(r.text, 'Test');
    assert(/^\/\/ ABOUTME: /.test(file.split('\n')[0]) && /^\/\/ ABOUTME: /.test(file.split('\n')[1]));
    const fn = vm.runInNewContext('(' + file + ')');
    assert.strictEqual(typeof fn, 'function');
    assert.strictEqual(fn(), r.text);
  });

  test('T11 watch.js is generated from the current watch app sources and parses like the app', () => {
    const fs = require('fs');
    assert.strictEqual(fs.readFileSync(sync.OUT, 'utf8'), sync.generate(), 'run node src/topo_editor/sync-watch.js');
    const WATCH = vm.runInNewContext(fs.readFileSync(sync.OUT, 'utf8') + '\nWATCH;', { Math, Float32Array, Uint8Array, String });
    for (const f of ['demo.stp', 'walk.stp', 'features.stp']) {
      const W = new Float32Array(644);
      const Rr = new Float32Array(200);
      assert.strictEqual(WATCH.parseTopo(h.fixture(f), W, Rr), 0, f);
      const p = h.parse(h.fixture(f));
      assert.deepStrictEqual(Array.from(W.slice(0, p.R[3])), Array.from(p.W.slice(0, p.R[3])), f);
    }
  });

  test('T11 the editor preview draws through the watch renderer within the tile budget', () => {
    const fs = require('fs');
    const WATCH = vm.runInNewContext(fs.readFileSync(sync.OUT, 'utf8') + '\nWATCH;', { Math, Float32Array, Uint8Array, String });
    const p = h.parse(h.fixture('demo.stp'));
    // Review round 3: the Map's bottom tile was shortened in t.html; the editor's preview tiles must follow it.
    const heights = h.TILE_HEIGHT.map((f) => Math.round(466 * f));
    const editor = fs.readFileSync(path.join(h.ROOT, 'src/topo_editor/index.html'), 'utf8');
    assert(editor.indexOf('heights = [' + heights.join(', ') + ']') >= 0, 'editor preview tile heights differ from t.html: ' + heights.join(', '));
    for (let ix = 0; ix <= 5; ix++) {
      WATCH.show(p.W, p.R[3], 64 + ix);
      for (let ti = 0; ti < 3; ti++) {
        const c = h.countingContext(466, heights[ti]);
        const units = WATCH.drawTile(c, ti);
        assert.strictEqual(units, c.units);
        assert(units <= 150);
      }
    }
  });
};
