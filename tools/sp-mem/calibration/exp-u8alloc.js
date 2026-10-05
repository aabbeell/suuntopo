#!/usr/bin/env node
// ABOUTME: Calibration experiment for matram's Race S heap test (forum 15279 #0, 14940 #8): allocate Uint8Array(N) repeatedly and count bytes per allocation.
// ABOUTME: Also the module-var form of the same test and the reference's typed-array overhead note; prints measured host and estimated 32-bit bytes.

'use strict';

const fs = require('fs');
const path = require('path');
const L = require('./lib');

const args = L.parseArgs(process.argv.slice(2), { sizes: '4000,2100,200', count: '10' });
const sizes = args.sizes.split(',').map(Number);
const K = parseInt(args.count, 10);

/* (a) Holder form, as in hardware test T3: a preallocated holder array, one new Uint8Array(N) per step. */
const holderProbe = `
var SIZE = PARAMS.size, K = PARAMS.count, holder = new Array(K), i = 0;
while (i < K) { holder[i] = 0; i++; }
i = 0;
SPH.checkpoint('baseline');
function step() { holder[i] = new Uint8Array(SIZE); i++; }
step(); SPH.checkpoint('alloc 1');
while (i < K) { step(); }
SPH.checkpoint('alloc K');
`;

/* (b) Module-var form, as a main.js would most likely do it: k vars in the shipped dispatcher's scope. */
function moduleSource(k, size) {
	const vars = [];
	for (let j = 0; j < k; j++) vars.push(`a${j}=new Uint8Array(${size})`);
	return `// 2\nvar ${vars.length ? vars.join(',') + ',' : ''}n=0;return function(_e,_,_d){if(2===_e)n=1};\n`;
}
const moduleProbe = `
var f, d;
SPH.checkpoint('baseline');
f = SPH.load(PARAMS.p0, 1); d = f(); f = null;
SPH.checkpoint('k=0');
d = null;
SPH.checkpoint('released');
f = SPH.load(PARAMS.pk, 1); d = f(); f = null;
SPH.checkpoint('k=K');
`;

const rows = [];
const notes = [];
for (const variant of args.variants) {
	for (const size of sizes) {
		const rep = L.runProbe(variant, holderProbe, { params: { size, count: K } });
		const first = L.delta(rep, 'alloc 1');
		const all = L.delta(rep, 'alloc K');
		const perHost = (all.host - first.host) / (K - 1);
		const perT32 = (all.t32 - first.t32) / (K - 1);
		const perFit = all.fit === null ? null : (all.fit - first.fit) / (K - 1);
		const reqs = L.bigRequestsIn(rep, 'alloc K').map((r) => r.size);
		const bufReqHost = reqs.length ? Math.max(...reqs) : null;
		const t32 = rep.layout.target32;
		rows.push([variant, size, L.fmt(first.t32), L.fmt(perT32), L.fmt(perT32 - size), L.fmt(perFit), L.fmt(perHost),
			bufReqHost === null ? '<1 KB' : L.fmt(bufReqHost), L.fmt(Math.floor(28000 / perT32)), L.fmt(7 * perT32) + ' - ' + L.fmt(8 * perT32)]);
		if (size === 4000) {
			notes.push(`${variant}: 32-bit struct sizes used: hbufobj ${t32.hbufobj} B; Uint8Array(4000) = hbufobj + fixed buffer (header + 4000 B) = ${L.fmt(perT32)} B est32 per allocation.`);
		}
	}
	/* module-var form */
	const dir = L.workDir('u8mod');
	const p0 = path.join(dir, 'main0.js'), pk = path.join(dir, 'main7.js');
	fs.writeFileSync(p0, moduleSource(0, 4000));
	fs.writeFileSync(pk, moduleSource(7, 4000));
	const rep = L.runProbe(variant, moduleProbe, { params: { p0, pk }, dir });
	const k0 = L.delta(rep, 'k=0'), k7 = L.delta(rep, 'k=K');
	notes.push(`${variant}: module-var form, main.js with 7 x 'var aN=new Uint8Array(4000)': app ${L.fmt(k7.t32)} B est32 (${L.fmt(k7.host)} host) vs ${L.fmt(k0.t32)} B est32 without the arrays; ` +
		`difference ${L.fmt(k7.t32 - k0.t32)} B = ${L.fmt((k7.t32 - k0.t32) / 7)} B per array incl. its scope slot and bytecode.`);
	fs.rmSync(dir, { recursive: true, force: true });
}

console.log('matram allocation test (forum 15279 #0: "a single Uint8Array of 4000 elements and a total of seven such arrays" on a Race S)');
console.log(L.table(['variant', 'N', 'first alloc est32', 'per alloc est32', 'overhead est32', 'per alloc watch-fit', 'per alloc host', 'largest request host', 'fit in 28,000 B', '7x .. 8x est32'], rows));
console.log('per alloc = (K-th minus first) / (K-1), measured as live bytes after GC; est32 from the heap walk (32-bit struct sizes).');
console.log('largest request host = biggest single host allocation in the phase (only requests >= 1 KB are logged); its 32-bit size is the buffer data plus a 16 (lowmem) or 24 (default) B header.');
for (const n of notes) console.log('  ' + n);
console.log('Suunto reference (L951-960) says a typed array costs its data plus "N" bytes and illustrates N = 26 B; the harness overhead column is the Duktape 2.7 value for each configuration.');
