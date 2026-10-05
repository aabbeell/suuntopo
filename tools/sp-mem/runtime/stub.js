// ABOUTME: SuuntoPlus runtime stub for the sp-mem Duktape harness: the globals an app sees on the watch ($, setText, localStorage, appConn, canvas ctx...).
// ABOUTME: Loaded before the baseline checkpoint; all bookkeeping slots are preallocated so the hot paths allocate nothing in the JS heap.

/* Shared state between the stub, the scenario and the driver. */
var SP = (function () {
	var MAX_SUBS = 64, MAX_SLOTS = 96, MAX_BLE = 128, MAX_TIMERS = 32, MAX_FEEDS = 8, MAX_MAIN = 64, MAX_CANVAS = 8;
	var i;
	var sp = {
		t: 0,
		ticks: 60,
		scenario: null,
		/* main.js event queue: [eventId, arg] pairs (ring) */
		mainEv: new Array(MAX_MAIN), mainArg: new Array(MAX_MAIN), mainHead: 0, mainTail: 0, MAX_MAIN: MAX_MAIN,
		/* subscriptions */
		subCb: new Array(MAX_SUBS), subOut: new Array(MAX_SUBS), subRes: new Array(MAX_SUBS), subInit: new Array(MAX_SUBS), MAX_SUBS: MAX_SUBS,
		/* template handler slots filled by generated view files through __v() */
		slotFn: new Array(MAX_SLOTS), MAX_SLOTS: MAX_SLOTS,
		/* canvases of the mounted view */
		cvDirty: new Array(MAX_CANVAS), ctx: new Array(MAX_CANVAS), MAX_CANVAS: MAX_CANVAS,
		/* timers */
		tmFn: new Array(MAX_TIMERS), tmDue: new Array(MAX_TIMERS), MAX_TIMERS: MAX_TIMERS,
		/* BLE */
		/* connections are numbered 1..3; each has its own event handler (MultiSensor-style apps open two) */
		bleHandlers: new Array(4), nConn: 0,
		bleCharConn: new Array(32),  /* characteristic id (0..31) -> connection id, set by regUuid */
		bleConn: new Array(MAX_BLE), bleCh: new Array(MAX_BLE), bleEv: new Array(MAX_BLE), bleData: new Array(MAX_BLE), bleHead: 0, bleTail: 0, MAX_BLE: MAX_BLE,
		feedCh: new Array(MAX_FEEDS), feedRec: new Array(MAX_FEEDS), feedMax: new Array(MAX_FEEDS), feedLine: new Array(MAX_FEEDS),
		feedPerTick: new Array(MAX_FEEDS), feedLoop: new Array(MAX_FEEDS), nFeeds: 0,
		bleType: 0,          /* 0 Array, 1 Uint8Array, 2 plain buffer (the watch's type is unverified) */
		bleAutoConnect: true,
		bleReadCh: new Array(16), bleReadData: new Array(16), nBleRead: 0,
		bleNotif: new Array(32),  /* notifications enabled per characteristic id (0..31) */
		/* resources for $.get / $.subscribe outside Zapp outputs */
		resPath: new Array(32), resFn: new Array(32), resPerTick: new Array(32), nRes: 0,
		/* input providers by manifest "in" name (resolved to indexes by the driver) */
		inName: new Array(16), inFn: new Array(16), nIn: 0,
		/* set by the driver */
		outNames: null,
		unloadRequested: false,
		counters: { setText: 0, setStyle: 0, playIndication: 0, systemEvent: 0, put: 0, unknownPut: 0, writeChar: 0, bleEvents: 0, mainEvents: 0 }
	};
	for (i = 0; i < MAX_MAIN; i++) { sp.mainEv[i] = 0; sp.mainArg[i] = 0; }
	for (i = 0; i < MAX_SUBS; i++) { sp.subCb[i] = null; sp.subOut[i] = -1; sp.subRes[i] = null; sp.subInit[i] = false; }
	for (i = 0; i < MAX_SLOTS; i++) { sp.slotFn[i] = null; }
	for (i = 0; i < MAX_CANVAS; i++) { sp.cvDirty[i] = false; sp.ctx[i] = null; }
	for (i = 0; i < MAX_TIMERS; i++) { sp.tmFn[i] = null; sp.tmDue[i] = 0; }
	for (i = 0; i < MAX_BLE; i++) { sp.bleConn[i] = 0; sp.bleCh[i] = 0; sp.bleEv[i] = 0; sp.bleData[i] = null; }
	for (i = 0; i < 4; i++) { sp.bleHandlers[i] = null; }
	for (i = 0; i < MAX_FEEDS; i++) { sp.feedCh[i] = 0; sp.feedRec[i] = -1; sp.feedMax[i] = 20; sp.feedLine[i] = 0; sp.feedPerTick[i] = 1; sp.feedLoop[i] = false; }
	for (i = 0; i < 32; i++) { sp.bleNotif[i] = false; sp.bleCharConn[i] = 0; }
	for (i = 0; i < 16; i++) { sp.bleReadCh[i] = 0; sp.bleReadData[i] = null; sp.inName[i] = null; sp.inFn[i] = null; }
	for (i = 0; i < 32; i++) { sp.resPath[i] = null; sp.resFn[i] = null; sp.resPerTick[i] = 1; }
	return sp;
})();

/* ---------------- main.js event queue ---------------- */

SP.queueMain = function (eventId, arg) {
	var next = (SP.mainTail + 1) % SP.MAX_MAIN;
	if (next === SP.mainHead) { SPH.warn('main event queue full'); return; }
	SP.mainEv[SP.mainTail] = eventId;
	SP.mainArg[SP.mainTail] = arg;
	SP.mainTail = next;
};

/* ---------------- $ resource API ---------------- */

var $ = {
	get: function (path, cb) {
		var idx = SP.outputIndex(path), r;
		if (typeof cb !== 'function') { return; }
		if (idx >= 0) { cb(SP.outputValue(idx)); return; }
		r = SP.findResource(path);
		if (r >= 0) { cb(SP.resourceValue(r, 0)); }
	},
	put: function (path, value, cb, type) {
		SP.counters.put++;
		if (path === '/Zapp/0/Event' || path === 'Zapp/0/Event') {
			SP.queueMain(16384, value);
		} else if (path === '/Activity/Trigger' || path === 'Activity/Trigger') {
			SP.queueMain(4, 0);
		} else {
			SP.counters.unknownPut++;
		}
		if (typeof cb === 'function') { cb(); }
	},
	subscribe: function (path, cb) {
		var s;
		for (s = 0; s < SP.MAX_SUBS; s++) {
			if (SP.subCb[s] === null) { break; }
		}
		if (s === SP.MAX_SUBS) { SPH.warn('too many subscriptions'); return 0; }
		SP.subCb[s] = cb;
		SP.subOut[s] = SP.outputIndex(path);
		SP.subRes[s] = SP.subOut[s] >= 0 ? null : path;
		SP.subInit[s] = true; /* assumption: a new subscription gets the current value once */
		return s + 1;
	},
	unsubscribe: function (token) {
		var s = token - 1;
		if (s >= 0 && s < SP.MAX_SUBS) { SP.subCb[s] = null; SP.subOut[s] = -1; SP.subRes[s] = null; SP.subInit[s] = false; }
	}
};

/* Output resource path -> output index, or -1. Accepts 'Zapp/0/Output/x' with or without leading '/'. */
SP.outputIndex = function (path) {
	var k, z, name;
	if (SP.outNames === null || typeof path !== 'string') { return -1; }
	k = path.indexOf('/Output/');
	z = path.indexOf('Zapp/');
	if (k < 0 || z < 0 || z > 1) { return -1; }
	name = path.substring(k + 8);
	return SP.outNames.indexOf(name);
};

SP.findResource = function (path) {
	var r;
	for (r = 0; r < SP.nRes; r++) {
		if (SP.resPath[r] === path) { return r; }
	}
	return -1;
};

SP.resourceValue = function (r, k) {
	var f = SP.resFn[r];
	return (typeof f === 'function') ? f(SP.t, k) : f;
};

/* ---------------- UI natives ---------------- */

var setText = function (sel, text) { SP.counters.setText++; };
var setStyle = function (sel, prop, value) { SP.counters.setStyle++; };
var getStyle = function (sel, prop) { return '#FFFFFF'; };
var setVis = function (sel, visible) { SP.counters.setStyle++; };
var control = function (target, command) {
	var c;
	if (command !== 'REFRESH') { return; }
	c = SP.canvasIndex(target);
	if (c >= 0) { SP.cvDirty[c] = true; }
};
var unload = function (view) { SP.unloadRequested = true; };
var open = function (view) { };
var close = function (view) { };
var next = function (target) { };
var previous = function (target) { };
var first = function (target) { };
var last = function (target) { };
var select = function (target) { };
var navigate = function (target, index, immediate, relative) { };
var gaugeControl = function () { };
var playIndication = function (name, btn, prio, stop) { SP.counters.playIndication++; };
var systemEvent = function () { SP.counters.systemEvent++; };
var trace = function () { };
var analSE = function () { };
var translate = function (s) { return s; };
var formatValue = function (v, fmt) { return String(v); };
var sportAppActivityEvent = function (id) { };
var enabledZappId = 1;

/* evalFile('{file_path}/extN.js'): compiled from C memory, value returned like on the watch. */
var evalFile = function (path) {
	return SPH.load(path.replace('{file_path}', JOB.appDir), 2);
};

/* setTimeout in template scripts: fires at the next tick boundary (ticks are 1 s). */
var setTimeout = function (fn, ms) {
	var k, due = SP.t + Math.max(1, Math.ceil((ms || 0) / 1000));
	for (k = 0; k < SP.MAX_TIMERS; k++) {
		if (SP.tmFn[k] === null) { SP.tmFn[k] = fn; SP.tmDue[k] = due; return k + 1; }
	}
	SPH.warn('too many timers');
	return 0;
};
var clearTimeout = function (id) {
	if (id > 0 && id <= SP.MAX_TIMERS) { SP.tmFn[id - 1] = null; }
};

/* ---------------- localStorage (values live in C memory, like data.jsn on the watch) ---------------- */

var localStorage = {
	getItem: function (key) {
		return SPH.lsKind(key) === 1 ? SPH.lsGet(key) : null;
	},
	setItem: function (key, value) {
		SPH.lsSet(key, String(value), 1);
	},
	getObject: function (key) {
		return SPH.lsKind(key) === 2 ? JSON.parse(SPH.lsGet(key)) : null;
	},
	setObject: function (key, value) {
		SPH.lsSet(key, JSON.stringify(value), 2);
	},
	removeItem: function (key) {
		SPH.lsSet(key, '', 0);
	}
};

/* ---------------- appConn (BLE) ---------------- */

SP.queueBle = function (conn, ch, ev, data) {
	var next = (SP.bleTail + 1) % SP.MAX_BLE;
	if (next === SP.bleHead) { SPH.warn('BLE event queue full'); return; }
	SP.bleConn[SP.bleTail] = conn;
	SP.bleCh[SP.bleTail] = ch;
	SP.bleEv[SP.bleTail] = ev;
	SP.bleData[SP.bleTail] = data;
	SP.bleTail = next;
};

/* Connection id of a characteristic (from regUuid), or the first connection. */
SP.connOf = function (charId) {
	var c = SP.bleCharConn[charId & 31];
	return c > 0 ? c : (SP.nConn > 0 ? 1 : 0);
};

var appConn = {
	connect: function (zappId, handler, search1, search2) {
		var c;
		if (SP.nConn >= 3) { SPH.warn('appConn.connect: more than 3 connections'); return 0; }
		c = ++SP.nConn;
		SP.bleHandlers[c] = handler;
		SP.queueBle(c, 0, 111, null);
		if (SP.bleAutoConnect) { SP.queueBle(c, 0, 100, null); }
		return c;
	},
	regUuid: function (connId, charId, serviceUuid, charUuid) {
		SP.bleCharConn[charId & 31] = connId;
		SP.queueBle(connId, charId, 107, null);
	},
	enaCharNotf: function (connId, charId) {
		SP.bleNotif[charId & 31] = true;
		SP.queueBle(connId, charId, 109, null);
	},
	readChar: function (connId, charId) {
		var k;
		for (k = 0; k < SP.nBleRead; k++) {
			if (SP.bleReadCh[k] === charId) { SP.queueBle(connId, charId, 102, SPH.bytes(SP.bleReadData[k], SP.bleType)); return; }
		}
		SP.queueBle(connId, charId, 103, null);
	},
	writeChar: function (connId, charId, data) {
		SP.counters.writeChar++;
		SP.queueBle(connId, charId, 104, null);
	}
};

/* ---------------- canvas context mock (counts draw calls in C, per frame) ---------------- */

/* Methods are native functions (op code as magic) so each draw call is one native call, as on the watch. */
SP.CtxProto = {};
(function () {
	var names = ['', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'stroke', 'fill', 'fillRect', 'fillText', 'measureText',
		'arc', 'arcTo', 'rect', 'strokeRect', 'clearRect', 'rotate', 'translate', 'scale', 'setTransform', 'save', 'restore'];
	var op;
	for (op = 1; op < names.length; op++) { SP.CtxProto[names[op]] = SPH.cvMethod(op); }
})();


SP.resetCtx = function (ctx, w, h) {
	ctx.width = w;
	ctx.height = h;
	ctx.lineWidth = 1;
	ctx.strokeStyle = '#FFFFFF';
	ctx.fillStyle = '#FFFFFF';
	ctx.lineCap = 'butt';
	ctx.lineJoin = 'miter';
	ctx.font = '';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	ctx.globalAlpha = 1;
};

(function () {
	var c;
	for (c = 0; c < SP.MAX_CANVAS; c++) {
		SP.ctx[c] = Object.create(SP.CtxProto);
		SP.resetCtx(SP.ctx[c], 0, 0);
	}
})();

/* ---------------- template handler registration (called by generated view files) ---------------- */

var __v = function (slot, fn) {
	if (slot >= 0 && slot < SP.MAX_SLOTS) { SP.slotFn[slot] = fn; }
};

/* ---------------- scenario API ---------------- */

var scenario = function (def) { SP.scenario = def; };

SP.storage = {
	setItem: function (key, value) { SPH.lsSet(key, String(value), 1); },
	setObject: function (key, value) { SPH.lsSet(key, JSON.stringify(value), 2); },
	/* Load a file's text as a string item without keeping it in the JS heap. */
	setItemFromFile: function (key, path) { SPH.lsSet(key, SPH.readText(path), 1); },
	setObjectFromFile: function (key, path) { SPH.lsSet(key, JSON.stringify(JSON.parse(SPH.readText(path))), 2); }
};

SP.ble = {
	/* dataType: 'array' (default), 'uint8array' or 'buffer' */
	setDataType: function (name) { SP.bleType = name === 'uint8array' ? 1 : (name === 'buffer' ? 2 : 0); },
	setAutoConnect: function (on) { SP.bleAutoConnect = !!on; },
	open: function (path) { return SPH.recOpen(path); },
	/* Feed a recording to a characteristic as 106 notifications: opts.maxLen bytes each (default 20),
	 * opts.lines = one text line per notification, opts.perTick notifications per tick, opts.loop = rewind at end. */
	feed: function (charId, handle, opts) {
		var f = SP.nFeeds++;
		opts = opts || {};
		SP.feedCh[f] = charId;
		SP.feedRec[f] = handle;
		SP.feedMax[f] = opts.maxLen || 20;
		SP.feedLine[f] = opts.lines ? 1 : 0;
		SP.feedPerTick[f] = opts.perTick || 1;
		SP.feedLoop[f] = !!opts.loop;
	},
	notify: function (charId, bytes) { SP.queueBle(SP.connOf(charId), charId, 106, SPH.bytes(bytes, SP.bleType)); },
	/* Any event (e.g. 101 DISCONNECTED) on a characteristic's connection; connId overrides the routing. */
	emit: function (charId, eventId, bytes, connId) {
		SP.queueBle(connId || SP.connOf(charId), charId, eventId, bytes ? SPH.bytes(bytes, SP.bleType) : null);
	},
	readResponse: function (charId, bytes) { SP.bleReadCh[SP.nBleRead] = charId; SP.bleReadData[SP.nBleRead] = bytes; SP.nBleRead++; }
};

/* Path relative to the scenario file's directory (absolute paths pass through). */
SP.file = function (rel) { return rel.charAt(0) === '/' ? rel : JOB.scenarioDir + '/' + rel; };
SP.param = function (key, fallback) { return (JOB.params && JOB.params[key] !== undefined) ? JOB.params[key] : fallback; };
SP.input = function (name, valueOrFn) { SP.inName[SP.nIn] = name; SP.inFn[SP.nIn] = valueOrFn; SP.nIn++; };
SP.resource = function (path, valueOrFn, perTick) { SP.resPath[SP.nRes] = path; SP.resFn[SP.nRes] = valueOrFn; SP.resPerTick[SP.nRes] = perTick || 1; SP.nRes++; };
SP.event = function (eventId) { SP.queueMain(16384, eventId); };
SP.lap = function () { SP.queueMain(4, 0); };
SP.checkpoint = function (label) { SPH.checkpoint(label); };
