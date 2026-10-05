// ABOUTME: Writes the built-in topo files ext5.js-ext7.js of the watch app from hand-drawn schematic geometry.
// ABOUTME: ext5 short single pitch, ext6 long route with traverses, ext7 fictional wall near the 3.5 KB file limit. Run once.
// Usage: node make-builtins.js [--personal]. By default Piccolo Fillar (ext6.js) gets neutral approach, descent and pitch
// notes, so the source package is store-safe. --personal writes the rich notes, which paraphrase a vault note based on
// guidebook material (SPEC §18 Q7): for a personal build only, never for a store upload unless Vitya has confirmed in
// writing that the notes are his own. Run it again without the flag before building a store package (test T8 checks).

'use strict';
const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '../../../src/suuntopo_canvas');
const PERSONAL = process.argv.includes('--personal');

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
  for (const [tag, key] of [['W', 'wall'], ['G', 'grade'], ['A', 'approach'], ['D', 'descent']]) if (t[key]) rec.push(tag + t[key]);
  rec.push('R' + pathText(t.route));
  rec.push('B' + t.stances.join(','));
  for (const p of t.pitches) rec.push('P' + p.join('~'));
  for (const [type, paths] of t.features) rec.push('F' + type + paths.map(pathText).join(';'));
  return rec.join('|');
}

function write(file, about, topo) {
  const s = encode(topo);
  if (/['\\]/.test(s)) throw new Error(file + ': quote or backslash in topo text');
  const body = '// ABOUTME: ' + about[0] + '\n// ABOUTME: ' + about[1] + '\nfunction () {\n  return \'' + s + '\';\n}\n';
  fs.writeFileSync(path.join(APP, file), body);
  console.log(file, Buffer.byteLength(s), 'B topo,', Buffer.byteLength(body), 'B file');
}

// Short single pitch: the IV step to the North Summit of the Jägerhorn (from the vault route note; schematic).
write('ext5.js', ['Built-in topo 2: Jägerhorn North Summit step, a short single pitch (schematic, after the route note).',
  'Loaded by main.js with evalFile; returns the topo as one STP1 line.'], {
  name: 'Jägerhorn N', wall: 'Monte Rosa', grade: 'IV',
  approach: 'Schematic, check on site. From the south summit go down to the notch below the North Summit.',
  descent: 'Back down the step to the notch, then return along the ridge.',
  route: [[120, 620], [190, 585], [255, 560], [262, 500], [270, 440]],
  stances: [2, 4],
  pitches: [[1, 'IV', 0, 'Short steep step on rock from the notch to the North Summit.']],
  features: [
    ['a', [[[90, 640], [190, 600], [250, 575], [300, 590], [380, 640]]]],
    ['s', [[[235, 545], [290, 540], [290, 445], [245, 450]]]],
    ['c', [[[60, 700], [150, 650], [260, 590], [330, 620], [420, 700]]]],
    ['z', [[[150, 640]], [[310, 610]]]]
  ]
});

// Long multi-pitch with traverses: Piccolo Fillar, La Diretta plus the Bisaccia finish (grades and lengths from the
// vault route note; drawing and wording are original and schematic).
const PICCOLO = {
  name: 'Piccolo Fillar', wall: 'Monte Rosa E face', grade: '6b',
  approach: 'Schematic, verify on site. From bivacco Belloni up the couloir (II), then exposed ledges left to the glacier terrace.',
  descent: 'Rappel the route. The second rappel is awkward.',
  route: [[430, 1810], [370, 1790], [330, 1765], [335, 1655], [340, 1545], [330, 1445], [320, 1345], [300, 1300],
    [255, 1280], [240, 1225], [245, 1165], [272, 1135], [255, 1095], [215, 1005], [205, 925], [200, 845], [228, 840],
    [232, 780], [210, 742], [195, 680], [200, 600], [215, 470], [232, 432], [262, 420], [266, 352], [292, 332], [296, 262]],
  stances: [2, 3, 4, 5, 6, 9, 12, 13, 15, 18, 19, 20, 21, 23, 25, 26],
  pitches: [
    [2, '5b', 0, 'L1-L4 are 130 m together on bolts. Steep start, then easier.'],
    [2, '5a', 0, 'Bolted face.'],
    [1, '4b', 0, 'Easier face.'],
    [1, '4b', 0, 'To a large reddish niche.'],
    [2, '5c', 35, 'Crack-chimney on the right, then traverse left along a flake into a dihedral.'],
    [2, '5c', 35, 'Dihedral, crack out right, back left to the bolts.'],
    [1, '3a', 50, 'Up left to the big central ledge. Belay on the piton; the bolts to the right lead off route.'],
    [2, '5c', 55, 'Dihedrals near the arete, left of the rock triangle.'],
    [3, '6a', 45, 'Traverse 4 m right into a dihedral, thin crack, then left to the belay.'],
    [3, '6a/6b', 30, 'Delicate slab, then an athletic dihedral.'],
    [2, '5a', 35, 'Dihedrals and cracks to the top of the pillar.'],
    [1, 'IV', 60, 'Bisaccia: sharp ridge on snowy rock.'],
    [2, 'V+', 20, 'Oblique crack-dihedral, then an exposed traverse right.'],
    [3, 'VI', 30, 'Smooth wall, then right on overhanging rock.'],
    [1, 'IV', 0, 'Last pitch to the summit.']
  ],
  features: [
    ['g', [[[120, 1820], [150, 1300], [170, 800], [190, 450]], [[480, 1820], [430, 1300], [400, 800], [360, 400]]]],
    ['c', [[[150, 1840], [330, 1830], [480, 1850]]]],
    ['b', [[[345, 1720]], [[350, 1600]], [[348, 1500]], [[338, 1400]], [[262, 1255]], [[258, 1190]], [[262, 1115]]]],
    ['h', [[[318, 1345], [305, 1300]]]],
    ['l', [[[250, 1290], [300, 1305]], [[175, 1012], [250, 1000]]]],
    ['d', [[[255, 1225], [262, 1165]], [[190, 925], [185, 845]], [[250, 840], [252, 780]]]],
    ['a', [[[175, 1000], [165, 860], [180, 700]]]],
    ['s', [[[205, 1000], [300, 880], [205, 620]], [[180, 700], [230, 700], [215, 630]]]],
    ['o', [[[218, 770], [255, 762]]]],
    ['k', [[[240, 790], [243, 755]], [[212, 660], [205, 605]]]],
    ['n', [[[218, 1012]], [[240, 800]], [[205, 700]], [[240, 425]], [[285, 345]]]],
    ['v', [[[214, 595]]]],
    ['z', [[[380, 1830]], [[420, 1825]], [[460, 1838]]]]
  ]
};
if (!PERSONAL) {
  PICCOLO.approach = 'Schematic sketch, not a guide. Check the route on site.';
  PICCOLO.descent = 'Check the descent on site.';
  PICCOLO.pitches = PICCOLO.pitches.map(([band, grade, len]) => [band, grade, len, '']);
}
write('ext6.js', ['Built-in topo 3: Piccolo Fillar, La Diretta and the Bisaccia finish, 15 pitches with traverses (schematic).',
  'Loaded by main.js with evalFile; returns the topo as one STP1 line. Grades and lengths from the vault route note' +
  (PERSONAL ? '; personal build with route notes, not for the store.' : '; neutral notes.')], PICCOLO);

// Near the file limit: a fictional big wall of 30 pitches with dense terrain (tests the size and tile budgets).
{
  const route = [];
  const stances = [];
  const pitches = [];
  const grades = ['5a', '5b', '5c', '6a', '6a+', '6b', '6b+', '6c', '5c', '6a'];
  const bands = [2, 2, 2, 3, 3, 3, 4, 4, 2, 3];
  let x = 700;
  let y = 3900;
  route.push([x + 80, y + 60]);
  for (let k = 0; k <= 30; k++) {
    stances.push(route.length);
    route.push([x, y]);
    if (k === 30) break;
    const sway = k % 6 < 3 ? 40 : -40;
    route.push([x + sway, y - 55]);
    x += sway / 2 + (k % 5 === 4 ? -60 : (k % 5 === 1 ? 60 : 0));
    y -= 120;
  }
  route.push([x + 120, y - 20]);
  route.push([x + 220, y + 40]);
  for (let k = 0; k < 30; k++) {
    const g = grades[k % 10];
    pitches.push([bands[k % 10], g, 30 + (k * 7) % 25, k % 5 === 4 ? 'Traverse left on a ledge, then straight up the wall.' : (k % 3 ? 'Follow the crack system, cams 0.5 to 3.' : 'Corner with bolts, belay on a small ledge.')]);
  }
  const features = [];
  for (let k = 0; k < 30; k++) {
    const [sx, sy] = route[stances[k]];
    if (k % 3 === 0) features.push(['k', [[[sx + 35, sy - 10], [sx + 30, sy - 90]]]]);
    if (k % 3 === 1) features.push(['d', [[[sx - 30, sy - 5], [sx - 25, sy - 95]]]]);
    if (k % 6 === 2) features.push(['r', [[[sx - 40, sy - 70], [sx + 20, sy - 80]]]]);
    if (k % 6 === 5) features.push(['l', [[[sx - 30, sy + 4], [sx + 30, sy + 4]]]]);
    if (k % 4 === 3) features.push(['n', [[[sx + 20, sy - 60]], [[sx - 20, sy - 30]]]]);
  }
  features.push(['b', route.filter((p, i) => stances.includes(i)).slice(0, 24).map(([px, py]) => [[px + 16, py]])]);
  features.push(['c', [route.filter((p, i) => i % 6 === 0).map(([px, py]) => [px - 120, py])]]);
  write('ext7.js', ['Built-in topo 4: a fictional big wall of 30 pitches with dense terrain, close to the 3.5 KB file limit.',
    'Loaded by main.js with evalFile; returns the topo as one STP1 line. Not a real climb.'], {
    name: 'Fictional Wall', wall: 'Demo', grade: '6c',
    approach: 'Fictional 30-pitch wall to try a long route on the watch. Not a real climb.',
    descent: 'Walk off right.',
    route, stances, pitches, features
  });
}
