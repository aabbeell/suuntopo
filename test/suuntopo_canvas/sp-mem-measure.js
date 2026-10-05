#!/usr/bin/env node
// ABOUTME: Runs tools/sp-mem (lowmem, shipped form) on a Suuntopo app folder over the memory scenarios and prints the est32
// ABOUTME: steady, load and run peaks, largest blocks, cyclic garbage and canvas maxima. Usage: node sp-mem-measure.js [appDir] [scenarios]

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SP_MEM = path.join(ROOT, 'tools/sp-mem/sp-mem.js');
const SCENARIOS = {
  default: path.join(ROOT, 'tools/sp-mem/scenarios/default.js'),
  tour: path.join(__dirname, 'sp-mem-tour.js'),
  worst: path.join(__dirname, 'sp-mem-worst.js'),
  slotmap: path.join(__dirname, 'sp-mem-slotmap.js'),
  reload: path.join(__dirname, 'sp-mem-reload.js'),
  long: path.join(__dirname, 'sp-mem-long.js')
};

const app = path.resolve(process.argv[2] || path.join(ROOT, 'src/suuntopo_canvas'));
const which = (process.argv[3] || 'default,tour,worst,slotmap,reload').split(',');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-mem-measure-'));
const num = (s) => Number(String(s).replace(/,/g, ''));

console.log('scenario  steady   load    run     largest block    fn block  garbage avg/max  canvas  main.js  t.xml');
for (const name of which) {
  if (!SCENARIOS[name]) throw new Error('unknown scenario ' + name + ' (' + Object.keys(SCENARIOS).join(', ') + ')');
  const json = path.join(out, name + '.json');
  const run = spawnSync('node', [SP_MEM, app, '--scenario', SCENARIOS[name], '--variants', 'lowmem', '--forms', 'shipped', '--json', json], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const txt = run.stdout + run.stderr;
  fs.writeFileSync(path.join(out, name + '.txt'), txt);
  const row = {};
  let m;
  if ((m = txt.match(/shipped main\.js ([\d,]+) B; templates t\.xml ([\d,]+) B/))) { row.main = num(m[1]); row.txml = num(m[2]); }
  if ((m = txt.match(/^steady state\s+[\d,-]+\s+([\d,-]+)/m))) row.steady = num(m[1]);
  if ((m = txt.match(/^load peak.*?\s([\d,]+)\s+([\d,]+)\s+([\d,]+)\s*$/m))) row.load = num(m[2]);
  if ((m = txt.match(/^run peak.*?\s([\d,]+)\s+([\d,]+)\s+([\d,]+)\s*$/m))) row.run = num(m[2]);
  if ((m = txt.match(/^lowmem\s+.*?\s([\d,]+) \/ ([\d,]+)\s+([\d.-]+)\s*$/m))) row.garbage = num(m[1]) + '/' + num(m[2]);
  if ((m = txt.match(/largest live app block \(steady\)\s+([\d,]+)\s+([\d,]+)\s+(\S+)/))) row.block = num(m[2]) + ' ' + m[3];
  if ((m = txt.match(/largest compiled-function data block\s+([\d,]+)\s+([\d,]+)/))) row.fn = num(m[2]);
  let canvas = 0;
  const re = /^#c\d\s+.*?(\d+)\s+(\d+)\s*$/gm;
  while ((m = re.exec(txt))) canvas = Math.max(canvas, Number(m[2]));
  if (run.status !== 0 || row.steady === undefined) {
    console.log(name.padEnd(9) + ' sp-mem failed, see ' + path.join(out, name + '.txt'));
    continue;
  }
  console.log([name.padEnd(9), String(row.steady).padStart(6), String(row.load).padStart(6), String(row.run).padStart(6), String(row.block).padEnd(16),
    String(row.fn).padStart(8), String(row.garbage).padStart(16), String(canvas).padStart(7), String(row.main).padStart(8), String(row.txml).padStart(6)].join('  '));
}
console.log('reports in ' + out);
