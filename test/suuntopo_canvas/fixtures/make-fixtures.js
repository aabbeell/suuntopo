// ABOUTME: Writes the deterministic STP1 test fixtures (one pitch, 60 pitches, accents, every feature, walks, stress at 3500 characters).
// ABOUTME: Run once with node; the .stp files are committed. demo.stp is the canonical demo and is kept by hand.

'use strict';
const fs = require('fs');
const path = require('path');

const bytes = (s) => Buffer.byteLength(s, 'utf8');

// Encodes absolute points as x,y[,dx,dy]*.
function pathText(points) {
  let out = '';
  let px = 0;
  let py = 0;
  points.forEach(([x, y], i) => {
    out += i ? ',' + (x - px) + ',' + (y - py) : x + ',' + y;
    px = x;
    py = y;
  });
  return out;
}

function encode(t) {
  const rec = ['STP1', 'N' + t.name];
  if (t.wall) rec.push('W' + t.wall);
  if (t.grade) rec.push('G' + t.grade);
  if (t.approach) rec.push('A' + t.approach);
  if (t.descent) rec.push('D' + t.descent);
  rec.push('R' + pathText(t.route));
  rec.push('B' + t.stances.join(','));
  for (const p of t.pitches) rec.push('P' + p.band + '~' + p.grade + '~' + p.len + '~' + p.info);
  for (const f of t.features || []) rec.push('F' + f.type + f.paths.map(pathText).join(';'));
  return rec.join('|');
}

// Deterministic pseudo-random numbers (mulberry32).
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function zigzagRoute(n, x0, y0, step, seed) {
  const r = rng(seed);
  const pts = [];
  let x = x0;
  let y = y0;
  for (let i = 0; i < n; i++) {
    pts.push([Math.round(x), Math.round(y)]);
    x = Math.min(4000, Math.max(40, x + (r() - 0.5) * 80));
    y -= step;
  }
  return pts;
}

const out = {};

out['one-pitch.stp'] = encode({
  name: 'One pitch', grade: '6a', route: [[200, 900], [230, 700], [210, 500]], stances: [0, 2],
  pitches: [{ band: 3, grade: '6a', len: 28, info: 'Single pitch to the chains.' }]
});

{
  const route = zigzagRoute(120, 600, 3900, 31, 7);
  const stances = [];
  for (let k = 0; k <= 60; k++) stances.push(Math.round((k * 118) / 60) + 1);
  const pitches = [];
  for (let k = 1; k <= 60; k++) pitches.push({ band: k % 5, grade: 'VI' + (k % 2 ? '+' : '-'), len: 20 + (k % 30), info: 'P' + k + ' note' });
  out['sixty.stp'] = encode({ name: 'Ősz-fal Ďumbier hosszú út 60', grade: 'VII', route, stances, pitches });
}

out['accents.stp'] = encode({
  name: 'Čierny štít – Ľadová', wall: 'Ťažká stena', grade: 'V+ ü', approach: 'Prístup: 45 perc, élesen jobbra.', descent: 'Zostup: ślizg w dół, ñ, ø, ß.',
  route: [[100, 1300], [150, 1200], [160, 1000], [140, 800], [180, 700]], stances: [1, 2, 3],
  pitches: [{ band: 2, grade: 'Ⅴ', len: 35, info: 'Hosszú repedés, ékszerek: €, ½.' }, { band: 4, grade: 'VII−', len: 40, info: 'Kémény ~ tetőig.' }]
});

{
  const letters = 'rolkhdapgscqbnvxtwz';
  const features = [];
  letters.split('').forEach((type, i) => {
    const y = 1800 - i * 80;
    if ('bnvxtwz'.includes(type)) features.push({ type, paths: [[[300, y]], [[340, y + 20]]] });
    else if (type === 's' || type === 'q') features.push({ type, paths: [[[400, y], [480, y], [480, y + 60], [400, y + 60]]] });
    else features.push({ type, paths: [[[200, y], [260, y - 20], [320, y + 10]]] });
  });
  out['features.stp'] = encode({
    name: 'Every feature', grade: '5a', route: [[250, 1900], [250, 1400], [250, 900], [250, 300]], stances: [0, 1, 2, 3],
    pitches: [{ band: 1, grade: '4c', len: 40, info: '' }, { band: 2, grade: '5a', len: 45, info: 'Middle.' }, { band: 1, grade: '4a', len: 50, info: 'Top.' }],
    features
  });
}

out['walk.stp'] = encode({
  name: 'Walk in and out', grade: 'IV', approach: 'Follow the cairns for 30 minutes.', descent: 'Scramble down the gully to the east.',
  route: [[100, 1500], [160, 1450], [200, 1380], [220, 1300], [230, 1200], [260, 1100], [300, 1050], [420, 1060], [560, 1120]],
  stances: [3, 4, 6], pitches: [{ band: 1, grade: 'III', len: 30, info: 'Ramp.' }, { band: 2, grade: 'IV', len: 45, info: 'Wall.' }],
  features: [{ type: 'c', paths: [[[50, 1550], [80, 1000], [140, 700]]] }]
});

// Stress: 120 route points, 35 pitches, 40 feature records, 100 paths, 400 points, padded to exactly 3500 characters.
{
  const r = rng(42);
  const route = zigzagRoute(120, 700, 3600, 26, 11);
  const stances = [];
  for (let k = 0; k <= 35; k++) stances.push(3 + Math.round((k * 112) / 35));
  const pitches = [];
  for (let k = 1; k <= 35; k++) pitches.push({ band: (k % 4) + 1, grade: '6' + 'abc'[k % 3], len: 25 + (k % 20), info: '' });
  const types = 'kkkkrroolhdapgscbbbbtwzxvnkkrrhhddaappgg';
  const features = [];
  let pathsLeft = 100;
  let pointsLeft = 400;
  for (let i = 0; i < 40; i++) {
    const type = types[i];
    const nPaths = i < 20 ? 3 : 2;
    const paths = [];
    for (let j = 0; j < nPaths && pathsLeft > 0; j++) {
      const base = route[Math.floor(r() * 110) + 5];
      const point = 'bnvxtwz'.includes(type);
      const np = point ? 1 : Math.min(6, pointsLeft - (pathsLeft - 1));
      const pts = [];
      for (let q = 0; q < np; q++) pts.push([Math.max(0, Math.min(4095, base[0] + Math.round((r() - 0.5) * 120) + q * 12)), Math.max(0, Math.min(4095, base[1] - q * 25))]);
      paths.push(pts);
      pathsLeft--;
      pointsLeft -= np;
    }
    if (paths.length) features.push({ type, paths });
  }
  const t = { name: 'Stress topo', grade: '7a', route, stances, pitches, features, approach: '' };
  // Trim line points (never below 2 per path) until the topo fits in 3500 characters with a short approach note.
  while (bytes(encode(t)) > 3490) {
    let longest = null;
    for (const f of features) for (const q of f.paths) if (q.length > 2 && (!longest || q.length > longest.length)) longest = q;
    if (!longest) break;
    longest.pop();
  }
  const without = bytes(encode(t));
  t.approach = 'x'.repeat(Math.min(200, 3500 - without - 2));
  let s = encode(t);
  if (bytes(s) < 3500) t.descent = 'y'.repeat(3500 - bytes(s) - 2);
  s = encode(t);
  out['stress.stp'] = s;
}

// Slot-sized: the largest topo the Topo setting holds (1500 bytes), 12 pitches with terrain, for the hardware test data.
{
  const route = zigzagRoute(40, 500, 1900, 40, 5);
  const stances = [];
  for (let k = 0; k <= 12; k++) stances.push(2 + Math.round((k * 36) / 12));
  const pitches = [];
  for (let k = 1; k <= 12; k++) pitches.push({ band: (k % 4) + 1, grade: 'V' + (k % 2 ? '+' : ''), len: 30 + k, info: 'Pitch ' + k + ': crack, then a ledge.' });
  const features = [];
  for (let k = 0; k < 12; k++) {
    const [x, y] = route[stances[k]];
    features.push({ type: 'kdrl'[k % 4], paths: [[[x + 30, y - 10], [x + 34, y - 60]]] });
  }
  features.push({ type: 'b', paths: stances.map((v) => [[route[v][0] + 15, route[v][1]]]) });
  const t = { name: 'Slot full', grade: 'V+', route, stances, pitches, features, approach: '' };
  t.approach = 'a'.repeat(Math.max(0, Math.min(200, 1500 - bytes(encode(t)) - 2)));
  let s = encode(t);
  if (bytes(s) < 1500) t.descent = 'd'.repeat(Math.min(200, 1500 - bytes(s) - 2));
  out['slot-1500.stp'] = encode(t);
}

for (const [name, s] of Object.entries(out)) {
  fs.writeFileSync(path.join(__dirname, name), s + '\n');
  console.log(name, bytes(s), 'bytes');
}
