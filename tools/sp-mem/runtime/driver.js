// ABOUTME: Lifecycle driver for the sp-mem harness: loads the app (shipped dispatcher or source globals), mounts templates, runs ticks.
// ABOUTME: Calls main.js like the firmware does (onLoad, onExerciseStart, getUserInterface, evaluate ticks, events) and takes SPH checkpoints.

var D = {
	G: (function () { return this; })(),
	appLoaded: false,
	dispatch: null,   /* shipped form: the function(_e,_,_d) returned by main.js */
	io: null,         /* shipped form: the '_' array (inputs then outputs) */
	inObj: null,      /* source form: input object */
	outObj: null,     /* source form: output object */
	last: null,       /* last notified output values */
	inFn: null,       /* input providers by input index */
	view: null,
	ticks: 0
};

D.eventName = function (ev) {
	switch (ev) {
	case 1: return 'evaluate';
	case 2: return 'onLoad';
	case 4: return 'onLap';
	case 8: return 'onAutoLap';
	case 16: return 'onInterval';
	case 32: return 'onPoolLength';
	case 128: return 'onExerciseStart';
	case 256: return 'onExercisePause';
	case 512: return 'onExerciseContinue';
	case 1024: return 'onExerciseEnd';
	case 2048: return 'onActivityChange';
	case 4096: return 'getUserInterface';
	case 8192: return 'getSummaryOutputs';
	case 16384: return 'onEvent';
	case 32768: return 'onAccelerometer';
	case 65536: return 'getLapInfo';
	default: return 'event';
	}
};

D.outputValue = function (i) {
	return D.io !== null ? D.io[JOB.nIn + i] : D.outObj[JOB.outNames[i]];
};
SP.outputValue = D.outputValue;

D.fillInputs = function () {
	var i, f, v;
	for (i = 0; i < JOB.nIn; i++) {
		f = D.inFn[i];
		v = (typeof f === 'function') ? f(SP.t) : (f === null ? 0 : f);
		if (D.io !== null) { D.io[i] = v; } else { D.inObj[JOB.inNames[i]] = v; }
	}
};

D.callMain = function (ev, arg) {
	var r, fn;
	if (!D.appLoaded || (JOB.eventMask & ev) === 0) { return undefined; }
	D.fillInputs();
	try {
		if (D.dispatch !== null) {
			r = D.dispatch(ev, D.io, arg);
		} else {
			fn = D.G[D.eventName(ev)];
			if (typeof fn === 'function') { r = fn(D.inObj, D.outObj, arg); }
		}
	} catch (e) {
		SPH.error(D.eventName(ev) + ': ' + e);
	}
	D.notifyOutputs();
	return r;
};

D.callSub = function (s, v) {
	try { SP.subCb[s](v); } catch (e) { SPH.error('subscription callback: ' + e); }
};

D.callSlot = function (slot, a, b) {
	var fn;
	if (slot < 0) { return undefined; }
	fn = SP.slotFn[slot];
	if (fn === null) { return undefined; }
	try { return fn(a, b); } catch (e) { SPH.error('template script: ' + e); }
	return undefined;
};

/* After a main.js callback: changed outputs go to template subscriptions and <eval> scripts. */
D.notifyOutputs = function () {
	var i, v, s, k, ev;
	for (i = 0; i < JOB.nOut; i++) {
		v = D.outputValue(i);
		if (v === D.last[i] || (v !== v && D.last[i] !== D.last[i])) { continue; }
		D.last[i] = v;
		for (s = 0; s < SP.MAX_SUBS; s++) {
			if (SP.subCb[s] !== null && SP.subOut[s] === i && !SP.subInit[s]) { D.callSub(s, v); }
		}
		if (D.view !== null) {
			for (k = 0; k < D.view.evals.length; k++) {
				ev = D.view.evals[k];
				if (ev.out === i) {
					D.callSlot(ev.format, v);
					D.callSlot(ev.changed, v);
				}
			}
		}
	}
};

/* New subscriptions receive the current value once (assumption about the firmware). */
D.flushSubInit = function () {
	var s, r, v;
	for (s = 0; s < SP.MAX_SUBS; s++) {
		if (SP.subCb[s] === null || !SP.subInit[s]) { continue; }
		SP.subInit[s] = false;
		if (SP.subOut[s] >= 0) {
			v = D.outputValue(SP.subOut[s]);
			if (v !== undefined) { D.callSub(s, v); }
		} else {
			r = SP.findResource(SP.subRes[s]);
			if (r >= 0) { D.callSub(s, SP.resourceValue(r, 0)); }
		}
	}
};

D.deliverResources = function () {
	var s, r, k;
	for (s = 0; s < SP.MAX_SUBS; s++) {
		if (SP.subCb[s] === null || SP.subRes[s] === null) { continue; }
		r = SP.findResource(SP.subRes[s]);
		if (r < 0) { continue; }
		for (k = 0; k < SP.resPerTick[r] && SP.subCb[s] !== null; k++) { D.callSub(s, SP.resourceValue(r, k)); }
	}
};

D.deliverMain = function () {
	var end = SP.mainTail, ev, arg;
	while (SP.mainHead !== end) {
		ev = SP.mainEv[SP.mainHead];
		arg = SP.mainArg[SP.mainHead];
		SP.mainHead = (SP.mainHead + 1) % SP.MAX_MAIN;
		SP.counters.mainEvents++;
		D.callMain(ev, arg);
	}
};

D.deliverBle = function () {
	var f, n, data, end, k, conn, ch, ev, h;
	for (f = 0; f < SP.nFeeds; f++) {
		if (SP.nConn === 0 || !SP.bleNotif[SP.feedCh[f] & 31]) { continue; }
		for (n = 0; n < SP.feedPerTick[f]; n++) {
			data = SPH.recNext(SP.feedRec[f], SP.feedMax[f], SP.feedLine[f], SP.bleType);
			if (data === undefined && SP.feedLoop[f]) {
				SPH.recRewind(SP.feedRec[f]);
				data = SPH.recNext(SP.feedRec[f], SP.feedMax[f], SP.feedLine[f], SP.bleType);
			}
			if (data === undefined) { break; }
			SP.queueBle(SP.connOf(SP.feedCh[f]), SP.feedCh[f], 106, data);
		}
	}
	data = null;
	/* Only events queued before this point: chains (connect -> 100 -> regUuid -> 107 ...) advance one step per tick. */
	end = SP.bleTail;
	while (SP.bleHead !== end) {
		k = SP.bleHead;
		conn = SP.bleConn[k];
		ch = SP.bleCh[k];
		ev = SP.bleEv[k];
		data = SP.bleData[k];
		SP.bleData[k] = null;
		SP.bleHead = (k + 1) % SP.MAX_BLE;
		h = (conn > 0 && conn < 4) ? SP.bleHandlers[conn] : null;
		if (h !== null) {
			SP.counters.bleEvents++;
			try { h(ch, ev, data); } catch (e) { SPH.error('BLE handler event ' + ev + ': ' + e); }
		}
		data = null;
		h = null;
	}
};

D.fireTimers = function () {
	var k, fn;
	for (k = 0; k < SP.MAX_TIMERS; k++) {
		if (SP.tmFn[k] !== null && SP.tmDue[k] <= SP.t) {
			fn = SP.tmFn[k];
			SP.tmFn[k] = null;
			try { fn(); } catch (e) { SPH.error('timer: ' + e); }
		}
	}
	fn = null;
};

SP.canvasIndex = function (target) {
	var c, cv;
	if (D.view === null) { return -1; }
	for (c = 0; c < D.view.canvases.length; c++) {
		cv = D.view.canvases[c];
		if (cv.id === target || cv.name === target) { return c; }
	}
	return -1;
};

D.drawDirty = function () {
	var c, cv, ctx;
	if (D.view === null) { return; }
	for (c = 0; c < D.view.canvases.length && c < SP.MAX_CANVAS; c++) {
		if (!SP.cvDirty[c]) { continue; }
		SP.cvDirty[c] = false;
		cv = D.view.canvases[c];
		ctx = SP.ctx[c];
		SP.resetCtx(ctx, cv.w, cv.h);
		SPH.cvBegin(c, SP.t);
		D.callSlot(cv.slot, ctx);
		SPH.cvEnd();
	}
};

D.unmount = function () {
	var s, k;
	if (D.view === null) { return; }
	D.callSlot(D.view.onDeactivate);
	for (s = 0; s < SP.MAX_SUBS; s++) { SP.subCb[s] = null; SP.subOut[s] = -1; SP.subRes[s] = null; SP.subInit[s] = false; }
	for (k = 0; k < SP.MAX_SLOTS; k++) { SP.slotFn[k] = null; }
	for (k = 0; k < SP.MAX_TIMERS; k++) { SP.tmFn[k] = null; }
	for (k = 0; k < SP.MAX_CANVAS; k++) { SP.cvDirty[k] = false; }
	D.view = null;
};

D.mount = function (name) {
	var meta, f, c;
	D.unmount();
	meta = JOB.views[name];
	if (meta === undefined) {
		SPH.error('getUserInterface returned unknown template: ' + name);
		return;
	}
	D.view = meta;
	try {
		f = SPH.load(meta.path, 1);
		f();
	} catch (e) {
		SPH.error('template ' + name + ' load: ' + e);
	}
	f = null;
	D.callSlot(meta.onActivate);
	D.flushSubInit();
	for (c = 0; c < meta.canvases.length && c < SP.MAX_CANVAS; c++) { SP.cvDirty[c] = true; }
	D.drawDirty();
};

/* getUserInterface -> template name -> mount. */
D.remount = function () {
	var r = D.callMain(4096, undefined), name;
	SP.unloadRequested = false;
	if (r === undefined || r === null || typeof r.template !== 'string') {
		SPH.error('getUserInterface did not return {template: ...}');
		return;
	}
	name = r.template;
	r = null;
	if (name.indexOf('{zapp_disp}') >= 0) { name = name.replace('{zapp_disp}', JOB.display); }
	D.mount(name);
};

SP.press = function (button, event) {
	var b, bt;
	event = event || 'onClick';
	if (D.view === null) { return; }
	for (b = 0; b < D.view.buttons.length; b++) {
		bt = D.view.buttons[b];
		if (bt.name === button && bt.event === event) { D.callSlot(bt.slot, button, 0); }
	}
};

/* Run any other template handler by tag and event name (e.g. uiViewSet onSelectionChanged). */
SP.trigger = function (tag, event, target, targetData) {
	var k, h;
	if (D.view === null) { return; }
	for (k = 0; k < D.view.others.length; k++) {
		h = D.view.others[k];
		if (h.tag === tag && h.event === event) { D.callSlot(h.slot, target, targetData); }
	}
};

D.tick = function (t) {
	SP.t = t;
	SPH.tickBegin(t);
	if (t > 0 && SP.scenario !== null && typeof SP.scenario.onTick === 'function') {
		try { SP.scenario.onTick(SP, t); } catch (e) { SPH.error('scenario onTick: ' + e); }
	}
	D.deliverBle();
	D.deliverMain();
	D.callMain(1, undefined);
	D.flushSubInit();
	D.deliverResources();
	D.fireTimers();
	if (SP.unloadRequested) { D.remount(); }
	D.drawDirty();
	SPH.tickEnd(t);
};

D.seedStorage = function () {
	var data, k, v;
	if (!JOB.dataPath) { return; }
	data = JSON.parse(SPH.readText(JOB.dataPath));
	for (k in data) {
		v = data[k];
		if (v !== null && typeof v === 'object') { SPH.lsSet(k, JSON.stringify(v), 2); } else { SPH.lsSet(k, String(v), 1); }
	}
};

D.resolveInputs = function () {
	var i, k;
	D.inFn = new Array(JOB.nIn);
	for (i = 0; i < JOB.nIn; i++) {
		D.inFn[i] = null;
		for (k = 0; k < SP.nIn; k++) {
			if (SP.inName[k] === JOB.inNames[i]) { D.inFn[i] = SP.inFn[k]; }
		}
	}
	D.last = new Array(JOB.nOut);
	for (i = 0; i < JOB.nOut; i++) { D.last[i] = undefined; }
};

D.loadApp = function () {
	var body, i;
	if (JOB.form === 'shipped') {
		D.io = new Array(JOB.nIn + JOB.nOut);
		for (i = 0; i < JOB.nIn + JOB.nOut; i++) { D.io[i] = (i < JOB.nIn) ? 0 : undefined; }
		body = SPH.load(JOB.mainPath, 1);
		D.dispatch = body();
		body = null;
	} else {
		D.inObj = {};
		D.outObj = {};
		for (i = 0; i < JOB.nIn; i++) { D.inObj[JOB.inNames[i]] = 0; }
		SPH.load(JOB.mainPath, 0);
	}
	D.appLoaded = true;
};

D.run = function () {
	var t, n, mid;
	SP.outNames = JOB.outNames;
	D.seedStorage();
	if (SP.scenario !== null && typeof SP.scenario.setup === 'function') { SP.scenario.setup(SP); }
	n = JOB.ticks > 0 ? JOB.ticks : ((SP.scenario !== null && SP.scenario.ticks) || 60);
	D.ticks = n;
	D.resolveInputs();
	/* Dry ticks: the driver's own per-tick allocations, measured with no app loaded. */
	for (t = 1 - JOB.dryTicks; t <= 0; t++) { D.tick(t); }
	SP.t = 0;

	SPH.checkpoint('baseline');
	if (JOB.appLimit > 0) { SPH.setLimit(SPH.live() + JOB.appLimit); }
	try {
		D.loadApp();
	} catch (e) {
		SPH.error('main.js load: ' + e);
	}
	SPH.checkpoint('main.js loaded');
	D.callMain(2, undefined);
	SPH.checkpoint('onLoad');
	D.callMain(128, undefined);
	SPH.checkpoint('onExerciseStart');
	D.remount();
	SPH.checkpoint('UI mounted');
	/* Checkpoints sit outside the loops: a loop's label catcher would otherwise be counted as live. */
	mid = n >= 20 ? 10 : 1;
	D.tick(1);
	SPH.checkpoint('tick 1');
	for (t = 2; t <= mid; t++) { D.tick(t); }
	if (mid === 10) { SPH.checkpoint('tick 10'); }
	for (t = mid + 1; t <= n; t++) { D.tick(t); }
	SPH.checkpoint('steady state');
	D.callMain(1024, undefined);
	D.callMain(8192, undefined);
	D.unmount();
	SPH.checkpoint('exercise end');
	D.summary();
};

/* Printed after the last checkpoint, so building these strings does not affect any measurement. */
D.summary = function () {
	var i, s = 'outputs at end:', c = SP.counters;
	for (i = 0; i < JOB.nOut; i++) { s += ' ' + JOB.outNames[i] + '=' + D.outputValue(i); }
	SPH.print(s);
	SPH.print('calls: ' + c.mainEvents + ' queued main events, ' + c.bleEvents + ' BLE events delivered, ' + c.setText + ' setText, ' +
		c.setStyle + ' setStyle, ' + c.put + ' $.put, ' + c.systemEvent + ' systemEvent, ' + c.playIndication + ' playIndication, ' +
		c.writeChar + ' writeChar');
};

D.run();
