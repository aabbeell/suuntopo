#!/usr/bin/env node
// ABOUTME: Fallback build for sp-mem when sp-build rejects ext*.js files: same SuuntoPlus Editor library steps, but ext files are not script-validated.
// ABOUTME: ext*.js files are bare function/object expressions loaded by evalFile(), which the library's script validator cannot parse. Usage: node build-lib.js <appDir> <outDir>

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const TOOLS = path.join(os.homedir(), '.vscode/extensions/suunto.suuntoplus-editor-1.42.0/node_modules/@suunto-internal/suuntoplus-tools/lib/index.js');

async function main() {
	const appDir = path.resolve(process.argv[2]);
	const outDir = path.resolve(process.argv[3]);
	const T = require(TOOLS);
	await T.suuntoPlus.validateSourceDirectory(appDir);
	if (!(await T.validateProject(appDir))) throw new Error('Project validation failed');
	if (!(await T.javascript.validateAndMinify(path.join(appDir, 'main.js')))) throw new Error('main.js failed JavaScript validation');
	const work = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-mem-build-'));
	for (const f of fs.readdirSync(appDir)) {
		if (fs.statSync(path.join(appDir, f)).isFile()) fs.copyFileSync(path.join(appDir, f), path.join(work, f));
	}
	const appId = await T.suuntoPlus.getAppId(work);
	const result = await T.buildApp(appId, work, work, { languageCode: 'en' });
	if (!result.success) throw new Error('Build failed');
	fs.mkdirSync(outDir, { recursive: true });
	process.stdout.write('BUILD OK appId=' + appId + '\n');
	for (const f of fs.readdirSync(work).filter((x) => /\.(fea|dev)$/i.test(x))) {
		fs.copyFileSync(path.join(work, f), path.join(outDir, f));
		process.stderr.write('built ' + f + '\n');
	}
}

main().catch((e) => {
	process.stderr.write('BUILD FAILED: ' + (e && e.message || e) + '\n');
	process.exit(1);
});
