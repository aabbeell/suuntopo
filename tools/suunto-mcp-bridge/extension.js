// ABOUTME: VS Code extension that serves a minimal MCP server (Streamable HTTP, JSON responses) on localhost.
// ABOUTME: Its tools drive the SuuntoPlus Editor extension: build an app, open the simulator, screenshot, read simulator logs.

const vscode = require('vscode');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SUUNTO_EXTENSION_ID = 'Suunto.suuntoplus-editor';
// The simulator hooks below rely on internals of this exact SuuntoPlus Editor version.
const TESTED_SUUNTO_VERSION = '1.42.0';
const BUILD_TIMEOUT_MS = 60000;
const DEPLOY_TIMEOUT_MS = 120000;
const SIM_LOG_LIMIT = 500;
const SCREENSHOT_DIR = path.join(os.tmpdir(), 'suunto-mcp-bridge');

let server;
let lastSimulatorAppDir;
const simulatorLog = [];
const hookedLoggers = new WeakSet();

function activate(context) {
  const port = vscode.workspace.getConfiguration('suuntoMcpBridge').get('port') || 39317;
  server = http.createServer((req, res) => handleHttp(req, res).catch((err) => {
    console.error('suunto-mcp-bridge request failed:', err);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }));
  server.on('error', (err) => {
    // A second VS Code window finds the port taken; the first window keeps serving.
    console.warn('suunto-mcp-bridge: MCP server not started:', err.message);
  });
  server.listen(port, '127.0.0.1');
  context.subscriptions.push({ dispose: () => server.close() });
}

function deactivate() {
  if (server) server.close();
}

// ---------- MCP over HTTP ----------

async function handleHttp(req, res) {
  if (req.url.split('?')[0] !== '/mcp') {
    res.writeHead(404);
    return res.end();
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { Allow: 'POST' });
    return res.end();
  }
  const body = await readBody(req);
  let message;
  try {
    message = JSON.parse(body);
  } catch (err) {
    return sendJson(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  const messages = Array.isArray(message) ? message : [message];
  const responses = [];
  for (const msg of messages) {
    const response = await handleRpc(msg);
    if (response) responses.push(response);
  }
  if (responses.length === 0) {
    res.writeHead(202);
    return res.end();
  }
  return sendJson(res, 200, Array.isArray(message) ? responses : responses[0]);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function handleRpc(msg) {
  const isNotification = msg.id === undefined;
  try {
    let result;
    switch (msg.method) {
      case 'initialize':
        result = {
          protocolVersion: (msg.params && msg.params.protocolVersion) || '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'suunto-mcp-bridge', version: '0.1.5' },
        };
        break;
      case 'ping':
        result = {};
        break;
      case 'tools/list':
        result = { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) };
        break;
      case 'tools/call':
        result = await callTool(msg.params.name, msg.params.arguments || {});
        break;
      default:
        if (isNotification) return null;
        return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found: ' + msg.method } };
    }
    return isNotification ? null : { jsonrpc: '2.0', id: msg.id, result };
  } catch (err) {
    if (isNotification) return null;
    return { jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: String(err && err.message || err) } };
  }
}

// Tools share one simulator panel and one build log, so calls run one at a time in arrival order.
let toolQueue = Promise.resolve();
function callTool(name, args) {
  const result = toolQueue.then(() => runTool(name, args));
  toolQueue = result.catch(() => {});
  return result;
}

async function runTool(name, args) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error('Unknown tool: ' + name);
  try {
    const content = await tool.run(args);
    const warning = await suuntoVersionWarning();
    if (warning) content.push({ type: 'text', text: warning });
    return { content };
  } catch (err) {
    return { content: [{ type: 'text', text: String(err && err.message || err) }], isError: true };
  }
}

// ---------- Tools ----------

const APP_ARG = {
  type: 'string',
  description: 'App folder: an absolute path, or a folder name under src/ in an open workspace folder (e.g. "suuntopo_canvas")',
};

const TOOLS = [
  {
    name: 'build',
    description: 'Validate, minify and build a SuuntoPlus app with the SuuntoPlus Editor. Returns the build log and the built .fea/.dev files.',
    inputSchema: { type: 'object', properties: { app: APP_ARG }, required: ['app'] },
    run: buildApp,
  },
  {
    name: 'deploy',
    description: 'Build an app and install it on the watch connected to this Mac (USB, or Bluetooth if enabled in the SuuntoPlus Editor). Sideloaded apps are removed by the next phone sync.',
    inputSchema: { type: 'object', properties: { app: APP_ARG }, required: ['app'] },
    run: deployApp,
  },
  {
    name: 'open_simulator',
    description: 'Open (or switch) the SuuntoPlus Simulator panel in VS Code to the given app. Simulator log capture starts here.',
    inputSchema: { type: 'object', properties: { app: APP_ARG }, required: ['app'] },
    run: openSimulator,
  },
  {
    name: 'screenshot',
    description: 'Screenshot the watch display of an app. Runs the app fresh in a headless copy of the simulator and captures it a few seconds after start, so it shows the start screen, not the state of the visible simulator panel. The first call may download a headless Chrome (progress shown in VS Code).',
    inputSchema: {
      type: 'object',
      properties: {
        app: APP_ARG,
        name: { type: 'string', description: 'File name for the PNG, without extension (default: the app folder name)' },
        wait_seconds: { type: 'number', description: 'How long the app runs before the capture (default 2)' },
        display: {
          type: 'string',
          enum: ['s', 'm', 'l', 'n', 'o', 'q'],
          description: 'Watch display to render on, e.g. "q" for the 466 px AMOLED watches (Race, Race S, Vertical 2). Also switches the visible simulator panel. Default: the panel\'s current display.',
        },
      },
      required: ['app'],
    },
    run: screenshot,
  },
  {
    name: 'sim_log',
    description: 'Return the latest log lines of the SuuntoPlus Simulator panel opened through open_simulator (app console output, warnings, errors).',
    inputSchema: {
      type: 'object',
      properties: { lines: { type: 'number', description: 'How many of the latest lines to return (default 50)' } },
    },
    run: readSimulatorLog,
  },
];

async function buildApp({ app }) {
  const appDir = resolveAppDir(app);
  await ensureSuuntoActive();
  const logFile = suuntoLogFile();
  const logStart = fileSize(logFile);
  const startedAt = Date.now();
  await vscode.commands.executeCommand('suuntoplus.buildApp', { applicationDirectory: appDir });

  let logText = '';
  let verdict = 'unknown (no result in the log within ' + BUILD_TIMEOUT_MS / 1000 + ' s)';
  while (Date.now() - startedAt < BUILD_TIMEOUT_MS) {
    await sleep(500);
    logText = readFrom(logFile, logStart);
    if (/build successful/i.test(logText)) { verdict = 'success'; break; }
    if (/(build|validation) failed/i.test(logText)) { verdict = 'failed'; break; }
  }
  const outputs = fs.readdirSync(appDir)
    .filter((f) => /\.(fea|dev)$/i.test(f))
    .map((f) => path.join(appDir, f))
    .filter((f) => fs.statSync(f).mtimeMs >= startedAt - 1000);
  return [{
    type: 'text',
    text: 'Build ' + verdict + ' for ' + appDir + '\n\nBuilt files:\n' + (outputs.join('\n') || '(none)') + '\n\nLog:\n' + withoutDebugEntries(logText).trim(),
  }];
}

async function deployApp({ app }) {
  const appDir = resolveAppDir(app);
  await ensureSuuntoActive();
  const logFile = suuntoLogFile();
  const logStart = fileSize(logFile);
  const startedAt = Date.now();
  await vscode.commands.executeCommand('suuntoplus.deployApp', { applicationDirectory: appDir });

  let logText = '';
  let verdict = 'unknown (no result in the log within ' + DEPLOY_TIMEOUT_MS / 1000 + ' s; is a watch connected?)';
  while (Date.now() - startedAt < DEPLOY_TIMEOUT_MS) {
    await sleep(1000);
    logText = readFrom(logFile, logStart);
    if (/added to watch/i.test(logText)) { verdict = 'installed'; break; }
    if (/(build|validation) failed|does not support SuuntoPlus|Unsupported watch|\[error\]/i.test(logText)) { verdict = 'failed'; break; }
  }
  return [{ type: 'text', text: 'Deploy ' + verdict + ' for ' + appDir + '\n\nLog:\n' + withoutDebugEntries(logText).trim() }];
}

async function openSimulator({ app }) {
  const appDir = resolveAppDir(app);
  const panel = await simulatorPanel(appDir);
  return [{ type: 'text', text: 'Simulator open for ' + appDir + (panel ? '' : ' (panel object not returned; log capture unavailable)') }];
}

// The SuuntoPlus Editor's own screenshot() throws in 1.42.0 (its obfuscated page script references a variable
// that does not exist inside the browser), so this drives the editor's headless simulator page directly.
async function screenshot({ app, name, wait_seconds, display }) {
  const appDir = resolveAppDir(app);
  const panel = await simulatorPanel(appDir);
  if (!panel || !panel.page) throw new Error('The SuuntoPlus Simulator panel did not open');
  const page = panel.page;
  fixPagePostMessage(page);
  if (display && display !== panel.displayId) {
    panel.displayId = display;
    await panel.reload();
  }
  // Download the headless browser without the extension's yes/no prompt, which only a person could answer.
  if (!(await page.getInstalledBrowser())) await page.installChrome(false);
  // A fresh headless page picks up the current app code and starts it from scratch.
  await page.destroyPuppeteer();
  await panel.createPuppeteer();
  const browserPage = page.puppeteerPage;
  if (!browserPage) throw new Error('The headless simulator did not start');
  try {
    await sleep(500);
    await browserPage.setViewport({ width: 5760, height: 3240, deviceScaleFactor: 1 });
    await browserPage.evaluate("var start = document.getElementById('startSimulator'); if (start) start.click();");
    await sleep(1000 * (wait_seconds > 0 ? wait_seconds : 2));
    // Move the watch display to the top of the page so nothing overlaps it in the capture.
    await browserPage.evaluate("var bg = document.querySelector('.html-bg'); if (bg) { bg.parentNode.removeChild(bg); document.body.insertBefore(bg, document.body.firstChild); }");
    const watchDisplay = await browserPage.$('.html-bg');
    if (!watchDisplay) throw new Error('The headless simulator shows no watch display');
    const png = await watchDisplay.screenshot({ type: 'png', omitBackground: true });
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const pngPath = path.join(SCREENSHOT_DIR, (name || path.basename(appDir)).replace(/[^\w.-]/g, '_') + '.png');
    fs.writeFileSync(pngPath, png);
    return [
      { type: 'image', data: Buffer.from(png).toString('base64'), mimeType: 'image/png' },
      { type: 'text', text: 'Saved to ' + pngPath },
    ];
  } finally {
    await page.destroyPuppeteer();
  }
}

// The editor's postMessage() forwards every view update to the headless page with an obfuscated function that
// fails inside the browser in 1.42.0 ("_0x... is not defined"), which also breaks the visible panel while a
// headless page exists. This replacement does the same forwarding with a plain function.
const fixedPages = new WeakSet();
function fixPagePostMessage(page) {
  if (fixedPages.has(page)) return;
  fixedPages.add(page);
  page.postMessage = async (message) => {
    if (page.webview) await page.webview.postMessage(message);
    if (page.puppeteerPage) {
      await page.puppeteerPage.evaluate((data) => window.dispatchEvent(new MessageEvent('message', { data })), message);
    }
  };
}

async function readSimulatorLog({ lines }) {
  const count = Math.max(1, Math.min(SIM_LOG_LIMIT, lines || 50));
  const header = lastSimulatorAppDir ? 'Simulator log for ' + lastSimulatorAppDir : 'No simulator opened through open_simulator yet';
  return [{ type: 'text', text: header + '\n\n' + simulatorLog.slice(-count).join('\n') }];
}

// ---------- SuuntoPlus Editor glue ----------

// The SuuntoPlus Editor registers its commands early in activation, but activation itself can hang on starting
// its watch-connection server (an x86 binary that needs Rosetta), so wait for the commands, not for activation.
async function ensureSuuntoActive() {
  const ext = vscode.extensions.getExtension(SUUNTO_EXTENSION_ID);
  if (!ext) throw new Error('The SuuntoPlus Editor extension (' + SUUNTO_EXTENSION_ID + ') is not installed');
  if (!ext.isActive) ext.activate().catch((err) => console.warn('suunto-mcp-bridge: SuuntoPlus Editor activation failed:', err));
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const commands = await vscode.commands.getCommands(true);
    if (commands.includes('suuntoplus.simulatorDefault')) return ext;
    await sleep(500);
  }
  throw new Error('The SuuntoPlus Editor commands did not become available; check that the folder is trusted');
}

async function suuntoVersionWarning() {
  const ext = vscode.extensions.getExtension(SUUNTO_EXTENSION_ID);
  const version = ext && ext.packageJSON.version;
  if (version && version !== TESTED_SUUNTO_VERSION) {
    return 'Warning: SuuntoPlus Editor is ' + version + '; this bridge was written against ' + TESTED_SUUNTO_VERSION + ' and may misbehave.';
  }
  return '';
}

// suuntoplus.simulatorDefault returns the live simulator panel when given a file inside the app folder.
async function simulatorPanel(appDir) {
  await ensureSuuntoActive();
  const panel = await vscode.commands.executeCommand('suuntoplus.simulatorDefault', vscode.Uri.file(path.join(appDir, 'manifest.json')));
  lastSimulatorAppDir = appDir;
  if (panel) hookLogger(panel);
  return panel;
}

function hookLogger(panel) {
  const logger = panel.logger;
  if (!logger || hookedLoggers.has(logger)) return;
  hookedLoggers.add(logger);
  for (const level of ['debug', 'info', 'warn', 'error']) {
    const original = logger[level].bind(logger);
    logger[level] = (...args) => {
      simulatorLog.push(new Date().toTimeString().slice(0, 8) + ' [' + level + '] ' + args.map(formatLogArg).join(' '));
      if (simulatorLog.length > SIM_LOG_LIMIT) simulatorLog.splice(0, simulatorLog.length - SIM_LOG_LIMIT);
      return original(...args);
    };
  }
}

function formatLogArg(arg) {
  if (arg instanceof Error) return arg.message;
  return typeof arg === 'string' ? arg : JSON.stringify(arg);
}

function resolveAppDir(app) {
  if (!app) throw new Error('Missing "app"');
  const candidates = path.isAbsolute(app)
    ? [app]
    : (vscode.workspace.workspaceFolders || []).flatMap((f) => [path.join(f.uri.fsPath, 'src', app), path.join(f.uri.fsPath, app)]);
  const found = candidates.find((dir) => fs.existsSync(path.join(dir, 'manifest.json')));
  if (!found) throw new Error('No SuuntoPlus app (manifest.json) found for "' + app + '". Tried:\n' + candidates.join('\n'));
  return found;
}

// Debug entries in the SuuntoPlus Editor log repeat the whole minified app once per display; their continuation lines
// do not start with a timestamp, so they are dropped together with the entry.
function withoutDebugEntries(logText) {
  let inDebugEntry = false;
  return logText.split('\n').filter((line) => {
    if (line.startsWith('[')) inDebugEntry = line.includes('] [debug] ');
    return !inDebugEntry;
  }).join('\n');
}

function suuntoLogFile() {
  return path.join(process.env.HOME || '', 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'suunto.suuntoplus-editor', 'suuntoplus-editor.log');
}

function fileSize(file) {
  try { return fs.statSync(file).size; } catch (err) { return 0; }
}

function readFrom(file, offset) {
  const size = fileSize(file);
  if (size <= offset) return '';
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(size - offset);
    fs.readSync(fd, buf, 0, buf.length, offset);
    return buf.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { activate, deactivate };
