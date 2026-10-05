// ABOUTME: sp-mem scenario (long session, 30 min at 1 tick/s): slot walk.stp, the Fictional Wall opened and climbed with a hold
// ABOUTME: every 45 s, a lap every 3 min (lap advance On), Info and the list, a pause, overlays every 7 min, a reload at 20 min.
scenario({
	name: 'longsession',
	ticks: 1800,
	setup: function (sp) {
		sp.storage.setItemFromFile('topo0', sp.param('topo0', sp.file('fixtures/walk.stp')));
		sp.storage.setItem('lapAdv', '1');
		this.ticks = Number(sp.param('ticks', 1800));
	},
	onTick: function (sp, t) {
		if (t === 5) { sp.press('up', 'onLongPressStart'); }
		else if (t >= 6 && t <= 9) { sp.press('up', 'onLongPressStart'); }
		else if (t === 10) { sp.press('next', 'onLongPressStart'); }
		else if (t > 60 && t % 45 === 0) {
			if (t % 450 === 0) { sp.press('next', 'onLongPressStart'); }
			else if (t % 450 === 45) { sp.press('next', 'onLongPressStart'); }
			else { sp.press(t % 270 === 0 ? 'down' : 'up', 'onLongPressStart'); }
		}
		if (t > 60 && t % 180 === 7) { sp.lap(); }
		if (t === 900) { SP.queueMain(256, 0); }
		if (t === 960) { SP.queueMain(512, 0); }
		if (t > 60 && t % 420 === 13 && D.view !== null) { D.callSlot(D.view.onDeactivate); D.callSlot(D.view.onActivate); D.flushSubInit(); }
		if (t === 1200) { SP.unloadRequested = true; }
	}
});
