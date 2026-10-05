// ABOUTME: sp-mem scenario feeding BLE notifications: text lines from a recording on characteristic 1, short binary packets on characteristic 2.
// ABOUTME: Params: rate (lines per tick, default 10 = 10 Hz), type (array|uint8array|buffer), file (recording, default the synthetic LK8EX1 one).

/* Reused packet buffer: a literal inside onTick would add one harness allocation per tick. */
var BLE_LINES_PACKET = [0, 0x01, 0x02, 0x03];

scenario({
	name: 'ble-lines',
	ticks: 60,
	setup: function (sp) {
		var rec = sp.ble.open(sp.file(sp.param('file', 'recordings/lk8ex1-synthetic.txt')));
		sp.ble.setDataType(sp.param('type', 'array'));
		/* One line per notification (UltraBip-style on MTU-127 watches); 127 B cap; loops at the end of the file. */
		sp.ble.feed(1, rec, { lines: true, maxLen: 127, perTick: parseInt(sp.param('rate', '10'), 10), loop: true });
	},
	onTick: function (sp, t) {
		/* A 4-byte packet on characteristic 2 every tick (counts as a 106 NOTIFICATION once enabled). */
		if (sp.bleNotif[2]) {
			BLE_LINES_PACKET[0] = t & 0xff;
			sp.ble.notify(2, BLE_LINES_PACKET);
		}
		/* One disconnect/reconnect cycle on connection 1 halfway through. */
		if (t === 30) { sp.ble.emit(1, 101, null); }
		if (t === 32) { sp.ble.emit(1, 100, null); }
	}
});
