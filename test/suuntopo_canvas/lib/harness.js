// ABOUTME: Loads the shipped Suuntopo code (main.js, ext*.js, t.html onLoad script) into Node vm contexts with stubs
// ABOUTME: of the watch globals, and wires main.js to the template through outputs and events like the firmware does.

'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../../..');
const APP = path.join(ROOT, 'src/suuntopo_canvas');
const FIXTURES = path.join(__dirname, '..', 'fixtures');
const WIDTH = { q: 466, o: 280, n: 240 };
const INITIALLY_HIDDEN = ['#it', '#l0', '#l1', '#l2', '#l3', '#l4', '#l5', '#ld'];

const readApp = (name) => fs.readFileSync(path.join(APP, name), 'utf8');
const lang = () => JSON.parse(readApp('en.json'));
const fixture = (name) => fs.readFileSync(path.join(FIXTURES, name), 'utf8').replace(/\n$/, '');
const extFiles = () => fs.readdirSync(APP).filter((f) => /^ext\d+\.js$/.test(f)).sort((a, b) => parseInt(a.slice(3), 10) - parseInt(b.slice(3), 10));
// Built-in topo files: topo id t (1-4) is ext(t + 3).js. Every other ext file is code.
const TOPO_EXT = ['ext4.js', 'ext5.js', 'ext6.js', 'ext7.js'];

// Text of attribute attr on the first element that has it (attribute values never contain a double quote).
function attribute(html, attr) {
  const start = html.indexOf(attr + '="');
  if (start < 0) throw new Error('attribute ' + attr + ' not found');
  const from = start + attr.length + 2;
  return html.substring(from, html.indexOf('"', from));
}

// Replaces {{ TOKEN }} and {{key}} the way the build does (language data plus compile tokens).
function substitute(text, display) {
  const ui1 = ['s', 'm', 'l'].indexOf(display) >= 0;
  const data = Object.assign({}, lang(), { DISPLAY_ID: display, IS_UI1: ui1 ? 1 : 0, IS_UI2: ui1 ? 0 : 1, HAS_SETTINGS: ui1 ? 0 : 1, LANGUAGE: 'en' });
  return text.replace(/{{\s*([^}\s]+)\s*}}/g, (m, key) => {
    if (!(key in data)) throw new Error('unknown token ' + key);
    return String(data[key]);
  });
}

const templateSource = (display) => substitute(readApp('t.html'), display).replace(/{zapp_index}/g, '0');
// Heights of the canvas tiles #c0-#c2 as fractions of the display, from their style in t.html.
const TILE_HEIGHT = [0, 1, 2].map((i) => {
  const m = new RegExp('<object id="c' + i + '"[^\\n]*height:(\\d+)%').exec(readApp('t.html'));
  if (!m) throw new Error('tile #c' + i + ' has no height in t.html');
  return Number(m[1]) / 100;
});

function sharedBlock(display) {
  const script = attribute(templateSource(display), 'onLoad');
  const a = script.indexOf('// BEGIN SHARED');
  const b = script.indexOf('// END SHARED');
  if (a < 0 || b < 0) throw new Error('shared block markers missing');
  return script.substring(a, b + '// END SHARED'.length);
}

const scriptCache = new Map();
function compiled(code, filename) {
  if (!scriptCache.has(code)) scriptCache.set(code, new vm.Script(code, { filename }));
  return scriptCache.get(code);
}

// The screen: element texts, visibility and colours written by main.js and the template, with the firmware's rules.
function newScreen() {
  const s = { text: {}, vis: {}, color: {}, textCalls: 0, styleCalls: 0 };
  for (const id of INITIALLY_HIDDEN) s.vis[id] = 'HIDDEN';
  s.setText = (id, t) => {
    if (typeof t !== 'string' || !t.length || !t.replace(/ /g, '').length) throw new Error('setText with blank text on ' + id);
    if (s.vis[id] === 'HIDDEN') throw new Error('setText on hidden ' + id);
    s.text[id] = t;
    s.textCalls++;
  };
  s.setStyle = (sel, prop, val) => {
    s.styleCalls++;
    const id = sel.replace(/ \*$/, '');
    if (prop === 'visibility') {
      if (val !== 'HIDDEN' && val !== 'VISIBLE') throw new Error('bad visibility ' + val);
      s.vis[id] = val;
    } else if (prop === 'color') {
      if (!/^#[0-9A-F]{6}$/.test(val)) throw new Error('bad colour ' + val);
      s.color[id] = val;
    } else {
      throw new Error('unexpected style ' + prop);
    }
  };
  s.visible = (id) => s.vis[id] !== 'HIDDEN';
  s.shown = (id) => (s.visible(id) ? s.text[id] : undefined);
  return s;
}

// Context in which main.js and the ext files run: storage, evalFile and the screen natives. Storage behaves like the
// editor's AppSettings: getItem returns only string values (null for an integer enum as the phone app stores it), getObject
// returns the raw value. opts.failExt (a Set of file names, may change during a test) makes evalFile throw for those files,
// like a JSalloc failure; opts.storageThrows makes every storage call throw.
function mainContext(display, storage, screen, opts) {
  const st = Object.assign({}, storage || {});
  const rec = { system: [], writes: 0, reads: 0, evalFiles: [] };
  const has = (k) => Object.prototype.hasOwnProperty.call(st, k);
  const g = {
    Math, String, Number, isFinite, isNaN, Float32Array, Uint8Array,
    localStorage: {
      getItem: (k) => {
        rec.reads++;
        if (opts && opts.storageThrows) throw new Error('storage');
        return has(k) && typeof st[k] === 'string' ? st[k] : null;
      },
      getObject: (k) => {
        rec.reads++;
        if (opts && opts.storageThrows) throw new Error('storage');
        return has(k) ? st[k] : undefined;
      },
      setItem: (k, v) => {
        if (opts && opts.storageThrows) throw new Error('storage');
        st[k] = String(v);
        rec.writes++;
      }
    },
    systemEvent: (m) => rec.system.push(m),
    setText: (id, t) => screen.setText(id, t),
    setStyle: (sel, p, v) => screen.setStyle(sel, p, v)
  };
  const ctx = vm.createContext(g);
  // Like the simulator: evalFile returns a function that evaluates the file's expression and calls it with the arguments.
  g.evalFile = (file) => {
    const m = /^\{file_path\}\/(ext\d+\.js)$/.exec(file);
    if (!m) throw new Error('bad evalFile path ' + file);
    rec.evalFiles.push(m[1]);
    if (opts && opts.failExt && opts.failExt.has(m[1])) throw new Error('JSalloc failed (' + m[1] + ')');
    const fn = compiled('(' + substitute(readApp(m[1]), display) + ')', m[1]).runInContext(ctx);
    return function () { return fn.apply(null, arguments); };
  };
  return { ctx, storage: st, rec };
}

// Runs one ext file's function (for unit tests of ext1 and friends).
function ext(name, display, screen, storage) {
  const c = mainContext(display || 'q', storage, screen || newScreen());
  return { fn: compiled('(' + substitute(readApp(name), display || 'q') + ')', name).runInContext(c.ctx), main: c };
}

// The two parser stages as main.js runs them: ext1.js (header, text, pitches) then ext9.js (geometry).
function parser() {
  const c = mainContext('q', {}, newScreen());
  const load = (f) => compiled('(' + substitute(readApp(f), 'q') + ')', f).runInContext(c.ctx);
  const one = load('ext1.js');
  const two = load('ext9.js');
  return (s, W, R) => one(s, R) || two(s, W, R);
}

// Parses s. Returns { code, W, R }.
function parse(s) {
  const W = new Float32Array(644);
  const R = new Float32Array(200);
  const code = parser()(s, W, R);
  return { code, W, R };
}

function loadMain(display, storage, screen, opts) {
  const sc = screen || newScreen();
  const c = mainContext(display || 'q', storage, sc, opts);
  compiled(substitute(readApp('main.js'), display || 'q'), 'main.js').runInContext(c.ctx);
  return { ctx: c.ctx, output: {}, input: {}, storage: c.storage, rec: c.rec, screen: sc };
}

// A canvas context that counts budget units like the renderer's cost table and records stroked segments.
function countingContext(width, height) {
  const ctx = { width, height, units: 0, maxPathOps: 0, pathOps: 0, colours: [], strokes: 0, fills: 0, arcs: 0, lines: 0, segments: [], lineWidth: 1, cx: 0, cy: 0 };
  let stroke = '#000000';
  let fill = '#000000';
  Object.defineProperty(ctx, 'strokeStyle', { get: () => stroke, set: (c) => { ctx.colours.push(c); stroke = c; } });
  Object.defineProperty(ctx, 'fillStyle', { get: () => fill, set: (c) => { ctx.colours.push(c); fill = c; } });
  ctx.beginPath = () => { ctx.pathOps = 0; };
  const pathOp = () => { ctx.units += 1; ctx.pathOps++; ctx.maxPathOps = Math.max(ctx.maxPathOps, ctx.pathOps); };
  ctx.moveTo = (x, y) => { pathOp(); ctx.cx = x; ctx.cy = y; };
  ctx.lineTo = (x, y) => { pathOp(); ctx.lines++; ctx.segments.push([ctx.cx, ctx.cy, x, y, stroke, ctx.lineWidth]); ctx.cx = x; ctx.cy = y; };
  ctx.stroke = () => { ctx.units += 2; ctx.strokes++; };
  ctx.fill = () => { ctx.units += 2; ctx.fills++; };
  ctx.fillRect = () => { ctx.units += 2; };
  ctx.arc = () => { ctx.units += 4; ctx.arcs++; };
  for (const name of ['fillText', 'strokeRect', 'setTransform', 'arcTo', 'rotate', 'translate', 'scale', 'measureText', 'closePath']) {
    ctx[name] = () => { throw new Error('renderer used ' + name); };
  }
  return ctx;
}

// The renderer keeps its constants, state and helpers in its own function scope (t.html, makeRenderer). For tests only,
// the template script gets one extra line inside that scope, before the per-frame function is returned: a function that
// reads or assigns any name visible there. The shipped script and its scoping are otherwise unchanged.
const RENDERER_RETURN = '  return function (ctx, ti) {';
function withRendererHook(script) {
  const at = script.indexOf(RENDERER_RETURN);
  if (at < 0 || script.indexOf(RENDERER_RETURN, at + 1) >= 0) throw new Error('t.html: expected one "' + RENDERER_RETURN.trim() + '" in the renderer');
  const hook = '  __renderer = function (__n, __v, __set) { return __set ? eval(__n + \' = __v\') : eval(__n); };\n';
  return script.substring(0, at) + hook + script.substring(at);
}

// Loads the template script with stubs; outputs are delivered with t.deliver(name, value). t.ctx holds the template's
// top-level names; t.r reads and assigns names as the renderer sees them (its own scope, then the template's), so a test
// can read t.r.sz or replace t.r.vis.
function loadTemplate(display, screen) {
  const sc = screen || newScreen();
  const rec = { refresh: [], events: [], subs: {}, subToken: {}, live: 0, subscribes: 0, unsubs: 0, gets: {}, pending: [], timers: [], delays: [], slow: [], clock: 0 };
  const g = {
    Math, String, Number, isFinite, isNaN, Float32Array, Uint8Array,
    $: {
      // live counts subscriptions not yet released, so a leak of tokens shows even when a path is subscribed again.
      subscribe: (p, cb) => {
        const name = p.replace('Zapp/0/Output/', '');
        rec.live++;
        rec.subscribes++;
        rec.subs[name] = cb;
        rec.subToken[name] = p + '#' + rec.subscribes;
        return rec.subToken[name];
      },
      unsubscribe: (tok) => {
        if (!tok) throw new Error('unsubscribe without a token');
        rec.unsubs++;
        rec.live--;
        const name = String(tok).replace('Zapp/0/Output/', '').replace(/#\d+$/, '');
        if (rec.subs[name] && String(tok) === rec.subToken[name]) delete rec.subs[name];
      },
      // $.get answers later (rig answers Zapp outputs with main.js's current value); rec.gets keeps the last callback per path.
      get: (p, cb) => { rec.gets[p] = cb; rec.pending.push([p, cb]); },
      put: (p, v, cb, type) => {
        if (type !== 'int32' || p !== '/Zapp/0/Event') throw new Error('bad put ' + p + ' ' + type);
        if (typeof v !== 'number' || Math.floor(v) !== v || v < 0 || v > 2147483647) throw new Error('bad event value ' + v);
        rec.events.push(v);
      }
    },
    setText: (id, t) => sc.setText(id, t),
    setStyle: (sel, p, v) => sc.setStyle(sel, p, v),
    control: (target, cmd) => { if (cmd !== 'REFRESH') throw new Error('bad control'); rec.refresh.push(target); },
    // Timers of a second or more (the stream watchdog) wait on the firmware clock (sys.tick, t.advance); shorter ones (the
    // refresh chain) are in rec.timers and run with t.runTimers().
    setTimeout: (fn, ms) => {
      if (typeof fn !== 'function') throw new Error('setTimeout without function');
      if (ms >= 1000) { rec.slow.push([fn, rec.clock + ms]); return; }
      rec.timers.push(fn);
      rec.delays.push(ms);
    }
  };
  const html = templateSource(display);
  const ctx = vm.createContext(g);
  compiled(withRendererHook(attribute(html, 'onLoad')), 't.html onLoad').runInContext(ctx);
  const r = new Proxy({}, {
    get: (o, name) => (typeof name === 'string' ? ctx.__renderer(name) : undefined),
    set: (o, name, v) => { ctx.__renderer(name, v, 1); return true; }
  });
  const buttons = {};
  for (const name of ['up', 'down', 'next']) buttons[name] = html.match(new RegExp('<pushButton name="' + name + '"[^>]*onLongPressStart="([^"]*)"'))[1];
  const t = {
    ctx, r, rec, screen: sc, display,
    activate: () => compiled(attribute(html, 'onActivate'), 'onActivate').runInContext(ctx),
    deactivate: () => compiled(attribute(html, 'onDeactivate'), 'onDeactivate').runInContext(ctx),
    hold: (name) => compiled(buttons[name], 'button').runInContext(ctx),
    deliver: (name, v) => { if (rec.subs[name]) rec.subs[name](v); },
    runTimers: () => { const list = rec.timers.splice(0); for (const fn of list) fn(); },
    // Moves the firmware clock on by ms and runs the slow timers that fall due.
    advance: (ms) => {
      rec.clock += ms;
      const due = rec.slow.filter((x) => x[1] <= rec.clock);
      rec.slow = rec.slow.filter((x) => x[1] > rec.clock);
      for (const [fn] of due) fn();
    },
    drawTile: (i) => {
      const W = WIDTH[display];
      const c = countingContext(W, Math.round(W * TILE_HEIGHT[i]));
      c.reported = ctx.drawTile(c, i);
      return c;
    }
  };
  return t;
}

// Check word of a stream chunk, as main.js computes it.
function chunkCheck(hash, k, words) {
  let h = hash * 7 + k * 131 + 1;
  for (let i = 0; i < 14; i++) h = (h * 31 + words[i]) % 16777213;
  return h;
}

// Hands chunk k (14 words and its check word) to the template's receiver the way its read chain does.
function deliverChunk(t, k, words, check) {
  t.ctx.rx[15] = k;
  words.forEach((v, i) => t.ctx.rv(i, v));
  t.ctx.rv(14, check);
}

// Feeds the geometry words W (nW of them) to the template as its read chain would, then sets the drawing state.
function feed(t, W, nW, hash, ms) {
  t.deliver('mh', hash);
  for (let k = 0; k * 14 < nW; k++) {
    const words = [];
    for (let i = 0; i < 14; i++) words.push(W[k * 14 + i]);
    deliverChunk(t, k, words, chunkCheck(hash, k, words));
  }
  if (ms !== undefined) t.deliver('ms', ms);
}

// main.js and the template connected the way the firmware connects them. mode 'change' delivers an output to the
// template only when its value changed (hardware); 'all' delivers every output every tick (simulator). Options:
// - order 'manifest' (default) delivers ms and mh first; 'hashLast' delivers the chunk words, ck, then mh and ms, so a chunk
//   reaches the template before its stream id (the order v1.0 subscribed in).
// - current false: a (re)activated template's subscriptions do not deliver the current value, only later changes.
// - gets false: $.get on an output never answers. By default it answers with main.js's current output value.
// - batch true: outputs written in onEvent or onLap reach the template only with the next evaluate (the reference allows
//   this), so a new stream id and the next chunk arrive in one batch.
// - mount false: no template yet (the user has not opened the app display); sys.evaluate() runs main.js alone until the test
//   calls sys.mount().
function rig(opts) {
  const o = Object.assign({ display: 'q', storage: {}, mode: 'change', order: 'manifest', current: true, gets: true, batch: false, mount: true }, opts || {});
  const screen = newScreen();
  const main = loadMain(o.display, o.storage, screen, o);
  const manifest = JSON.parse(readApp('manifest.json')).out.map((x) => x.name);
  const names = o.order === 'hashLast' ? manifest.filter((n) => /^d\d+$/.test(n)).concat(['ck', 'pitch', 'mh', 'ms']) : manifest;
  if (names.length !== manifest.length) throw new Error('delivery order misses an output');
  const sys = { main, screen, t: null, sent: {}, ticks: 0, names };
  main.ctx.onLoad(main.input, main.output);
  // Events the template sent, delivered to main.js.
  sys.events = () => {
    const ev = sys.t.rec.events.splice(0);
    for (const e of ev) main.ctx.onEvent(main.input, main.output, e);
  };
  // Pushes outputs to the template subscriptions.
  sys.push = (all) => {
    for (const n of names) {
      const v = main.output[n];
      if (v === undefined) continue;
      if (all || o.mode === 'all' || sys.sent[n] !== v) {
        sys.sent[n] = v;
        sys.t.deliver(n, v);
      }
    }
  };
  // Answers the template's pending $.get calls on outputs with main.js's current values, including the reads those
  // answers start (a chunk's read chain), up to 200 reads.
  sys.answer = () => {
    for (let n = 0; n < 200 && sys.t.rec.pending.length; ) {
      const list = sys.t.rec.pending.splice(0);
      for (const [p, cb] of list) {
        n++;
        const m = /^Zapp\/0\/Output\/(\w+)$/.exec(p);
        if (m && o.gets && main.output[m[1]] !== undefined) cb(main.output[m[1]]);
      }
    }
  };
  // One firmware second: events, evaluate, outputs, timers.
  sys.tick = (n) => {
    for (let i = 0; i < (n || 1); i++) {
      sys.events();
      main.ctx.evaluate(main.input, main.output);
      sys.ticks++;
      sys.push(false);
      sys.t.runTimers();
      sys.t.advance(1000);
      sys.answer();
      sys.events();
      if (!o.batch) sys.push(false);
    }
  };
  // What a (re)activated template gets: every current value, or (current false) nothing until a value changes.
  const delivered = () => {
    if (o.current) sys.push(true);
    else sys.sent = Object.assign({}, main.output);
  };
  // Mounts (or remounts) the template: onLoad, onActivate and the current value of every subscription.
  sys.mount = () => {
    sys.t = loadTemplate(o.display, screen);
    sys.sent = {};
    sys.t.activate();
    delivered();
    sys.answer();
    sys.events();
  };
  sys.reactivate = () => {
    sys.t.deactivate();
    sys.t.activate();
    delivered();
    sys.answer();
    sys.events();
  };
  sys.press = (name) => {
    sys.t.hold(name);
    sys.events();
    if (!o.batch) sys.push(false);
  };
  sys.lap = () => {
    main.ctx.onLap(main.input, main.output);
    if (!o.batch) sys.push(false);
  };
  // Ticks until the template holds the open topo completely (or limit ticks pass); returns the ticks used.
  sys.settle = (limit) => {
    let i = 0;
    while (i < (limit || 60) && !(sys.t.ctx.ready > 1 && sys.t.ctx.hash === main.ctx.S[7])) {
      sys.tick();
      i++;
    }
    return i;
  };
  // One firmware second with no template mounted: main.js streams to outputs nobody is subscribed to.
  sys.evaluate = (n) => {
    for (let i = 0; i < (n || 1); i++) main.ctx.evaluate(main.input, main.output);
  };
  if (o.mount) sys.mount();
  return sys;
}

module.exports = { ROOT, APP, FIXTURES, WIDTH, TILE_HEIGHT, TOPO_EXT, parser, readApp, lang, fixture, extFiles, attribute, substitute, templateSource, sharedBlock, newScreen, mainContext, ext, parse, loadMain, countingContext, loadTemplate, chunkCheck, deliverChunk, feed, rig };
