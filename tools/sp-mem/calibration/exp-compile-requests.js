#!/usr/bin/env node
// ABOUTME: Engine-configuration fingerprint: compiles shipped main.js / ext*.js files in each harness variant and lists every allocation request >= 1 KB.
// ABOUTME: Matches them against "ERR DUKTAPE : JSalloc:<n>" sizes from watch logs; usage: node exp-compile-requests.js [--watch 2636,2095,...] file.js[:main|:ext] ...

'use strict';

const path = require('path');
const L = require('./lib');

/* JSalloc sizes seen in watch logs (forum 15490, 15692, 14783 #134/#135; climb-logger watch-logs and issue #66). */
const DEFAULT_WATCH = '16,1392,1964,2095,2508,2544,2636,4226,4381';
const args = L.parseArgs(process.argv.slice(2), { watch: DEFAULT_WATCH });
const watch = args.watch.split(',').map(Number);
const files = (args._ || []).map((spec) => {
	const m = spec.match(/^(.*?)(?::(main|ext))?$/);
	const kind = m[2] || (/^ext/.test(path.basename(m[1])) ? 'ext' : 'main');
	return { path: path.resolve(m[1]), kind };
});
if (!files.length) {
	console.log('usage: node exp-compile-requests.js [--variants lowmem,default] [--watch n,n] <file.js[:main|:ext]> ...');
	process.exit(2);
}

/* Duktape 2.7 bytecode buffer growth (duk_bw_resize): new = used + need + (used >> shift) + 64, starting at
 * DUK__BC_INITIAL_INSTS * sizeof(duk_compiler_instr). PREFER_SIZE: shift 4, 16 instrs; otherwise shift 2, 256 instrs.
 * PC2LINE makes an instr 8 B instead of 4 B. */
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
const sequences = {
	'PREFER_SIZE, no PC2LINE (lowmem)': bwSequence(true, false, 6000),
	'PREFER_SIZE, PC2LINE': bwSequence(true, true, 6000),
	'speed, no PC2LINE': bwSequence(false, false, 6000),
	'speed, PC2LINE (default)': bwSequence(false, true, 6000)
};

const probe = `
var f;
SPH.checkpoint('baseline');
f = SPH.load(PARAMS.path, PARAMS.kind);
SPH.checkpoint('compiled');
`;

console.log('Watch JSalloc sizes vs Duktape 2.7 bytecode-buffer growth steps (exact members marked *):');
for (const [name, seq] of Object.entries(sequences)) {
	const hits = watch.filter((w) => seq.includes(w));
	const hits4 = watch.filter((w) => seq.includes(w - 4));
	console.log(`  ${name}: ${seq.filter((s) => s >= 1000).map((s) => (watch.includes(s) ? s + '*' : s)).join(' ')}`);
	console.log(`    exact: ${hits.join(', ') || 'none'}; watch = step + 4: ${hits4.join(', ') || 'none'}`);
}
console.log();

for (const f of files) {
	console.log(`== ${f.path} (${f.kind === 'ext' ? 'evalFile expression' : 'shipped main.js function body'})`);
	const rows = [];
	for (const variant of args.variants) {
		const rep = L.runProbe(variant, probe, { params: { path: f.path, kind: f.kind === 'ext' ? 2 : 1 } });
		const reqs = L.bigRequestsIn(rep, 'compiled');
		const sizes = reqs.map((r) => r.size);
		const exact = watch.filter((w) => sizes.includes(w));
		const plus4 = watch.filter((w) => sizes.includes(w - 4));
		const d = L.delta(rep, 'compiled');
		const m = L.cps(rep);
		rows.push([variant, L.fmt(m.compiled.phasePeak - m.baseline.live), L.fmt(m.compiled.phaseMaxReq), L.fmt(d.t32),
			exact.join(',') || '-', plus4.join(',') || '-', reqs.map((r) => r.size + (r.old ? '<' + r.old : '')).join(' ') || '-']);
		if (rep.fatal || rep.errorsTotal) rows[rows.length - 1].push(rep.fatal || rep.errors.join('|'));
	}
	console.log(L.table(['variant', 'compile peak host', 'max request host', 'template est32', 'watch exact', 'watch = req+4', 'requests >= 1 KB (new<old for growth)'], rows));
	console.log();
}
console.log('ext files are evaluated as an evalFile expression (wrapped as function(){return (src);}), main.js as the shipped function body.');
