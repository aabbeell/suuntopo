// ABOUTME: T9: main.js on its own. Start-up and saved-state restore, the stream it writes to the outputs, lap advance, storage
// ABOUTME: writes only on user actions, the logged pitch and the "Highest pitch" summary with its 30-tick hold rule.

'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const h = require('./lib/harness');

const plain = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
// The 12-pitch, 1,500-byte slot topo of the hardware-test package.
const hwSlot = () => JSON.parse(fs.readFileSync(path.join(h.FIXTURES, 'hw-data.json'), 'utf8')).topo0;

function boot(storage, display, opts) {
  const m = h.loadMain(display || 'q', storage, undefined, opts);
  m.ctx.onLoad(m.input, m.output);
  m.call = (name, arg) => plain(arg === undefined ? m.ctx[name](m.input, m.output) : m.ctx[name](m.input, m.output, arg));
  m.ticks = (n) => { for (let i = 0; i < n; i++) m.call('evaluate'); };
  m.S = () => Array.from(m.ctx.S);
  return m;
}

const hashOf = (s) => h.parse(s).R[2];
const builtin = (n) => h.mainContext('q', {}, h.newScreen()).ctx.evalFile('{file_path}/ext' + (n + 3) + '.js')();
// Stream id main.js gives topo t (0 slot, 1-4 built-in) with string s: content hash + 65536 * t.
const idOf = (s, t) => hashOf(s) + 65536 * t;

// Content hash of the STP1 parser (ext1.js), for building a topo with a chosen hash.
const contentHash = (s) => {
  let x = 0;
  for (let k = 0; k < s.length; k++) x = (x + s.charCodeAt(k) * (k % 31 + 1)) % 65521;
  return x || 1;
};

// A valid slot topo with the same content hash as s: walk.stp with its last pitch note replaced by 200 letters, chosen so
// that the letters' weighted sum makes up the difference (each position k adds charCode * (k % 31 + 1)).
function collidingWith(s) {
  const base = h.fixture('walk.stp');
  const at = base.indexOf('Wall.');
  const make = (codes) => base.substring(0, at) + String.fromCharCode.apply(null, codes) + base.substring(at + 5);
  const codes = new Array(200).fill(97);
  let d = (contentHash(s) - contentHash(make(codes)) + 65521) % 65521;
  const order = codes.map((c, i) => i).sort((x, y) => ((at + y) % 31) - ((at + x) % 31));
  for (const i of order) {
    const w = (at + i) % 31 + 1;
    const q = Math.min(25, Math.floor(d / w));
    codes[i] += q;
    d -= q * w;
  }
  if (d) throw new Error('no colliding topo found');
  return make(codes);
}

module.exports = (test) => {
  test('T9 an empty slot opens the demo (built-in 1) on its Route card; outputs carry its drawing state and stream id', () => {
    const m = boot({});
    const S = m.S();
    assert.deepStrictEqual([S[0], S[1], S[5], S[8], S[10]], [0, 0, 1, 6, -1], 'four built-ins and two Help cards');
    assert.strictEqual(m.output.ms, 128);
    assert.strictEqual(m.output.mh, idOf(builtin(1), 1));
    assert.strictEqual(m.output.pitch, 0);
  });

  test('T9 a valid slot is parsed and opened first; an invalid slot keeps its error code, the demo opens and its error card shows', () => {
    const ok = boot({ topo0: h.fixture('walk.stp') });
    assert.deepStrictEqual([ok.S()[5], ok.S()[8], ok.S()[10]], [0, 7, 0]);
    assert.strictEqual(ok.output.mh, idOf(h.fixture('walk.stp'), 0));
    const bad = boot({ topo0: 'STP1|Nx' });
    assert.deepStrictEqual([bad.S()[5], bad.S()[8], bad.S()[10]], [1, 7, 3]);
    assert.strictEqual(bad.S()[1], 0, 'the list opens on the error card, not on the demo');
    assert.strictEqual(bad.output.ms, 0, 'the error card draws nothing');
  });

  test('T9 a pasted topo with surrounding whitespace or a BOM parses like the clean one', () => {
    const clean = h.fixture('walk.stp');
    for (const s of [clean + ' ', clean + '\n', clean + '\r\n', ' ' + clean, '﻿' + clean, '\n' + clean + '\n\n']) {
      const m = boot({ topo0: s });
      assert.strictEqual(m.S()[10], 0, JSON.stringify(s.slice(-3)));
      assert.strictEqual(m.output.mh, idOf(clean, 0));
    }
    const one = boot({ topo0: h.fixture('one-pitch.stp') + '\n' });
    assert.strictEqual(one.S()[10], 0, 'a topo ending in a P record');
  });

  test('T9 a saved position restores view, topo and idx when the stream id matches; otherwise the Route card at idx 0', () => {
    const id = idOf(builtin(3), 3);
    const m = boot({ sv: '2,2,3,9,15,' + id });
    assert.deepStrictEqual([m.S()[0], m.S()[2], m.S()[5], m.S()[6]], [2, 9, 3, 15]);
    assert.strictEqual(m.output.ms, 0, 'Info draws nothing');
    const stale = boot({ sv: '2,1,3,9,15,' + (id + 1) });
    assert.deepStrictEqual([stale.S()[0], stale.S()[1], stale.S()[2], stale.S()[5]], [0, 2, 0, 3]);
    const top = boot({ sv: '2,1,2,2,1,' + idOf(builtin(2), 2) });
    assert.deepStrictEqual([top.S()[0], top.S()[2]], [1, 0], 'a route saved at Top (finished) starts again at Start');
    const past = boot({ sv: '2,1,2,9,1,' + idOf(builtin(2), 2) });
    assert.strictEqual(past.S()[2], 0, 'an idx past Top also starts at Start');
  });

  test('T9 corrupt or foreign saved states fall back to the default', () => {
    for (const sv of ['', 'x', '1,1,0,1,4,99', '2,1,0,1,4', '2,1,7,1,4,99', '2,1,0,1,4,99', '2,a,1,1,4,1']) {
      const m = boot({ sv });
      assert.strictEqual(m.S()[5], 1, sv);
      assert.strictEqual(m.S()[0], 0, sv);
    }
  });

  test('T9 dbg overrides sv (simulator fixtures)', () => {
    const m = boot({ sv: '2,1,2,1,1,' + idOf(builtin(2), 2), dbg: '2,2,1,3,4,' + idOf(builtin(1), 1) });
    assert.deepStrictEqual([m.S()[0], m.S()[2], m.S()[5]], [2, 3, 1]);
  });

  test('T9 a chunk request writes that chunk with a valid check word and the request to ck; evaluate writes no chunk', () => {
    const m = boot({});
    const W = m.ctx.W;
    const K = Math.ceil(m.ctx.R[3] / 14);
    m.ticks(3);
    assert.strictEqual(m.output.ck, undefined, 'nothing is streamed unasked');
    for (let k = K - 1; k >= 0; k--) {
      const n = (k + 7) * 64 + k;
      m.call('onEvent', 4000000 + n);
      assert.strictEqual(m.output.ck, n);
      const words = [];
      for (let j = 0; j < 14; j++) words.push(m.output['d' + j]);
      assert.deepStrictEqual(words, Array.from(W.slice(k * 14, k * 14 + 14)), 'chunk ' + k);
      assert.strictEqual(m.output.d14, h.chunkCheck(m.output.mh, k, words));
    }
    m.call('onEvent', 4000000 + 99 * 64 + K);
    assert.strictEqual(m.output.ck, 7 * 64, 'a chunk past the end is not written');
    const S = Array.from(m.S());
    m.call('onEvent', 4000000 + 64);
    assert.deepStrictEqual(Array.from(m.S()), S, 'a request does not touch the state');
  });

  test('T9 two topos with the same content hash get different stream ids', () => {
    const demo = builtin(1);
    const twin = collidingWith(demo);
    assert.strictEqual(hashOf(twin), hashOf(demo), 'test topo must collide');
    const m = boot({ topo0: twin });
    assert.strictEqual(m.S()[5], 0);
    const slotId = m.output.mh;
    m.call('onEvent', 1);
    m.call('onEvent', 3);
    assert.strictEqual(m.S()[5], 1, 'the demo is open');
    assert.notStrictEqual(m.output.mh, slotId);
    m.call('onEvent', 4000000 + 64);
    assert.strictEqual(m.output.d14, h.chunkCheck(m.output.mh, 0, Array.from(m.ctx.W.slice(0, 14))), 'the demo chunk carries the demo id');
    assert.notStrictEqual(m.output.d14, h.chunkCheck(slotId, 0, Array.from(m.ctx.W.slice(0, 14))));
  });

  test('T9 lap advances one pitch when lapAdv is On and stops at Top; Off, no open topo and autolap do nothing', () => {
    const m = boot({ lapAdv: '1', topo0: h.fixture('walk.stp') });
    m.call('onLap');
    assert.deepStrictEqual([m.S()[0], m.S()[2]], [1, 1]);
    m.call('onLap');
    m.call('onLap');
    m.call('onLap');
    assert.strictEqual(m.S()[2], 3, 'Top');
    assert.strictEqual(m.output.pitch, 2, 'Top logs as the last pitch');
    const off = boot({ lapAdv: '0' });
    off.call('onLap');
    assert.strictEqual(off.S()[2], 0);
    const auto = boot({ lapAdv: '1' });
    auto.call('onAutoLap');
    assert.strictEqual(auto.S()[2], 0);
  });

  test('T9 the lap setting is read as the integer index the phone app stores, and as a string', () => {
    for (const [v, on] of [[1, 1], ['1', 1], [0, 0], ['0', 0], [undefined, 0]]) {
      const storage = { topo0: h.fixture('walk.stp') };
      if (v !== undefined) storage.lapAdv = v;
      const m = boot(storage);
      assert.strictEqual(m.ctx.S[12], on, 'lapAdv ' + JSON.stringify(v));
      m.call('onLap');
      assert.strictEqual(m.S()[2], on, 'lap with lapAdv ' + JSON.stringify(v));
    }
  });

  test('T9 storage is written on long presses, pause and end when the position changed; never in evaluate or on a lap', () => {
    const m = boot({ lapAdv: '1' });
    m.ticks(50);
    assert.strictEqual(m.storage.sv, undefined, 'no write while ticking');
    m.call('onEvent', 1);
    assert(/^2,0,1,0,4,\d+$/.test(m.storage.sv), m.storage.sv);
    const writes = m.rec.writes;
    m.call('onEvent', 1);
    assert.strictEqual(m.rec.writes, writes, 'browsing the list does not rewrite the same position');
    m.call('onEvent', 2);
    m.call('onEvent', 3);
    assert(/^2,1,2,0,1,/.test(m.storage.sv), 'middle on card 2 opens built-in 2: ' + m.storage.sv);
    m.call('onLap');
    assert.strictEqual(m.ctx.S[2], 1);
    assert(/^2,1,2,0,1,/.test(m.storage.sv), 'a lap does not write');
    m.call('onExercisePause');
    assert(/^2,1,2,1,1,/.test(m.storage.sv), 'pause writes the lapped position');
    const w = m.rec.writes;
    m.call('onExercisePause');
    assert.strictEqual(m.rec.writes, w, 'an unchanged position is not written again');
    m.call('onLap');
    m.call('onExerciseEnd');
    assert(/^2,1,2,2,1,/.test(m.storage.sv), 'end writes a changed position: ' + m.storage.sv);
  });

  test('T9 a failing storage write leaves chunk requests answered', () => {
    const m = boot({}, 'q', { storageThrows: true });
    m.call('onEvent', 1);
    m.call('onEvent', 4000000 + 64 + 2);
    assert.strictEqual(m.output.ck, 66, 'a request is answered after a failed save');
  });

  test('T9 logged pitch: the idx on the slot topo and schematic built-ins, 0 on the fictional ones (demo, wall)', () => {
    const m = boot({ topo0: h.fixture('walk.stp') });
    m.call('onEvent', 3);
    m.call('onEvent', 1);
    assert.strictEqual(m.output.pitch, 1);
    // With an empty slot the list is demo, Jägerhorn, Piccolo Fillar, Fictional Wall, Help, Help.
    for (const [card, want] of [[0, 0], [1, 1], [2, 1], [3, 0]]) {
      const b = boot({});
      for (let i = 0; i < card; i++) b.call('onEvent', 1);
      b.call('onEvent', 3);
      b.call('onEvent', 1);
      assert.deepStrictEqual([b.ctx.S[5], b.ctx.S[2]], [card + 1, 1], 'built-in ' + (card + 1) + ' open at pitch 1');
      assert.strictEqual(b.output.pitch, want, 'built-in card ' + card);
    }
  });

  test('T9 best pitch needs 30 consecutive recorded ticks; look-ahead, pauses and the demo do not count', () => {
    const m = boot({ topo0: h.fixture('walk.stp') });
    m.call('onEvent', 3);
    m.call('onEvent', 1);
    m.ticks(40);
    assert.deepStrictEqual(m.call('getSummaryOutputs'), [], 'not recording before the exercise starts');
    m.call('onExerciseStart');
    m.ticks(29);
    assert.deepStrictEqual(m.call('getSummaryOutputs'), []);
    m.ticks(1);
    assert.deepStrictEqual(m.call('getSummaryOutputs'), [{ id: 'p', name: 'Highest pitch', format: 'Count_Twodigits', value: 1 }]);
    m.call('onEvent', 1);
    m.ticks(10);
    m.call('onEvent', 2);
    m.call('onExercisePause');
    m.ticks(50);
    m.call('onExerciseContinue');
    assert.strictEqual(m.call('getSummaryOutputs')[0].value, 1, 'look-ahead and pause gaps do not count');
    m.call('onEvent', 1);
    m.call('onEvent', 1);
    m.ticks(30);
    assert.strictEqual(m.call('getSummaryOutputs')[0].value, 2, 'Top counts as the last pitch');
    const demo = boot({});
    demo.call('onExerciseStart');
    demo.call('onEvent', 3);
    demo.call('onEvent', 1);
    demo.ticks(60);
    assert.deepStrictEqual(demo.call('getSummaryOutputs'), []);
  });

  // Review finding: the position saved at the end of one exercise was counted, and logged, in the next one.
  test('T9 a position restored from an earlier exercise is neither logged nor counted until a press or lap moves it', () => {
    const one = boot({ topo0: hwSlot() });
    one.call('onEvent', 3);
    for (let i = 0; i < 7; i++) one.call('onEvent', 1);
    one.call('onExerciseStart');
    one.ticks(31);
    assert.strictEqual(one.call('getSummaryOutputs')[0].value, 7);
    one.call('onExerciseEnd');
    const saved = Object.assign({}, one.storage, { lapAdv: '1' });
    const two = boot(saved);
    assert.deepStrictEqual([two.S()[0], two.S()[2]], [1, 7], 'the position is restored');
    two.call('onExerciseStart');
    two.call('onEvent', 3000000);
    assert.strictEqual(two.output.pitch, 0, 'the restored pitch is not logged');
    two.ticks(31);
    assert.deepStrictEqual(two.call('getSummaryOutputs'), [], 'nor counted');
    two.call('onLap');
    assert.strictEqual(two.output.pitch, 8, 'a lap moves on and logs');
    two.ticks(30);
    assert.strictEqual(two.call('getSummaryOutputs')[0].value, 8);
    const quiet = boot(saved);
    quiet.call('onExerciseStart');
    quiet.ticks(40);
    assert.deepStrictEqual(quiet.call('getSummaryOutputs'), [], 'never showing the app display counts nothing either');
  });

  // Review round 2: a loaded function and its automatic prototype refer to each other, which reference counting cannot
  // free; ext0.js uses main.js's loader instead of calling evalFile itself (the reference allows it from main.js only).
  // Round 4: ext0.js also gets main.js's open() and opens the start-up topo itself.
  test('T9 every file main.js loads comes back without a prototype; ext0.js gets main.js\'s loader and open()', () => {
    const m = h.loadMain('q', { topo0: h.fixture('walk.stp') });
    const evalFile = m.ctx.evalFile;
    const loaded = [];
    let loader = null;
    let opener = null;
    m.ctx.evalFile = (f) => {
      const fn = evalFile(f);
      loaded.push([f, fn]);
      if (/ext0\.js$/.test(f)) {
        return function (S, W, R, ls, ext, open) {
          loader = ext;
          opener = open;
          return fn.apply(null, arguments);
        };
      }
      return fn;
    };
    m.ctx.onLoad(m.input, m.output);
    assert.strictEqual(typeof loader, 'function', 'ext0.js got no loader');
    assert.strictEqual(opener, m.ctx.open, 'ext0.js got no open()');
    assert.strictEqual(m.ctx.S[5], 0, 'the slot topo opened at start-up through the loader');
    for (const id of [3, 1, 1, 3, 3, 3, 2, 3, 1, 4, 6]) m.ctx.onEvent(m.input, m.output, id);
    assert(loaded.length >= 10, 'files loaded: ' + loaded.map((x) => x[0]).join(' '));
    for (const [f, fn] of loaded) {
      if (/ext0\.js$/.test(f)) continue;
      assert.strictEqual(fn.prototype, null, f + ' keeps its prototype');
    }
  });

  test('T9 units events switch the text to feet', () => {
    const m = boot({});
    m.call('onEvent', 3);
    m.call('onEvent', 1);
    m.call('onEvent', 6);
    assert.strictEqual(m.screen.shown('#h1'), '4c  82 ft');
    m.call('onEvent', 5);
    assert.strictEqual(m.screen.shown('#h1'), '4c  25 m');
  });

  test('T9 getUserInterface picks u on UI1 displays, t elsewhere; UI1 reads, loads, streams and saves nothing', () => {
    assert.deepStrictEqual(boot({}, 'q').call('getUserInterface'), { template: 't' });
    const ui1 = boot({ sv: '2,1,2,1,1,1', topo0: h.fixture('walk.stp') }, 's');
    assert.deepStrictEqual(ui1.call('getUserInterface'), { template: 'u' });
    assert.strictEqual(ui1.rec.reads, 0);
    assert.deepStrictEqual(ui1.rec.evalFiles, [], 'no ext file loaded');
    ui1.call('onExerciseStart');
    ui1.ticks(10);
    assert.strictEqual(ui1.output.ck, undefined, 'no stream');
    assert.strictEqual(ui1.output.ms, 0);
    ui1.call('onLap');
    ui1.call('onExercisePause');
    ui1.call('onExerciseEnd');
    assert.strictEqual(ui1.rec.writes, 0);
    assert.deepStrictEqual(ui1.call('getSummaryOutputs'), []);
  });
};
