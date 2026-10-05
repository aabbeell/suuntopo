// ABOUTME: sp-mem scenario that puts a synthetic SuuntoPo topo of a chosen size into localStorage ('topo0' string setting), then navigates it.
// ABOUTME: Params: points (route points, default 40), anchors (default 8), features (default 30), key (default topo0); the JSON size is printed.

scenario({
	name: 'topo-size',
	ticks: 60,
	setup: function (sp) {
		var nPoints = parseInt(sp.param('points', '40'), 10);
		var nAnchors = parseInt(sp.param('anchors', '8'), 10);
		var nFeatures = parseInt(sp.param('features', '30'), 10);
		var types = ['slab', 'tree', 'cross', 'crack', 'overhang', 'ledge', 'rappel'];
		var topo = { name: 'Synthetic', wall: 'Test wall', grade: 'V', pitches: nAnchors, width: 400, height: 1600,
			anchors: [], route: [], features: [] };
		var i, json;
		for (i = 0; i < nPoints; i++) { topo.route.push([60 + (i * 37) % 280, 1500 - Math.round(i * 1400 / nPoints)]); }
		for (i = 0; i < nAnchors; i++) {
			topo.anchors.push({ x: topo.route[Math.floor(i * (nPoints - 1) / Math.max(1, nAnchors - 1))][0],
				y: topo.route[Math.floor(i * (nPoints - 1) / Math.max(1, nAnchors - 1))][1],
				grade: 'IV+', length: '35m', info: 'Pitch ' + (i + 1) + ' description' });
		}
		for (i = 0; i < nFeatures; i++) {
			topo.features.push({ type: types[i % types.length], x: 40 + (i * 53) % 320, y: 100 + (i * 97) % 1400, w: 20 + i % 40, h: 10 + i % 30 });
		}
		json = JSON.stringify(topo);
		SPH.print('topo-size: ' + json.length + ' bytes JSON (' + nPoints + ' points, ' + nAnchors + ' anchors, ' + nFeatures + ' features)');
		/* Stored in C memory: the app's getItem() allocates its own copy, as on the watch. */
		sp.storage.setItem(sp.param('key', 'topo0'), json);
	},
	onTick: function (sp, t) {
		if (t === 2) { sp.press('down'); }
		if (t === 3) { sp.press('next'); }
		if (t > 3 && t < 12) { sp.press('up'); }
		if (t === 14) { sp.press('up', 'onLongPressStart'); }
		if (t === 20) { sp.press('next'); }
		if (t === 25) { sp.press('next'); }
	}
});
