// ABOUTME: Default sp-mem scenario: load, getUserInterface and 60 evaluate ticks with no extra input.
// ABOUTME: Copy this file to write your own; setup runs before the baseline checkpoint, onTick before each evaluate.

scenario({
	name: 'default',
	ticks: 60,
	setup: function (sp) {
		/* Examples (all optional):
		 *   sp.storage.setItemFromFile('topo0', '/path/to/topo.json');  // settings string, kept in C memory
		 *   sp.input('hr', function (t) { return 120 + t % 10; });       // manifest "in" value per tick
		 *   sp.resource('/Dev/Time/Tick10hz', function (t, k) { return t * 10 + k; }, 10);
		 *   sp.ble.setDataType('uint8array');                            // type of BLE 'data' (unverified on watch)
		 */
	},
	onTick: function (sp, t) {
		/* Examples: sp.press('up'); sp.press('down', 'onLongPressStart'); sp.lap(); sp.ble.notify(1, [0x24, 0x4c]); */
	}
});
