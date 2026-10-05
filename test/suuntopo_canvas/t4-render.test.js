// ABOUTME: T4: canvas budget of the shipped renderer. Every fixture and built-in topo, at every position, in Map and whole-topo
// ABOUTME: views on q, o and n, stays within 150 units and 20 path ops per tile and draws the current pitch where visible.

'use strict';
const assert = require('assert');
const h = require('./lib/harness');
const { FIXTURE_NAMES, builtins } = require('./t1-codec.test.js');

const SOURCES = () => FIXTURE_NAMES.map((f) => [f, h.fixture(f)]).concat(builtins());

// A template on display d holding topo s (as if fully streamed).
function holding(s, d) {
  const p = h.parse(s);
  assert.strictEqual(p.code, 0);
  const t = h.loadTemplate(d);
  t.activate();
  h.feed(t, p.W, p.R[3], p.R[2], 0);
  assert.strictEqual(t.ctx.ready, 2, 'stream did not complete');
  return { t, n: p.R[1], p };
}

// Whether route vertices i0..i1 come within the tile in screen space.
function runVisible(c, i0, i1, tH) {
  for (let i = i0; i < i1; i++) {
    const a = c.wd(c.oR + i);
    const b = c.wd(c.oR + i + 1);
    const x0 = Math.floor(a / 4096) * c.sz + c.ox;
    const y0 = (a % 4096) * c.sz + c.oy;
    const x1 = Math.floor(b / 4096) * c.sz + c.ox;
    const y1 = (b % 4096) * c.sz + c.oy;
    if (Math.max(x0, x1) >= 0 && Math.min(x0, x1) <= c.tW && Math.max(y0, y1) >= 0 && Math.min(y0, y1) <= tH) return true;
  }
  return false;
}

function checkTiles(t, label, stats) {
  const c = t.r;
  for (let ti = 0; ti < 3; ti++) {
    const k = t.drawTile(ti);
    const where = label + ' tile ' + ti;
    assert(k.units <= 150, where + ': ' + k.units + ' units');
    assert(k.maxPathOps <= 20, where + ': ' + k.maxPathOps + ' ops in one path');
    assert.strictEqual(k.reported, k.units, where + ': renderer accounting differs from the counted calls');
    // Review round 2: arc and fill costs on the Race S are unmeasured, so frames use strokes and lines only.
    assert.strictEqual(k.arcs, 0, where + ': arc in a frame');
    assert.strictEqual(k.fills, 0, where + ': fill in a frame');
    for (const col of k.colours) assert(/^#[0-9A-F]{6}$/.test(col), where + ': colour ' + col);
    // Review round 3: no shipped or fixture topo reaches the per-tile cap on patterned length, so none loses a pattern to it.
    assert(c.steps <= 8000, where + ': patterned length ' + Math.round(c.steps) + ' reached the cap');
    stats.max = Math.max(stats.max, k.units);
    if (!c.drawMode) continue;
    const n = c.nB - 1;
    if (c.hl >= 1 && c.hl <= n && runVisible(c, c.stance(c.hl - 1), c.stance(c.hl), k.height)) {
      assert(k.segments.some((s) => s[4] === c.C_CUR), where + ': current pitch not drawn');
    }
    if (c.skipped) stats.dropped++;
  }
}

module.exports = (test) => {
  test('T4 every topo x position x Map/whole view x q/o/n stays within the tile budget', () => {
    const stats = { max: 0, dropped: 0 };
    for (const [name, s] of SOURCES()) {
      for (const d of ['q', 'o', 'n']) {
        const { t, n } = holding(s, d);
        for (let ix = 0; ix <= n + 1; ix++) {
          t.deliver('ms', 64 + ix);
          checkTiles(t, name + ' ' + d + ' map ' + ix, stats);
          t.deliver('ms', 128 + ix);
          checkTiles(t, name + ' ' + d + ' whole ' + ix, stats);
        }
      }
    }
    assert(stats.max <= 150);
  });

  test('T4 the stress topo drops terrain somewhere and still keeps every tile within budget', () => {
    const stats = { max: 0, dropped: 0 };
    for (const d of ['q', 'o', 'n']) {
      const { t, n } = holding(h.fixture('stress.stp'), d);
      for (let ix = 0; ix <= n + 1; ix++) {
        t.deliver('ms', 64 + ix);
        checkTiles(t, 'stress ' + d + ' ' + ix, stats);
      }
    }
    assert(stats.dropped > 0, 'no terrain feature was ever dropped');
    assert(stats.max <= 150);
  });

  test('T4 no drawing state, or a topo whose route has not arrived, draws only the black background (2 units)', () => {
    const { t } = holding(h.fixture('demo.stp'), 'q');
    t.deliver('ms', 0);
    for (let ti = 0; ti < 3; ti++) assert.strictEqual(t.drawTile(ti).units, 2);
    const fresh = h.loadTemplate('q');
    fresh.activate();
    fresh.deliver('mh', 1234);
    fresh.deliver('ms', 64);
    for (let ti = 0; ti < 3; ti++) assert.strictEqual(fresh.drawTile(ti).units, 2);
  });

  test('T4 the renderer never uses canvas text, strokeRect, closePath or transforms', () => {
    // The counting context throws on any of them.
    for (const d of ['q', 'o', 'n']) {
      const { t } = holding(h.fixture('features.stp'), d);
      for (let ix = 0; ix <= 4; ix++) {
        t.deliver('ms', 64 + ix);
        for (let ti = 0; ti < 3; ti++) t.drawTile(ti);
      }
    }
  });

  test('T4 point glyphs are skipped below zoom 0.6 and drawn when zoomed in', () => {
    // Glyph strokes are the only 2.5 px #D9D9D9 lines in the demo besides the arete (3 px).
    const glyphs = (t) => {
      let n = 0;
      for (let ti = 0; ti < 3; ti++) n += t.drawTile(ti).segments.filter((s) => s[4] === '#D9D9D9' && s[5] === 2.5).length;
      return n;
    };
    const { t } = holding(h.fixture('demo.stp'), 'q');
    t.deliver('ms', 128);
    assert(t.ctx.camZ < 0.6, 'whole-topo view should be zoomed out');
    assert.strictEqual(glyphs(t), 0);
    let zoomed = 0;
    for (let ix = 1; ix <= 4; ix++) {
      t.deliver('ms', 64 + ix);
      assert(t.ctx.camZ >= 0.6);
      zoomed += glyphs(t);
    }
    assert(zoomed > 0, 'no glyph drawn when zoomed in');
  });

  test('T4 the route appears once its chunks are in; terrain waits for the whole topo; the loading line goes away', () => {
    const p = h.parse(h.fixture('stress.stp'));
    const t = h.loadTemplate('q');
    t.activate();
    t.deliver('mh', p.R[2]);
    t.deliver('ms', 65);
    assert.strictEqual(t.screen.vis['#ld'], 'VISIBLE');
    const K = Math.ceil(p.R[3] / 14);
    const levels = [];
    for (let k = 0; k < K; k++) {
      const words = [];
      for (let i = 0; i < 14; i++) words.push(p.W[k * 14 + i]);
      h.deliverChunk(t, k, words, h.chunkCheck(p.R[2], k, words));
      levels.push(t.ctx.ready);
    }
    assert(levels.indexOf(1) >= 0, 'never route-only: ' + levels.join(','));
    assert.strictEqual(levels[levels.length - 1], 2);
    assert.strictEqual(t.screen.vis['#ld'], 'HIDDEN', 'loading line hidden once complete');
    t.ctx.pend = 0;
    t.ctx.pull();
    assert.strictEqual(t.ctx.pend, 0, 'the template asks for nothing once the topo is complete');
  });

  // Review round 2: zig-zags and ticks stepped along whole segments at screen scale, so a valid slot topo with a few long
  // cracks or roofs made one paint hundreds of times slower than any shipped topo (1.1 million vis() calls), unseen by
  // the unit budget because the features were dropped anyway.
  test('T4 long decorated segments keep the work per paint bounded (vis and op calls), on q, o and n', () => {
    const slot = (letter) => {
      let s = 'STP1|NZig|R2000,2000,0,-20,0,-20|B0,1,2|P1~4a~10~|P1~4a~10~|F' + letter + '0,0';
      while (s.length < 1475) s += ',4095,4095,-4095,-4095';
      return s;
    };
    for (const letter of ['k', 'r', 'o', 'p']) {
      const s = slot(letter);
      assert(Buffer.byteLength(s) <= 1500);
      for (const d of ['q', 'o', 'n']) {
        const { t } = holding(s, d);
        t.deliver('ms', 65);
        assert(t.ctx.camZ >= 0.6, 'decorations are on at this zoom');
        const calls = { vis: 0, op: 0 };
        const vis = t.r.vis;
        const op = t.r.op;
        t.r.vis = function () { calls.vis++; return vis.apply(null, arguments); };
        t.r.op = function () { calls.op++; return op.apply(null, arguments); };
        for (let ti = 0; ti < 3; ti++) t.drawTile(ti);
        assert(calls.vis > 0 && calls.op > 0, letter + ' ' + d + ': the counters did not reach the renderer');
        assert(calls.vis + calls.op <= 20000, letter + ' ' + d + ': ' + calls.vis + ' vis() and ' + calls.op + ' op() calls in one paint');
      }
    }
  });

  // Review round 3: the bound above is per segment. A crack segment shorter than two tile widths whose bounding box nears
  // a tile while its line misses it ran all its zig-zag steps without spending a budget unit, so a 1,500-byte slot of 159
  // such segments made 22,000-44,000 calls per paint. The patterned length is now capped per tile as well.
  test('T4 short crack segments that miss the tile keep the work per paint bounded, on q, o and n', () => {
    const head = 'STP1|NZig|R2000,2000,0,-20,0,-20|B0,1,2|P1~4a~10~|P1~4a~10~';
    const probe = holding(head, 'q').t;
    probe.deliver('ms', 65);
    const c = probe.ctx;
    // World point of screen point (X, Y) of tile 0 on q.
    const world = (X, Y) => [Math.round((X - 233) / c.camZ + c.camX), Math.round((Y + Math.round(466 * 0.16) - 233) / c.camZ + c.camY)];
    // A to B passes outside the tile's top-right corner while their bounding box overlaps it; the second slot starts with
    // a visible point, so the feature also gets drawn.
    const a = world(600, 60);
    const b = world(300, -400);
    for (const start of ['', '2100,1960,']) {
      let s = head + '|Fk' + (start ? start + (a[0] - 2100) + ',' + (a[1] - 1960) : a[0] + ',' + a[1]);
      for (let sign = 1; Buffer.byteLength(s) + (',' + (b[0] - a[0]) + ',' + (b[1] - a[1])).length <= 1500; sign = -sign) {
        s += ',' + sign * (b[0] - a[0]) + ',' + sign * (b[1] - a[1]);
      }
      for (const d of ['q', 'o', 'n']) {
        const { t } = holding(s, d);
        t.deliver('ms', 65);
        assert(t.ctx.camZ >= 0.6, 'decorations are on at this zoom');
        const calls = { vis: 0, op: 0 };
        const vis = t.r.vis;
        const op = t.r.op;
        t.r.vis = function () { calls.vis++; return vis.apply(null, arguments); };
        t.r.op = function () { calls.op++; return op.apply(null, arguments); };
        for (let ti = 0; ti < 3; ti++) assert(t.drawTile(ti).units <= 150);
        assert(calls.vis > 0 && calls.op > 0, d + ': the counters did not reach the renderer');
        assert(calls.vis + calls.op <= 20000, d + ' ' + (start ? 'visible start' : 'no visible point') + ': ' + calls.vis + ' vis() and ' + calls.op + ' op() calls in one paint');
      }
    }
  });

  test('T4 a decorated segment up to two tile widths long keeps its pattern (demo crack and roof on the Map)', () => {
    const { t } = holding(h.fixture('demo.stp'), 'q');
    const p = h.parse(h.fixture('demo.stp'));
    let pattern = 0;
    for (let ix = 1; ix <= p.R[1]; ix++) {
      t.deliver('ms', 64 + ix);
      // Zig-zag and tick strokes are the short terrain-coloured segments.
      for (let ti = 0; ti < 3; ti++) {
        pattern += t.drawTile(ti).segments.filter((g) => g[4] === t.r.C_TER && Math.hypot(g[2] - g[0], g[3] - g[1]) < 12).length;
      }
    }
    assert(pattern > 50, 'only ' + pattern + ' pattern strokes');
  });

  // Review round 2: #616161 dim terrain was about 3.4:1 against black on q, too faint for a glance in daylight. Terrain
  // keeps 4.5:1; done pitches are dimmer on purpose and keep 3:1 (SPEC §5.7).
  test('T4 drawing colours on q keep their contrast against the black background (terrain 4.5:1, the rest 3:1)', () => {
    const c = h.loadTemplate('q').r;
    const lum = (hex) => {
      const ch = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
      return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    };
    for (const name of ['C_TER', 'C_DIM', 'C_GLY', 'C_VEG', 'C_NEXT', 'C_CUR', 'C_DONE', 'C_WALK']) {
      const ratio = (lum(c[name]) + 0.05) / 0.05;
      assert(ratio >= (['C_TER', 'C_DIM', 'C_GLY', 'C_VEG'].indexOf(name) >= 0 ? 4.5 : 3), name + ' ' + c[name] + ' is ' + ratio.toFixed(1) + ':1');
    }
  });

  // Round 4 (memory): every function gets an automatic prototype object (about 50 B est32); no template function is a
  // constructor, so each drops it at load, in the template's scope or in the renderer's.
  test('T4 no template function keeps its automatic prototype', () => {
    const t = h.loadTemplate('q');
    const script = h.attribute(h.templateSource('q'), 'onLoad');
    const names = [...script.matchAll(/\bvar ([A-Za-z_$][\w$]*) = \(?function\b/g)].map((m) => m[1]);
    assert(names.length >= 23, 'found ' + names.join(' '));
    for (const name of names) {
      // makeRenderer runs once and is dropped with its prototype, so its variable holds null.
      if (name === 'makeRenderer') {
        assert.strictEqual(t.r[name], null, 'makeRenderer is kept after use');
        continue;
      }
      assert.strictEqual(typeof t.r[name], 'function', name);
      assert.strictEqual(t.r[name].prototype, null, name + ' keeps its prototype');
    }
  });

  test('T4 a corrupt chunk (wrong check word) is ignored and a new topo hash resets the buffer', () => {
    const p = h.parse(h.fixture('demo.stp'));
    const t = h.loadTemplate('q');
    t.activate();
    t.deliver('mh', p.R[2]);
    h.deliverChunk(t, 0, Array.from(p.W.slice(0, 14)), 12345);
    assert.strictEqual(t.ctx.nGot, 0);
    h.feed(t, p.W, p.R[3], p.R[2], 64);
    assert.strictEqual(t.ctx.ready, 2);
    t.deliver('mh', 777);
    assert.strictEqual(t.ctx.ready, 0);
    assert.strictEqual(t.ctx.nGot, 0);
  });
};
