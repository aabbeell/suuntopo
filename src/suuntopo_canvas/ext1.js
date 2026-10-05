// ABOUTME: STP1 parser, stage 1 of 2 (ext9.js is stage 2), loaded by main.js only when a topo is opened: checks the header,
// ABOUTME: size and text records, and fills R with the code, pitch count, hash, text spans (N G A D) and the pitch table.
function (s, R) {
  var L, p = 4, a, e, t, k, q, x, d, nP = 0, h = 0, seen = 0, c = 0, bad;
  R[0] = 1;
  if (typeof s !== 'string') { return 1; }
  L = s.length;
  if (L < 4 || s.substring(0, 4) !== 'STP1' || (L > 4 && s.charCodeAt(4) !== 124)) { return 1; }
  for (k = 0; k < L; k++) { h = (h + s.charCodeAt(k) * (k % 31 + 1)) % 65521; }
  R[0] = 7;
  if (L > 3500) { return 7; }
  // 1 when the text between a and e is longer than max characters or holds a control character, '<' or '&': setText reads
  // markup and character entities, so a name like 'A <b>B</b>' or 'A &amp; B' would not show as written.
  bad = function (a, e, max) {
    var ch;
    if (e - a > max) { return 1; }
    for (; a < e; a++) {
      ch = s.charCodeAt(a);
      if (ch < 32 || ch === 60 || ch === 38) { return 1; }
    }
    return 0;
  };
  for (k = 4; k < 12; k++) { R[k] = 0; }
  while (p < L) {
    a = p + 1;
    e = s.indexOf('|', a);
    if (e < 0) { e = L; }
    t = s.charAt(a++);
    c = 0;
    if (t === 'N') {
      c = seen || e === a || bad(a, e, 32) ? 2 : 0;
      seen = 1; R[4] = a; R[5] = e;
    } else if (t === 'W' || t === 'G' || t === 'A' || t === 'D') {
      c = bad(a, e, t === 'G' ? 10 : (t === 'W' ? 32 : 200)) ? 7 : 0;
      k = 'xxGxAxD'.indexOf(t) + 4;
      if (k > 4) { R[k] = a; R[k + 1] = e; }
    } else if (t === 'P') {
      // band~grade~len~info: pitch table entry band*1000+len, gradeStart*256+gradeLen, infoStart*256+infoLen.
      k = s.charCodeAt(a) - 48;
      q = s.indexOf('~', a + 2);
      x = 0;
      for (d = q + 1; s.charCodeAt(d) >= 48 && s.charCodeAt(d) <= 57; d++) { x = x * 10 + s.charCodeAt(d) - 48; }
      if (!(k >= 0 && k <= 4) || s.charAt(a + 1) !== '~' || q < 0 || q >= e || bad(a + 2, q, 10) || d - q < 2 || d - q > 4 || s.charAt(d) !== '~' || d >= e || bad(d + 1, e, 200) || nP > 59) {
        c = 5;
      } else {
        R[16 + 3 * nP] = k * 1000 + x;
        R[17 + 3 * nP] = (a + 2) * 256 + q - a - 2;
        R[18 + 3 * nP++] = (d + 1) * 256 + e - d - 1;
      }
    }
    if (c) { break; }
    p = e;
  }
  // bad and this call's scope refer to each other (and bad to its automatic prototype), which reference counting cannot
  // free: drop the links so a parse leaves no cyclic garbage (SPEC §8).
  bad.prototype = null;
  bad = null;
  if (c) { R[0] = c; return c; }
  R[0] = seen ? 0 : 2;
  R[1] = nP;
  R[2] = h || 1;
  return R[0];
}
