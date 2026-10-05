// ABOUTME: sp-mem scenario for Suuntopo: fills the settings slot, then opens every topo with long presses, waits for
// ABOUTME: each stream, steps through pitches and the Info pages. Params: topo0 = file path or 'empty' (default fixtures/walk.stp).

var TOUR = {
	// One character per tick: u/d/m = long press up/down/middle, . = wait, l = lap. With the slot filled the list is
	// slot, demo, Jägerhorn, Piccolo Fillar, Fictional Wall, Help, Help: this opens the Fictional Wall (largest built-in),
	// waits for its stream, steps pitches, visits Info pages and the list, and laps. The fixture file's trailing newline
	// reaches the slot; v1.0 rejected it (E6), so its tour never opened the Wall (SPEC §8, round 1).
	plan: '..........' + 'uuuu' + 'm' + '........................' + 'uuuuu' + 'm' + '...' + 'm' + '...' + 'mm' + '...' +
		'd' + 'm' + '..........' + 'uuu' + 'l' + '.....' + 'mmm' + 'uuuuu' + '.....'
};

scenario({
	name: 'climbing-topo-tour',
	ticks: 10,
	setup: function (sp) {
		var v = sp.param('topo0', sp.file('fixtures/walk.stp'));
		if (v === 'empty') {
			sp.storage.setItem('topo0', '');
		} else {
			sp.storage.setItemFromFile('topo0', v);
		}
		sp.storage.setItem('lapAdv', '1');
		this.ticks = TOUR.plan.length + 1;
	},
	onTick: function (sp, t) {
		var c = TOUR.plan.charAt(t - 1);
		if (c === 'u') { sp.press('up', 'onLongPressStart'); }
		else if (c === 'd') { sp.press('down', 'onLongPressStart'); }
		else if (c === 'm') { sp.press('next', 'onLongPressStart'); }
		else if (c === 'l') { sp.lap(); }
	}
});
