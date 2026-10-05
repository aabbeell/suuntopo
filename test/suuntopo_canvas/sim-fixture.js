#!/usr/bin/env node
// ABOUTME: Builds a scratch copy of the Suuntopo app for simulator screenshots or a hardware test package (never in src/).
// ABOUTME: Usage: node sim-fixture.js <outDir> [--display q] [--slot file.stp] [--dbg view,topo,idx] [--press 3,1] [--data data.json]

'use strict';
const fs = require('fs');
const path = require('path');
const h = require('./lib/harness');

function usage(msg) {
  if (msg) console.error(msg);
  console.error('usage: node sim-fixture.js <outDir> [--display q|o|n] [--slot file.stp] [--dbg view,topo,idx] [--press 3,1] [--data data.json]');
  console.error('  --display    substitutes {{tokens}} in the ext files for this display (the simulator loads them unbuilt)');
  console.error('  --slot       puts a topo into the settings slot (topo0)');
  console.error('  --dbg        start state: view 0 list, 1 map, 2 info; topo 0 slot, 1-4 built-in; idx');
  console.error('  --press      replays long presses (1 up, 2 down, 3 middle) 1.5 s after main.js state reached the template');
  console.error('  --data       uses this data.json (hardware test package)');
  process.exit(2);
}

const args = process.argv.slice(2);
const outDir = args.shift();
if (!outDir) usage();
const opts = { display: 'q' };
while (args.length) {
  const flag = args.shift();
  const value = args.shift();
  if (value === undefined) usage('missing value for ' + flag);
  if (flag === '--display') opts.display = value;
  else if (flag === '--slot') opts.slot = fs.readFileSync(value, 'utf8').replace(/\n$/, '');
  else if (flag === '--dbg') opts.dbg = value.split(',').map(Number);
  else if (flag === '--data') opts.data = JSON.parse(fs.readFileSync(value, 'utf8'));
  else if (flag === '--press') opts.press = value.split(',').map(Number);
  else usage('unknown flag ' + flag);
}
if (['q', 'o', 'n'].indexOf(opts.display) < 0) usage('display must be q, o or n');

const out = path.resolve(outDir);
if (out.startsWith(path.resolve(h.APP))) usage('refusing to write into the app source folder');
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) fs.rmSync(path.join(out, f), { recursive: true, force: true });

// Copy only the files a source package contains; ext files get their tokens substituted for the display.
for (const f of fs.readdirSync(h.APP)) {
  if (/^ext\d+\.js$/.test(f)) {
    fs.writeFileSync(path.join(out, f), h.substitute(h.readApp(f), opts.display));
  } else if (f === 'main.js' || f === 'manifest.json' || f === 'data.json' || /\.html$/.test(f) || /^[a-z]{2}\.json$/.test(f)) {
    fs.copyFileSync(path.join(h.APP, f), path.join(out, f));
  }
}

if (opts.press) {
  if (!opts.press.every((b) => b === 1 || b === 2 || b === 3)) usage('--press takes buttons 1, 2 or 3');
  const file = path.join(out, 't.html');
  let html = fs.readFileSync(file, 'utf8');
  const calls = opts.press.map((b) => 'send(' + b + ');').join(' ');
  html = html.replace('  // END SHARED', '  // END SHARED\n  var simPressed = 0;\n  var simPress = function () { if (ms < 0) { setTimeout(simPress, 300); return; } ' + calls + ' };');
  html = html.replace('onActivate="', 'onActivate="\n  if (!simPressed) { simPressed = 1; setTimeout(simPress, 1500); }');
  fs.writeFileSync(file, html);
}

const data = opts.data || JSON.parse(fs.readFileSync(path.join(out, 'data.json'), 'utf8'));
if (opts.slot !== undefined) data.topo0 = opts.slot;
if (opts.dbg) {
  const [view, topo, idx] = opts.dbg;
  const main = h.mainContext('q', {}, h.newScreen()).ctx;
  const s = topo === 0 ? data.topo0 : main.evalFile('{file_path}/ext' + (topo + 3) + '.js')();
  const p = h.parse(s || '');
  if (p.code) usage('dbg topo ' + topo + ' does not parse (E' + p.code + ')');
  // The saved stream id is the content hash plus 65536 * topo, as main.js computes it.
  data.dbg = ['2', view, topo, Math.min(idx, p.R[1] + 1), p.R[1], p.R[2] + 65536 * topo].join(',');
  console.log('dbg ' + data.dbg);
}
fs.writeFileSync(path.join(out, 'data.json'), JSON.stringify(data, null, 1) + '\n');
console.log('scratch app written to ' + out);
