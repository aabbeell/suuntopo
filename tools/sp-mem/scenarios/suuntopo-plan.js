// ABOUTME: Button plan for SuuntoPo v0.3 navigation (one press per tick) plus a mirror of main.js onEvent, shared by the sp-mem scenario and Node analysis.
// ABOUTME: ES5 so Duktape can load it (SPH.load) and Node can require it; build(routes) gives a string of action codes, step() advances the expected state.

var SuuntopoPlan = (function () {
	/* Action codes, one per tick. */
	var UP = 117, UP_LONG = 85, DOWN = 100, DOWN_LONG = 68, CROWN = 110, CROWN_LONG = 78, IDLE = 46; /* u U d D n N . */

	/* routes: route point count per selector entry, entry 0 = the template's hardcoded topo. */
	function parseRoutes(text) {
		var parts = String(text).split(','), out = [], i;
		for (i = 0; i < parts.length; i++) { out.push(parseInt(parts[i], 10)); }
		return out;
	}

	function newState() {
		return { mode: 0, sel: 0, topo: 0, wp: 0, zoom: 12 };
	}

	/* Mirror of main.js onEvent (v0.3): eventId 1 up, 2 up long, 3 down, 4 down long, 5 crown, 6 crown long. */
	function onEvent(s, ev, routes) {
		var maxWP = routes[s.topo] || 10;
		var topoCount = routes.length;
		if (ev === 1) {
			if (s.mode === 0) { if (s.sel > 0) { s.sel--; } } else if (s.wp < maxWP - 1) { s.wp++; }
		} else if (ev === 2) {
			if (s.mode === 1 && s.zoom < 30) { s.zoom += 2; }
		} else if (ev === 3) {
			if (s.mode === 0) { if (s.sel < topoCount - 1) { s.sel++; } } else if (s.wp > 0) { s.wp--; }
		} else if (ev === 4) {
			if (s.mode === 1 && s.zoom > 5) { s.zoom -= 2; }
		} else if (ev === 5) {
			if (s.mode === 0) { s.topo = s.sel; s.wp = 0; s.mode = 1; } else if (s.mode === 1) { s.mode = 2; } else { s.mode = 1; }
		} else if (ev === 6) {
			if (s.mode !== 0) { s.mode = 0; }
		}
	}

	function eventOf(code) {
		switch (code) {
		case UP: return 1;
		case UP_LONG: return 2;
		case DOWN: return 3;
		case DOWN_LONG: return 4;
		case CROWN: return 5;
		case CROWN_LONG: return 6;
		default: return 0;
		}
	}

	function step(s, code, routes) {
		var ev = eventOf(code);
		if (ev > 0) { onEvent(s, ev, routes); }
	}

	/* Per entry: walk the selector to it, open the map, every waypoint up, zoom 12 -> 30 -> 4 -> 12,
	 * open the info view, every waypoint back down, return to the selector. Every press changes an
	 * output the template redraws on, so every planned tick draws exactly one frame. */
	function build(routes) {
		var s = newState(), plan = '', i, k;
		var push = function (ch) { plan += ch; step(s, ch.charCodeAt(0), routes); };
		for (i = 0; i < routes.length; i++) {
			while (s.sel < i) { push('d'); }
			push('n');
			for (k = 1; k < routes[i]; k++) { push('u'); }
			while (s.zoom < 30) { push('U'); }
			while (s.zoom > 5) { push('D'); }
			while (s.zoom < 12) { push('U'); }
			push('n');
			for (k = 1; k < routes[i]; k++) { push('d'); }
			push('N');
		}
		return plan;
	}

	return {
		UP: UP, UP_LONG: UP_LONG, DOWN: DOWN, DOWN_LONG: DOWN_LONG, CROWN: CROWN, CROWN_LONG: CROWN_LONG, IDLE: IDLE,
		parseRoutes: parseRoutes, newState: newState, step: step, build: build
	};
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = SuuntopoPlan; }
