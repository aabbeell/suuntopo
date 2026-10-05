#!/usr/bin/env node
// ABOUTME: Reads the connected watch's system events through the SuuntoPlus Editor's local SDS server (ws://127.0.0.1:9801).
// ABOUTME: Usage: node watch-log.js [serial] [--grep <regex>] [--out <file>]; needs VS Code running with the watch connected.

const path = require('path');
const fs = require('fs');
const os = require('os');
const WebSocket = require(path.join(os.homedir(), '.vscode/extensions/suunto.suuntoplus-editor-1.42.0/node_modules/ws'));

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const serial = args[0] && !args[0].startsWith('--') ? args[0] : null;
const filter = opt('--grep') ? new RegExp(opt('--grep'), 'i') : null;
const out = opt('--out');

const ws = new WebSocket('ws://127.0.0.1:9801');
let nextId = 9000;
const pending = new Map();
const send = (req) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify(Object.assign({ Type: 'Request', Body: {}, RequestId: id }, req)));
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('timeout for ' + req.Uri)); } }, 60000);
});
ws.on('message', (raw) => {
  let msg;
  try { msg = JSON.parse(raw); } catch (e) { return; }
  const p = pending.get(msg.RequestId);
  if (p) { pending.delete(msg.RequestId); p.resolve(msg); }
});
ws.on('error', (e) => { console.error('SDS not reachable: ' + e.message); process.exit(1); });
ws.on('open', async () => {
  try {
    let s = serial;
    if (!s) {
      const devs = await send({ Method: 'GET', Uri: 'suunto://SDS/ConnectedDevices' });
      const list = (devs.Body && devs.Body.Devices) || [];
      if (!list.length) throw new Error('no watch connected');
      s = list[0].Serial;
    }
    const res = await send({ Method: 'GET', Uri: 'suunto://SDS/SystemEvents/' + s });
    const text = res.Body && res.Body.Content;
    if (typeof text !== 'string') throw new Error('unexpected response: ' + JSON.stringify(res).slice(0, 300));
    if (out) fs.writeFileSync(out, text);
    const lines = text.split(/\r?\n/);
    const shown = filter ? lines.filter((l) => filter.test(l)) : lines;
    console.log(shown.join('\n'));
    console.error('[' + lines.length + ' lines from ' + s + (filter ? ', ' + shown.length + ' matched' : '') + (out ? ', saved to ' + out : '') + ']');
    ws.close();
  } catch (e) {
    console.error('ERROR: ' + e.message);
    process.exit(1);
  }
});
