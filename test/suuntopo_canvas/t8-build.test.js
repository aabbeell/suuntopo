// ABOUTME: T8: build and packaging. sp-build builds every display without warnings; compiled template, main.js and ext sizes
// ABOUTME: stay within the budgets of the deep-dive research; settings fit data.jsn; the source package holds the app files only.

'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const h = require('./lib/harness');

const EXT = path.join(os.homedir(), '.vscode/extensions/suunto.suuntoplus-editor-1.42.0/node_modules');
const SP_BUILD = path.join(h.ROOT, 'tools/sp-build/sp-build.js');

// Budgets (docs/research/deep-dive/limits.md and suuntopo-crash.md) and the measured guards this build must keep.
const LIMITS = {
  // Raised by 200 B on 2026-10-04 for the review fixes (stream order, single refresh chain, subscription release, $.get of the
  // current state): 10,588 -> 10,791 B and 6,999 -> 7,185 B. Dropping glyphs and decorated styles would save ~1.9 KB (SPEC §8).
  // Review round 2 (2026-10-04): t.xml +133 B (refresh chain recovery, units sent on change, the open card's Map hint, the
  // bound on long patterned segments; dropping arcs saved 120 B) and ext3.js +171 B (helper cleanup against cyclic garbage,
  // an action on every error card). Compile requests, the binding limit, stay under 2,499 B (next test).
  // Review round 3 (2026-10-04): onLoad +37 B (route first after a mount, a per-tile cap on patterned segments, hardened
  // activation, 100 ms refresh spacing; factoring the tick offset in drawLine saved 16 B), t.xml +73 B with the hardened
  // onDeactivate and the shorter bottom tile; main.js +16 B (restart the stream at chunk 0 for a template that holds
  // nothing). main.js's guard is now the research limit itself, 2 KB.
  // Round 4 (memory, 2026-10-04): t.xml +530 B and onLoad +530 B for prototype = null on 23 template functions (+408 B), the
  // renderer's own scope (made once by makeRenderer, then dropped) and the bind fallback. They save 3.9 KB steady and 4.8 KB
  // load peak (sp-mem, lowmem est32), which is the binding measure; the source sizes are only a proxy for it.
  // Pull stream (2026-10-04, after the first watch test stopped at "Loading 0%" on the subscription limit): t.xml and onLoad
  // +740 B for the request, read chain and watchdog; main.js -94 B. sp-mem: steady -490 B, load peak +440 B, run peaks flat.
  tXml: 12300, // mounted template; research target 8-10 KB (measured 12,264 B, pull stream)
  onLoad: 8600, // template onLoad script; research target about 6 KB (measured 8,556 B, pull stream)
  templateFunction: 2000, // any single template function
  mainJs: 2048, // minified main.js; research limit 2 KB (measured 2,012 B, round 3)
  codeExt: 2100, // code ext files; research guideline 1.6 KB, loaded only at rare moments (largest measured 2,066 B, ext3.js)
  topoExt: 3500, // built-in topo files, binding decision 1
  dataJsn: 2048 // data.jsn with a full 1500-byte topo and a saved position; research: under 2 KB
};

// [name, bytes] of every function in a script: its own source, without the functions nested in it, since Duktape compiles
// each nested function into a block of its own. A function is named by the variable it is assigned to; the function a
// function returns is named after that function plus '()' (the renderer's per-frame drawTile).
function functionSizes(script) {
  const acorn = require(path.join(EXT, 'acorn'));
  const out = [];
  const visit = (node, name) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'FunctionExpression') {
      let own = node.end - node.start;
      const inner = (n, label) => {
        if (!n || typeof n.type !== 'string') return;
        if (n.type === 'FunctionExpression') {
          own -= n.end - n.start;
          visit(n, label);
          return;
        }
        const next = n.type === 'VariableDeclarator' ? n.id.name : (n.type === 'ReturnStatement' ? name + '()' : label);
        for (const key of Object.keys(n)) {
          const v = n[key];
          if (Array.isArray(v)) v.forEach((x) => inner(x, next));
          else if (v && typeof v.type === 'string') inner(v, next);
        }
      };
      inner(node.body, name);
      out.push([name, own]);
      return;
    }
    const next = node.type === 'VariableDeclarator' ? node.id.name : name;
    for (const key of Object.keys(node)) {
      const v = node[key];
      if (Array.isArray(v)) v.forEach((x) => visit(x, next));
      else if (v && typeof v.type === 'string') visit(v, next);
    }
  };
  visit(acorn.parse(script, { ecmaVersion: 5 }), '(top)');
  return out;
}

function packageCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'topo-pkg-'));
  for (const f of fs.readdirSync(h.APP)) {
    if (/^(main\.js|manifest\.json|data\.json|[a-z]+\.html|[a-z]{2}\.json|ext\d+\.js)$/.test(f)) fs.copyFileSync(path.join(h.APP, f), path.join(dir, f));
  }
  return dir;
}

let built = null;
function build() {
  if (built) return built;
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'topo-build-'));
  // Both streams: the build library's validator warns on stderr (review round 2: reading stdout alone missed it).
  const run = spawnSync('node', [SP_BUILD, packageCopy(), out], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (run.status !== 0) throw new Error('sp-build failed:\n' + run.stdout + run.stderr);
  const log = run.stdout + run.stderr;
  const AdmZip = require(path.join(EXT, 'adm-zip'));
  const pkg = {};
  for (const d of ['s', 'm', 'l', 'n', 'o', 'q']) {
    const zip = new AdmZip(path.join(out, 'suunto01-' + d + '-en.fea'));
    pkg[d] = {};
    for (const e of zip.getEntries()) pkg[d][e.entryName] = e.getData().toString('utf8');
  }
  built = { log, pkg };
  return built;
}

module.exports = (test) => {
  // Review round 2: the validator's "data.json: Invalid type 'number' for 'lapAdv', expected object or string" went to
  // stderr, which was not read, and matched none of the filter words. Every line on either stream must now be one of the
  // build library's informational lines.
  const INFO_LINES = [
    /^$/,
    /^[a-z]+\.html for [a-z] display: input size \d+ bytes, output size \d+ bytes$/,
    /^main\.js: original size \d+ bytes, minified size \d+ bytes$/,
    /^Removed HTML templates for display [a-z]: [a-z]+\.html$/,
    /^BUILD OK appId=suunto01$/,
    /^\S+\/suunto01-[a-z]-en\.fea \d+ bytes$/
  ];

  test('T8 sp-build builds every display with no warnings (only informational build lines); packages hold the expected files', () => {
    const { log, pkg } = build();
    assert(/BUILD OK appId=suunto01/.test(log), log);
    for (const line of log.split('\n')) assert(INFO_LINES.some((re) => re.test(line)), 'build message: ' + line);
    const exts = h.extFiles();
    for (const d of ['n', 'o', 'q']) assert.deepStrictEqual(Object.keys(pkg[d]).sort(), ['data.jsn', 'main.js', 'manifest.jsn', 't.xml'].concat(exts).sort(), d);
    for (const d of ['s', 'm', 'l']) assert(pkg[d]['u.xml'] && !pkg[d]['t.xml'], d + ' gets the not-supported template');
  });

  test('T8 compiled sizes: template, onLoad, every template function, main.js and the ext files', () => {
    const { pkg } = build();
    const q = pkg.q;
    const onLoad = q['t.xml'].substring(q['t.xml'].indexOf('<onLoad>') + 8, q['t.xml'].indexOf('</onLoad>'))
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    const fns = functionSizes(onLoad);
    const biggest = fns.reduce((a, b) => (b[1] > a[1] ? b : a));
    const sizes = { tXml: Buffer.byteLength(q['t.xml']), onLoad: Buffer.byteLength(onLoad), mainJs: Buffer.byteLength(q['main.js']) };
    console.log('     t.xml ' + sizes.tXml + ' B, onLoad ' + sizes.onLoad + ' B (largest function ' + biggest[0] + ' ' + biggest[1] + ' B), main.js ' + sizes.mainJs + ' B');
    console.log('     ext: ' + h.extFiles().map((f) => f + ' ' + Buffer.byteLength(q[f])).join(', '));
    assert(sizes.tXml <= LIMITS.tXml, 't.xml ' + sizes.tXml);
    assert(sizes.onLoad <= LIMITS.onLoad, 'onLoad ' + sizes.onLoad);
    assert(biggest[1] <= LIMITS.templateFunction, 'template function ' + biggest[0] + ' is ' + biggest[1] + ' B');
    assert(sizes.mainJs <= LIMITS.mainJs, 'main.js ' + sizes.mainJs);
    for (const f of h.extFiles()) {
      const max = h.TOPO_EXT.indexOf(f) >= 0 ? LIMITS.topoExt : LIMITS.codeExt;
      assert(Buffer.byteLength(q[f]) <= max, f + ' is ' + Buffer.byteLength(q[f]) + ' B (limit ' + max + ')');
    }
  });

  test('T8 every compiled code block stays at or under 2,499 B in Duktape (sp-mem harness, lowmem = watch configuration)', () => {
    const harness = path.join(h.ROOT, 'tools/sp-mem/build/sp-mem-lowmem');
    if (!fs.existsSync(harness)) {
      console.log('     skipped: tools/sp-mem harness not built (bash tools/sp-mem/build.sh)');
      return;
    }
    const { pkg } = build();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'topo-req-'));
    const specs = [];
    for (const f of ['main.js'].concat(h.extFiles())) {
      fs.writeFileSync(path.join(dir, f), pkg.q[f]);
      specs.push(path.join(dir, f) + (f === 'main.js' ? ':main' : ':ext'));
    }
    const out = execFileSync('node', [path.join(h.ROOT, 'tools/sp-mem/calibration/exp-compile-requests.js'), '--variants', 'lowmem'].concat(specs), { encoding: 'utf8', maxBuffer: 1 << 24 });
    const rows = out.split('\n== ').slice(1).map((block) => {
      const file = path.basename(block.split(' ')[0]);
      const m = block.match(/\nlowmem\s+([\d,]+)\s+([\d,]+)/);
      return [file, Number(m[2].replace(/,/g, ''))];
    });
    console.log('     max compile request (B): ' + rows.map(([f, r]) => f + ' ' + r).join(', '));
    for (const [f, req] of rows) {
      // Built-in topo files hold their topo as one string literal; binding decision 1 allows files up to 3.5 KB.
      assert(req <= (h.TOPO_EXT.indexOf(f) >= 0 ? 3600 : 2499), f + ' compiles with a ' + req + ' B request');
    }
  });

  test('T8 the built ext files have their tokens substituted (the simulator loads the source copies)', () => {
    const { pkg } = build();
    for (const f of h.extFiles()) assert(!/{{/.test(pkg.q[f]), f + ' keeps a token in the package');
    assert(/'q'/.test(pkg.q['ext3.js']) && /'n'/.test(pkg.n['ext3.js'].replace("D==='n'", '')), 'display id substituted per display');
  });

  // Review round 2: the source package is what the store gets, so the Piccolo Fillar built-in carries neutral notes unless
  // Vitya confirms in writing that the guidebook-based notes are his own (SPEC §18 Q7); make-builtins.js --personal writes
  // them for a personal build only.
  test('T8 the shipped Piccolo Fillar built-in (ext6.js) has neutral notes: no pitch notes, a schematic warning as approach', () => {
    const main = h.mainContext('q', {}, h.newScreen()).ctx;
    const s = main.evalFile('{file_path}/ext6.js')();
    const p = h.parse(s);
    assert.strictEqual(p.code, 0);
    for (let k = 0; k < p.R[1]; k++) {
      const v = p.R[18 + 3 * k];
      assert.strictEqual(v % 256, 0, 'pitch ' + (k + 1) + ' has notes: ' + s.substr(Math.floor(v / 256), v % 256));
    }
    assert.strictEqual(s.substring(p.R[8], p.R[9]), 'Schematic sketch, not a guide. Check the route on site.');
    assert.strictEqual(s.substring(p.R[10], p.R[11]), 'Check the descent on site.');
    assert(!/personal/i.test(h.readApp('ext6.js').split('\n').slice(0, 2).join(' ')), 'ext6.js is the personal build');
  });

  test('T8 the demo built-in equals fixtures/demo.stp and is labelled fictional', () => {
    const main = h.mainContext('q', {}, h.newScreen()).ctx;
    const demo = main.evalFile('{file_path}/ext4.js')();
    assert.strictEqual(demo, h.fixture('demo.stp'));
    assert(/Fictional/.test(demo.split('|')[1]));
  });

  // Review round 2: the validator warns on any top-level value that is not a string or an object, and the reference's
  // settings example ships an enum default as a string; ext0.js reads both forms (T9).
  test('T8 data.json: one empty slot, lap advance off (the string "0"), no debug state; a full slot still fits under 2 KB', () => {
    const data = JSON.parse(h.readApp('data.json'));
    assert.deepStrictEqual(data, { topo0: '', lapAdv: '0', sv: '' });
    const full = Object.assign({}, data, { topo0: 'x'.repeat(1500), sv: '2,2,4,61,60,327664' });
    assert(Buffer.byteLength(JSON.stringify(full)) <= LIMITS.dataJsn, 'data.jsn worst case ' + Buffer.byteLength(JSON.stringify(full)));
  });

  test('T8 manifest: one 1500-byte slot, inline enum, 19 outputs (limit 20), 1 logged, no activities', () => {
    const m = JSON.parse(h.readApp('manifest.json'));
    assert.deepStrictEqual(m.settings[0], { shownName: 'Topo line from editor', path: 'topo0', type: 'string', maxLength: 1500 });
    assert.deepStrictEqual(m.settings[1].values, ['Off', 'On']);
    for (const s of m.settings) assert(!s.valuePath, 'valuePath crashes the Suunto app');
    assert.strictEqual(m.out.length, 19);
    assert.strictEqual(m.out.filter((o) => o.log).length, 1);
    assert(!m.activities, 'activities is undocumented and could hide the app');
  });

  test('T8 the source package contains exactly the app files', () => {
    const lib = require(path.join(EXT, '@suunto-internal/suuntoplus-tools/lib/source-package.js'));
    const AdmZip = require(path.join(EXT, 'adm-zip'));
    const zipPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'topo-src-')), 'src.zip');
    return lib.createSourcePackage(h.APP, zipPath).then(() => {
      const names = new AdmZip(zipPath).getEntries().map((e) => e.entryName).sort();
      assert.deepStrictEqual(names, ['data.json', 'en.json', 'main.js', 'manifest.json', 't.html', 'u.html'].concat(h.extFiles()).sort());
    });
  });
};
