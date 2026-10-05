#!/usr/bin/env node
// ABOUTME: Measures a SuuntoPlus app's JS heap footprint: builds it with sp-build, runs the shipped and source forms in the Duktape harness.
// ABOUTME: Usage: node sp-mem.js <appDir> [--scenario file.js] [--display q] [--ticks N] [--json out.json]; prints host and estimated watch bytes.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildView } = require('./lib/views');

const HERE = __dirname;
const SP_BUILD = path.join(HERE, '..', 'sp-build', 'sp-build.js');
const TOOLS_LIB = path.join(os.homedir(), '.vscode/extensions/suunto.suuntoplus-editor-1.42.0/node_modules/@suunto-internal/suuntoplus-tools/lib');
const STUB = path.join(HERE, 'runtime', 'stub.js');
const DRIVER = path.join(HERE, 'runtime', 'driver.js');
const DISPLAYS = { s: [218, 218], m: [240, 240], l: [320, 300], n: [240, 240], o: [280, 280], q: [466, 466] };
const ALL_EVENTS = 0x1ffff;

function usage() {
	console.log(`usage: node sp-mem.js <appDir> [options]
  --scenario <file>     scenario JS (default: scenarios/default.js)
  --display <id>        display id of the build to run (default q)
  --ticks <n>           evaluate ticks (default: scenario.ticks or 60)
  --forms <list>        shipped,source (default both)
  --variants <list>     lowmem,default,brew (default all three)
  --app-limit <bytes>   refuse host allocations more than this above the baseline (simulated OOM; host bytes,
                        so for a watch budget B (est32) use about B / 0.7 with the lowmem variant)
  --dry-ticks <n>       harness-only ticks before baseline (default 5)
  --set key=value       scenario parameter, read in scenarios as JOB.params.key (repeatable)
  --json <file>         also write the combined results as JSON
  --keep                keep the /tmp/sp-mem-run-* work directory`);
}

function parseArgs(argv) {
	const a = { _: [], scenario: path.join(HERE, 'scenarios', 'default.js'), display: 'q', ticks: 0, forms: ['shipped', 'source'],
		variants: ['lowmem', 'default', 'brew'], appLimit: 0, dryTicks: 5, json: null, keep: false, params: {} };
	for (let i = 0; i < argv.length; i++) {
		const v = argv[i];
		const next = () => argv[++i];
		if (v === '--scenario') a.scenario = path.resolve(next());
		else if (v === '--display') a.display = next();
		else if (v === '--ticks') a.ticks = parseInt(next(), 10);
		else if (v === '--forms') a.forms = next().split(',');
		else if (v === '--variants') a.variants = next().split(',');
		else if (v === '--app-limit') a.appLimit = parseInt(next(), 10);
		else if (v === '--dry-ticks') a.dryTicks = parseInt(next(), 10);
		else if (v === '--json') a.json = path.resolve(next());
		else if (v === '--keep') a.keep = true;
		else if (v === '--set') { const kv = next(); const k = kv.indexOf('='); a.params[kv.slice(0, k)] = kv.slice(k + 1); }
		else if (v === '--help' || v === '-h') { usage(); process.exit(0); }
		else a._.push(v);
	}
	return a;
}

function run(cmd, args, opts) {
	const r = spawnSync(cmd, args, Object.assign({ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, opts || {}));
	if (r.error) throw r.error;
	return r;
}

/* Build with sp-build into the work dir; TMPDIR keeps the build library's temp files there too. */
function buildApp(appDir, work) {
	const tmpdir = path.join(work, 'tmpdir');
	fs.mkdirSync(tmpdir, { recursive: true });
	const env = Object.assign({}, process.env, { TMPDIR: tmpdir });
	const r = run('node', [SP_BUILD, appDir, path.join(work, 'build')], { env });
	const appIdOf = (out) => { const m = out.match(/BUILD OK appId=(\S+)/); return m ? m[1] : null; };
	if (r.status === 0) {
		return { tool: 'sp-build', note: '', appId: appIdOf(r.stdout) };
	}
	if (/ext\w*\.js failed JavaScript validation/.test(r.stdout + r.stderr)) {
		/* sp-build validates ext*.js as scripts; evalFile files are bare expressions. Build with the library directly. */
		const r2 = run('node', [path.join(HERE, 'lib', 'build-lib.js'), appDir, path.join(work, 'build')], { env });
		if (r2.status === 0) {
			return { tool: 'build-lib', appId: appIdOf(r2.stdout), note: 'sp-build rejected the ext*.js files (bare function expressions for evalFile); built with lib/build-lib.js, which skips only that validation' };
		}
		process.stderr.write(r2.stdout + r2.stderr);
	}
	process.stderr.write(r.stdout + r.stderr);
	throw new Error('sp-build failed');
}

/* Packages are named <appId>-<display>[-<lang>].fea|.dev. Select by the appId the build reported: the app folder
 * may hold stale packages from older builds (other appIds), which the build tool copies along. */
function unpackFea(work, display, appId) {
	const buildDir = path.join(work, 'build');
	const re = new RegExp(`^${appId}-${display}(-[a-z]{2})?\\.(fea|dev)$`);
	const candidates = fs.readdirSync(buildDir).filter((f) => re.test(f));
	const fea = candidates.find((f) => /-en\./.test(f)) || candidates[0];
	if (!appId || !fea) throw new Error(`no build for appId ${appId}, display ${display} in ${buildDir}`);
	const out = path.join(work, 'fea');
	const r = run('unzip', ['-o', '-q', path.join(buildDir, fea), '-d', out]);
	if (r.status !== 0) throw new Error('unzip failed: ' + r.stderr);
	return { dir: out, file: fea, size: fs.statSync(path.join(buildDir, fea)).size };
}

async function sourceMain(appDir, display, outPath) {
	const template = require(path.join(TOOLS_LIB, 'util', 'template'));
	const localization = require(path.join(TOOLS_LIB, 'project', 'localization'));
	const lang = await localization.getLanguageFile(appDir, 'en');
	const src = fs.readFileSync(path.join(appDir, 'main.js'), 'utf8');
	fs.writeFileSync(outPath, template.applyTemplate(src, display, lang, false));
}

function prepareJob(appDir, work, args, appId) {
	const fea = unpackFea(work, args.display, appId);
	const manifest = JSON.parse(fs.readFileSync(path.join(fea.dir, 'manifest.jsn'), 'utf8'));
	const inNames = (manifest.in || []).map((x) => x.name);
	const outNames = (manifest.out || []).map((x) => x.name);
	const mainPath = path.join(fea.dir, 'main.js');
	const mainText = fs.readFileSync(mainPath, 'utf8');
	const maskMatch = mainText.match(/^\/\/\s*(\d+)/);
	const [displayW, displayH] = DISPLAYS[args.display] || DISPLAYS.q;
	const viewsDir = path.join(work, 'views');
	fs.mkdirSync(viewsDir, { recursive: true });
	const views = {};
	const templateSizes = {};
	for (const f of fs.readdirSync(fea.dir).filter((x) => x.endsWith('.xml'))) {
		const name = f.replace(/\.xml$/, '');
		const xml = fs.readFileSync(path.join(fea.dir, f), 'utf8');
		const v = buildView(xml, { outNames, displayW, displayH });
		if (v.slots > 96) throw new Error(`template ${f} needs ${v.slots} handler slots (stub has 96)`);
		const viewPath = path.join(viewsDir, name + '.js');
		fs.writeFileSync(viewPath, v.source);
		views[name] = Object.assign({ path: viewPath }, v.meta);
		templateSizes[name] = xml.length;
	}
	const dataPath = fs.existsSync(path.join(fea.dir, 'data.jsn')) ? path.join(fea.dir, 'data.jsn') : '';
	return {
		fea, manifest, inNames, outNames, views, templateSizes, dataPath,
		shippedMain: mainPath, shippedMainSize: mainText.length,
		eventMask: maskMatch ? parseInt(maskMatch[1], 10) : ALL_EVENTS,
		displayW, displayH
	};
}

function writeJob(work, prep, form, args, sourceMainPath) {
	const job = {
		form,
		mainPath: form === 'shipped' ? prep.shippedMain : sourceMainPath,
		eventMask: form === 'shipped' ? prep.eventMask : ALL_EVENTS,
		nIn: prep.inNames.length,
		nOut: prep.outNames.length,
		inNames: prep.inNames,
		outNames: prep.outNames,
		appDir: prep.fea.dir,
		dataPath: prep.dataPath,
		ticks: args.ticks,
		dryTicks: args.dryTicks,
		appLimit: args.appLimit,
		display: args.display,
		scenarioDir: path.dirname(args.scenario),
		params: args.params,
		views: prep.views
	};
	const p = path.join(work, `job-${form}.js`);
	fs.writeFileSync(p, `// Generated by sp-mem: job description for the driver.\nvar JOB = ${JSON.stringify(job, null, 1)};\n`);
	return p;
}

function runHarness(work, variant, form, jobPath, args) {
	const bin = path.join(HERE, 'build', `sp-mem-${variant}`);
	if (!fs.existsSync(bin)) throw new Error(`missing ${bin}; run: bash ${path.join(HERE, 'build.sh')}`);
	const out = path.join(work, `report-${variant}-${form}.json`);
	const cli = ['--out', out, STUB, jobPath, args.scenario, DRIVER];
	const r = run(bin, cli);
	let rep = null;
	try { rep = JSON.parse(fs.readFileSync(out, 'utf8')); } catch (e) { /* reported below */ }
	if (!rep) throw new Error(`${variant}/${form}: harness produced no report\n${r.stderr}`);
	rep.stderr = r.stderr;
	rep.exitCode = r.status;
	return rep;
}

/* ---------------- analysis ---------------- */

const LOAD_LABELS = ['main.js loaded', 'onLoad', 'onExerciseStart', 'UI mounted'];

function analyse(rep) {
	const cps = {};
	for (const c of rep.checkpoints) cps[c.label] = c;
	const base = cps.baseline;
	const res = { rep, cps, base, labels: rep.checkpoints.map((c) => c.label) };
	if (!base) return res;
	res.app = (label) => cps[label] ? cps[label].live - base.live : null;
	res.app32 = (label) => (cps[label] && cps[label].walk && base.walk) ? cps[label].walk.t32Total - base.walk.t32Total : null;
	/* watch-fit: the lowmem walk re-sized with the 12-byte buffer-header layout (calibration/exp-fingerprint.js); lowmem builds only. */
	res.hasAlt = !!(base.walkAlt);
	res.app32alt = (label) => (cps[label] && cps[label].walkAlt && base.walkAlt) ? cps[label].walkAlt.t32Total - base.walkAlt.t32Total : null;
	res.ratioAlt = (label) => {
		const h = res.app(label), t = res.app32alt(label);
		return (h && t !== null && h > 0) ? t / h : null;
	};
	res.ratio = (label) => {
		const h = res.app(label), t = res.app32(label);
		return (h && t !== null && h > 0) ? t / h : null;
	};
	const loadPeaks = LOAD_LABELS.filter((l) => cps[l]).map((l) => cps[l].phasePeak);
	res.loadPeakApp = loadPeaks.length ? Math.max(...loadPeaks) - base.live : null;
	const runTicks = rep.ticks.filter((t) => t[0] > 0);
	const dryTicks = rep.ticks.filter((t) => t[0] <= 0);
	res.runPeakApp = runTicks.length ? Math.max(...runTicks.map((t) => t[3])) - base.live : null;
	const avg = (arr, k) => arr.length ? arr.reduce((s, t) => s + t[k], 0) / arr.length : 0;
	res.allocsPerTick = avg(runTicks, 4);
	res.bytesPerTick = avg(runTicks, 5);
	res.dryAllocsPerTick = avg(dryTicks, 4);
	res.dryBytesPerTick = avg(dryTicks, 5);
	/* Cyclic garbage per tick (8th tick field, internal builds only): freed by the forced tick-end mark-and-sweep, not by
	 * refcounting. The harness collects it every tick; stock Duktape would let it pile up until a voluntary or emergency GC. */
	const msTicks = runTicks.filter((t) => t.length > 7 && t[7] >= 0);
	res.msGarbageAvg = msTicks.length ? avg(msTicks, 7) : null;
	res.msGarbageMax = msTicks.length ? Math.max(...msTicks.map((t) => t[7])) : null;
	/* Leak indicator: live-after-GC growth over the second half of the run (scenario steps usually happen early). */
	const half = runTicks[Math.floor(runTicks.length / 2)];
	const tN = runTicks[runTicks.length - 1];
	res.leakPerTick = (half && tN && tN[0] > half[0]) ? (tN[2] - half[2]) / (tN[0] - half[0]) : null;
	res.nTicks = runTicks.length;
	return res;
}

/* ---------------- formatting ---------------- */

const fmt = (n) => (n === null || n === undefined || Number.isNaN(n)) ? '-' : Math.round(n).toLocaleString('en-US');
const kb = (n) => (n === null || n === undefined) ? '-' : (n / 1024).toFixed(1) + ' KB';

function table(headers, rows) {
	const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
	const line = (cells) => cells.map((c, i) => (i === 0 ? String(c).padEnd(widths[i]) : String(c).padStart(widths[i]))).join('  ');
	return [line(headers), widths.map((w) => '-'.repeat(w)).join('  '), ...rows.map(line)].join('\n');
}

function canvasSummary(rep, prep) {
	const ops = rep.canvasOps;
	const idx = (name) => ops.indexOf(name);
	const byCanvas = new Map();
	for (const f of rep.frames) {
		if (!byCanvas.has(f.canvas)) byCanvas.set(f.canvas, []);
		byCanvas.get(f.canvas).push(f);
	}
	const firstView = Object.values(prep.views).find((v) => v.canvases.length > 0);
	const rows = [];
	const flags = [];
	for (const [c, frames] of byCanvas) {
		const g = (f, n) => f.ops[idx(n)];
		const max = (fn) => Math.max(...frames.map(fn));
		const total = (f) => f.ops.reduce((s, x) => s + x, 0);
		const budget = (f) => 2 * g(f, 'stroke') + g(f, 'lineTo');
		const id = firstView && firstView.canvases[c] ? firstView.canvases[c].id : `canvas ${c}`;
		const row = {
			id, frames: frames.length, ops: max(total), beginPath: max((f) => g(f, 'beginPath')), lineTo: max((f) => g(f, 'lineTo')),
			stroke: max((f) => g(f, 'stroke')), fill: max((f) => g(f, 'fill') + g(f, 'fillRect')), text: max((f) => g(f, 'fillText')),
			arc: max((f) => g(f, 'arc') + g(f, 'arcTo')), maxPathLineTo: max((f) => f.maxLineToPerPath), budget: max(budget)
		};
		rows.push(row);
		if (row.budget > 200) flags.push(`${id}: 2*stroke+lineTo reaches ${row.budget} (> ~200: Race S drops the whole canvas, forum 15279)`);
		if (row.maxPathLineTo > 24) flags.push(`${id}: ${row.maxPathLineTo} lineTo in one path (> ~24 per path on Race S, forum 15279)`);
		for (const n of ['rect', 'strokeRect', 'clearRect', 'save', 'restore', 'other']) {
			const m = max((f) => g(f, n));
			if (m > 0) flags.push(`${id}: uses ${n} (${m}/frame), not in the reference's supported canvas list`);
		}
	}
	return { rows, flags };
}

function report(appDir, args, prep, results, buildOut) {
	const lines = [];
	const say = (s) => lines.push(s === undefined ? '' : s);
	const A = (variant, form) => results[`${variant}/${form}`];
	const forms = args.forms;
	const primaryForm = forms.includes('shipped') ? 'shipped' : forms[0];
	const lm = A('lowmem', primaryForm), df = A('default', primaryForm), br = A('brew', primaryForm);
	const any = lm || df || br;

	say(`sp-mem: ${path.basename(appDir)}  (display ${args.display}, scenario ${path.basename(args.scenario)}, ${any ? any.nTicks : '?'} ticks)`);
	say(`build: ${prep.fea.file} ${fmt(prep.fea.size)} B; shipped main.js ${fmt(prep.shippedMainSize)} B; templates ${Object.entries(prep.templateSizes).map(([k, v]) => `${k}.xml ${fmt(v)} B`).join(', ')}`);
	say(`event mask (main.js header): ${prep.eventMask}; outputs: ${prep.outNames.join(', ') || '-'}; inputs: ${prep.inNames.join(', ') || '-'}`);
	if (buildOut.note) say('note: ' + buildOut.note);
	say();

	for (const form of forms) {
		const L = A('lowmem', form), Dd = A('default', form);
		const ref = L || Dd;
		if (!ref || !ref.base) continue;
		say(`== ${form} form ${form === 'shipped' ? '(minified dispatcher, what the watch runs)' : '(source main.js with named global callbacks)'}`);
		say('App bytes = live heap after full GC minus the baseline (engine + stub + scenario). host = measured on this Mac (64-bit);');
		say('est32 = estimated for a 32-bit ARM build from a walk of every live allocation (see README).');
		const headers = ['checkpoint'];
		if (Dd) headers.push('host live dflt', 'app host dflt', 'app est32 dflt');
		if (L) headers.push('app host lowmem', 'app est32 lowmem', 'step est32 lowmem');
		if (L && L.hasAlt) headers.push('app est32 watch-fit');
		const rows = ref.labels.map((label, i) => {
			const r = [label];
			if (Dd) r.push(fmt(Dd.cps[label] ? Dd.cps[label].live : null), fmt(Dd.app(label)), fmt(Dd.app32(label)));
			if (L) r.push(fmt(L.app(label)), fmt(L.app32(label)), i === 0 ? '' : fmt(L.app32(label) - L.app32(ref.labels[i - 1])));
			if (L && L.hasAlt) r.push(fmt(L.app32alt(label)));
			return r;
		});
		say(table(headers, rows));
		say('step = change since the previous checkpoint.');
		if (L && L.hasAlt) {
			say('watch-fit = the lowmem walk re-sized with 16-bit heap pointers and 4-byte alignment: a configuration (not the only possible one) that');
			say('gives the 12-byte buffer header watch JSalloc sizes imply. Watch logs match lowmem, not default (calibration/README.md).');
		}
		const blockRef = L || Dd;
		const s = blockRef.cps['steady state'];
		if (s) {
			const nb = s.blocks - blockRef.base.blocks;
			say(`Allocator headers are not counted: the app holds ${fmt(nb)} live blocks at steady state, so a watch allocator with 4-8 B per block adds ${fmt(nb * 4)}-${fmt(nb * 8)} B.`);
		}
		say();
		const peakRows = [];
		const peakRow = (name, get) => {
			const r = [name];
			if (Dd) r.push(fmt(get(Dd, 'host')), fmt(get(Dd, 'est')));
			if (L) r.push(fmt(get(L, 'host')), fmt(get(L, 'est')));
			if (L && L.hasAlt) r.push(fmt(get(L, 'alt')));
			peakRows.push(r);
		};
		const scaled = (X, v, label, k) => {
			const ratio = k === 'alt' ? X.ratioAlt(label) : X.ratio(label);
			return (v === null || ratio === null) ? null : v * ratio;
		};
		peakRow('load peak (compile + onLoad + mount)', (X, k) => k === 'host' ? X.loadPeakApp : scaled(X, X.loadPeakApp, 'UI mounted', k));
		peakRow('run peak (within any tick)', (X, k) => k === 'host' ? X.runPeakApp : scaled(X, X.runPeakApp, 'steady state', k));
		const ph = ['peak above baseline'];
		if (Dd) ph.push('host dflt', 'est32 dflt (scaled)');
		if (L) ph.push('host lowmem', 'est32 lowmem (scaled)');
		if (L && L.hasAlt) ph.push('est32 watch-fit (scaled)');
		say(table(ph, peakRows));
		say('Peaks are measured on the host before GC; est32 peaks are scaled by the est32/host ratio of the nearest checkpoint.');
		say('The run peak assumes a full GC at the end of every tick (the harness forces one). If "cyclic garbage" below is above zero,');
		say('stock Duktape keeps that garbage until a voluntary GC (about 50 allocations per live object) or an allocation failure, so');
		say('without a firmware-forced GC per callback the real high-water mark is higher: read the run peak as a lower bound.');
		say();
		const churn = [];
		for (const [name, X] of [['default', Dd], ['lowmem', L]]) {
			if (!X) continue;
			churn.push([name, X.allocsPerTick.toFixed(1), fmt(X.bytesPerTick), X.dryAllocsPerTick.toFixed(1), fmt(X.dryBytesPerTick),
				(X.allocsPerTick - X.dryAllocsPerTick).toFixed(1), fmt(X.bytesPerTick - X.dryBytesPerTick),
				X.msGarbageAvg === null ? '-' : `${fmt(X.msGarbageAvg)} / ${fmt(X.msGarbageMax)}`,
				X.leakPerTick === null ? '-' : X.leakPerTick.toFixed(1)]);
		}
		say(table(['host allocation churn per tick', 'allocs total', 'bytes', 'harness-only allocs', 'bytes', '~app allocs', '~app bytes',
			'cyclic garbage B/tick avg / max', 'live growth B/tick (2nd half)'], churn));
		say('harness-only = dry ticks with no app loaded; ~app = total minus harness-only (transient garbage, freed by refcount or GC).');
		say('cyclic garbage = host bytes the tick-end mark-and-sweep freed that refcounting did not (value-stack shrink and freelists excluded).');
		say();
		if (form === primaryForm) {
			const cats = ref.rep.categories;
			const catRows = cats.map((name, i) => {
				const r = [name];
				for (const X of [Dd, L]) {
					if (!X) continue;
					const s = X.cps['steady state'], b = X.base;
					if (s && s.walk && b.walk) r.push(fmt(s.walk.host[i] - b.walk.host[i]), fmt(s.walk.t32[i] - b.walk.t32[i]));
					else r.push('-', '-');
				}
				return r;
			});
			const ch = ['steady state app bytes by kind'];
			if (Dd) ch.push('host dflt', 'est32 dflt');
			if (L) ch.push('host lowmem', 'est32 lowmem');
			say(table(ch, catRows));
			say();
			const engine = [];
			for (const [name, X] of [['default', Dd], ['lowmem', L]]) {
				if (!X || !X.base.walk) continue;
				engine.push([name, fmt(X.base.live), fmt(X.base.walk.t32Total)]);
			}
			if (engine.length) {
				say(table(['baseline (engine with RAM built-ins + stub)', 'host', 'est32'], engine));
				say('On the watch the built-ins are likely in ROM or shared, so only the app rows above are comparable to the ~28 KB (Race S) budget.');
				say();
			}
		}
	}

	const shipped = results[`lowmem/shipped`], source = results[`lowmem/source`];
	if (shipped && source && shipped.base && source.base) {
		say('== shipped vs source (lowmem, est32 app bytes)');
		say(table(['checkpoint', 'shipped', 'source', 'source - shipped'], shipped.labels.map((l) => [l, fmt(shipped.app32(l)), fmt(source.app32(l)),
			fmt((source.app32(l) || 0) - (shipped.app32(l) || 0))])));
		say();
	}

	const primary = lm || df || br;
	if (primary && primary.rep.frames.length) {
		const cs = canvasSummary(primary.rep, prep);
		say('== canvas draw calls per frame (max over frames)');
		say(table(['canvas', 'frames', 'ops', 'beginPath', 'lineTo', 'stroke', 'fill+fillRect', 'fillText', 'arc', 'max lineTo/path', '2*stroke+lineTo'],
			cs.rows.map((r) => [r.id, r.frames, r.ops, r.beginPath, r.lineTo, r.stroke, r.fill, r.text, r.arc, r.maxPathLineTo, r.budget])));
		for (const f of cs.flags) say('  ! ' + f);
		say();
	}

	/* Single-block sizes: the watch heap refuses one block above ~4.1 KB outright ("JSalloc:n oversize") and most of its
	 * other failures are 2-3 KB requests on a fragmented heap (calibration/README.md). */
	const blk = lm && lm.base && lm.base.walk ? lm : null;
	if (blk) {
		const s = blk.cps['steady state'];
		const loadLabels = LOAD_LABELS.filter((l) => blk.cps[l]);
		const maxLoadReq = loadLabels.length ? Math.max(...loadLabels.map((l) => blk.cps[l].phaseMaxReq || 0)) : 0;
		const runTicks = blk.rep.ticks.filter((t) => t[0] > 0);
		const maxRunReq = runTicks.length ? Math.max(...runTicks.map((t) => t[6] || 0)) : 0;
		/* Largest app function block: tracked on its own by newer harness builds (maxAppFnBlockT32), else from the top-8 list. */
		const fnTop = s && s.walk.maxAppFnBlockT32 > 0 ? [[s.walk.maxAppFnBlockT32, s.walk.maxAppFnBlockHost, 'functions']]
			: (s && s.walk.appTopBlocks ? s.walk.appTopBlocks.filter((b) => b[2] === 'functions') : []);
		const rowsB = [];
		if (s) {
			rowsB.push(['largest live app block (steady)', fmt(s.walk.maxAppBlockHost), fmt(s.walk.maxAppBlockT32), s.walk.maxAppBlockCat]);
			rowsB.push(['largest compiled-function data block', fnTop.length ? fmt(fnTop[0][1]) : '-', fnTop.length ? fmt(fnTop[0][0]) : '-',
				fnTop.length ? `watch compile request ~${fmt(fnTop[0][0] - 4)} B` : '']);
		}
		rowsB.push(['largest request during load (transient)', fmt(maxLoadReq), '-', 'host; byte buffers ~same on the watch, value arrays ~half']);
		rowsB.push(['largest request within a tick (transient)', fmt(maxRunReq), '-', 'host; as above']);
		say('== single-block sizes (lowmem)');
		say(table(['block', 'host B', 'est32 B', 'note'], rowsB));
		const flag = (v, what) => {
			if (v >= 4096) say(`  ! ${what} ${fmt(v)} B: above the ~4.1 KB single-block cap (watch logs "JSalloc:n oversize", no eviction, never succeeds)`);
			else if (v >= 1964) say(`  ! ${what} ${fmt(v)} B: above ~2 KB; most watch JSalloc failures are 1.96-3.1 KB requests on a fragmented heap`);
		};
		if (s) flag(s.walk.maxAppBlockT32, 'largest live app block est32');
		if (fnTop.length) flag(fnTop[0][0] - 4, 'largest function data (watch request)');
		say();
	}

	const checks = [];
	for (const [key, X] of Object.entries(results)) {
		if (!X.base) continue;
		const walks = X.rep.checkpoints.filter((c) => c.walk);
		if (walks.length) {
			const resid = Math.max(...walks.map((c) => c.walk.residualBytes));
			const mism = Math.max(...walks.map((c) => c.walk.mismatches));
			const pend = Math.max(...walks.map((c) => c.walk.pending));
			checks.push(`${key}: heap walk covered all but ${fmt(resid)} B of live host bytes, ${mism} size mismatches, ${pend} objects pending GC`);
		}
		if (X.rep.errorsTotal) checks.push(`${key}: ${X.rep.errorsTotal} app errors: ${X.rep.errors.join(' | ')}`);
		if (X.rep.fatal) checks.push(`${key}: FATAL ${X.rep.fatal}`);
		if (X.rep.failedAllocs) checks.push(`${key}: ${X.rep.failedAllocs} allocations refused by --app-limit (Duktape retries each after an emergency GC)`);
		for (const w of X.rep.warnings) checks.push(`${key}: warning: ${w}`);
	}
	if (br && df) {
		const d = Math.max(...br.labels.map((l) => Math.abs((br.app(l) || 0) - (df.app(l) || 0))));
		checks.push(`brew (Homebrew libduktape) vs default (same config from source): app bytes differ by at most ${fmt(d)} B`);
	}
	const printed = primary ? [...new Set(primary.rep.stderr.split('\n').filter((l) => l.trim() && !/^(app error|warning): /.test(l)))] : [];
	if (printed.length) {
		say('== scenario / harness output');
		for (const l of printed.slice(0, 20)) say('  ' + l);
		say();
	}
	if (checks.length) {
		say('== checks');
		for (const c of checks) say('  ' + c);
		say();
	}
	return lines.join('\n');
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args._.length !== 1) { usage(); process.exit(2); }
	const appDir = path.resolve(args._[0]);
	const work = fs.mkdtempSync('/tmp/sp-mem-run-');
	try {
		const buildOut = buildApp(appDir, work);
		const prep = prepareJob(appDir, work, args, buildOut.appId);
		let sourceMainPath = null;
		if (args.forms.includes('source')) {
			sourceMainPath = path.join(work, 'source-main.js');
			await sourceMain(appDir, args.display, sourceMainPath);
		}
		const results = {};
		for (const form of args.forms) {
			const jobPath = writeJob(work, prep, form, args, sourceMainPath);
			for (const variant of args.variants) {
				const rep = runHarness(work, variant, form, jobPath, args);
				results[`${variant}/${form}`] = analyse(rep);
			}
		}
		console.log(report(appDir, args, prep, results, buildOut));
		if (args.json) {
			const out = {};
			for (const [k, v] of Object.entries(results)) out[k] = v.rep;
			fs.writeFileSync(args.json, JSON.stringify({ app: appDir, args, views: prep.views, results: out }, null, 1));
			console.log('json: ' + args.json);
		}
		if (args.keep) console.log('work dir: ' + work);
	} finally {
		if (!args.keep) fs.rmSync(work, { recursive: true, force: true });
	}
}

main().catch((e) => {
	console.error('sp-mem: ' + (e && e.message || e));
	process.exit(1);
});
