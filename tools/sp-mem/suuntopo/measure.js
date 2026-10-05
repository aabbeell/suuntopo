#!/usr/bin/env node
// ABOUTME: SuuntoPo memory study: runs sp-mem with the suuntopo-nav scenario over topo cases (empty, shipped x3, synthetic sizes x1/x3) for one or more app builds.
// ABOUTME: Splits main.js vs template heap (steady, peak), finds largest blocks, counts canvas units per view, checks frame equivalence; writes results.json, prints tables.

'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const gen = require('./gen-topo');
const Plan = require('../scenarios/suuntopo-plan');

const HERE = __dirname;
const SCENARIO = path.join(HERE, '..', 'scenarios', 'suuntopo-nav.js');
const CATS = ['strings', 'objects', 'scopes', 'functions', 'propTables', 'arrayParts', 'buffers', 'engine'];
const HARDCODED_ROUTE = 7; /* route points of the topo hardcoded in the v0.3 template (selector entry 0) */
const STRLEN16_MAX = 65535;

function usage() {
	console.log(`usage: node measure.js --app name=<appDir>[@<encoder.js>] [--app ...] --shipped-data <v0.3 data.json> [options]
  --sizes 2,5,10,25,50,100   synthetic topo sizes in KB (1 KB = 1024 B of compact v0.3 JSON)
  --slots 1,3                filled settings slots per synthetic size
  --extra empty,shipped3     extra cases: all slots empty; the data.json topo in all three slots
  --variants lowmem,default  sp-mem engine variants (lowmem is skipped for wire strings > 65,535 B: STRLEN16)
  --sp-mem <sp-mem.js>       harness runner (default ../sp-mem.js)
  --out <dir>                results dir (default /tmp/sp-mem-suuntopo/results)
  --jobs <n>                 parallel harness runs (default 4)
  --only <case,...>          run only these case ids
An encoder module exports encode(topoObject) -> settings string; without one the wire format is compact v0.3 JSON.`);
}

function parseArgs(argv) {
	const a = { apps: [], sizes: [2, 5, 10, 25, 50, 100], slots: [1, 3], extra: ['empty', 'shipped3'], variants: ['lowmem', 'default'],
		spMem: path.join(HERE, '..', 'sp-mem.js'), out: '/tmp/sp-mem-suuntopo/results', jobs: 4, shipped: null, only: null };
	for (let i = 0; i < argv.length; i++) {
		const v = argv[i];
		const next = () => argv[++i];
		if (v === '--app') {
			const s = next();
			const eq = s.indexOf('=');
			const at = s.lastIndexOf('@');
			a.apps.push({ name: s.slice(0, eq), dir: path.resolve(at > eq ? s.slice(eq + 1, at) : s.slice(eq + 1)),
				encoder: at > eq ? path.resolve(s.slice(at + 1)) : null });
		} else if (v === '--sizes') a.sizes = next().split(',').map(Number);
		else if (v === '--slots') a.slots = next().split(',').map(Number);
		else if (v === '--extra') a.extra = next().split(',').filter(Boolean);
		else if (v === '--variants') a.variants = next().split(',');
		else if (v === '--sp-mem') a.spMem = path.resolve(next());
		else if (v === '--out') a.out = path.resolve(next());
		else if (v === '--jobs') a.jobs = parseInt(next(), 10);
		else if (v === '--shipped-data') a.shipped = path.resolve(next());
		else if (v === '--only') a.only = next().split(',');
		else if (v === '--help' || v === '-h') { usage(); process.exit(0); }
		else throw new Error('unknown argument ' + v);
	}
	if (!a.apps.length || !a.shipped) { usage(); process.exit(2); }
	return a;
}

/* ---------------- cases ---------------- */

function buildCases(args) {
	const cases = [];
	const shippedText = JSON.parse(fs.readFileSync(args.shipped, 'utf8')).topo0;
	if (args.extra.includes('empty')) cases.push({ id: 'empty', label: 'no synced topo', topos: [] });
	if (args.extra.includes('shipped3')) {
		const t = JSON.parse(shippedText);
		cases.push({ id: 'shipped3', label: 'data.json topo x3', topos: [t, t, t], v03Text: shippedText });
	}
	for (const kb of args.sizes) {
		for (const n of args.slots) {
			const topos = [];
			for (let k = 0; k < n; k++) { topos.push(gen.generate(Math.round(kb * 1024), `Synthetic ${kb} KB` + (n > 1 ? ` #${k + 1}` : ''), k).topo); }
			cases.push({ id: `${kb}KBx${n}`, label: `${kb} KB x${n}`, kb, n, topos });
		}
	}
	return args.only ? cases.filter((c) => args.only.includes(c.id)) : cases;
}

function loadEncoder(app) {
	if (!app.encoder) return { encode: (t) => JSON.stringify(t), name: 'v0.3 JSON' };
	const m = require(app.encoder);
	return { encode: m.encode, name: m.name || path.basename(app.encoder) };
}

/* ---------------- running ---------------- */

function runSpMem(args, app, kase, files, routes, outJson) {
	const tooLong = files.some((f) => f && fs.statSync(f).size > STRLEN16_MAX);
	const variants = args.variants.filter((v) => !(v === 'lowmem' && tooLong));
	const cli = [args.spMem, app.dir, '--scenario', SCENARIO, '--forms', 'shipped', '--variants', variants.join(','), '--json', outJson,
		'--set', 'routes=' + routes.join(',')];
	for (let k = 0; k < 3; k++) cli.push('--set', `topo${k}=` + (files[k] || 'empty'));
	return new Promise((resolve) => {
		const p = spawn('node', cli, { stdio: ['ignore', 'pipe', 'pipe'] });
		let out = '';
		p.stdout.on('data', (d) => { out += d; });
		p.stderr.on('data', (d) => { out += d; });
		p.on('close', (code) => resolve({ code, out, variants, skipped: tooLong && args.variants.includes('lowmem') ? ['lowmem (wire > 65,535 B: STRLEN16)'] : [] }));
	});
}

async function pool(items, n, fn) {
	const results = new Array(items.length);
	let next = 0;
	const worker = async () => { while (next < items.length) { const i = next++; results[i] = await fn(items[i], i); } };
	await Promise.all(Array.from({ length: Math.max(1, n) }, worker));
	return results;
}

/* ---------------- analysis ---------------- */

function planStates(routes) {
	const plan = Plan.build(routes);
	const s = Plan.newState();
	const states = [Object.assign({}, s)];
	for (let i = 0; i < plan.length; i++) { Plan.step(s, plan.charCodeAt(i), routes); states.push(Object.assign({}, s)); }
	return { plan, states };
}

const VIEW = ['selector', 'map', 'info'];

function analyseVariant(rep, states) {
	const cps = {};
	for (const c of rep.checkpoints) cps[c.label] = c;
	const base = cps.baseline;
	if (!base || !cps['steady state']) return { failed: true, fatal: rep.fatal, errors: rep.errors };
	const host = (l) => cps[l].live - base.live;
	const t32 = (l) => cps[l].walk.t32Total - base.walk.t32Total;
	const r = {};
	r.mainSteadyHost = host('onExerciseStart');
	r.mainSteady32 = t32('onExerciseStart');
	r.mainPeakHost = Math.max(cps['main.js loaded'].phasePeak, cps.onLoad.phasePeak) - base.live;
	r.tplSteadyHost = host('steady state') - host('onExerciseStart');
	r.tplSteady32 = t32('steady state') - t32('onExerciseStart');
	r.tplMountPeakHost = cps['UI mounted'].phasePeak - cps.onExerciseStart.live;
	r.totalSteadyHost = host('steady state');
	r.totalSteady32 = t32('steady state');
	r.ratio = r.totalSteady32 / r.totalSteadyHost;
	r.loadPeakHost = Math.max(cps['main.js loaded'].phasePeak, cps.onLoad.phasePeak, cps.onExerciseStart.phasePeak, cps['UI mounted'].phasePeak) - base.live;
	const ticks = rep.ticks.filter((t) => t[0] >= 1 && t[0] < states.length);
	r.runPeakHost = Math.max(...ticks.map((t) => t[3])) - base.live;
	r.runPeakByView = {};
	r.maxReqByView = {};
	for (const t of ticks) {
		const v = VIEW[states[t[0]].mode];
		r.runPeakByView[v] = Math.max(r.runPeakByView[v] || 0, t[3] - base.live);
		if (t.length > 6) r.maxReqByView[v] = Math.max(r.maxReqByView[v] || 0, t[6]);
	}
	/* est32 for peaks: host peak scaled by the steady-state est32/host ratio (harness convention; an estimate). */
	r.mainPeak32 = r.mainPeakHost * r.ratio;
	r.loadPeak32 = r.loadPeakHost * r.ratio;
	r.runPeak32 = r.runPeakHost * r.ratio;
	r.byKind32 = CATS.map((c, i) => cps['steady state'].walk.t32[i] - base.walk.t32[i]);
	r.byKindHost = CATS.map((c, i) => cps['steady state'].walk.host[i] - base.walk.host[i]);
	/* Largest single live block per category at steady state (fork harness only). A category's block counts as
	 * the app's only when it is larger than the largest such block already in the baseline (harness + engine). */
	const sw = cps['steady state'].walk, bw = base.walk;
	if (Array.isArray(sw.maxT32) && Array.isArray(sw.maxHost)) { /* per-category arrays: the /tmp sp-mem-suuntopo fork */
		r.maxBlock = CATS.map((c, i) => ({ cat: c, t32: sw.maxT32[i], host: sw.maxHost[i], baseT32: bw.maxT32[i], app: sw.maxT32[i] > bw.maxT32[i] }));
		const appBlocks = r.maxBlock.filter((b) => b.app);
		const data = appBlocks.filter((b) => b.cat !== 'functions' && b.cat !== 'engine');
		r.maxDataBlock = data.length ? data.reduce((m, b) => (b.t32 > m.t32 ? b : m)) : null;
		/* Below this size an app data block cannot be told apart from the harness's own largest property table. */
		r.blockFloor32 = bw.maxT32[CATS.indexOf('propTables')];
		const fn = r.maxBlock.find((b) => b.cat === 'functions');
		r.maxCodeBlock = fn && fn.app ? fn : null;
		r.maxReqMain = Math.max(cps['main.js loaded'].phaseMaxReq || 0, cps.onLoad.phaseMaxReq || 0);
		r.maxReqMount = cps['UI mounted'].phaseMaxReq || 0;
	}
	r.blocks = cps['steady state'].blocks - base.blocks;
	r.errorsTotal = rep.errorsTotal;
	r.errors = rep.errors;
	r.fatal = rep.fatal;
	r.failedAllocs = rep.failedAllocs;
	const m = (rep.stderr || '').match(/suuntopo-nav: plan (\d+) presses, routes ([\d,]+), output checks (\d+), mismatches (\d+)/);
	r.planCheck = m ? { presses: +m[1], checks: +m[3], mismatches: +m[4] } : null;
	const walks = rep.checkpoints.filter((c) => c.walk);
	r.walkResidual = Math.max(...walks.map((c) => c.walk.residualBytes));
	r.walkMismatches = Math.max(...walks.map((c) => c.walk.mismatches));
	return r;
}

function analyseCanvas(rep, states) {
	const ops = rep.canvasOps;
	const ix = (n) => ops.indexOf(n);
	const views = {};
	const perTopoMap = {};
	for (const f of rep.frames) {
		const s = states[f.t] || states[0];
		const v = VIEW[s.mode];
		const units = 2 * f.ops[ix('stroke')] + f.ops[ix('lineTo')];
		const o = views[v] || (views[v] = { frames: 0, maxUnits: 0, minUnits: Infinity, maxLineToPerPath: 0, maxOps: 0, maxFill: 0, maxArc: 0, maxText: 0 });
		o.frames++;
		o.maxUnits = Math.max(o.maxUnits, units);
		o.minUnits = Math.min(o.minUnits, units);
		o.maxLineToPerPath = Math.max(o.maxLineToPerPath, f.maxLineToPerPath);
		o.maxOps = Math.max(o.maxOps, f.ops.reduce((a, b) => a + b, 0));
		o.maxFill = Math.max(o.maxFill, f.ops[ix('fill')] + f.ops[ix('fillRect')]);
		o.maxArc = Math.max(o.maxArc, f.ops[ix('arc')]);
		o.maxText = Math.max(o.maxText, f.ops[ix('fillText')]);
		if (s.mode === 1) {
			const k = s.topo;
			const p = perTopoMap[k] || (perTopoMap[k] = { maxUnits: 0, maxLineToPerPath: 0 });
			p.maxUnits = Math.max(p.maxUnits, units);
			p.maxLineToPerPath = Math.max(p.maxLineToPerPath, f.maxLineToPerPath);
		}
	}
	const sig = rep.frames.map((f) => f.t + ':' + f.ops.join(',') + ':' + f.maxLineToPerPath).join('|');
	return { views, perTopoMap, frames: rep.frames.length, signature: sig, strokeRect: Math.max(0, ...rep.frames.map((f) => f.ops[ix('strokeRect')])) };
}

/* ---------------- formatting ---------------- */

const fmt = (n) => (n === null || n === undefined || Number.isNaN(n)) ? '-' : Math.round(n).toLocaleString('en-US');
const kbf = (n) => (n === null || n === undefined || Number.isNaN(n)) ? '-' : (n / 1024).toFixed(1);
const pair = (lm, df, f) => {
	const a = lm && !lm.failed ? f(lm) : null;
	const b = df && !df.failed ? f(df) : null;
	if (a === null && b === null) return '-';
	if (a === null) return `- / ${kbf(b)}`;
	if (b === null) return `${kbf(a)} / -`;
	return `${kbf(a)} / ${kbf(b)}`;
};

function blockCell(lm, df) {
	const one = (x) => (!x || x.failed) ? '-' : (x.blockFloor32 === undefined ? 'n/a (needs per-category maxT32 from the fork harness)' :
		(x.maxDataBlock ? `${kbf(x.maxDataBlock.t32)} ${x.maxDataBlock.cat}` : `<${kbf(x.blockFloor32)}`));
	return `${one(lm)} / ${one(df)}`;
}

function mdTable(headers, rows) {
	return [`| ${headers.join(' | ')} |`, `|${headers.map((h, i) => (i === 0 ? '---' : '---:')).join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

function report(args, cases, results) {
	const L = [];
	const apps = args.apps.map((a) => a.name);
	L.push(`# SuuntoPo memory study (${new Date().toISOString()})`);
	L.push('');
	L.push('Values are KB (1 KB = 1024 B). "a / b" = est32 lowmem / est32 default (32-bit watch estimate; lowmem is the lower bracket).');
	L.push('Steady = measured live bytes after full GC (est32 from the heap walk). Peaks = measured host peak before GC, scaled to est32 by the steady est32/host ratio (estimate).');
	L.push('');
	L.push('## Wire size (settings string per slot, bytes)');
	L.push(mdTable(['case', ...apps], cases.map((c) => [c.label, ...apps.map((a) => {
		const r = results[a][c.id];
		return r ? r.wire.map(fmt).join(' + ') || '0' : '-';
	})])));
	L.push('');
	for (const a of apps) {
		L.push(`## ${a}: heap (est32 KB, lowmem / default)`);
		const rows = cases.map((c) => {
			const r = results[a][c.id];
			if (!r) return [c.label, '-', '-', '-', '-', '-', '-', '-', '-'];
			const lm = r.variants.lowmem, df = r.variants.default;
			return [c.label, pair(lm, df, (x) => x.mainSteady32), pair(lm, df, (x) => x.mainPeak32), pair(lm, df, (x) => x.tplSteady32),
				pair(lm, df, (x) => x.tplMountPeakHost * x.ratio), pair(lm, df, (x) => x.totalSteady32), pair(lm, df, (x) => x.loadPeak32),
				pair(lm, df, (x) => x.runPeak32), blockCell(lm, df)];
		});
		L.push(mdTable(['case', 'main.js steady', 'main.js peak', 'template steady', 'template mount peak', 'app steady', 'app load peak', 'app run peak', 'largest data block'], rows));
		L.push('');
	}
	L.push('## Canvas units per frame (2*stroke + lineTo; max over frames), from ' + apps[0]);
	const ref = apps[0];
	L.push(mdTable(['case', 'selector', 'map (max)', 'map per entry', 'max lineTo/path', 'info', 'frames'], cases.map((c) => {
		const r = results[ref][c.id];
		if (!r || !r.canvas) return [c.label, '-', '-', '-', '-', '-', '-'];
		const v = r.canvas.views;
		return [c.label, v.selector ? v.selector.maxUnits : '-', v.map ? v.map.maxUnits : '-',
			Object.keys(r.canvas.perTopoMap).map((k) => r.canvas.perTopoMap[k].maxUnits).join(' / '),
			v.map ? v.map.maxLineToPerPath : '-', v.info ? v.info.maxUnits : '-', r.canvas.frames];
	})));
	L.push('');
	L.push('## Checks');
	for (const a of apps) {
		for (const c of cases) {
			const r = results[a][c.id];
			if (!r) continue;
			const notes = [];
			for (const [vn, x] of Object.entries(r.variants)) {
				if (x.failed) { notes.push(`${vn}: FAILED ${x.fatal || ''} ${(x.errors || []).join('; ')}`); continue; }
				if (!x.planCheck) notes.push(`${vn}: no plan check line`);
				else if (x.planCheck.mismatches) notes.push(`${vn}: ${x.planCheck.mismatches} output mismatches`);
				if (x.errorsTotal) notes.push(`${vn}: ${x.errorsTotal} app errors (${x.errors.join('; ')})`);
				if (x.walkResidual || x.walkMismatches) notes.push(`${vn}: walk residual ${x.walkResidual} B, ${x.walkMismatches} mismatches`);
			}
			if (r.skipped.length) notes.push('skipped ' + r.skipped.join(', '));
			if (a !== ref && results[ref][c.id] && r.canvas && results[ref][c.id].canvas) {
				notes.push(r.canvas.signature === results[ref][c.id].canvas.signature ? `frames identical to ${ref}` : `FRAMES DIFFER from ${ref}`);
			}
			L.push(`- ${a} / ${c.label}: ${notes.length ? notes.join('; ') : 'ok'}`);
		}
	}
	return L.join('\n');
}

/* ---------------- main ---------------- */

async function main() {
	const args = parseArgs(process.argv.slice(2));
	fs.mkdirSync(args.out, { recursive: true });
	const cases = buildCases(args);
	const jobs = [];
	for (const app of args.apps) {
		const enc = loadEncoder(app);
		for (const c of cases) {
			const dir = path.join(args.out, app.name, c.id);
			fs.mkdirSync(dir, { recursive: true });
			const files = [];
			const wire = [];
			c.topos.forEach((t, k) => {
				const text = (!app.encoder && c.v03Text) ? c.v03Text : enc.encode(t);
				const f = path.join(dir, `topo${k}.txt`);
				fs.writeFileSync(f, text);
				files.push(f);
				wire.push(Buffer.byteLength(text));
			});
			const routes = [HARDCODED_ROUTE, ...c.topos.map((t) => t.route.length)];
			jobs.push({ app, c, dir, files, wire, routes, enc: enc.name });
		}
	}
	const results = {};
	for (const app of args.apps) results[app.name] = {};
	await pool(jobs, args.jobs, async (j) => {
		const outJson = path.join(j.dir, 'sp-mem.json');
		const t0 = Date.now();
		const run = await runSpMem(args, j.app, j.c, j.files, j.routes, outJson);
		fs.writeFileSync(path.join(j.dir, 'sp-mem.txt'), run.out);
		const entry = { app: j.app.name, encoder: j.enc, case: j.c.id, wire: j.wire, routes: j.routes, skipped: run.skipped, variants: {}, exitCode: run.code, seconds: (Date.now() - t0) / 1000 };
		if (j.c.topos.length) {
			entry.topoShape = j.c.topos.map((t) => ({ route: t.route.length, anchors: t.anchors.length, features: t.features.length, json: JSON.stringify(t).length }));
		}
		let data = null;
		try { data = JSON.parse(fs.readFileSync(outJson, 'utf8')); } catch (e) { entry.error = 'no sp-mem JSON: ' + run.out.slice(-2000); }
		if (data) {
			const { states } = planStates(j.routes);
			for (const v of run.variants) {
				const rep = data.results[`${v}/shipped`];
				if (!rep) { entry.variants[v] = { failed: true, fatal: 'missing result' }; continue; }
				entry.variants[v] = analyseVariant(rep, states);
				if (!entry.canvas && rep.frames && rep.frames.length) entry.canvas = analyseCanvas(rep, states);
			}
		}
		results[j.app.name][j.c.id] = entry;
		process.stderr.write(`done ${j.app.name}/${j.c.id} in ${entry.seconds.toFixed(1)} s\n`);
	});
	const slim = JSON.parse(JSON.stringify(results, (k, v) => (k === 'signature' ? undefined : v)));
	fs.writeFileSync(path.join(args.out, 'results.json'), JSON.stringify({ args: Object.assign({}, args), cases: cases.map((c) => ({ id: c.id, label: c.label })), results: slim }, null, 1));
	console.log(report(args, cases, results));
	console.log('\nresults: ' + path.join(args.out, 'results.json'));
}

main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
