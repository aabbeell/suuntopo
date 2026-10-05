// ABOUTME: Writes the Info text of the open topo for the position S[2]: the pitch title (or Approach, Descent) and page S[3]
// ABOUTME: of the notes (at most 200 characters), word-wrapped into lines of CPL characters, 6 a page. Sets the page count S[4].
function (S, str, R) {
  var D = '{{ DISPLAY_ID }}', mip = D !== 'q', CPL = D === 'n' ? 17 : (D === 'o' ? 20 : 18), n = S[6], k = S[2];
  var a = R[13 + 3 * k], pitch = k >= 1 && k <= n, lines = [], t, b, i;
  var put = function (el, t, c) {
    var v = t && t.split(' ').join('') ? 'VISIBLE' : 'HIDDEN';
    setStyle(el, 'visibility', v);
    setStyle(el + ' *', 'visibility', v);
    if (v === 'VISIBLE') {
      setText(el, t);
      setStyle(el, 'color', c);
    }
  };
  // Text at packed span v (start * 256 + length).
  var span = function (v) {
    return str.substr(Math.floor(v / 256), v % 256);
  };
  t = str.substring(R[4], R[5]);
  put('#tn', t.length > (D === 'n' ? 14 : 15) ? t.substring(0, D === 'n' ? 11 : 12) + '...' : t, '#FFFFFF');
  t = pitch ? '{{pAbbr}}' + k + '  ' + span(R[14 + 3 * k]) + (a % 1000 ? '  ' + (S[9] ? Math.round(a % 1000 * 3.281) + ' ft' : a % 1000 + ' m') : '') : (k ? '{{wDescent}}' : '{{wApproach}}');
  put('#it', t.length > CPL ? t.substring(0, CPL - 3) + '...' : t, pitch ? (mip ? '#AAAAAA#55AAFF#FFFFFF#FFFF00#FFAA00' : '#B3B3B3#5AC8FA#FFFFFF#FFD400#FF9500').substr(7 * Math.floor(a / 1000), 7) : '#FFFFFF');
  put('#h1', '', '#FFFFFF');
  t = pitch ? span(R[15 + 3 * k]) : (k ? str.substring(R[10], R[11]) : str.substring(R[8], R[9]));
  while (t.length) {
    if (t.charAt(0) === ' ') {
      t = t.substring(1);
    } else {
      b = t.length > CPL ? t.lastIndexOf(' ', CPL) : t.length;
      lines.push(t.substring(0, b > 0 ? b : CPL));
      t = t.substring(b > 0 ? b : CPL);
    }
  }
  S[4] = Math.max(1, Math.ceil(lines.length / 6));
  S[3] = Math.min(S[3], S[4] - 1);
  lines = lines.length ? lines.slice(S[3] * 6, S[3] * 6 + 6) : ['', '{{noNotes}}'];
  // The page of the notes when they take more than one; the title above already names the pitch.
  put('#h2', S[4] > 1 ? '{{wNotes}} ' + (S[3] + 1) + '/' + S[4] : '', mip ? '#AAAAAA' : '#B3B3B3');
  for (i = 0; i < 6; i++) {
    put('#l' + i, lines[i] || '', lines[0] ? '#FFFFFF' : (mip ? '#AAAAAA' : '#B3B3B3'));
  }
  // The helpers and this call's scope refer to each other (and each helper to its automatic prototype), which reference
  // counting cannot free: drop the links so the call leaves no cyclic garbage (SPEC §8).
  put.prototype = span.prototype = null;
  put = span = null;
}
