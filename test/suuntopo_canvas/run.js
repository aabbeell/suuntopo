#!/usr/bin/env node
// ABOUTME: Test runner for the Suuntopo watch app and its editor: runs every *.test.js file in this folder.
// ABOUTME: Usage: node test/suuntopo_canvas/run.js [name filter]; exits non-zero when any test fails.

'use strict';
const fs = require('fs');
const path = require('path');

const filter = process.argv[2] || '';
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

for (const file of fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).sort()) {
  require(path.join(__dirname, file))(test);
}

(async () => {
  let failed = 0;
  let ran = 0;
  for (const t of tests) {
    if (filter && t.name.indexOf(filter) < 0) continue;
    ran++;
    const start = Date.now();
    try {
      await t.fn();
      console.log('ok   ' + t.name + ' (' + (Date.now() - start) + ' ms)');
    } catch (err) {
      failed++;
      console.log('FAIL ' + t.name);
      console.log('     ' + String((err && err.stack) || err).split('\n').slice(0, 6).join('\n     '));
    }
  }
  console.log('\n' + (ran - failed) + ' passed, ' + failed + ' failed, ' + ran + ' run');
  process.exit(failed ? 1 : 0);
})();
