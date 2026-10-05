// ABOUTME: Writes the text of the topo list's broken-slot error card and its two Help cards (card S[1]), loaded by main.js
// ABOUTME: when one of them is shown; ext3.js writes the topo cards, so each press compiles only the writer it needs.
function (S, str, R, user) {
  var D = '{{ DISPLAY_ID }}', CPL = D === 'n' ? 17 : (D === 'o' ? 20 : 18);
  var id = S[1] + (S[10] < 0 ? 1 : 0), grey = D === 'q' ? '#B3B3B3' : '#AAAAAA', rows = [], col = '#FFFFFF', i, b, t;
  // Text t in colour c; blank text hides the element (setText needs visible, non-blank text).
  var put = function (el, t, c) {
    var v = t && t.split(' ').join('') ? 'VISIBLE' : 'HIDDEN';
    setStyle(el, 'visibility', v);
    setStyle(el + ' *', 'visibility', v);
    if (v === 'VISIBLE') {
      setText(el, t);
      setStyle(el, 'color', c);
    }
  };
  put('#h2', S[1] + 1 + '/' + S[8], grey);
  put('#h1', '', col);
  put('#it', '', col);
  if (id > S[11]) {
    // Help 1: the buttons; Help 2: how to load a topo.
    put('#tn', '{{wHelp}}', col);
    rows = (id > S[11] + 1 ? '{{help1}}|{{help2}}|{{help3}}|{{help4}}|{{help5}}|{{help6}}' : '{{keys1}}|{{keys2}}|{{keys3}}|{{keys4}}|{{keys5}}|{{keys6}}').split('|');
  } else {
    // Broken slot: the error text, with what to do (the editor fixes E2-E5 and E7), word-wrapped at CPL, then the code.
    put('#tn', '{{wTopo}}', col);
    t = '{{e1}}|{{e2}}|{{e3}}|{{e4}}|{{e5}}|{{e6}}|{{e7}}||{{e9}}'.split('|')[S[10] - 1];
    t += (S[10] > 1 && S[10] < 8 && S[10] !== 6 ? ' {{eFix}}' : '') + ' (E' + S[10] + ')';
    while (t.length > CPL) {
      b = t.lastIndexOf(' ', CPL);
      rows.push(t.substring(0, b > 0 ? b : CPL));
      t = t.substring(b > 0 ? b + 1 : CPL);
    }
    rows.push(t);
    col = D === 'q' ? '#FF7A59' : '#FF5555';
  }
  for (i = 0; i < 6; i++) {
    put('#l' + i, rows[i] || '', col);
  }
  // put and this call's scope refer to each other (and put to its automatic prototype), which reference counting cannot
  // free: drop the links so the call leaves no cyclic garbage (SPEC §8).
  put.prototype = null;
  put = null;
}
