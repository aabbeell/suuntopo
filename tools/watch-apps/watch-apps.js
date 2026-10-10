#!/usr/bin/env node
// ABOUTME: Lists the SuuntoPlus apps installed on the connected watch through the SuuntoPlus Editor's local SDS server (ws://127.0.0.1:9801).
// ABOUTME: Usage: node watch-apps.js [serial]; prints the raw Plugin/List body. Hold the watch lock while running it.
const os = require('os');
const path = require('path');
const WebSocket = require(path.join(os.homedir(), '.vscode/extensions/suunto.suuntoplus-editor-1.42.0/node_modules/ws'));

const serialArg = process.argv[2];
const ws = new WebSocket('ws://127.0.0.1:9801');
let next = 1;
const pending = new Map();
const send = (req) => new Promise((resolve, reject) => {
  const id = 9000 + next++;
  pending.set(id, { resolve });
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
    let serial = serialArg;
    if (!serial) {
      const devs = await send({ Method: 'GET', Uri: 'suunto://SDS/ConnectedDevices' });
      const list = (devs.Body && (devs.Body.Devices || devs.Body)) || [];
      if (!Array.isArray(list) || !list.length) throw new Error('no connected watch: ' + JSON.stringify(devs.Body));
      serial = list[0].Serial;
    }
    const res = await send({ Method: 'GET', Uri: 'suunto://' + serial + '/Plugin/List' });
    console.log(JSON.stringify(res.Body, null, 1));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
  ws.close();
});
