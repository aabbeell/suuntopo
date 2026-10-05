// ABOUTME: Writes the Map text of the open topo (str, with spans and the pitch table in R) for the position S[2],
// ABOUTME: loaded by main.js when the Map is shown: the position, then grade and length of the pitch (or route totals).
function (S, str, R) {
  var D = '{{ DISPLAY_ID }}', mip = D !== 'q', NC = D === 'n' ? 14 : 15, n = S[6], k = S[2], a = R[13 + 3 * k];
  var pitch = k >= 1 && k <= n, sum = 0, i, t;
  var put = function (el, t, c) {
    var v = t && t.split(' ').join('') ? 'VISIBLE' : 'HIDDEN';
    setStyle(el, 'visibility', v);
    setStyle(el + ' *', 'visibility', v);
    if (v === 'VISIBLE') {
      setText(el, t);
      setStyle(el, 'color', c);
    }
  };
  var fit = function (t) {
    return t.length > NC ? t.substring(0, NC - 3) + '...' : t;
  };
  var len = function (m) {
    return m ? '  ' + (S[9] ? Math.round(m * 3.281) + ' ft' : m + ' m') : '';
  };
  for (i = 1; i <= n; i++) {
    sum += R[13 + 3 * i] % 1000;
  }
  // Pitch: grade and length in the band colour. Start and Top: route grade and total length.
  t = pitch ? str.substr(Math.floor(R[14 + 3 * k] / 256), R[14 + 3 * k] % 256) + len(a % 1000) : str.substring(R[6], R[7]) + len(sum);
  // The position, which every hold changes, in the large white top line; the topo's name is on its list card and in Info.
  put('#tn', k < 1 ? '{{wStart}}' : (k > n ? '{{wTop}}' : '{{wPitch}} ' + k + '/' + n), '#FFFFFF');
  put('#h1', fit(t), pitch ? (mip ? '#AAAAAA#55AAFF#FFFFFF#FFFF00#FFAA00' : '#B3B3B3#5AC8FA#FFFFFF#FFD400#FF9500').substr(7 * Math.floor(a / 1000), 7) : '#FFFFFF');
  put('#h2', '', '#FFFFFF');
  put('#it', '', '#FFFFFF');
  for (i = 0; i < 6; i++) {
    put('#l' + i, '', '#FFFFFF');
  }
  // The helpers and this call's scope refer to each other (and each helper to its automatic prototype), which reference
  // counting cannot free: drop the links so the call leaves no cyclic garbage (SPEC §8).
  put.prototype = fit.prototype = len.prototype = null;
  put = fit = len = null;
}
