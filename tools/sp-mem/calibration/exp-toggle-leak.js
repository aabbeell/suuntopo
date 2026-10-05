#!/usr/bin/env node
// ABOUTME: Calibration experiment for skyfi's in-menu toggle leak (forum 15490): what one instantiated module scope costs, for probes sized like P0/P1/P4/P4b.
// ABOUTME: Generates synthetic shipped-form main.js files (byte size and module-function count from the forum table), instantiates them K times without discard.

'use strict';

const fs = require('fs');
const path = require('path');
const L = require('./lib');

const args = L.parseArgs(process.argv.slice(2), { k: '6' });
const K = parseInt(args.k, 10);

/* skyfi's probes (15490 #0, Vertical 2 FW 2.53.42): built main.js bytes, module-level functions, re-enables survived. */
const PROBES = [
	{ id: 'P0', bytes: 134, fns: 1, toggles: '56 clean (no failure)' },
	{ id: 'P1', bytes: 1446, fns: 20, toggles: '~10 (silent freeze)' },
	{ id: 'P4b', bytes: 1516, fns: 8, toggles: '~43 (JsTotMem 131712/133120)' },
	{ id: 'P4', bytes: 3260, fns: 17, toggles: '~6 (silent / JSalloc:2095)' }
];

/* A module-level helper of roughly `len` bytes; style 'code' (arithmetic) or 'str' (string literals). */
function helper(name, idx, len, style) {
	let body = '';
	let n = 0;
	while (body.length < len - 30) {
		if (style === 'str') body += `systemEvent('p${idx} step ${n} value '+t),`;
		else body += `t=(t*${3 + (n % 7)}+${idx * 11 + n})%${97 + n},`;
		n++;
	}
	return `${name}=function(t){return ${body}t}`;
}

/* Iterate the helper size until the file is within 2% of the probe's byte size. */
function shippedMain(p, style) {
	let per = 0;
	let src = shippedMainPer(p, style, per);
	for (let it = 0; it < 12 && p.fns > 0; it++) {
		const err = p.bytes - src.length;
		if (Math.abs(err) <= p.bytes * 0.02) break;
		per = Math.max(-1000, per + Math.round(err / p.fns));
		src = shippedMainPer(p, style, per);
	}
	return src;
}

function shippedMainPer(p, style, adjust) {
	const names = [];
	for (let i = 0; i < p.fns; i++) names.push('f' + i.toString(36));
	/* dispatcher: onLoad + evaluate, calls every helper once so none is dead code */
	const calls = names.map((n) => `s=${n}(s)`).join(',');
	const dispatcher = `return function(_e,_,_d){2===_e&&(s=0),1===_e&&(${calls || 's++'},_[0]=s)};`;
	const fixed = `// 3\nvar s=0${names.length ? ',' : ''}`.length + dispatcher.length + 1 + Math.max(0, names.length - 1);
	const per = names.length ? Math.max(24, Math.floor((p.bytes - fixed) / names.length) + adjust) : 0;
	const helpers = names.map((n, i) => helper(n, i, per, style));
	let src = `// 3\nvar s=0${helpers.length ? ',' + helpers.join(',') : ''};${dispatcher}\n`;
	if (!names.length) src = `// 3\nvar s=0;${dispatcher}\n`;
	return src;
}

/* Instantiate the same main.js K times in one heap and keep every dispatcher (no discard), as the firmware's in-menu re-enable does. */
const probe = `
var systemEvent = function () {};
var kept = new Array(PARAMS.k), io = [0, 0], i = 0, f, d;
while (i < PARAMS.k) { kept[i] = null; i++; }
i = 0;
SPH.checkpoint('baseline');
function enable() {
	f = SPH.load(PARAMS.path, 1);
	d = f();
	f = null;
	d(2, io);
	d(1, io);
	kept[i] = d;
	d = null;
	i++;
}
enable();
SPH.checkpoint('1 instance');
while (i < PARAMS.k) { enable(); }
SPH.checkpoint('K instances');
`;

const rows = [];
for (const style of ['code', 'str']) {
	for (const p of PROBES) {
		const dir = L.workDir('tog');
		const file = path.join(dir, 'main.js');
		const src = shippedMain(p, style);
		fs.writeFileSync(file, src);
		const rep = L.runProbe('lowmem', probe, { params: { path: file, k: K }, dir });
		const one = L.delta(rep, '1 instance');
		const all = L.delta(rep, 'K instances');
		const per = (all.t32 - one.t32) / (K - 1);
		const m = L.cps(rep);
		const cat = (label, name) => {
			const i = rep.categories.indexOf(name);
			return m[label].walk.t32[i] - m.baseline.walk.t32[i];
		};
		const perFn = (cat('K instances', 'functions') - cat('1 instance', 'functions')) / (K - 1);
		rows.push([style, p.id, L.fmt(src.length), p.fns, L.fmt(one.t32), L.fmt(per), L.fmt(perFn), p.toggles,
			p.id === 'P0' ? '> ' + L.fmt(56 * per) : '~' + L.fmt(parseInt(p.toggles.match(/\d+/)[0], 10) * per)]);
		if (rep.errorsTotal || rep.fatal) rows[rows.length - 1].push(rep.fatal || rep.errors.join('|'));
		fs.rmSync(dir, { recursive: true, force: true });
	}
}
console.log('Toggle-leak probes (forum 15490 #0, Vertical 2 FW 2.53.42): cost of one instantiated module scope, lowmem est32');
console.log(L.table(['content', 'probe', 'main.js B', 'module fns', 'first instance est32', 'per extra instance est32', 'of which functions', 'watch toggles', 'implied free heap if the whole scope leaks'], rows));
console.log('instance = compile + run the module body + onLoad + one evaluate, template released, dispatcher kept (what an in-menu re-enable without "JS discard" would leave).');
console.log('Content is synthetic (skyfi\'s probe sources are not published): "code" = arithmetic helpers, "str" = string-literal helpers, same byte size and function count.');
console.log('Watch reference: in the P4b run two JsTotMem lines 20 re-enables apart read 128,912 and 131,712 B (2,800 B, about 140 B per re-enable),');
console.log('with Weather and Movement enabled (climb-logger docs/watch-logs 2026-07-10_1827-p4b..., lines 1243 and 1365).');
