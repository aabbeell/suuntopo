// ABOUTME: Start-up for main.js onLoad: reads the settings slot, lap setting and saved position (dbg first, for simulator
// ABOUTME: fixtures), parses the slot topo into S[10], then opens the saved topo (S[13]-S[16]) or the default one.
// main.js passes its localStorage as ls: in the simulator an evalFile'd function does not see the app's storage. It also
// passes its own file loader as ext (the reference documents evalFile for main.js only, so no ext file calls it) and its
// open(t), which loads and parses topo t.
function (S, W, R, ls, ext, open) {
  var user = '', p = '', s, t, end;
  try {
    // A pasted topo often carries a trailing newline or a leading BOM: trim() removes both.
    user = String(ls.getItem('topo0') || '').trim();
    p = ls.getItem('dbg') || ls.getItem('sv') || '';
    // An enum is stored as its index, an integer once the phone app syncs it (getItem then returns null).
    t = ls.getItem('lapAdv');
    if (t === null && ls.getObject) {
      t = ls.getObject('lapAdv');
    }
    S[12] = Number(t) === 1 ? 1 : 0;
  } catch (e) {}
  S[10] = -1;
  if (user) {
    try {
      S[10] = ext(1)(user, R) || ext(9)(user, W, R);
    } catch (e) {
      S[10] = 9;
    }
  }
  // Cards: the slot (when not empty), the built-ins and two Help cards.
  S[8] = S[11] + 2 + (S[10] < 0 ? 0 : 1);
  // main.js keeps only the slot's card, 'name|grade|pitches' ('|' cannot occur in a record's text), and reads the slot
  // again when it opens it, so a full slot does not stay in memory while another topo is open.
  // The grade is the first G record, as ext3.js reads it from an open topo.
  s = user;
  t = s.indexOf('|G');
  end = s.indexOf('|', t + 1);
  user = S[10] ? '' : s.substring(R[4], R[5]) + '|' + (t < 0 ? '' : s.substring(t + 2, end < 0 ? s.length : end)) + '|' + R[1];
  s = '';
  // Saved position '2,view,topo,idx,pitches,id'; topo 0 is the settings slot, 1-4 the built-ins.
  p = String(p).split(',');
  t = Number(p[2]);
  S[13] = 9;
  if (p.length === 6 && p[0] === '2' && (t === 0 ? S[10] === 0 : t >= 1 && t <= S[11]) && Number(p[1]) >= 0 && Number(p[1]) <= 2 && Number(p[3]) >= 0) {
    S[13] = t;
    S[14] = Math.floor(Number(p[1]));
    S[15] = Math.floor(Number(p[3]));
    S[16] = Number(p[5]);
  }
  // The saved topo, or the default one: the slot, or the demo when the slot is empty or broken.
  if (S[13] > 8 || open(S[13])) {
    S[13] = 9;
    open(S[10] ? 1 : 0);
  } else if (S[16] === S[7]) {
    // A finished route (saved at Top) starts again at Start.
    S[0] = S[14];
    S[2] = S[15] > S[6] ? 0 : S[15];
  }
  // The open topo's card; the error card when the slot is broken and no saved topo was restored; the first card when
  // nothing could be opened.
  S[1] = S[5] > 8 || (S[10] > 0 && S[13] > 8) ? 0 : S[5] - (S[10] < 0 ? 1 : 0);
  return user;
}
