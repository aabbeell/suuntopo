#!/usr/bin/env node
// ABOUTME: Cyclic garbage per action of the sp-mem tour (sp-mem-tour.js): reads an sp-mem --json report and groups each tick's
// ABOUTME: msGarbage (lowmem, shipped form) by the tour action of that tick. Usage: node sp-mem-garbage.js <report.json>

'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = process.argv[2];
if (!file) {
  console.error('usage: node sp-mem-garbage.js <report.json>  (from: node tools/sp-mem/sp-mem.js src/suuntopo_canvas ' +
    '--scenario test/suuntopo_canvas/sp-mem-tour.js --json <report.json>)');
  process.exit(2);
}

// The tour plan, read from the scenario file itself so the two never disagree.
const sandbox = { scenario: () => {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'sp-mem-tour.js'), 'utf8') + '\n;this.plan = TOUR.plan;', sandbox);
const plan = sandbox.plan;
const ACTION = { '.': 'wait', u: 'hold UP', d: 'hold DOWN', m: 'hold MIDDLE', l: 'lap' };

const result = JSON.parse(fs.readFileSync(file, 'utf8')).results['lowmem/shipped'];
const t = result.tickFields.indexOf('t');
const g = result.tickFields.indexOf('msGarbage');
const groups = {};
let sum = 0;
let n = 0;
let first = 0;
for (const tick of result.ticks) {
  // Ticks up to 0 are the harness's dry ticks, with no app loaded.
  if (tick[t] < 1 || tick[g] < 0) continue;
  const action = tick[t] === 1 ? 'first tick (after mount)' : ACTION[plan.charAt(tick[t] - 1)] || 'after the plan';
  if (tick[t] === 1) first = tick[g];
  (groups[action] = groups[action] || []).push(tick[g]);
  sum += tick[g];
  n++;
}
console.log('cyclic garbage, host bytes (lowmem, shipped form): average ' + Math.round(sum / n) + ' B per tick over ' + n + ' ticks, first tick ' + first + ' B');
for (const [action, list] of Object.entries(groups)) {
  const avg = Math.round(list.reduce((a, b) => a + b, 0) / list.length);
  console.log('  ' + action.padEnd(24) + ' ticks ' + String(list.length).padStart(3) + '  average ' + String(avg).padStart(6) + ' B  max ' + String(Math.max.apply(null, list)).padStart(6) + ' B');
}
