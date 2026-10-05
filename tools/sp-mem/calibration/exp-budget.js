#!/usr/bin/env node
// ABOUTME: Derives the free JS heap for one third-party app from watch readings plus harness footprints (climb-logger JsTotMem, matram's Race S test).
// ABOUTME: Prints each anchor with its arithmetic; watch numbers are hard-coded with their sources, app footprints are measured by sp-mem now.

'use strict';

const fs = require('fs');
const path = require('path');
const L = require('./lib');

const GH = process.env.SPMEM_GH || '/tmp/sp-mem-gh';
const HEAP = 133120; /* JsTotMem denominator: 9 Peak Pro (14783 #135), Vertical 2 FW 2.53.42 (15490), Race 2 FW 2.56.18 (15692). Race S unmeasured. */

function footprint(dir) {
	const r = L.runSpMem(dir, ['--forms', 'shipped', '--variants', 'lowmem']);
	const rep = r.data && r.data.results['lowmem/shipped'];
	if (!rep) throw new Error(`sp-mem failed for ${dir}: ${(r.stderr || r.stdout).slice(-300)}`);
	const m = {};
	for (const c of rep.checkpoints) m[c.label] = c;
	const b = m.baseline;
	const d = (l, k) => k === 'fit' ? m[l].walkAlt.t32Total - b.walkAlt.t32Total : m[l].walk.t32Total - b.walk.t32Total;
	const host = (l) => m[l].live - b.live;
	const loadPeakHost = Math.max(...['main.js loaded', 'onLoad', 'onExerciseStart', 'UI mounted'].map((l) => m[l].phasePeak)) - b.live;
	const runPeakHost = Math.max(...rep.ticks.filter((t) => t[0] > 0).map((t) => t[3])) - b.live;
	const peak = (k) => Math.round(Math.max(loadPeakHost * d('UI mounted', k) / host('UI mounted'), runPeakHost * d('steady state', k) / host('steady state')));
	return { steady: d('steady state', 'lowmem'), steadyFit: d('steady state', 'fit'), peak: peak('lowmem'), peakFit: peak('fit') };
}

const lines = [];
const say = (s) => lines.push(s === undefined ? '' : s);

/* Anchor 1: climb-logger build 9f9d8e1 on a Vertical 2 (FW 2.53.42) next to Weather + Movement, before the exercise
 * (docs/watch-logs/2026-07-08e_stufe2-checkpoint.log): JsTotMem 131,060 3 s after the 2nd enable (1 earlier instance
 * disabled in-menu) and 131,192 19 s after the 4th enable (3 earlier instances disabled in-menu, no JS discard). */
const climbDir = path.join(GH, 'climb', 'app-9f9d8e1');
if (fs.existsSync(path.join(climbDir, 'manifest.json'))) {
	const f = footprint(climbDir);
	const reading = 131192;
	say('Anchor 1: climb-logger 9f9d8e1, Vertical 2 FW 2.53.42, Weather + Movement enabled, pre-exercise (07-08e log)');
	say(L.table(['quantity', 'lowmem est32', 'watch-fit est32'], [
		['app footprint, steady (sp-mem default scenario)', L.fmt(f.steady), L.fmt(f.steadyFit)],
		['app footprint, peak (load or run)', L.fmt(f.peak), L.fmt(f.peakFit)],
		['JsTotMem reading (measured on the watch)', L.fmt(reading), L.fmt(reading)],
		['rest of the heap = reading - app (steady .. peak)', `${L.fmt(reading - f.peak)} .. ${L.fmt(reading - f.steady)}`, `${L.fmt(reading - f.peakFit)} .. ${L.fmt(reading - f.steadyFit)}`],
		['free for one app = 133,120 - rest', `${L.fmt(HEAP - reading + f.steady)} .. ${L.fmt(HEAP - reading + f.peak)}`, `${L.fmt(HEAP - reading + f.steadyFit)} .. ${L.fmt(HEAP - reading + f.peakFit)}`]
	]));
	say('"rest" = firmware share of the JS heap + Weather + Movement + 3 in-menu-disabled climb-logger instances. The reading rose only');
	say('132 B between 1 and 3 disabled instances (131,060 -> 131,192), so a disabled instance keeps far less than its ~30 KB footprint.');
	say();
} else {
	say('Anchor 1 skipped: run fetch-sources.sh first.');
}

/* Anchor 2: matram, Race S (15279 #0, 2026-05-31): seven Uint8Array(4000) allocated, the eighth not; firmware, co-apps
 * and the test app are not stated. */
const u8 = L.runProbe('lowmem', `
var h = [0, 0], i = 0;
SPH.checkpoint('baseline');
h[0] = new Uint8Array(4000);
SPH.checkpoint('one');
`, {});
const per = L.delta(u8, 'one');
say('Anchor 2: matram, Race S: 7 x Uint8Array(4000) fit, the 8th did not');
say(L.table(['quantity', 'lowmem est32', 'watch-fit est32'], [
	['one Uint8Array(4000)', L.fmt(per.t32), L.fmt(per.fit)],
	['free at that moment if the heap is contiguous: [7x, 8x)', `${L.fmt(7 * per.t32)} .. ${L.fmt(8 * per.t32)}`, `${L.fmt(7 * per.fit)} .. ${L.fmt(8 * per.fit)}`]
]));
say('Plus whatever matram\'s own app held. Under a pool or size-class allocator "7" counts free ~4 KB blocks instead (hardware test T3).');
say();
console.log(lines.join('\n'));
