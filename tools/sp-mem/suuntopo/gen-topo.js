// ABOUTME: Generates synthetic SuuntoPo topos in the v0.3 / topo-editor JSON format, sized to a target compact-JSON byte count.
// ABOUTME: Deterministic per-pitch mix (3 route points, 1 anchor, 8 features cycling all editor types, contours); usage: node gen-topo.js <KB> [out.json].

'use strict';

/* Feature cycle: every type the editor emits, in the shape the editor emits it (EDITOR_SPEC.md). */
const CYCLE = ['tree', 'cross', 'grass', 'crack', 'slab', 'bolt', 'ledge', 'rappel', 'overhang', 'piton',
	'arete', 'chimney', 'corner', 'roof', 'ramp', 'couloir', 'chockstone', 'label'];
const GRADES = ['III', 'IV', 'IV+', 'V', 'V+', 'VI', 'II'];
const INFOS = [
	'Follow the crack to a ledge, belay at two bolts',
	'Traverse left under the roof, then straight up',
	'Slab with thin protection, belay on a tree',
	'Chimney, exit right onto easy ground',
	'Corner system, small cams useful',
	'Easy ramp to the big ledge'
];
const LABELS = ['Pillar', 'Gully', 'Big ledge', 'Rap'];

const MIX = {
	routePointsPerPitch: 3,
	anchorsPerPitch: 1,
	featuresPerPitch: 8,
	contourEveryPitches: 2, contourPoints: 6,
	contourPolyEveryPitches: 4, contourPolyPoints: 5,
	pitchHeightUnits: 150, widthUnits: 1000
};

function makeRng(seed) {
	let s = seed >>> 0;
	return function (n) {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s % n;
	};
}

/* A topo with `pitches` pitches. All coordinates are integers in editor units (1 unit = 1 watch pixel). */
/* variant k gives a different but same-sized topo (other seed, distinct descriptions), so three filled slots
 * do not share interned strings the way three copies of one topo would. */
function build(pitches, label, variant) {
	const k0 = variant || 0;
	const rnd = makeRng(12345 + k0 * 7919);
	const pitchH = Math.min(MIX.pitchHeightUnits, Math.floor(31000 / pitches));
	const height = pitchH * pitches + 300;
	const W = MIX.widthUnits;
	const topo = { name: label || ('Synthetic ' + pitches + 'p'), wall: 'Generated wall', grade: 'VI', pitches,
		width: W, height, anchors: [], route: [], features: [] };
	const yAt = (p, frac) => height - 150 - Math.round(p * pitchH + frac * pitchH);
	let x = 400;
	topo.route.push([x, yAt(0, 0)]);
	let fi = 0;
	for (let p = 0; p < pitches; p++) {
		for (let k = 1; k <= MIX.routePointsPerPitch; k++) {
			x = Math.max(60, Math.min(W - 60, x + rnd(121) - 60));
			topo.route.push([x, yAt(p, k / MIX.routePointsPerPitch)]);
		}
		const top = topo.route[topo.route.length - 1];
		topo.anchors.push({ x: top[0], y: top[1], grade: GRADES[p % GRADES.length], length: (20 + (p * 7) % 30) + 'm',
			info: INFOS[(p + k0) % INFOS.length] + ' (P' + (p + 1) + (k0 ? ', T' + (k0 + 1) : '') + ')' });
		for (let k = 0; k < MIX.featuresPerPitch; k++) {
			const type = CYCLE[fi++ % CYCLE.length];
			const fx = 40 + rnd(W - 80);
			const fy = yAt(p, rnd(100) / 100);
			let f;
			switch (type) {
			case 'crack': f = { type, x: fx, y: fy, w: 9, h: 60 + rnd(81) }; break;
			case 'chimney': case 'corner': f = { type, x: fx, y: fy, w: 10 + rnd(5), h: 60 + rnd(61) }; break;
			case 'couloir': f = { type, x: fx, y: fy, w: 20, h: 80 + rnd(81) }; break;
			case 'overhang': f = { type, x: fx, y: fy, w: 60 + rnd(81), h: 9 }; break;
			case 'roof': f = { type, x: fx, y: fy, w: 40 + rnd(61), h: 8 }; break;
			case 'ramp': f = { type, x: fx, y: fy, w: 60 + rnd(61), h: 30 + rnd(31) }; break;
			case 'ledge': f = { type, x: fx, y: fy, w: 80 + rnd(81), h: 6 }; break;
			case 'slab': f = { type, x: fx, y: fy, w: 50 + rnd(111), h: 50 + rnd(91) }; break;
			case 'arete': f = { type, x1: fx, y1: fy, x2: fx + rnd(81) - 40, y2: fy - 60 - rnd(60) }; break;
			case 'label': f = { type, x: fx, y: fy, text: LABELS[fi % LABELS.length] }; break;
			default: f = { type, x: fx, y: fy };
			}
			topo.features.push(f);
		}
		if (p % MIX.contourEveryPitches === 0) {
			const pts = [];
			let cx = 40 + rnd(W - 200);
			for (let k = 0; k < MIX.contourPoints; k++) { cx += 20 + rnd(40); pts.push([cx, yAt(p, k / MIX.contourPoints)]); }
			topo.features.push({ type: 'contour', points: pts });
		}
		if (p % MIX.contourPolyEveryPitches === 0) {
			const pts = [];
			const cx = 100 + rnd(W - 200), cy = yAt(p, 0.5);
			for (let k = 0; k < MIX.contourPolyPoints; k++) {
				const a = (k / MIX.contourPolyPoints) * Math.PI * 2;
				pts.push([cx + Math.round(Math.cos(a) * (40 + rnd(30))), cy + Math.round(Math.sin(a) * (40 + rnd(30)))]);
			}
			topo.features.push({ type: 'contour_poly', points: pts });
		}
	}
	return topo;
}

/* The pitch count whose compact JSON is closest to targetBytes. */
function generate(targetBytes, label, variant) {
	let best = null;
	for (let p = 1; p < 2000; p++) {
		const t = build(p, label, variant);
		const n = JSON.stringify(t).length;
		if (best === null || Math.abs(n - targetBytes) < Math.abs(best.bytes - targetBytes)) { best = { topo: t, bytes: n, pitches: p }; }
		if (n > targetBytes) { break; }
	}
	return best;
}

module.exports = { generate, build, MIX, CYCLE };

if (require.main === module) {
	const kb = parseFloat(process.argv[2] || '10');
	const r = generate(Math.round(kb * 1024), 'Synthetic ' + kb + ' KB');
	const text = JSON.stringify(r.topo);
	if (process.argv[3]) { require('fs').writeFileSync(process.argv[3], text); }
	console.log(`${kb} KB target: ${r.bytes} B compact JSON, ${r.pitches} pitches, ${r.topo.route.length} route points, ` +
		`${r.topo.anchors.length} anchors, ${r.topo.features.length} features`);
}
