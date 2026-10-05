// ABOUTME: sp-mem scenario (worst steady state): the 1,500 B slot is full, the Fictional Wall (largest built-in) is opened,
// ABOUTME: streamed completely, stepped to pitch 5, Info visited and back on the Map, ending on the Wall's whole-topo card.
var WORST = {
	// List with a full slot: slot, demo, Jagerhorn, Piccolo, Wall, Help, Help. 4 x up, middle opens the Wall (Map).
	plan: '..........' + 'uuuu' + 'm' + '..............................' + 'uuuuu' + 'm' + '...' + 'm' + 'mm' + 'm' + '..........'
};
scenario({
	name: 'worst',
	ticks: 10,
	setup: function (sp) {
		sp.storage.setItemFromFile('topo0', sp.param('topo0', sp.file('fixtures/slot-1500.stp')));
		sp.storage.setItem('lapAdv', '1');
		this.ticks = WORST.plan.length + 1;
	},
	onTick: function (sp, t) {
		var c = WORST.plan.charAt(t - 1);
		if (c === 'u') { sp.press('up', 'onLongPressStart'); }
		else if (c === 'd') { sp.press('down', 'onLongPressStart'); }
		else if (c === 'm') { sp.press('next', 'onLongPressStart'); }
	}
});
