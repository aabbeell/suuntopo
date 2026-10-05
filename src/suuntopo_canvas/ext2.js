// ABOUTME: Long-press navigation for Suuntopo, loaded by main.js per press: b = 1 up, 2 down, 3 middle, 4 lap advance.
// ABOUTME: Updates the state array S in place and returns the topo id main.js must open, or -1.
function (S, b) {
  var id = S[1] + (S[10] < 0 ? 1 : 0);
  // Lap advance (main.js checks the setting and an open topo): next pitch, up to Top, on the Map.
  if (b > 3) {
    S[2] = Math.min(S[2] + 1, S[6] + 1);
    S[0] = 1;
    S[3] = 0;
    S[1] = S[5] - (S[10] < 0 ? 1 : 0);
    return -1;
  }
  if (!S[0]) {
    if (b < 3) {
      id = S[1] + (b === 1 ? 1 : -1);
      if (id >= 0 && id < S[8]) {
        S[1] = id;
      }
      return -1;
    }
    // Middle on a topo card opens it; on a Help card it returns to the open topo's Map, if any. On the broken slot's error
    // card it moves to the open topo's card, where its name and label show that it is not the pasted topo (with a broken
    // slot the card index is the topo id).
    if (!id && S[10] > 0) {
      if (S[5] < 9) {
        S[1] = S[5];
      }
      return -1;
    }
    if (id > S[11]) {
      if (S[5] < 9) {
        S[0] = 1;
        S[3] = 0;
      }
      return -1;
    }
    S[0] = 1;
    S[3] = 0;
    return id === S[5] ? -1 : id;
  }
  if (b === 1) {
    if (S[2] <= S[6]) {
      S[2]++;
      S[3] = 0;
    }
  } else if (b === 2) {
    if (S[2] > 0) {
      S[2]--;
      S[3] = 0;
    }
  } else if (S[0] === 1) {
    S[0] = 2;
    S[3] = 0;
  } else if (S[3] + 1 < S[4]) {
    S[3]++;
  } else {
    S[0] = 0;
    S[1] = S[5] > 8 ? 0 : S[5] - (S[10] < 0 ? 1 : 0);
  }
  return -1;
}
