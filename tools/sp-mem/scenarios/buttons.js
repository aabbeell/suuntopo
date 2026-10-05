// ABOUTME: sp-mem scenario that presses the watch buttons during the run (exercises onEvent and template button handlers).
// ABOUTME: Up is clicked every 2nd tick, down every 3rd, up long-press every 10th; 60 ticks.

scenario({
	name: 'buttons',
	ticks: 60,
	onTick: function (sp, t) {
		if (t % 2 === 0) { sp.press('up'); }
		if (t % 3 === 0) { sp.press('down'); }
		if (t % 10 === 0) { sp.press('up', 'onLongPressStart'); }
		if (t % 7 === 0) { sp.press('next'); }
	}
});
