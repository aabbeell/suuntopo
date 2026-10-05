#!/usr/bin/env node
// ABOUTME: Calibration experiment for matram's failed app (forum 14940 #8): 12 minutes of HR data as a Uint8Array literal in main.js could not be activated on a Race S.
// ABOUTME: Compiles shipped-form main.js files with N-element literals and reports compile peak, largest single request and largest retained block.

'use strict';

const fs = require('fs');
const path = require('path');
const L = require('./lib');

const args = L.parseArgs(process.argv.slice(2), { counts: '144,360,720,1440', forms: 'u8,array' });
const counts = args.counts.split(',').map(Number);
const forms = args.forms.split(',');

/* Deterministic HR-like values 60..190. */
function values(n) {
	const v = [];
	let x = 120;
	for (let i = 0; i < n; i++) { x += ((i * 37) % 11) - 5; if (x < 60) x = 60 + (i % 7); if (x > 190) x = 190 - (i % 7); v.push(x); }
	return v;
}

function source(form, n) {
	const lit = '[' + values(n).join(',') + ']';
	const init = form === 'u8' ? `new Uint8Array(${lit})` : lit;
	return `// 3\nvar h=${init},i=0;return function(_e,_,_d){1===_e&&(i=(i+1)%h.length,_[0]=h[i])};\n`;
}

const probe = `
var f, d;
SPH.checkpoint('baseline');
f = SPH.load(PARAMS.path, 1);
SPH.checkpoint('compiled');
d = f();
SPH.checkpoint('instantiated');
f = null;
SPH.checkpoint('template released');
`;

const rows = [];
for (const variant of args.variants) {
	for (const form of forms) {
		for (const n of counts) {
			const dir = L.workDir('lit');
			const p = path.join(dir, 'main.js');
			const src = source(form, n);
			fs.writeFileSync(p, src);
			const rep = L.runProbe(variant, probe, { params: { path: p }, dir });
			const m = L.cps(rep);
			const base = m.baseline.live;
			const peak = Math.max(m.compiled.phasePeak, m.instantiated.phasePeak) - base;
			const kept = L.delta(rep, 'template released');
			/* 32-bit sizes of the big transient blocks: the compiler's bytecode buffer is bytes (same size on the watch);
			 * the value stack and the temporary Array part hold 8-byte tvals on the watch (16 on this host). */
			const bcWatch = m.compiled.phaseMaxReq;
			const vsWatch = Math.round(m.instantiated.phaseMaxReq / (rep.layout.host.tval / rep.layout.target32.tval));
			const arrWatch = n * rep.layout.target32.tval;
			const worst = Math.max(bcWatch, vsWatch, arrWatch);
			const verdict = worst > 4225 ? 'oversize on the watch (> ~4.1 KB cap)' : worst >= 1964 ? 'risky (> ~2 KB block)' : 'ok';
			rows.push([variant, form, n, L.fmt(src.length), L.fmt(peak), L.fmt(bcWatch), L.fmt(vsWatch), L.fmt(arrWatch), L.fmt(kept.t32), verdict]);
			if (rep.errorsTotal || rep.fatal) rows[rows.length - 1].push(rep.fatal || rep.errors.join('|'));
			fs.rmSync(dir, { recursive: true, force: true });
		}
	}
}
console.log('HR-data literal in main.js (forum 14940 #8: 12 min of HR in a Uint8 array fails to activate on a Race S; without it the app activates)');
console.log(L.table(['variant', 'form', 'values', 'main.js B', 'load peak host', 'bytecode buffer (watch B)', 'value stack (watch B)',
	'temp Array part (watch B)', 'retained est32', 'verdict'], rows));
console.log('form u8 = new Uint8Array([..]), array = plain [..]. load peak: highest live bytes above baseline during compile + first call (host, before GC).');
console.log('bytecode buffer: largest compile request (a byte buffer, same size on the watch); value stack: largest request while the module body runs');
console.log('(measured: about one value-stack slot per literal element), halved for 8-byte tvals; temp Array part: values x 8 B, the literal');
console.log('before it is copied into the Uint8Array. Watch limits used: one block <= ~4.1 KB (4,226 and 4,381 were refused as "oversize"),');
console.log('and blocks >= ~2 KB often fail on a fragmented heap. retained: what the running app keeps after the compiled template is released.');
