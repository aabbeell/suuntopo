#!/usr/bin/env node
// ABOUTME: Byte-exact check of the harness against watch logs: climb-logger builds whose main.js compile failed on a Vertical 2 with "JSalloc:<n>".
// ABOUTME: Compares n with the largest compiled-function data block the lowmem harness computes, and the bytecode-buffer growth steps per engine config.

'use strict';

const fs = require('fs');
const path = require('path');
const L = require('./lib');

const GH = process.env.SPMEM_GH || '/tmp/sp-mem-gh';
const args = L.parseArgs(process.argv.slice(2), { variants: 'lowmem,default' });
const variants = Array.isArray(args.variants) ? args.variants : args.variants.split(',');

/* Builds and the failing request the watch logged while compiling their main.js ("Zapp climbl01:Load script" -> "JSalloc:n"),
 * from wylandplex/suuntoplus-climb-logger docs/watch-logs (Vertical 2, FW 2.53.42, Weather + Movement co-enabled). */
const CASES = [
	{ sha: 'eaae480', log: '2026-07-07g_enabledrain-CONFIRMED-...', watch: 2348, count: '11x' },
	{ sha: 'c63fe4a', log: '2026-07-07h_ROOTCAUSE-single-disable-...', watch: 2364, count: '3x' },
	{ sha: 'a9bfc2b', log: '2026-07-07i/j (hybrid-switchfix, master-reflash)', watch: 2392, count: '18-21x' },
	{ sha: '9f9d8e1', log: '2026-07-09_1521-toggle2-storm_JSalloc2636x11', watch: 2636, count: '11x' }
];

/* Watch sizes that are not tied to one function (bytecode growth candidates). */
const WATCH_OTHER = [1964, 2095, 4226, 4381];

function bwSequence(preferSize, pc2line, upTo) {
	const instr = pc2line ? 8 : 4;
	const shift = preferSize ? 4 : 2;
	let size = (preferSize ? 16 : 256) * instr;
	const seq = [size];
	while (size < upTo) {
		const used = size - (size % instr);
		size = used + instr + (used >> shift) + 64;
		seq.push(size);
	}
	return seq;
}

const probe = `
var f;
SPH.checkpoint('baseline');
f = SPH.load(PARAMS.path, 1);
SPH.checkpoint('compiled');
`;

console.log('1. Function data blocks: watch "JSalloc:n" while compiling main.js vs the largest compiled-function data block in the harness');
const rows = [];
for (const c of CASES) {
	const main = path.join(GH, 'climb', `b-${c.sha}`, 'main.js');
	if (!fs.existsSync(main)) { rows.push([c.sha, 'missing: run fetch-sources.sh']); continue; }
	const row = [c.sha, fs.statSync(main).size, c.log, `${c.watch} (${c.count})`];
	for (const v of variants) {
		const rep = L.runProbe(v, probe, { params: { path: main } });
		const top = L.cps(rep).compiled.walk.appTopBlocks.filter((b) => b[2] === 'functions').map((b) => b[0]);
		row.push(`${top[0]} (${top[0] - c.watch >= 0 ? '+' : ''}${top[0] - c.watch})`);
	}
	rows.push(row);
}
console.log(L.table(['build', 'main.js B', 'watch log', 'watch JSalloc', ...variants.map((v) => `largest fn data est32 ${v} (minus watch)`)], rows));
console.log('A compiled function\'s data block = fixed-buffer header + constants x 8 + inner-function pointers x 4 + bytecode x 4 B (32-bit).');
console.log('The payload is configuration-independent; only the header differs (harness 32-bit: lowmem 16 B, default 24 B). A constant');
console.log('difference of 4 B (lowmem) means the watch\'s fixed-buffer header is 12 B (for example 16-bit heap pointers, DUK_USE_HEAPPTR16).');
console.log();

console.log('2. Bytecode-buffer growth steps (Duktape 2.7 duk_bw_resize: used + need + (used >> shift) + 64) vs other watch sizes');
const seqs = [
	['PREFER_SIZE, no PC2LINE (= harness lowmem)', bwSequence(true, false, 6000)],
	['PREFER_SIZE, PC2LINE', bwSequence(true, true, 6000)],
	['speed, no PC2LINE', bwSequence(false, false, 6000)],
	['speed, PC2LINE (= harness default)', bwSequence(false, true, 6000)]
];
const srows = seqs.map(([name, seq]) => [name, WATCH_OTHER.filter((w) => seq.includes(w)).join(', ') || 'none',
	seq.filter((s) => s >= 1800 && s <= 4800).join(' ')]);
console.log(L.table(['engine configuration', 'watch sizes that are exact steps', 'steps 1.8-4.8 KB'], srows));
console.log('2095 (P4 ext90 parse, climb-logger Load script) and 4381 ("oversize", climb-logger ext21/ext22 parse) are exact steps only for');
console.log('PREFER_SIZE without PC2LINE. 1964 and 4226 are not bytecode steps (other allocations: 1964 recurs across builds, 4226 is #66\'s ext10).');
