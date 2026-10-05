// ABOUTME: T6: localization. Token and en.json key sets match across t.html, u.html, main.js and the ext files, values avoid
// ABOUTME: characters that break the build or STP1, and app strings fit their character budgets on q, o and n.

'use strict';
const assert = require('assert');
const h = require('./lib/harness');

const FILES = () => ['t.html', 'u.html', 'main.js'].concat(h.extFiles());

const usedKeys = () => {
  const keys = new Set();
  for (const f of FILES()) {
    for (const m of h.readApp(f).matchAll(/{{\s*([A-Za-z0-9_]+)\s*}}/g)) {
      if (!/^[A-Z_0-9]+$/.test(m[1])) keys.add(m[1]);
    }
  }
  return keys;
};

// Character budgets of ext3.js (name) and ext11.js (cpl) for display d (same expressions as the files).
const budgets = (d) => ({ name: d === 'n' ? 14 : 15, cpl: d === 'n' ? 17 : (d === 'o' ? 20 : 18), h2: d === 'n' ? 11 : 12 });

module.exports = (test) => {
  test('T6 every token used has an en.json key and every key is used', () => {
    assert.deepStrictEqual([...usedKeys()].sort(), Object.keys(h.lang()).sort());
  });

  test('T6 en.json values avoid build- and STP1-breaking characters', () => {
    for (const [k, v] of Object.entries(h.lang())) {
      assert(v.length > 0, k + ' is empty');
      assert(!/['"\\<>&{}|~\n\r]/.test(v), k + ' contains a forbidden character: ' + v);
      assert.strictEqual(v, v.trim(), k + ' has surrounding spaces');
    }
  });

  test('T6 the budgets used by ext3.js and ext11.js are the ones checked here', () => {
    assert(/NC = D === 'n' \? 14 : 15/.test(h.readApp('ext3.js')), 'update budgets() in this test');
    assert(/CPL = D === 'n' \? 17 : \(D === 'o' \? 20 : 18\)/.test(h.readApp('ext11.js')), 'update budgets() in this test');
  });

  test('T6 app strings fit their character budgets on q, o and n', () => {
    const L = h.lang();
    for (const d of ['q', 'o', 'n']) {
      const b = budgets(d);
      const fits = (s, max, what) => assert(s.length <= max, d + ': "' + s + '" (' + what + ') is ' + s.length + ' > ' + max);
      fits(L.demoName, b.name, 'demo name');
      fits(L.wHelp, b.name, 'help title');
      fits(L.wTopo, b.name, 'error card title');
      fits(L.wPitch + ' 60/60', b.name, 'map position (top line)');
      fits(L.wNotes + ' 9/9', b.h2, 'info page count');
      fits(L.wLoading + ' 99%', b.cpl, 'loading line');
      fits(L.hintOpen, b.cpl, 'open hint on a list card');
      fits(L.hintMap, b.cpl, 'map hint under the open topo card');
      fits('5c  4 ' + L.pMany, b.name, 'route card pitch count in words (falls back to ' + L.pAbbr + ' when longer)');
      fits(L.wApproach, b.cpl, 'info title');
      fits(L.wDescent, b.cpl, 'info title');
      fits(L.wSchematic, b.cpl, 'built-in label');
      fits(L.noNotes, b.cpl, 'no notes');
      fits('60 ' + L.pAbbr, b.name, 'route card pitch count');
      for (let i = 1; i <= 6; i++) fits(L['help' + i], b.cpl, 'help line ' + i);
      for (let i = 1; i <= 6; i++) fits(L['keys' + i], b.cpl, 'button help line ' + i);
    }
  });

  test('T6 error texts fit one Info page with the code appended', () => {
    const L = h.lang();
    for (const d of ['q', 'o', 'n']) {
      const sys = h.rig({ display: d, storage: { topo0: '{"old":1}' } });
      for (const k of ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e9']) {
        sys.main.ctx.S[10] = Number(k.slice(1));
        sys.main.ctx.S[1] = 0;
        sys.main.ctx.S[0] = 0;
        sys.main.ctx.onEvent(sys.main.input, sys.main.output, 3000000);
        const lines = [0, 1, 2, 3, 4, 5].map((i) => sys.screen.shown('#l' + i)).filter(Boolean);
        // Review round 2: the codes the editor fixes (E2-E5, E7) say so.
        const fix = ['e2', 'e3', 'e4', 'e5', 'e7'].indexOf(k) >= 0 ? ' ' + L.eFix : '';
        assert.strictEqual(lines.join(' '), L[k] + fix + ' (E' + k.slice(1) + ')', d + ' ' + k);
        for (const line of lines) assert(line.length <= budgets(d).cpl, d + ' ' + k + ' line too long: ' + line);
      }
    }
  });

  // Review round 3: one 27-character line ran past the right edge on s and l. Each line of u.html now fits 16 characters
  // (screenshots on s, m and l show the 13-character lines with room to spare).
  test('T6 the not-supported screen of UI1 watches (s, m, l) is lines of at most 16 characters', () => {
    const L = h.lang();
    const keys = [...h.readApp('u.html').matchAll(/{{([A-Za-z0-9_]+)}}/g)].map((m) => m[1]);
    assert(keys.length >= 2, 'u.html lines: ' + keys.join(', '));
    for (const k of keys) assert(L[k].length <= 16, k + ': "' + L[k] + '" is ' + L[k].length + ' characters');
  });

  test('T6 manifest name, description and version are within store limits', () => {
    const m = JSON.parse(h.readApp('manifest.json'));
    assert(Buffer.byteLength(m.name) <= 60);
    assert(Buffer.byteLength(m.description) <= 22, 'description longer than the recommended 22 characters');
    assert(m.version.length <= 4);
    assert.deepStrictEqual(m.languages, ['en']);
    // Abel kept the Suunto brand in the name (2026-10-04); every listing text must then say the app is not affiliated.
    if (/suunto/i.test(m.name)) {
      const listing = require('fs').readFileSync(require('path').join(h.ROOT, 'store/suuntopo_canvas/listing.md'), 'utf8');
      for (const re of [/^> .*not affiliated with or endorsed by Suunto/m, /^> .*Not affiliated with Suunto/m]) assert(re.test(listing), 'listing lacks ' + re);
    }
  });
};
