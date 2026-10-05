#!/usr/bin/env node
// ABOUTME: Runs a list of SuuntoPlus apps (official examples, published GitHub apps, climb-logger builds) through sp-mem and tabulates their lowmem est32 footprint.
// ABOUTME: Usage: node exp-apps.js [--list apps.json] [--scenario file] [--json out.json]; each list entry is {dir, label, watch} with the reported on-watch behaviour.

'use strict';

const fs = require('fs');
const path = require('path');
const L = require('./lib');

const args = L.parseArgs(process.argv.slice(2), { list: path.join(__dirname, 'apps.json') });
const list = JSON.parse(fs.readFileSync(args.list, 'utf8'));
const REF = path.join(L.ROOT, '..', '..', 'reference', 'suunto_plus_examples');

function expand(dir) {
	return dir.replace(/^\$REF/, REF).replace(/^~/, require('os').homedir());
}

const rows = [];
const out = [];
for (const app of list) {
	const dir = expand(app.dir);
	if (!fs.existsSync(path.join(dir, 'manifest.json'))) {
		rows.push([app.label, 'missing', '', '', '', '', '', '', '', '', app.watch || '']);
		continue;
	}
	const extra = ['--forms', 'shipped', '--variants', 'lowmem'];
	if (app.scenario || args.scenario) extra.push('--scenario', path.resolve(L.HERE, app.scenario || args.scenario));
	const r = L.runSpMem(dir, extra);
	const rep = r.data && r.data.results['lowmem/shipped'];
	if (!rep) {
		rows.push([app.label, 'build/run failed', '', '', '', '', '', '', '', '', app.watch || '']);
		out.push({ label: app.label, error: (r.stderr || r.stdout || '').slice(-400) });
		continue;
	}
	const m = {};
	for (const c of rep.checkpoints) m[c.label] = c;
	const base = m.baseline;
	const app32 = (l) => m[l] ? m[l].walk.t32Total - base.walk.t32Total : null;
	const appAlt = (l) => (m[l] && m[l].walkAlt && base.walkAlt) ? m[l].walkAlt.t32Total - base.walkAlt.t32Total : null;
	const appHost = (l) => m[l] ? m[l].live - base.live : null;
	const ratio = (l) => appHost(l) > 0 ? app32(l) / appHost(l) : 0.7;
	const loadLabels = ['main.js loaded', 'onLoad', 'onExerciseStart', 'UI mounted'].filter((l) => m[l]);
	const loadPeak = Math.max(...loadLabels.map((l) => m[l].phasePeak)) - base.live;
	const runTicks = rep.ticks.filter((t) => t[0] > 0);
	const runPeak = runTicks.length ? Math.max(...runTicks.map((t) => t[3])) - base.live : 0;
	const steady = m['steady state'];
	const fnBlocks = steady.walk.appTopBlocks.filter((b) => b[2] === 'functions').map((b) => b[0]);
	const maxReqLoad = Math.max(...loadLabels.map((l) => m[l].phaseMaxReq));
	const maxReqRun = runTicks.length ? Math.max(...runTicks.map((t) => t[6] || 0)) : 0;
	const build = (r.stdout.match(/^build: .*$/m) || [''])[0];
	const mainB = (build.match(/shipped main\.js ([\d,]+) B/) || [, '?'])[1];
	const tpls = [...build.matchAll(/(\S+)\.xml ([\d,]+) B/g)].map((x) => parseInt(x[2].replace(/,/g, ''), 10));
	const errs = rep.errorsTotal ? `${rep.errorsTotal} app errors` : '';
	const row = {
		label: app.label, mainJs: mainB, largestTemplate: tpls.length ? Math.max(...tpls) : null,
		mainLoaded32: app32('main.js loaded'), steady32: app32('steady state'), steadyFit: appAlt('steady state'),
		loadPeak32: Math.round(loadPeak * ratio('UI mounted')), runPeak32: Math.round(runPeak * ratio('steady state')),
		peakFit: Math.round(Math.max(loadPeak * appAlt('UI mounted') / appHost('UI mounted'), runPeak * appAlt('steady state') / appHost('steady state'))),
		largestBlock32: steady.walk.maxAppBlockT32, largestBlockKind: steady.walk.maxAppBlockCat, largestFn32: fnBlocks.length ? fnBlocks[0] : null,
		maxReqLoadHost: maxReqLoad, maxReqRunHost: maxReqRun, blocks: steady.blocks - base.blocks, errors: errs, watch: app.watch || ''
	};
	out.push(row);
	rows.push([row.label, row.mainJs, L.fmt(row.largestTemplate), L.fmt(row.mainLoaded32), L.fmt(row.steady32), L.fmt(row.loadPeak32), L.fmt(row.runPeak32),
		L.fmt(row.steadyFit) + ' / ' + L.fmt(row.peakFit),
		L.fmt(row.largestBlock32) + ' ' + row.largestBlockKind, L.fmt(row.largestFn32), L.fmt(row.maxReqLoadHost) + ' / ' + L.fmt(row.maxReqRunHost),
		(errs ? errs + '; ' : '') + row.watch]);
}

console.log('SuuntoPlus apps in the lowmem harness (shipped form, est32 = estimated 32-bit watch bytes; the lowmem configuration is the one the watch logs fingerprint)');
console.log(L.table(['app', 'main.js B', 'largest template B', 'main.js loaded est32', 'steady est32', 'load peak est32', 'run peak est32', 'watch-fit steady / peak',
	'largest app block est32', 'largest fn data est32', 'max request host load / run', 'reported on-watch behaviour'], rows));
console.log('steady = after mount and the scenario ticks, after GC. load/run peak: highest live bytes before GC, scaled to est32 by the nearest checkpoint ratio.');
console.log('watch-fit = lowmem walk with the 12-byte-header layout (16-bit heap pointers, 4-byte alignment); peak = max of load and run peak.');
console.log('largest fn data: the biggest compiled-function data block; the watch requests this minus 4 B when compiling (fingerprint, see exp-fingerprint.js).');
if (args.json) fs.writeFileSync(args.json, JSON.stringify(out, null, 1));
