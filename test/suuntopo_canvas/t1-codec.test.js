// ABOUTME: T1-T3: the STP1 parser shipped as ext1.js + ext9.js. Valid fixtures against the reference decoder, a malformed corpus
// ABOUTME: with expected error codes, and seeded fuzzing that must never throw.

'use strict';
const assert = require('assert');
const fs = require('fs');
const h = require('./lib/harness');
const R = require('./lib/reference');

const FIXTURES = fs.readdirSync(h.FIXTURES).filter((f) => f.endsWith('.stp')).sort();

// Valid base: three route points, two pitches.
const BASE = {
  head: 'STP1|NName',
  R: 'R10,10,0,10,0,10',
  B: 'B0,1,2',
  P: ['P1~4a~10~a', 'P2~5a~20~b'],
  extra: ''
};
const build = (o) => {
  const t = Object.assign({}, BASE, o);
  return [t.head, t.R, t.B].concat(t.P).filter((x) => x !== null).join('|') + t.extra;
};
const longRoute = (n) => 'R10,10' + ',0,1'.repeat(n - 1);
const pitches = (n) => Array.from({ length: n }, () => 'P1~4a~10~');

// [description, input, expected code]
const MALFORMED = [
  ['empty', '', 1],
  ['spaces', '   ', 1],
  ['null', null, 1],
  ['number', 42, 1],
  ['old v0.3 JSON', '{"name":"Salathe","anchors":[],"route":[[75,1217]]}', 1],
  ['STP2', build({ head: 'STP2|NName' }), 1],
  ['lower-case magic', build({ head: 'stp1|NName' }), 1],
  ['magic without separator', build({ head: 'STP1x|NName' }), 1],
  ['truncated magic', 'STP', 1],
  ['magic only', 'STP1', 2],
  ['N missing', build({ head: 'STP1' }), 2],
  ['N empty', build({ head: 'STP1|N' }), 2],
  ['N 33 characters', build({ head: 'STP1|N' + 'é'.repeat(32) + 'x' }), 2],
  ['N control character', build({ head: 'STP1|NNa\u0001me' }), 2],
  ['N twice', build({ head: 'STP1|NOne|NTwo' }), 2],
  ['R missing', build({ R: null }), 3],
  ['R one point', build({ R: 'R10,10', B: 'B0,1', P: ['P1~4a~10~'] }), 3],
  ['402 points in one feature path', build({ extra: '|Fc' + Array.from({ length: 402 }, () => '1,1').join(',') }), 7],
  ['R 121 points', build({ R: longRoute(121) }), 3],
  ['R twice', build({ extra: '|R10,10,0,10' }), 3],
  ['B missing', build({ B: null }), 4],
  ['B one entry', build({ B: 'B0', P: [] }), 4],
  ['B not increasing', build({ B: 'B0,2,1' }), 4],
  ['B repeated entry', build({ B: 'B0,1,1' }), 4],
  ['B out of range', build({ B: 'B0,1,3' }), 4],
  ['B negative', build({ B: 'B-1,1,2' }), 4],
  ['B 62 entries', build({ R: longRoute(70), B: 'B' + Array.from({ length: 62 }, (x, i) => i).join(','), P: pitches(60) }), 4],
  ['61 pitch records', build({ R: longRoute(70), B: 'B' + Array.from({ length: 62 }, (x, i) => i).join(','), P: pitches(61) }), 5],
  ['B twice', build({ extra: '|B0,2' }), 4],
  ['P count one short', build({ P: ['P1~4a~10~a'] }), 5],
  ['P count one over', build({ P: ['P1~4a~10~a', 'P1~4a~10~a', 'P1~4a~10~a'] }), 5],
  ['P band 5', build({ P: ['P5~4a~10~a', 'P2~5a~20~b'] }), 5],
  ['P band missing', build({ P: ['P~4a~10~a', 'P2~5a~20~b'] }), 5],
  ['P band two digits', build({ P: ['P12~4a~10~a', 'P2~5a~20~b'] }), 5],
  ['P grade 11 bytes', build({ P: ['P1~ABCDEFGHIJK~10~a', 'P2~5a~20~b'] }), 5],
  ['P tilde in grade', build({ P: ['P1~4~a~10~a', 'P2~5a~20~b'] }), 5],
  ['P length 1000', build({ P: ['P1~4a~1000~a', 'P2~5a~20~b'] }), 5],
  ['P length missing', build({ P: ['P1~4a~~a', 'P2~5a~20~b'] }), 5],
  ['P length negative', build({ P: ['P1~4a~-5~a', 'P2~5a~20~b'] }), 5],
  ['P without info separator', build({ P: ['P1~4a~10', 'P2~5a~20~b'] }), 5],
  ['P only band', build({ P: ['P1', 'P2~5a~20~b'] }), 5],
  ['P info 201 bytes', build({ P: ['P1~4a~10~' + 'x'.repeat(201), 'P2~5a~20~b'] }), 5],
  ['P info NUL', build({ P: ['P1~4a~10~a\u0000b', 'P2~5a~20~b'] }), 5],
  ['double minus', build({ R: 'R10,10,--5,10,0,10' }), 6],
  ['trailing minus', build({ R: 'R10,10,5-,10,0,10' }), 6],
  ['five digits', build({ R: 'R10,10,99999,10,0,10' }), 6],
  ['x beyond 4095', build({ R: 'R4096,10,0,10,0,10' }), 6],
  ['relative below 0', build({ R: 'R10,10,-20,10,0,10' }), 6],
  ['y beyond 4095 by relative', build({ R: 'R10,4090,0,10,0,10' }), 6],
  ['space in path', build({ R: 'R10, 10,0,10,0,10' }), 6],
  ['odd coordinate count', build({ R: 'R10,10,0,10,0' }), 6],
  ['empty B entry', build({ B: 'B0,,2' }), 6],
  ['feature trailing number', build({ extra: '|Fk10,10,5' }), 6],
  ['feature without points', build({ extra: '|Fk' }), 6],
  ['feature empty path', build({ extra: '|Fb10,10;' }), 6],
  ['3501 characters', build({ extra: '|X' + 'x'.repeat(3501 - build({}).length - 2) }), 7],
  ['W 33 bytes', build({ extra: '|W' + 'w'.repeat(33) }), 7],
  ['G 11 bytes', build({ extra: '|G' + 'g'.repeat(11) }), 7],
  ['A 201 bytes', build({ extra: '|A' + 'a'.repeat(201) }), 7],
  ['D control character', build({ extra: '|Dwalk\u0007off' }), 7],
  ['41 feature records', build({ extra: '|Fb1,1'.repeat(41) }), 7],
  ['101 paths', build({ extra: '|Fb' + Array.from({ length: 101 }, () => '1,1').join(';') }), 7],
  ['401 feature points', build({ extra: '|Fc' + Array.from({ length: 401 }, () => '1,1').join(',') }), 7],
  // Review round 2: setText reads markup and character entities, so '<' and '&' are rejected in every text record.
  ['N with a tag', build({ head: 'STP1|NR+D <b>Wall</b>' }), 2],
  ['N with an ampersand', build({ head: 'STP1|NR&D Wall' }), 2],
  ['W with an ampersand', build({ extra: '|WSun & Moon' }), 7],
  ['G with a less-than', build({ extra: '|G<6a' }), 7],
  ['A with an entity', build({ extra: '|AGrade then &amp; easier' }), 7],
  ['D with a tag', build({ extra: '|D<i>walk</i> off' }), 7],
  ['P grade with a less-than', build({ P: ['P1~<5a~10~a', 'P2~5a~20~b'] }), 5],
  ['P info with an ampersand', build({ P: ['P1~4a~10~Cams & nuts', 'P2~5a~20~b'] }), 5]
];

// Inputs the parser must accept.
const TOLERATED = [
  ['trailing separator', build({ extra: '|' })],
  ['empty record', build({ head: 'STP1||NName' })],
  ['unknown record', build({ extra: '|Xwhatever~|' })],
  ['unknown feature letter', build({ extra: '|Fy10,10' })],
  ['coordinate 4095', build({ R: 'R4095,4095,0,-10,0,-10' })],
  ['greater-than and guillemet in text', build({ head: 'STP1|N\u2039b> Wall', extra: '|AGrade > 5c' })],
  ['long single word', build({ extra: '|A' + 'x'.repeat(200) })],
  ['lone surrogate in name', build({ head: 'STP1|NN\uD800me' })],
  ['empty pitch notes', build({ P: ['P0~~0~', 'P4~~999~'] })],
  ['tilde in notes', build({ P: ['P1~4a~10~a~b~c', 'P2~5a~20~b'] })],
  ['1 point line feature', build({ extra: '|Fk10,10' })],
  ['exactly 3500 characters', build({ extra: '|X' + 'x'.repeat(3500 - build({}).length - 2) })],
  ['32 accented characters in the name', build({ head: 'STP1|N' + 'é'.repeat(32) })],
  ['61 stances', build({ R: longRoute(70), B: 'B' + Array.from({ length: 61 }, (x, i) => i).join(','), P: pitches(60) })],
  ['40 feature records, 100 paths', build({ extra: '|Fb1,1;1,1;1,1'.repeat(20) + '|Fb1,1;1,1'.repeat(20) })]
];

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

function mutate(s, r) {
  const pick = (n) => Math.floor(r() * n);
  const kind = pick(6);
  if (kind === 0) {
    const i = pick(s.length);
    return s.substring(0, i) + String.fromCharCode(pick(128)) + s.substring(i + 1);
  }
  if (kind === 1) return s.substring(0, pick(s.length + 1));
  if (kind === 2) {
    const recs = s.split('|');
    const i = 1 + pick(recs.length - 1);
    recs.splice(i, 0, recs[i]);
    return recs.join('|');
  }
  if (kind === 3) {
    const recs = s.split('|');
    recs.splice(1 + pick(recs.length - 1), 1);
    return recs.join('|');
  }
  if (kind === 4) {
    const i = pick(s.length);
    return s.substring(0, i) + '|,~;-9'[pick(6)] + s.substring(i);
  }
  const i = pick(s.length);
  return s.substring(0, i) + s.substring(i + 1 + pick(8));
}

module.exports = (test) => {
  test('T1 every valid fixture and built-in topo decodes like the reference decoder (counts, texts, hash, words)', () => {
    assert(FIXTURES.length >= 7, 'fixtures missing');
    const sources = FIXTURES.map((f) => [f, h.fixture(f)]).concat(builtins());
    for (const [name, s] of sources) {
      const p = h.parse(s);
      assert.strictEqual(p.code, 0, name + ' did not parse');
      assert.deepStrictEqual(R.fromParsed(s, p.W, p.R), R.decode(s), name);
      assert.strictEqual(p.R[2], R.stp1Hash(s), name + ' hash');
      assert.strictEqual(p.R[0], 0, name + ' code in R');
    }
  });

  test('T1 fixture corpus covers the limits (1 pitch, 60 pitches, 3500 characters, accents, every feature letter, walks)', () => {
    const n = (f) => h.parse(h.fixture(f)).R[1];
    assert.strictEqual(n('one-pitch.stp'), 1);
    assert.strictEqual(n('sixty.stp'), 60);
    assert.strictEqual(h.fixture('stress.stp').length, 3500);
    assert.strictEqual(new Set(R.decode(h.fixture('features.stp')).features.map((x) => x.type)).size, 19);
    const walk = R.decode(h.fixture('walk.stp'));
    assert(walk.stances[0] > 0 && walk.stances[walk.stances.length - 1] < walk.route.length - 1, 'walk fixture has approach and descent vertices');
    assert(/[^\x00-\x7f]/.test(h.fixture('accents.stp')));
    assert.strictEqual(Buffer.byteLength(R.decode(h.fixture('sixty.stp')).name), 32);
  });

  test('T2 malformed corpus returns the expected error code and never throws', () => {
    assert(MALFORMED.length >= 40, 'malformed corpus has ' + MALFORMED.length + ' cases');
    for (const [name, s, code] of MALFORMED) {
      const p = h.parse(s);
      assert.strictEqual(p.code, code, name);
      assert.strictEqual(p.R[0], code, name + ' code in R');
    }
  });

  test('T2 tolerated inputs parse', () => {
    for (const [name, s] of TOLERATED) assert.strictEqual(h.parse(s).code, 0, name);
  });

  test('T2 optional records (W, G, A, D) do not leak from the previous topo', () => {
    const parse = h.parser();
    const W = new Float32Array(644);
    const Rr = new Float32Array(200);
    assert.strictEqual(parse(h.fixture('walk.stp'), W, Rr), 0);
    assert.notStrictEqual(Rr[9], Rr[8]);
    const s = build({});
    assert.strictEqual(parse(s, W, Rr), 0);
    assert.strictEqual(s.substring(Rr[8], Rr[9]), '');
    assert.strictEqual(s.substring(Rr[10], Rr[11]), '');
    assert.strictEqual(s.substring(Rr[6], Rr[7]), '');
  });

  test('T3 5000 seeded mutations: never throw, each parse under 50 ms, valid results match the reference', () => {
    const parse = h.parser();
    const W = new Float32Array(644);
    const Rr = new Float32Array(200);
    const r = rng(1234);
    const corpus = FIXTURES.map(h.fixture);
    let ok = 0;
    for (let i = 0; i < 5000; i++) {
      let s = corpus[i % corpus.length];
      const rounds = 1 + Math.floor(r() * 3);
      for (let k = 0; k < rounds; k++) s = mutate(s, r);
      const t0 = process.hrtime.bigint();
      const code = parse(s, W, Rr);
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      assert(code >= 0 && code <= 7, 'unexpected code ' + code + ' for ' + JSON.stringify(s.slice(0, 80)));
      assert(ms < 50, 'parse took ' + ms + ' ms');
      if (code === 0) {
        ok++;
        assert.deepStrictEqual(R.fromParsed(s, W, Rr), R.decode(s));
      }
    }
    assert(ok > 100, 'fuzz produced too few valid topos (' + ok + ')');
  });
};

// The built-in topos (ext4.js upwards), as main.js loads them.
function builtins() {
  const main = h.mainContext('q', {}, h.newScreen()).ctx;
  return h.TOPO_EXT.map((f) => [f, main.evalFile('{file_path}/' + f)()]);
}

module.exports.MALFORMED = MALFORMED;
module.exports.rng = rng;
module.exports.mutate = mutate;
module.exports.FIXTURE_NAMES = FIXTURES;
module.exports.builtins = builtins;
