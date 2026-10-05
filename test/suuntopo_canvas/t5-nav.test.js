// ABOUTME: T5: main.js, the ext files and the template wired together like the firmware. Topo list, navigation, streams,
// ABOUTME: overlays, template reloads, laps and seeded random sessions must keep the screen and the protocol consistent.

'use strict';
const assert = require('assert');
const h = require('./lib/harness');
const { rng } = require('./t1-codec.test.js');

const BROKEN = 'STP1|NBroken|R1,1,0,5|B0,9|P1~4a~1~';

// Text currently readable on the watch (visible elements only).
const screenText = (sys) => ['#tn', '#h1', '#h2', '#it', '#l0', '#l1', '#l2', '#l3', '#l4', '#l5'].map((id) => sys.screen.shown(id) || '').filter(Boolean).join(' | ');

function checkInvariants(sys, where) {
  const S = sys.main.ctx.S;
  const n = S[6];
  assert([0, 1, 2].indexOf(S[0]) >= 0, where + ' view ' + S[0]);
  assert(S[1] >= 0 && S[1] < S[8], where + ' card ' + S[1]);
  assert(S[2] >= 0 && S[2] <= n + 1, where + ' idx ' + S[2] + ' of ' + n);
  if (S[0]) assert(S[5] < 9, where + ' map or info without an open topo');
  const ms = sys.main.output.ms;
  assert.strictEqual(ms, sys.main.ctx.drawState(), where + ' ms output');
  if (S[0] === 1) {
    // Review round 2: the position, which every hold changes, is the large top line; the bottom line is free.
    assert.strictEqual(ms, 64 + S[2], where + ' map draws the current idx');
    const pos = S[2] < 1 ? 'Start' : (S[2] > n ? 'Top' : 'Pitch ' + S[2] + '/' + n);
    assert.strictEqual(sys.screen.shown('#tn'), pos, where + ' map position text');
    for (const id of ['#it', '#l0', '#l1', '#h2']) assert(!sys.screen.visible(id), where + ' ' + id + ' visible on the map');
  } else if (S[0] === 2) {
    // Review round 2: the footer counts pages of notes only, and only when there is more than one.
    assert.strictEqual(ms, 0, where + ' info draws nothing');
    assert(sys.screen.visible('#it'), where + ' info title');
    assert(!sys.screen.visible('#h1'), where + ' h1 visible in info');
    assert.strictEqual(sys.screen.shown('#h2'), S[4] > 1 ? 'Notes ' + (S[3] + 1) + '/' + S[4] : undefined, where + ' info pages');
  } else {
    assert.strictEqual(sys.screen.shown('#h2'), S[1] + 1 + '/' + S[8], where + ' card position');
  }
  assert(sys.screen.visible('#tn'), where + ' #tn hidden');
  // Review round 2: the line under the drawing never covers the Map once the route can be drawn, and on the open topo's
  // list card it says how to open the Map once the topo is complete.
  const t = sys.t.ctx;
  if (t.ms >= 64 && t.ms < 128 && t.ready) assert(!sys.screen.visible('#ld'), where + ' loading line over the map');
  if (t.ms >= 128 && t.ready > 1) assert.strictEqual(sys.screen.shown('#ld'), 'Hold MIDDLE: map', where + ' open card hint');
}

module.exports = (test) => {
  test('T5 start-up with an empty slot opens the demo on its Route card and streams it', () => {
    const sys = h.rig({});
    const S = sys.main.ctx.S;
    assert.strictEqual(S[0], 0);
    assert.strictEqual(S[5], 1);
    assert.strictEqual(S[8], 6, 'four built-ins and two Help cards');
    assert.strictEqual(sys.screen.shown('#tn'), 'Fictional Demo');
    assert.strictEqual(sys.screen.shown('#h2'), '1/6');
    assert.strictEqual(sys.screen.shown('#it'), 'Not a real climb', 'the demo card says it is fictional');
    const ticks = sys.settle();
    assert(ticks <= Math.ceil(sys.main.ctx.R[3] / 14) + 2, 'demo stream took ' + ticks + ' ticks');
    assert.strictEqual(sys.main.output.ms, 128);
    for (let w = 0; w < sys.main.ctx.R[3]; w++) assert.strictEqual(sys.t.ctx.wd(w), sys.main.ctx.W[w], 'word ' + w);
    // The other built-ins: real routes are labelled schematic, the fictional wall says it is not a real climb.
    const labels = [];
    for (let i = 0; i < 3; i++) {
      sys.press('up');
      labels.push(sys.screen.shown('#tn') + ': ' + sys.screen.shown('#it'));
    }
    assert.deepStrictEqual(labels, ['Jägerhorn N: Schematic topo', 'Piccolo Fillar: Schematic topo', 'Fictional Wall: Not a real climb']);
  });

  test('T5 a valid slot topo is listed first and opened at start-up; an invalid one shows its error card first', () => {
    const ok = h.rig({ storage: { topo0: h.fixture('walk.stp') } });
    assert.strictEqual(ok.main.ctx.S[5], 0);
    assert.strictEqual(ok.main.ctx.S[8], 7);
    assert.strictEqual(ok.screen.shown('#tn'), 'Walk in and out');
    assert.strictEqual(ok.screen.shown('#h1'), 'IV  2 pitches');
    assert.strictEqual(ok.screen.shown('#it'), undefined, 'the slot topo is not labelled schematic');
    const bad = h.rig({ storage: { topo0: BROKEN } });
    assert.strictEqual(bad.main.ctx.S[5], 1, 'falls back to the demo');
    assert.strictEqual(bad.main.ctx.S[1], 0, 'the list opens on the error card');
    assert.strictEqual(bad.screen.shown('#tn'), 'Your topo');
    assert(/\(E4\)$/.test(screenText(bad)), screenText(bad));
    assert.strictEqual(bad.screen.color['#l0'], '#FF7A59');
    const old = h.rig({ storage: { topo0: '{"name":"Salathe","anchors":[]}' } });
    assert(/\(E1\)$/.test(screenText(old)), screenText(old));
    // Review round 3: middle on the error card went to the demo's Map, which shows neither the topo name nor "Not a real
    // climb", so it looked like the pasted topo. It now moves to the open demo's card.
    old.press('next');
    assert.deepStrictEqual([old.main.ctx.S[0], old.main.ctx.S[1]], [0, 1], 'middle on the error card moves to the open demo card');
    assert.strictEqual(old.screen.shown('#tn'), 'Fictional Demo');
    assert.strictEqual(old.screen.shown('#it'), 'Not a real climb');
    assert.strictEqual(old.main.output.ms, 128, 'the demo is drawn on its card');
    old.press('next');
    assert.strictEqual(old.main.ctx.S[0], 1, 'middle on the demo card opens its Map');
  });

  test('T5 the topo list shows every built-in with name, grade and pitch count, then the two Help cards', () => {
    const sys = h.rig({});
    const seen = [];
    const help = [];
    for (let i = 0; i < 7; i++) {
      seen.push(sys.screen.shown('#tn') + ' / ' + (sys.screen.shown('#h1') || '') + ' / ' + sys.screen.shown('#h2'));
      if (sys.screen.shown('#tn') === 'Help') help.push([0, 1, 2, 3, 4, 5].map((j) => sys.screen.shown('#l' + j)).join(' '));
      sys.press('up');
    }
    assert.deepStrictEqual(seen, [
      'Fictional Demo / 5c  4 pitches / 1/6', 'Jägerhorn N / IV  1 pitch / 2/6', 'Piccolo Fillar / 6b  15 pitches / 3/6',
      'Fictional Wall / 6c  30 pitches / 4/6', 'Help /  / 5/6', 'Help /  / 6/6', 'Help /  / 6/6']);
    assert.strictEqual(help[0], 'Hold UP: next Hold DOWN: back Hold MIDDLE: open, notes, list Button lock stops these holds.');
    // Review round 3: the editor runs on a computer and the setting lives in the phone app; the card says how the line gets
    // from one to the other, with the setting's name.
    assert.strictEqual(help[1], 'Draw your topo in the web editor (see store page). Send the line to your phone, paste it in Topo line.');
    assert.strictEqual(sys.main.output.ms, 0, 'only the open topo card is drawn');
  });

  test('T5 cards of topos that are not open say how to open them; the open topo card is drawn instead', () => {
    const sys = h.rig({});
    assert.strictEqual(sys.screen.shown('#l2'), undefined, 'the open demo card is drawn, without a hint');
    sys.press('up');
    assert.strictEqual(sys.screen.shown('#l2'), 'Hold MIDDLE: open');
    assert.strictEqual(sys.screen.color['#l2'], '#B3B3B3');
    sys.press('next');
    assert.strictEqual(sys.main.ctx.S[5], 2, 'Jägerhorn opened');
  });

  // Review finding: browsing the list compiled each built-in topo file (3.4 KB for the Wall) just to show its card.
  test('T5 browsing the list loads no topo file, and the card index in ext3.js matches the built-in topo files', () => {
    const sys = h.rig({ storage: { topo0: h.fixture('one-pitch.stp') } });
    const files = sys.main.rec.evalFiles;
    files.length = 0;
    const main = h.mainContext('q', {}, h.newScreen()).ctx;
    for (let card = 1; card <= 4; card++) {
      sys.press('up');
      const s = main.evalFile('{file_path}/ext' + (card + 3) + '.js')();
      const p = h.parse(s);
      const name = s.substring(p.R[4], p.R[5]);
      const want = s.substring(p.R[6], p.R[7]) + '  ' + p.R[1] + (p.R[1] === 1 ? ' pitch' : ' pitches');
      assert.strictEqual(sys.screen.shown('#tn'), name.length > 15 ? name.substring(0, 12) + '...' : name, 'card ' + card);
      assert.strictEqual(sys.screen.shown('#h1'), want, 'card ' + card);
    }
    assert.deepStrictEqual(files.filter((f) => h.TOPO_EXT.indexOf(f) >= 0), [], 'a topo file was loaded while browsing');
  });

  test('T5 belay-to-belay navigation, Info pages and the view cycle on the demo', () => {
    const sys = h.rig({ storage: { lapAdv: '0' } });
    sys.settle();
    assert.strictEqual(sys.screen.shown('#ld'), 'Hold MIDDLE: map', 'the open card says how to open the Map');
    sys.press('next');
    assert.strictEqual(sys.screen.shown('#tn'), 'Start');
    assert.strictEqual(sys.screen.shown('#h1'), '5c  110 m');
    assert(!sys.screen.visible('#ld'), 'no hint or loading line on the Map');
    sys.press('down');
    assert.strictEqual(sys.main.ctx.S[2], 0, 'down at Start does nothing');
    sys.press('up');
    assert.strictEqual(sys.screen.shown('#tn'), 'Pitch 1/4');
    assert.strictEqual(sys.screen.shown('#h1'), '4c  25 m');
    assert.strictEqual(sys.screen.color['#h1'], '#5AC8FA');
    sys.press('next');
    assert.strictEqual(sys.screen.shown('#it'), 'P1  4c  25 m');
    assert.strictEqual(sys.screen.shown('#h2'), 'Notes 1/2', 'page 1 of 2');
    assert.strictEqual(sys.screen.shown('#l0'), 'Easy slab to a');
    sys.press('next');
    assert.strictEqual(sys.screen.shown('#h2'), 'Notes 2/2');
    sys.press('up');
    assert.strictEqual(sys.screen.shown('#it'), 'P2  5b  30 m', 'up in Info moves to the next pitch, page 1');
    assert(!sys.screen.visible('#h2'), 'one page of notes needs no page count');
    sys.press('next');
    assert.strictEqual(sys.main.ctx.S[0], 0, 'the last page goes to the topo list');
    sys.press('next');
    assert.strictEqual(sys.main.ctx.S[0], 1, 'the open topo opens again at the same pitch');
    assert.strictEqual(sys.main.ctx.S[2], 2);
    for (let i = 0; i < 10; i++) sys.press('up');
    assert.strictEqual(sys.screen.shown('#tn'), 'Top');
    sys.press('next');
    assert.strictEqual(sys.screen.shown('#it'), 'Descent');
  });

  test('T5 every built-in streams completely in both delivery modes and is drawn within budget', () => {
    for (const mode of ['change', 'all']) {
      const sys = h.rig({ mode });
      for (let card = 0; card < 4; card++) {
        for (let i = 0; i < 8 && sys.main.ctx.S[1] !== card; i++) sys.press(sys.main.ctx.S[1] < card ? 'up' : 'down');
        assert.strictEqual(sys.main.ctx.S[1], card);
        sys.press('next');
        const ticks = sys.settle(80);
        const words = sys.main.ctx.R[3];
        assert.strictEqual(sys.t.ctx.ready, 2, mode + ' card ' + card + ' did not finish');
        assert(ticks <= Math.ceil(words / 14) + 3, mode + ' card ' + card + ': ' + ticks + ' ticks for ' + words + ' words');
        for (let w = 0; w < words; w++) assert.strictEqual(sys.t.ctx.wd(w), sys.main.ctx.W[w], mode + ' word ' + w);
        for (let ti = 0; ti < 3; ti++) assert(sys.t.drawTile(ti).units <= 150);
        for (let i = 0; i < 8 && sys.main.ctx.S[0]; i++) sys.press('next');
        assert.strictEqual(sys.main.ctx.S[0], 0, 'back on the topo list');
      }
    }
  });

  test('T5 an overlay (re-activation) keeps the topo; a template reload streams it again', () => {
    const sys = h.rig({});
    sys.settle();
    const before = sys.ticks;
    sys.reactivate();
    sys.tick(2);
    assert.strictEqual(sys.t.ctx.ready, 2);
    assert.strictEqual(sys.t.ctx.pend, 0, 'the overlay asked for nothing again');
    sys.mount();
    assert.strictEqual(sys.t.ctx.ready, 0, 'a reloaded template starts empty');
    const ticks = sys.settle();
    assert(ticks > 0 && ticks <= 10, 'restream took ' + ticks);
    assert(sys.ticks > before);
  });

  // Review round 3: evaluate() streams from onLoad, but the template mounts only when the user first opens the app display,
  // and again after a template reload. main.js went on from wherever its chunk pointer was, so the route waited for the
  // stream to wrap around (up to 18 s for the Fictional Wall) while the line said "Loading 99%".
  test('T5 a template mounted or reloaded after main.js streamed alone gets the route first, without "Loading 99%"', () => {
    const topos = [['demo', {}], ['full slot', { topo0: h.fixture('slot-1500.stp') }], ['wall', { dbg: '2,0,4,0,30,0' }]];
    for (const [name, storage] of topos) {
      const probe = h.rig({ storage, mount: false });
      const W = probe.main.ctx.W;
      const K = Math.ceil(probe.main.ctx.R[3] / 14);
      const routeChunks = Math.ceil((2 + Math.ceil((Math.floor(W[0] / 128) % 64) / 3) + W[0] % 128) / 14);
      for (const mode of ['change', 'all']) {
        for (const reload of [false, true]) {
          for (let pre = 0; pre < K + 2; pre++) {
            const where = name + ' ' + mode + (reload ? ' reload' : ' first mount') + ' after ' + pre + ' s';
            const sys = h.rig({ storage, mode, mount: reload });
            for (let i = 0; i < pre; i++) {
              if (reload) sys.tick(); else sys.evaluate();
            }
            sys.mount();
            let secs = 0;
            while (secs < 3 * K && !(sys.t.ctx.ready >= 1 && sys.t.ctx.hash === sys.main.ctx.S[7])) {
              sys.tick();
              secs++;
              assert(!/ 99%$/.test(sys.screen.shown('#ld') || ''), where + ': ' + sys.screen.shown('#ld') + ' before the route');
            }
            assert(secs <= routeChunks + 1, where + ': route after ' + secs + ' s (' + routeChunks + ' route chunks)');
          }
        }
      }
    }
  });

  // Review round 3: restarting at chunk 0 on every activation would restream what an overlay's template still holds.
  test('T5 an overlay during a load does not restart the stream', () => {
    const storage = { dbg: '2,0,4,0,30,0' };
    for (const mode of ['change', 'all']) {
      for (const at of [3, 8, 14]) {
        const sys = h.rig({ storage, mode });
        const K = Math.ceil(sys.main.ctx.R[3] / 14);
        for (let i = 0; i < at; i++) sys.tick();
        assert(sys.t.ctx.ready < 2, mode + ': still loading at ' + at + ' s');
        sys.reactivate();
        const total = at + sys.settle(3 * K);
        assert(sys.t.ctx.ready === 2 && total <= K + 2, mode + ' overlay at ' + at + ' s: complete after ' + total + ' s (' + K + ' chunks)');
      }
    }
  });

  test('T5 the loading line counts from chunk 0: chunks that arrive before it show 0%, never 99%', () => {
    const t = h.loadTemplate('q');
    t.activate();
    const p = h.parse(h.fixture('slot-1500.stp'));
    const K = Math.ceil(p.R[3] / 14);
    const chunk = (k) => {
      const words = [];
      for (let i = 0; i < 14; i++) words.push(p.W[k * 14 + i]);
      h.deliverChunk(t, k, words, h.chunkCheck(p.R[2], k, words));
    };
    t.deliver('mh', p.R[2]);
    t.deliver('ms', 128);
    for (let k = 1; k < K; k++) chunk(k);
    assert.strictEqual(t.screen.shown('#ld'), 'Loading 0%');
    chunk(0);
    assert.strictEqual(t.ctx.ready, 2);
    assert.strictEqual(t.screen.shown('#ld'), 'Hold MIDDLE: map');
  });

  // Review round 3: onDeactivate unsubscribed without try/catch before ending the refresh chain, and activate() read the
  // outputs with $.get before reporting to main.js; a throw in either (a token severed by a lap popup, a resource that
  // answers no get) froze the drawing or skipped the activation report.
  test('T5 a throwing unsubscribe in onDeactivate still ends the refresh chain; a throwing $.get skips neither the report nor the paint', () => {
    const sys = h.rig({ storage: { lapAdv: '1' } });
    sys.settle();
    sys.press('next');
    for (let k = 0; k < 3 && sys.t.rec.timers.length; k++) sys.t.runTimers();
    sys.lap();
    assert.strictEqual(sys.t.rec.timers.length, 1, 'the lap started a refresh chain');
    const c = sys.t.ctx;
    const unsubscribe = c.$.unsubscribe;
    c.$.unsubscribe = () => { throw new Error('stale subscription token'); };
    assert.doesNotThrow(() => sys.t.deactivate());
    c.$.unsubscribe = unsubscribe;
    assert.strictEqual(c.run, 0, 'the chain ended');
    sys.t.rec.timers.length = 0;
    sys.reactivate();
    for (let i = 0; i < 3; i++) {
      const n = sys.t.rec.refresh.length;
      sys.lap();
      for (let k = 0; k < 3 && sys.t.rec.timers.length; k++) sys.t.runTimers();
      assert.deepStrictEqual(sys.t.rec.refresh.slice(n), ['#c0', '#c1', '#c2'], 'lap ' + i + ' after the throw');
    }
    const t = h.loadTemplate('q');
    t.ctx.$.get = (path, cb) => {
      if (/^Zapp\//.test(path)) throw new Error('ZappProvider::sub FAILED');
      t.rec.gets[path] = cb;
    };
    assert.doesNotThrow(() => t.activate());
    assert.deepStrictEqual(t.rec.events, [3000000], 'the activation report was sent');
    assert.strictEqual(typeof t.rec.gets['/Settings/Unit/UnitsMode'], 'function', 'the units were read');
    assert.strictEqual(t.rec.refresh.length, 1, 'the tiles were painted');
  });

  // Review round 3: 60 ms apart, two of the three refreshes could fall in one 10 Hz tick, which is what filled the WBMAIN
  // pool on a Race S (forum 15279).
  test('T5 the refresh chain spaces the tiles at least 100 ms apart', () => {
    const sys = h.rig({});
    sys.settle();
    sys.press('next');
    sys.press('up');
    for (let k = 0; k < 6 && sys.t.rec.timers.length; k++) sys.t.runTimers();
    assert(sys.t.rec.delays.length >= 2, 'no chain ran');
    for (const d of sys.t.rec.delays) assert(d >= 100, 'refresh timer of ' + d + ' ms');
  });

  // Found by the 1000-session run: the template drops topo A when topo B's hash arrives, so returning to A before B
  // finished must restream A instead of trusting A's old completion report.
  test('T5 returning to a loaded topo after a half-streamed one streams it again', () => {
    for (const mode of ['change', 'all']) {
      const sys = h.rig({ storage: { topo0: h.fixture('one-pitch.stp') }, mode });
      const S = sys.main.ctx.S;
      sys.settle();
      const a = S[7];
      for (let i = 0; i < 4 && S[1] !== 1; i++) sys.press(S[1] < 1 ? 'up' : 'down');
      sys.press('next');
      assert.strictEqual(S[5], 1, mode + ': the demo is open');
      sys.tick(2);
      assert(sys.t.ctx.ready < 2 && sys.t.ctx.hash === S[7], mode + ': the demo is half streamed');
      for (let i = 0; i < 8 && S[0]; i++) sys.press('next');
      for (let i = 0; i < 4 && S[1] !== 0; i++) sys.press(S[1] < 0 ? 'up' : 'down');
      sys.press('next');
      assert.strictEqual(S[7], a, mode + ': the slot topo is open again');
      const ticks = sys.settle(20);
      assert(sys.t.ctx.ready === 2 && sys.t.ctx.hash === a, mode + ': the slot topo did not restream');
      assert(ticks <= Math.ceil(sys.main.ctx.R[3] / 14) + 2, mode + ': restream took ' + ticks);
    }
  });

  // Review finding: a one-chunk topo whose words reached the template before its stream id never loaded, because only
  // changed outputs are delivered and a one-chunk stream never changes.
  test('T5 a one-chunk topo loads whatever order the outputs arrive in, on mount, on reopening and on remount', () => {
    for (const mode of ['change', 'all']) {
      for (const [order, batch] of [['hashLast', true], ['hashLast', false], ['manifest', false]]) {
        for (const current of [true, false]) {
          const where = mode + ' ' + order + (batch ? ' batched' : '') + (current ? '' : ' no-current');
          const sys = h.rig({ storage: { topo0: h.fixture('one-pitch.stp') }, mode, order, batch, current });
          const S = sys.main.ctx.S;
          assert.strictEqual(Math.ceil(sys.main.ctx.R[3] / 14), 1, 'fixture must be one chunk');
          assert(sys.settle(10) <= 2, where + ': start-up did not load');
          sys.press('up');
          sys.press('next');
          assert.strictEqual(S[5], 1, where + ': demo open');
          sys.tick(2);
          for (let i = 0; i < 8 && S[0]; i++) sys.press('next');
          sys.press('down');
          sys.press('next');
          assert.strictEqual(S[5], 0, where + ': slot open again');
          assert(sys.settle(10) <= 2, where + ': reopening did not load');
          sys.mount();
          assert(sys.settle(10) <= 2, where + ': remount did not load');
          sys.reactivate();
          sys.tick(1);
          assert.strictEqual(sys.t.ctx.ready, 2, where + ': overlay dropped the topo');
        }
      }
    }
  });

  // Review findings: a failed load set S[5] to 9 with S[0] already 1, after which no button did anything; a failed text
  // writer threw out of onEvent before the outputs were written.
  test('T5 a topo or text file that fails to load leaves navigation and the outputs working', () => {
    const fail = new Set();
    const sys = h.rig({ failExt: fail });
    const S = sys.main.ctx.S;
    sys.settle();
    for (let i = 0; i < 3; i++) sys.press('up');
    fail.add('ext7.js');
    sys.press('next');
    checkInvariants(sys, 'wall fails');
    assert.deepStrictEqual([S[0], S[1], S[5]], [0, 3, 1], 'still on the Wall card with the demo open');
    assert.strictEqual(sys.screen.shown('#tn'), 'Fictional Wall');
    assert.deepStrictEqual([sys.t.ctx.hash, sys.t.ctx.ready, sys.t.ctx.pend], [S[7], 2, 0], 'the template keeps the demo and asks for nothing');
    sys.press('down');
    assert.strictEqual(S[1], 2, 'up and down still move');
    sys.press('up');
    fail.delete('ext7.js');
    sys.press('next');
    assert.deepStrictEqual([S[0], S[5]], [1, 4], 'the Wall opens once it loads');
    // Both the new and the previous topo fail: nothing is open, the list still works.
    for (let i = 0; i < 8 && S[0]; i++) sys.press('next');
    sys.press('down');
    fail.add('ext6.js');
    fail.add('ext7.js');
    sys.press('next');
    checkInvariants(sys, 'both fail');
    assert.deepStrictEqual([S[0], S[1], S[5]], [0, 2, 9]);
    for (const b of ['up', 'up', 'up', 'next', 'down', 'down', 'down', 'down', 'down']) {
      sys.press(b);
      checkInvariants(sys, 'after ' + b);
    }
    fail.clear();
    sys.press('next');
    assert.strictEqual(S[0], 1, 'a topo opens again');
    // A text writer that fails keeps the state change; onEvent still writes the outputs.
    fail.add('ext8.js');
    sys.press('up');
    assert.strictEqual(sys.main.output.ms, 64 + S[2], 'drawing state written');
    fail.add('ext2.js');
    const before = Array.from(S);
    sys.press('up');
    assert.deepStrictEqual(Array.from(S), before, 'a failed navigation file changes nothing');
  });

  test('T5 a broken slot and a demo that fails at start-up still give a working list', () => {
    for (const slot of [BROKEN, '']) {
      const sys = h.rig({ storage: { topo0: slot }, failExt: new Set(['ext4.js']) });
      const S = sys.main.ctx.S;
      assert.strictEqual(S[5], 9);
      checkInvariants(sys, 'start ' + JSON.stringify(slot));
      for (const b of ['up', 'next', 'down', 'next', 'up', 'up', 'up', 'up', 'up', 'next']) {
        sys.press(b);
        checkInvariants(sys, JSON.stringify(slot) + ' ' + b);
      }
    }
  });

  // Review finding: two key changes in one delivery batch started two refresh chains, refreshing two tiles at once and
  // sending REFRESH to a #c3 that does not exist.
  test('T5 one refresh chain at a time: tiles refresh one by one, only #c0-#c2', () => {
    const t = h.loadTemplate('q');
    t.activate();
    const p = h.parse(h.fixture('demo.stp'));
    h.feed(t, p.W, p.R[3], p.R[2], 64);
    t.deliver('ms', 65);
    assert.strictEqual(t.rec.refresh.length, 1, 'one synchronous refresh per batch: ' + t.rec.refresh.join(' '));
    for (let step = 0; step < 10 && t.rec.timers.length; step++) {
      assert.strictEqual(t.rec.timers.length, 1, 'one chain');
      const n = t.rec.refresh.length;
      t.runTimers();
      assert(t.rec.refresh.length - n <= 1, 'two tiles refreshed at once');
    }
    assert.deepStrictEqual(t.rec.refresh.slice(-3), ['#c0', '#c1', '#c2']);
    for (const c of t.rec.refresh) assert(['#c0', '#c1', '#c2'].indexOf(c) >= 0, 'REFRESH to ' + c);
    assert.strictEqual(t.ctx.run, 0, 'the chain ended');
  });

  // Review round 2: the chain's run flag was cleared only by its last timer. A timer the firmware drops with a deactivated
  // view, or a control() that throws, left it set, and no tile was ever refreshed again.
  test('T5 the refresh chain recovers when its timer is dropped on deactivation or control() throws', () => {
    const refreshesAfter = (sys, n) => sys.t.rec.refresh.slice(n);
    // A: deactivated while the chain waits for its #c1 timer; the firmware drops the timer; the view comes back.
    const a = h.rig({});
    a.settle();
    a.press('next');
    assert.strictEqual(a.t.rec.timers.length, 1, 'the Map press started a chain');
    a.t.deactivate();
    a.t.rec.timers.length = 0;
    a.reactivate();
    for (let i = 0; i < 6; i++) {
      const n = a.t.rec.refresh.length;
      a.press(i < 3 ? 'up' : 'down');
      for (let k = 0; k < 3 && a.t.rec.timers.length; k++) a.t.runTimers();
      assert.deepStrictEqual(refreshesAfter(a, n), ['#c0', '#c1', '#c2'], 'hold ' + i + ' after the dropped timer');
    }
    // A timer that survives the deactivation and fires while the view is away stops at once.
    const b = h.rig({});
    b.settle();
    b.press('next');
    b.t.deactivate();
    const n = b.t.rec.refresh.length;
    b.t.runTimers();
    assert.deepStrictEqual(refreshesAfter(b, n), [], 'a stale timer refreshed a tile of an inactive view');
    assert.strictEqual(b.t.rec.timers.length, 0);
    // B: control() throws once (an inactive view, say); the exception stays inside the chain and later holds refresh.
    const c = h.rig({});
    c.settle();
    const control = c.t.ctx.control;
    c.t.ctx.control = () => { throw new Error('view not active'); };
    c.press('next');
    c.t.ctx.control = control;
    for (let k = 0; k < 3 && c.t.rec.timers.length; k++) c.t.runTimers();
    assert.strictEqual(c.t.ctx.run, 0, 'the chain ended');
    for (let i = 0; i < 4; i++) {
      const m = c.t.rec.refresh.length;
      c.press('up');
      for (let k = 0; k < 3 && c.t.rec.timers.length; k++) c.t.runTimers();
      assert.deepStrictEqual(refreshesAfter(c, m), ['#c0', '#c1', '#c2'], 'hold ' + i + ' after the throw');
    }
  });

  // Review round 2: every activation sent the units event, so main.js loaded a text writer twice per activation.
  test('T5 an activation sends the units setting only when it changed since the last one this template sent', () => {
    const sys = h.rig({});
    sys.settle();
    const units = () => sys.t.rec.events.filter((e) => e === 5 || e === 6).length;
    const answer = (v) => { sys.t.rec.gets['/Settings/Unit/UnitsMode'](v); };
    answer(0);
    assert.strictEqual(units(), 1, 'the first answer is sent');
    sys.events();
    for (let i = 0; i < 3; i++) {
      // Frames in between: the renderer's own counters must not touch the units callback.
      for (let ti = 0; ti < 3; ti++) sys.t.drawTile(ti);
      sys.reactivate();
      assert.strictEqual(typeof sys.t.rec.gets['/Settings/Unit/UnitsMode'], 'function', 'the units callback is not a function');
      answer(0);
    }
    assert.strictEqual(units(), 0, 'unchanged units were sent again');
    sys.reactivate();
    answer(1);
    assert.deepStrictEqual(sys.t.rec.events.filter((e) => e === 5 || e === 6), [6], 'a change is sent');
    sys.events();
    assert.strictEqual(sys.main.ctx.S[9], 1);
    // A reloaded template sends once again, whatever main.js holds.
    sys.mount();
    sys.t.rec.gets['/Settings/Unit/UnitsMode'](1);
    assert.deepStrictEqual(sys.t.rec.events.filter((e) => e === 5 || e === 6), [6]);
  });

  // Review finding: every activation subscribed 18 outputs again without releasing the tokens it held.
  test('T5 repeated activations without onDeactivate do not pile up subscriptions', () => {
    const sys = h.rig({});
    const rec = sys.t.rec;
    sys.settle();
    assert.strictEqual(rec.live, 3);
    sys.t.activate();
    sys.t.activate();
    assert.strictEqual(rec.live, 3, 'three activations hold ' + rec.live);
    sys.t.deactivate();
    assert.strictEqual(rec.live, 0);
    sys.t.deactivate();
    assert.strictEqual(rec.live, 0, 'a second onDeactivate releases nothing twice');
    sys.t.activate();
    assert.strictEqual(rec.live, 3);
    assert.strictEqual(sys.settle(), 0, 'still holding the topo');
    sys.press('up');
    assert.strictEqual(sys.main.output.ms, 0);
    assert.strictEqual(sys.t.ctx.ms, 0, 'the fresh subscriptions deliver');
  });

  test('T5 a template whose subscriptions miss the current values reads the stream id and drawing state on activation', () => {
    const sys = h.rig({ current: false });
    assert(sys.settle(10) <= 7, 'the demo did not load');
    assert.strictEqual(sys.t.ctx.ms, 128);
    sys.mount();
    assert(sys.settle(10) <= 7, 'a remount did not load');
    const none = h.rig({ current: false, gets: false });
    none.tick(10);
    assert.strictEqual(none.t.ctx.hash, 0, 'without $.get the stream id never arrives (H1 tells which world the watch is)');
  });

  test('T5 a slot topo with the content hash of a built-in still loads that built-in', () => {
    const demo = h.fixture('demo.stp');
    const target = h.parse(demo).R[2];
    // Same construction as T9: 200 letters in the last note make up the hash difference.
    const base = h.fixture('walk.stp');
    const at = base.indexOf('Wall.');
    const hash = (s) => { let x = 0; for (let k = 0; k < s.length; k++) x = (x + s.charCodeAt(k) * (k % 31 + 1)) % 65521; return x; };
    const codes = new Array(200).fill(97);
    const make = () => base.substring(0, at) + String.fromCharCode.apply(null, codes) + base.substring(at + 5);
    let d = (target - hash(make()) + 65521) % 65521;
    for (const i of codes.map((c, j) => j).sort((x, y) => ((at + y) % 31) - ((at + x) % 31))) {
      const q = Math.min(25, Math.floor(d / ((at + i) % 31 + 1)));
      codes[i] += q;
      d -= q * ((at + i) % 31 + 1);
    }
    const twin = make();
    assert.strictEqual(h.parse(twin).R[2], target);
    const sys = h.rig({ storage: { topo0: twin } });
    sys.settle();
    sys.press('up');
    sys.press('next');
    sys.settle();
    assert.strictEqual(sys.t.ctx.nR, h.parse(demo).W[0] % 128, 'the template holds the demo route');
  });

  test('T5 imperial units show feet', () => {
    const sys = h.rig({});
    sys.press('next');
    sys.press('up');
    sys.t.rec.gets['/Settings/Unit/UnitsMode'](1);
    sys.events();
    assert.strictEqual(sys.screen.shown('#h1'), '4c  82 ft');
  });

  test('T5 lap advance moves one pitch and shows the Map; the position survives an app reload', () => {
    const storage = { lapAdv: '1', topo0: h.fixture('walk.stp') };
    const sys = h.rig({ storage });
    sys.lap();
    assert.strictEqual(sys.main.ctx.S[2], 1);
    assert.strictEqual(sys.main.ctx.S[0], 1);
    assert.strictEqual(sys.screen.shown('#tn'), 'Pitch 1/2');
    sys.press('up');
    const sv = sys.main.storage.sv;
    assert.strictEqual(sv, '2,1,0,2,2,' + sys.main.ctx.S[7]);
    const again = h.rig({ storage: Object.assign({}, storage, { sv }) });
    assert.strictEqual(again.main.ctx.S[0], 1);
    assert.strictEqual(again.main.ctx.S[2], 2);
    assert.strictEqual(again.screen.shown('#tn'), 'Pitch 2/2');
  });

  test('T5 a changed slot topo under a saved position opens its Route card at idx 0', () => {
    const sys = h.rig({ storage: { topo0: h.fixture('walk.stp'), sv: '2,1,0,2,2,123' } });
    assert.strictEqual(sys.main.ctx.S[0], 0);
    assert.strictEqual(sys.main.ctx.S[2], 0);
    assert.strictEqual(sys.main.ctx.S[5], 0);
    assert.strictEqual(sys.screen.shown('#tn'), 'Walk in and out');
  });

  // Round 4 (memory): main.js kept the whole slot string while another topo was open (1.5 KB for a full slot). It now keeps
  // the slot's card only and reads the slot from storage again when it opens it.
  test('T5 while another topo is open main.js keeps only the slot card; opening the slot reads it from storage again', () => {
    const slot = h.fixture('slot-1500.stp');
    const sys = h.rig({ storage: { topo0: slot } });
    const S = sys.main.ctx.S;
    assert.deepStrictEqual([S[0], S[1], S[5]], [0, 0, 0], 'the slot opens at start-up on its card');
    assert.strictEqual(sys.main.ctx.str, slot);
    assert.strictEqual(sys.main.ctx.user, 'Slot full|V+|12', 'main.js keeps the slot card only');
    sys.press('up');
    sys.press('next');
    assert.strictEqual(S[5], 1, 'the demo is open');
    assert.strictEqual(sys.main.ctx.str.indexOf('Slot full'), -1, 'no copy of the slot topo is held');
    for (let i = 0; i < 8 && S[0]; i++) sys.press('next');
    sys.press('down');
    assert.strictEqual(S[1], 0);
    assert.deepStrictEqual([sys.screen.shown('#tn'), sys.screen.shown('#h1'), sys.screen.shown('#l2')], ['Slot full', 'V+  12 pitches', 'Hold MIDDLE: open']);
    const reads = sys.main.rec.reads;
    sys.press('next');
    assert.deepStrictEqual([S[0], S[5]], [1, 0], 'the slot opens on its Map');
    assert.strictEqual(sys.main.rec.reads, reads + 1, 'one storage read to open the slot');
    assert.strictEqual(sys.main.ctx.str, slot);
    assert(sys.settle() <= Math.ceil(sys.main.ctx.R[3] / 14) + 2 && sys.t.ctx.ready === 2, 'the slot streams');
    // A slot that no longer parses when it is opened again (the stored line changed) leaves the list on its card with the
    // previously open topo opened again.
    for (let i = 0; i < 8 && S[0]; i++) sys.press('next');
    sys.press('up');
    sys.press('next');
    for (let i = 0; i < 8 && S[0]; i++) sys.press('next');
    sys.press('down');
    sys.main.storage.topo0 = 'STP1|Nx';
    sys.press('next');
    checkInvariants(sys, 'changed slot');
    assert.deepStrictEqual([S[0], S[1], S[5]], [0, 0, 1], 'still on the slot card with the demo open');
  });

  test('T5 the slot card shows the first G record of the slot, like the card of the open slot', () => {
    const sys = h.rig({ storage: { topo0: h.fixture('walk.stp') + '|GVI' } });
    const S = sys.main.ctx.S;
    assert.strictEqual(sys.screen.shown('#h1'), 'IV  2 pitches', 'the open slot');
    sys.press('up');
    sys.press('next');
    for (let i = 0; i < 8 && S[0]; i++) sys.press('next');
    sys.press('down');
    assert.deepStrictEqual([S[1], S[5]], [0, 1]);
    assert.strictEqual(sys.screen.shown('#h1'), 'IV  2 pitches', 'the slot card while the demo is open');
  });

  // Round 4: ext0.js opens the start-up topo; when it cannot be loaded, start() opens the demo.
  test('T5 when ext0.js fails to load at start-up the demo opens on its card and the list works', () => {
    const sys = h.rig({ storage: { topo0: h.fixture('walk.stp') }, failExt: new Set(['ext0.js']) });
    const S = sys.main.ctx.S;
    assert.deepStrictEqual([S[0], S[1], S[5], S[8]], [0, 0, 1, 6], 'demo open on card 0; the slot is unknown');
    assert.strictEqual(sys.screen.shown('#tn'), 'Fictional Demo');
    checkInvariants(sys, 'start');
    for (const b of ['up', 'next', 'down', 'next', 'next', 'next', 'up', 'up', 'up', 'up', 'next']) {
      sys.press(b);
      checkInvariants(sys, b);
    }
    assert.strictEqual(sys.settle() < 30, true, 'the open topo streams');
  });

  // Round 4: the error and Help cards have their own writer (ext11.js), so a press compiles only the writer it needs.
  test('T5 the list writes topo cards with ext3.js and the error and Help cards with ext11.js', () => {
    const sys = h.rig({ storage: { topo0: BROKEN } });
    const files = sys.main.rec.evalFiles;
    const writers = [];
    for (let card = 0; card < 7; card++) {
      if (card) {
        files.length = 0;
        sys.press('up');
      } else {
        files.length = 0;
        sys.reactivate();
      }
      writers.push(files.filter((f) => f === 'ext3.js' || f === 'ext11.js').join(' '));
    }
    assert.deepStrictEqual(writers, ['ext11.js', 'ext3.js', 'ext3.js', 'ext3.js', 'ext3.js', 'ext11.js', 'ext11.js']);
  });

  // Round 4: a closure per output cost its own scope record and prototype (about 120 B each, 18 outputs); the template binds rv
  // to the output index instead, and falls back to closures on a firmware without Function.prototype.bind.
  test('T5 the template subscribes rv bound to each output, and closures when bind is missing; both deliver the stream', () => {
    const p = h.parse(h.fixture('demo.stp'));
    for (const bind of [true, false]) {
      const t = h.loadTemplate('q');
      if (!bind) t.ctx.rv.bind = undefined;
      t.activate();
      assert.strictEqual(t.ctx.cb.filter((f) => typeof f === 'function').length, 3);
      assert.strictEqual(/^bound /.test(t.ctx.cb[0].name), bind, 'bound functions');
      h.feed(t, p.W, p.R[3], p.R[2], 64);
      assert.strictEqual(t.ctx.ready, 2, (bind ? 'bound' : 'closures') + ': the stream completes');
      assert.strictEqual(t.ctx.ms, 64);
    }
  });

  // First watch test (2026-10-04): v1.0 subscribed to 18 outputs; in a Climbing mode the watch refused the 16th
  // (ERR WBMAIN Too many sim. path-param calls, 507), the throw left activate() and the topo stayed at "Loading 0%".
  test('T5 the template holds at most three subscriptions and reads the chunks one $.get at a time', () => {
    const sys = h.rig({});
    const rec = sys.t.rec;
    let inFlight = 0, most = 0;
    const get = sys.t.ctx.$.get;
    sys.t.ctx.$.get = (p, cb) => {
      if (!/\/d\d+$/.test(p)) return get(p, cb);
      most = Math.max(most, ++inFlight);
      get(p, (v) => { inFlight--; cb(v); });
    };
    // Forget the topo so the instrumented template loads it again.
    sys.t.ctx.hash = 0;
    sys.reactivate();
    assert(sys.settle(20) <= 8, 'the demo did not load');
    assert(rec.live <= 3, rec.live + ' subscriptions');
    assert.deepStrictEqual(Object.keys(rec.subs).sort(), ['ck', 'mh', 'ms']);
    assert.strictEqual(most, 1, most + ' chunk reads in flight');
  });

  test('T5 a refused ck subscription or a read that never answers still loads the topo (watchdog)', () => {
    // A: the watch refuses the ck subscription; the watchdog reads ck directly.
    const sysA = h.rig({});
    const sub = sysA.t.ctx.$.subscribe;
    sysA.t.ctx.$.subscribe = (p, cb) => { if (/ck$/.test(p)) throw new Error('WB:subs'); return sub(p, cb); };
    sysA.t.ctx.hash = 0;
    sysA.reactivate();
    assert.strictEqual(sysA.t.rec.subs.ck, undefined, 'ck was refused');
    assert(sysA.settle(60) < 60, 'no load without the ck subscription');
    assert.strictEqual(sysA.t.ctx.ready, 2);
    // B: the first read of d3 is lost; the request is sent again and the topo completes.
    const sysB = h.rig({});
    sysB.t.ctx.hash = 0;
    const get = sysB.t.ctx.$.get;
    let dropped = 0;
    sysB.t.ctx.$.get = (p, cb) => { if (/d3$/.test(p) && !dropped++) return; get(p, cb); };
    sysB.reactivate();
    assert(sysB.settle(30) < 30, 'a lost read stalled the load');
    assert(dropped > 1, 'the read was not retried');
    assert.strictEqual(sysB.t.ctx.ready, 2);
  });

  // QUICK=1 runs a tenth of the sequences while iterating; the full 1000 is the acceptance run.
  const SEQUENCES = process.env.QUICK ? 100 : 1000;
  test('T5 ' + SEQUENCES + ' seeded sessions of 200 actions keep the screen and protocol consistent', () => {
    const r = rng(99);
    const slots = ['', h.fixture('walk.stp'), BROKEN, h.fixture('one-pitch.stp'), '{"old":1}'];
    for (let seq = 0; seq < SEQUENCES; seq++) {
      const fail = new Set();
      const sys = h.rig({
        storage: { topo0: slots[seq % slots.length], lapAdv: seq % 4 === 3 ? 1 : String(seq % 2) },
        mode: seq % 3 ? 'change' : 'all', order: seq % 4 === 1 ? 'hashLast' : 'manifest', batch: seq % 6 === 1,
        current: seq % 5 !== 2, failExt: fail
      });
      for (let step = 0; step < 200; step++) {
        const where = 'session ' + seq + ' step ' + step;
        const x = r();
        if (seq % 7 === 3 && x > 0.97) {
          const f = h.TOPO_EXT[Math.floor(r() * 4)];
          if (fail.has(f)) fail.delete(f); else fail.add(f);
        }
        if (x < 0.25) sys.press('up');
        else if (x < 0.45) sys.press('down');
        else if (x < 0.7) sys.press('next');
        else if (x < 0.78) sys.lap();
        else if (x < 0.83) sys.reactivate();
        else if (x < 0.85) sys.mount();
        else sys.tick();
        checkInvariants(sys, where);
      }
      fail.clear();
      sys.settle(60);
      assert.strictEqual(sys.t.ctx.ready > 1 && sys.t.ctx.hash === sys.main.ctx.S[7], sys.main.ctx.S[5] < 9, 'session ' + seq + ' stream did not settle');
    }
  });
};
