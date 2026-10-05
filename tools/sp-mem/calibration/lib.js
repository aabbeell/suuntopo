// ABOUTME: Shared helpers for the sp-mem calibration experiments: run a probe script in the harness binaries and read the report.
// ABOUTME: Probes run as plain global JS in one Duktape heap (no app build); they use the native SPH object directly.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HERE = __dirname;
const ROOT = path.join(HERE, '..');
const SPMEM = path.join(ROOT, 'sp-mem.js');

function harnessBin(variant) {
	const bin = path.join(ROOT, 'build', `sp-mem-${variant}`);
	if (!fs.existsSync(bin)) throw new Error(`missing ${bin}; run: bash ${path.join(ROOT, 'build.sh')}`);
	return bin;
}

function workDir(tag) {
	return fs.mkdtempSync(path.join('/tmp', `sp-mem-calib-${tag}-`));
}

/* Run probe source text (plus optional extra files run before it) in one harness variant.
 * params become the global PARAMS object. Returns the parsed JSON report with .stderr attached. */
function runProbe(variant, probeSource, opts) {
	const o = opts || {};
	const dir = o.dir || workDir('probe');
	const paramsPath = path.join(dir, 'params.js');
	fs.writeFileSync(paramsPath, `var PARAMS = ${JSON.stringify(o.params || {})};\n`);
	const probePath = path.join(dir, `probe-${variant}.js`);
	fs.writeFileSync(probePath, probeSource);
	const out = path.join(dir, `report-${variant}.json`);
	const args = ['--out', out];
	if (o.limit) args.push('--limit', String(o.limit));
	args.push(paramsPath, ...(o.before || []), probePath);
	const r = spawnSync(harnessBin(variant), args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
	if (r.error) throw r.error;
	const rep = JSON.parse(fs.readFileSync(out, 'utf8'));
	rep.stderr = r.stderr;
	rep.exitCode = r.status;
	if (!o.keep && !o.dir) fs.rmSync(dir, { recursive: true, force: true });
	return rep;
}

function cps(rep) {
	const m = {};
	for (const c of rep.checkpoints) m[c.label] = c;
	return m;
}

/* App bytes relative to a reference checkpoint (default 'baseline'). */
function delta(rep, label, ref) {
	const m = cps(rep);
	const a = m[label], b = m[ref || 'baseline'];
	if (!a || !b) return { host: null, t32: null };
	return {
		host: a.live - b.live,
		t32: (a.walk && b.walk) ? a.walk.t32Total - b.walk.t32Total : null,
		fit: (a.walkAlt && b.walkAlt) ? a.walkAlt.t32Total - b.walkAlt.t32Total : null
	};
}

/* Big requests (host bytes >= 1 KB) that fell in the phase ending at checkpoint `label`. */
function bigRequestsIn(rep, label) {
	const idx = rep.checkpoints.findIndex((c) => c.label === label);
	if (idx < 0) return [];
	return rep.bigRequests.filter((r) => r[2] === idx).map((r) => ({ size: r[0], old: r[1], t: r[3] }));
}

const fmt = (n) => (n === null || n === undefined || Number.isNaN(n)) ? '-' : Math.round(n).toLocaleString('en-US');

function table(headers, rows) {
	const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
	const line = (cells) => cells.map((c, i) => (i === 0 ? String(c).padEnd(widths[i]) : String(c).padStart(widths[i]))).join('  ');
	return [line(headers), widths.map((w) => '-'.repeat(w)).join('  '), ...rows.map(line)].join('\n');
}

function parseArgs(argv, defaults) {
	const a = Object.assign({ variants: ['lowmem', 'default'], keep: false }, defaults || {});
	for (let i = 0; i < argv.length; i++) {
		const v = argv[i];
		if (v === '--variants') a.variants = argv[++i].split(',');
		else if (v === '--keep') a.keep = true;
		else if (v === '--json') a.json = path.resolve(argv[++i]);
		else if (v.startsWith('--')) a[v.slice(2)] = argv[++i];
		else (a._ = a._ || []).push(v);
	}
	return a;
}

/* Run sp-mem.js on an app directory and return the parsed --json output (null on failure). */
function runSpMem(appDir, extraArgs) {
	const dir = workDir('app');
	const json = path.join(dir, 'out.json');
	const r = spawnSync('node', [SPMEM, appDir, '--json', json, ...(extraArgs || [])], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
	let data = null;
	try { data = JSON.parse(fs.readFileSync(json, 'utf8')); } catch (e) { /* reported by caller */ }
	fs.rmSync(dir, { recursive: true, force: true });
	return { data, stdout: r.stdout, stderr: r.stderr, status: r.status };
}

module.exports = { HERE, ROOT, harnessBin, workDir, runProbe, cps, delta, bigRequestsIn, fmt, table, parseArgs, runSpMem, os };
