// ABOUTME: Writes the text of the topo list card S[1] when it is a topo card (ext11.js writes the error and Help cards), loaded
// ABOUTME: by main.js when the list is shown. Built-in cards come from the card index below, so browsing never loads a topo file.
// Built-ins 1 (demo) and 4 (wall) are fictional and say so; 2 and 3 are schematic drawings of real routes.
function (S, str, R, user) {
  var D = '{{ DISPLAY_ID }}', NC = D === 'n' ? 14 : 15;
  var id = S[1] + (S[10] < 0 ? 1 : 0), grey = D === 'q' ? '#B3B3B3' : '#AAAAAA', rows = [], col = '#FFFFFF', c, g, n, i, t;
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
  var fit = function (t, m) {
    return t.length > m ? t.substring(0, m - 3) + '...' : t;
  };
  // Text of record tag in topo string s.
  var field = function (s, tag) {
    var a = s.indexOf('|' + tag), e = s.indexOf('|', a + 1);
    return a < 0 ? '' : s.substring(a + 2, e < 0 ? s.length : e);
  };
  put('#h2', S[1] + 1 + '/' + S[8], grey);
  put('#h1', '', col);
  put('#it', '', col);
  // The open topo from its string; the slot from the card main.js keeps for it (name|grade|pitches, ext0.js); the other
  // built-ins (ext4.js-ext7.js) from this card index of name~grade~pitches, which test T5 checks against the topo files.
  if (id === S[5]) {
    c = [field(str, 'N'), field(str, 'G'), S[6]];
  } else if (!id) {
    c = user.split('|');
  } else {
    c = '{{demoName}}~5c~4|Jägerhorn N~IV~1|Piccolo Fillar~6b~15|Fictional Wall~6c~30'.split('|')[id - 1].split('~');
  }
  put('#tn', fit(c[0], NC), col);
  g = c[1] ? c[1] + '  ' : '';
  n = +c[2];
  t = g + n + ' ' + (n === 1 ? '{{pOne}}' : '{{pMany}}');
  put('#h1', fit(t.length > NC ? g + n + ' {{pAbbr}}' : t, NC), col);
  put('#it', id % 3 === 1 ? '{{wFictional}}' : (id ? '{{wSchematic}}' : ''), grey);
  if (id !== S[5]) {
    rows = ['', '', '{{hintOpen}}'];
    col = grey;
  }
  for (i = 0; i < 6; i++) {
    put('#l' + i, rows[i] || '', col);
  }
  // The helpers and this call's scope refer to each other (and each helper to its automatic prototype), which reference
  // counting cannot free: drop the links so the call leaves no cyclic garbage (SPEC §8).
  put.prototype = fit.prototype = field.prototype = null;
  put = fit = field = null;
}
