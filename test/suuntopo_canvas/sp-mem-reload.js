// ABOUTME: sp-mem scenario (template reload with the Wall open): opens the Fictional Wall, streams it, then reloads the
// ABOUTME: template (unload) so main.js restreams from chunk 0, and an overlay re-activation after the stream completes.
scenario({
	name: 'reload',
	ticks: 90,
	setup: function (sp) {
		sp.storage.setItem('topo0', '');
	},
	onTick: function (sp, t) {
		if (t >= 3 && t <= 5) { sp.press('up', 'onLongPressStart'); }
		else if (t === 6) { sp.press('next', 'onLongPressStart'); }
		else if (t === 40) { SP.unloadRequested = true; }
		else if (t === 80 && D.view !== null) { D.callSlot(D.view.onDeactivate); D.callSlot(D.view.onActivate); D.flushSubInit(); }
	}
});
