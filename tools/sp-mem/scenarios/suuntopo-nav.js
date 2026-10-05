// ABOUTME: sp-mem scenario for SuuntoPo: fills the topo0..topo2 settings from files, then presses through the selector, every waypoint and zoom level, and the info view.
// ABOUTME: Params: topo0..topo2 = file path or 'empty' (omitted = keep data.jsn), routes = route counts per selector entry incl. the hardcoded one (e.g. 7,7,7,7).

SPH.load(JOB.scenarioDir + '/suuntopo-plan.js', 0);

/* Scenario state, allocated before the baseline; onTick only assigns numbers. */
var SPN = { plan: '', routes: null, st: null, outIdx: null, bad: 0, firstBad: 0, checked: 0 };

scenario({
	name: 'suuntopo-nav',
	ticks: 60,
	setup: function (sp) {
		var k, v;
		for (k = 0; k < 3; k++) {
			v = sp.param('topo' + k, null);
			if (v === 'empty') {
				sp.storage.setItem('topo' + k, '');
			} else if (v !== null) {
				/* Read in C and stored in C: the app's getItem allocates its own copy, as on the watch. */
				sp.storage.setItemFromFile('topo' + k, v);
			}
		}
		SPN.routes = SuuntopoPlan.parseRoutes(sp.param('routes', '7'));
		SPN.plan = SuuntopoPlan.build(SPN.routes);
		SPN.st = SuuntopoPlan.newState();
		SPN.outIdx = [JOB.outNames.indexOf('appMode'), JOB.outNames.indexOf('selectorIdx'), JOB.outNames.indexOf('topoIdx'),
			JOB.outNames.indexOf('anchorIdx'), JOB.outNames.indexOf('zoomLvl')];
		/* One tick per planned press, plus one final tick that reports the plan check. */
		this.ticks = SPN.plan.length + 1;
	},
	onTick: function (sp, t) {
		var s = SPN.st, o = SPN.outIdx, c;
		/* Outputs after the previous tick must match the main.js mirror; a mismatch means the app did not
		 * see the expected number of topos or waypoints (e.g. a topo silently failed to parse). */
		if (t > 1) {
			SPN.checked++;
			if (sp.outputValue(o[0]) !== s.mode || sp.outputValue(o[1]) !== s.sel || sp.outputValue(o[2]) !== s.topo ||
				sp.outputValue(o[3]) !== s.wp || sp.outputValue(o[4]) !== s.zoom) {
				SPN.bad++;
				if (SPN.firstBad === 0) { SPN.firstBad = t - 1; }
			}
		}
		if (t <= SPN.plan.length) {
			c = SPN.plan.charCodeAt(t - 1);
			if (c === SuuntopoPlan.UP) { sp.press('up', 'onClick'); }
			else if (c === SuuntopoPlan.UP_LONG) { sp.press('up', 'onLongPressStart'); }
			else if (c === SuuntopoPlan.DOWN) { sp.press('down', 'onClick'); }
			else if (c === SuuntopoPlan.DOWN_LONG) { sp.press('down', 'onLongPressStart'); }
			else if (c === SuuntopoPlan.CROWN) { sp.press('next', 'onClick'); }
			else if (c === SuuntopoPlan.CROWN_LONG) { sp.press('next', 'onLongPressStart'); }
			SuuntopoPlan.step(s, c, SPN.routes);
		} else {
			SPH.print('suuntopo-nav: plan ' + SPN.plan.length + ' presses, routes ' + SPN.routes.join(',') + ', output checks ' +
				SPN.checked + ', mismatches ' + SPN.bad + (SPN.bad ? ' (first after tick ' + SPN.firstBad + ')' : ''));
		}
	}
});
