// ABOUTME: sp-mem scenario (worst slot topo): the full 1,500 B slot topo is opened on the Map from the list, streamed,
// ABOUTME: and stepped through its pitches; nothing else is opened.
var SLOTMAP = {
	plan: '.....' + 'm' + '..............' + 'uuuuuuuuuu' + 'm' + 'm' + '..........'
};
scenario({
	name: 'slotmap',
	ticks: 10,
	setup: function (sp) {
		sp.storage.setItemFromFile('topo0', sp.param('topo0', sp.file('fixtures/slot-1500.stp')));
		this.ticks = SLOTMAP.plan.length + 1;
	},
	onTick: function (sp, t) {
		var c = SLOTMAP.plan.charAt(t - 1);
		if (c === 'u') { sp.press('up', 'onLongPressStart'); }
		else if (c === 'm') { sp.press('next', 'onLongPressStart'); }
	}
});
