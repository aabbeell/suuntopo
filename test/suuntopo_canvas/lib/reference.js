// ABOUTME: Independent STP1 reference decoder (modern JS, split based) used to cross-check the watch parser on valid topos,
// ABOUTME: plus a reader that turns the parser's stream words and result array back into the same plain object.

'use strict';

const FEATURE_LETTERS = 'rolkhdapgscqbnvxtwz';

function stp1Hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * ((i % 31) + 1)) % 65521;
  return h || 1;
}

function parsePath(body) {
  const nums = body.split(',').map(Number);
  const pts = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < nums.length; i += 2) {
    x = i ? x + nums[i] : nums[i];
    y = i ? y + nums[i + 1] : nums[i + 1];
    pts.push([x + 0, y + 0]); // + 0 turns a '-0' coordinate into 0, as the watch's packed words do
  }
  return pts;
}

// Decodes a topo that is known to be valid. Throws on anything unexpected.
function decode(s) {
  if (!s.startsWith('STP1')) throw new Error('not STP1');
  const out = { name: '', grade: '', approach: '', descent: '', route: [], stances: [], pitches: [], features: [], hash: stp1Hash(s) };
  for (const rec of s.split('|').slice(1)) {
    if (!rec.length) continue;
    const tag = rec[0];
    const body = rec.slice(1);
    if (tag === 'N') out.name = body;
    else if (tag === 'G') out.grade = body;
    else if (tag === 'A') out.approach = body;
    else if (tag === 'D') out.descent = body;
    else if (tag === 'R') out.route = parsePath(body);
    else if (tag === 'B') out.stances = body.split(',').map((v) => Number(v) + 0);
    else if (tag === 'P') {
      const parts = body.split('~');
      out.pitches.push({ band: Number(parts[0]), grade: parts[1], len: Number(parts[2]), info: parts.slice(3).join('~') });
    } else if (tag === 'F') {
      const type = FEATURE_LETTERS.indexOf(body[0]);
      if (type < 0) continue;
      for (const p of body.slice(1).split(';')) {
        const points = parsePath(p);
        out.features.push({ type, points });
      }
    }
  }
  return out;
}

// Reads ext1.js results back: W holds the stream words, R the counts, hash, text spans and pitch table.
function fromParsed(s, W, R) {
  const span = (v) => s.substring(Math.floor(v / 256), Math.floor(v / 256) + (v % 256));
  const n = R[1];
  const head = W[0];
  const nR = head % 128;
  const nB = Math.floor(head / 128) % 64;
  const nF = Math.floor(head / 8192);
  const oR = 2 + Math.ceil(nB / 3);
  const out = { name: s.substring(R[4], R[5]), grade: s.substring(R[6], R[7]), approach: s.substring(R[8], R[9]), descent: s.substring(R[10], R[11]), route: [], stances: [], pitches: [], features: [], hash: R[2] };
  const pt = (v) => [Math.floor(v / 4096), v % 4096];
  for (let i = 0; i < nB; i++) out.stances.push(Math.floor(W[2 + Math.floor(i / 3)] / [1, 128, 16384][i % 3]) % 128);
  for (let i = 0; i < nR; i++) out.route.push(pt(W[oR + i]));
  for (let k = 0; k < n; k++) {
    const a = R[16 + 3 * k];
    out.pitches.push({ band: Math.floor(a / 1000), grade: span(R[17 + 3 * k]), len: a % 1000, info: span(R[18 + 3 * k]) });
  }
  let po = oR + nR + nF;
  for (let f = 0; f < nF; f++) {
    const v = W[oR + nR + f];
    const points = [];
    for (let i = 0; i < v % 1024; i++) points.push(pt(W[po + i]));
    po += v % 1024;
    out.features.push({ type: Math.floor(v / 1024), points });
  }
  if (po !== R[3]) throw new Error('word count ' + R[3] + ' does not match the layout (' + po + ')');
  return out;
}

module.exports = { FEATURE_LETTERS, stp1Hash, decode, fromParsed };
