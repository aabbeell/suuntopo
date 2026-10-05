// ABOUTME: STP1 parser, stage 2 of 2 (after ext1.js): reads the route, stances and terrain records into the stream words W
// ABOUTME: (header, stances 3 per word, route, feature table, feature points), checks them against the pitch count in R.
function (s, W, R) {
  var L = s.length, p = 4, a, e, t, k, c = 0, q, x, y, last = -1, seen = 0, pp, pv;
  var nR = 0, nB = 0, nF = 0, nFP = 0, nFR = 0;
  // Reads an integer of 1-4 digits with an optional minus at pp into pv.
  var num = function () {
    var d = 0, neg = s.charAt(pp) === '-';
    pv = 0;
    if (neg) { pp++; }
    while (s.charCodeAt(pp) >= 48 && s.charCodeAt(pp) <= 57) { pv = pv * 10 + s.charCodeAt(pp++) - 48; d++; }
    if (neg) { pv = -pv; }
    return d > 0 && d < 5;
  };
  // Reads x,y[,dx,dy]* between a and e into W from word o as x*4096+y. Returns the count, -1 on a syntax or range
  // error, -2 when there are more than max points.
  var path = function (a, e, o, max) {
    var n = 0;
    pp = a;
    for (;;) {
      if (!num()) { return -1; }
      x = n ? x + pv : pv;
      if (s.charAt(pp++) !== ',' || !num()) { return -1; }
      y = n ? y + pv : pv;
      if (x < 0 || x > 4095 || y < 0 || y > 4095) { return -1; }
      if (n >= max) { return -2; }
      W[o + n++] = x * 4096 + y;
      if (pp === e) { return n; }
      if (s.charAt(pp++) !== ',') { return -1; }
    }
  };
  // Regions at their largest offsets, compacted at the end: stances 2, route 23, feature table 143, points 243.
  while (p < L) {
    a = p + 1;
    e = s.indexOf('|', a);
    if (e < 0) { e = L; }
    t = s.charAt(a++);
    c = 0;
    if (t === 'R') {
      k = path(a, e, 23, 120);
      c = seen & 1 ? 3 : (k === -1 ? 6 : (k < 2 ? 3 : 0));
      seen |= 1;
      nR = k;
    } else if (t === 'B') {
      c = seen & 2 ? 4 : 0;
      seen |= 2;
      pp = a;
      while (!c) {
        if (!num()) { c = 6; } else if (pv <= last || nB > 60) { c = 4; } else {
          k = 2 + Math.floor(nB / 3);
          W[k] = (nB % 3 ? W[k] : 0) + pv * (nB % 3 ? (nB % 3 === 1 ? 128 : 16384) : 1);
          last = pv;
          nB++;
          if (pp === e) { break; }
          if (s.charAt(pp++) !== ',') { c = 6; }
        }
      }
      if (!c && nB < 2) { c = 4; }
    } else if (t === 'F') {
      t = 'rolkhdapgscqbnvxtwz'.indexOf(s.charAt(a++));
      c = t >= 0 && ++nFR > 40 ? 7 : 0;
      while (t >= 0 && !c) {
        q = s.indexOf(';', a);
        if (q < 0 || q > e) { q = e; }
        k = path(a, q, 243 + nFP, 400 - nFP);
        if (k < 0 || nF > 99) { c = k === -1 ? 6 : 7; } else {
          W[143 + nF++] = t * 1024 + k;
          nFP += k;
          if (q === e) { break; }
          a = q + 1;
        }
      }
    }
    if (c) { break; }
    p = e;
  }
  // The helpers and this call's scope refer to each other (and each helper to its automatic prototype), which reference
  // counting cannot free: drop the links so a parse leaves no cyclic garbage (SPEC §8).
  num.prototype = path.prototype = null;
  num = path = null;
  c = c || (!(seen & 1) ? 3 : (!(seen & 2) || last >= nR ? 4 : (R[1] !== nB - 1 ? 5 : 0)));
  R[0] = c;
  if (c) { return c; }
  // Compact: header, stances, route, feature table, points.
  W[0] = nR + nB * 128 + nF * 8192;
  W[1] = nFP;
  q = 2 + Math.ceil(nB / 3);
  for (k = 0; k < nR + nF + nFP; k++) { W[q + k] = W[k < nR ? 23 + k : (k < nR + nF ? 143 + k - nR : 243 + k - nR - nF)]; }
  R[3] = q + nR + nF + nFP;
  return 0;
}
