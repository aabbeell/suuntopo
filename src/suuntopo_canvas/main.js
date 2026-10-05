// ABOUTME: Suuntopo main.js: owns the topo library (one settings slot plus built-in ext files), navigation, persistence,
// ABOUTME: lap advance and FIT logging, and writes the open topo's geometry chunk the template asks for to the d0..d14 outputs.

// S[0] view (0 Route, 1 Map, 2 Info), S[1] card, S[2] idx, S[3] page, S[4] pages, S[5] open topo (0 settings slot,
// 1-4 built-in, 9 none), S[6] pitches, S[7] stream id (content hash + 65536 * topo, 0 none), S[8] cards, S[9] imperial,
// S[10] slot parse code (-1 empty), S[11] built-in count, S[12] lap advance, S[13]-S[16] saved topo, view, idx and stream id
// (set by ext0.js). str is the open topo; user is the slot's card, 'name|grade|pitches' (ext0.js), when the slot parses.
var S, W, R, user = '', str = '', last = '';
var recording = 0, moved = 0, best = 0, holdIdx = -1, holdTicks = 0;
var IS_UI1 = '{{ IS_UI1 }}' === '1';

// Loads ext file i. Its function gets no prototype: a function and its automatic prototype refer to each other, which
// reference counting cannot free, so every load would leave garbage until a full mark-and-sweep (SPEC §8).
var ext = function (i) {
  var f = evalFile('{file_path}/ext' + i + '.js');
  f.prototype = null;
  return f;
};

// Opens topo t: parses it (ext1 then ext9) into W and R. Returns the parse code; when it fails, no topo is open (S[5] 9).
// A new stream id makes the template drop what it held and ask for the new topo's chunks.
// The slot is read from storage each time it opens (a long press or start-up): user keeps only its card.
var open = function (t) {
  var c;
  try {
    str = t ? ext(t + 3)() : String(localStorage.getItem('topo0') || '').trim();
    c = ext(1)(str, R) || ext(9)(str, W, R);
  } catch (e) {
    c = 9;
  }
  S[5] = c ? 9 : t;
  S[6] = c ? 0 : R[1];
  S[7] = c ? 0 : R[2] + 65536 * t;
  return c;
};

// Saves the position '2,view,topo,idx,pitches,id' when it changed: every write allocates a buffer the size of data.jsn.
var save = function () {
  var v = '2,' + S[0] + ',' + S[5] + ',' + S[2] + ',' + S[6] + ',' + S[7];
  if (!IS_UI1 && v !== last) {
    try {
      localStorage.setItem('sv', v);
      last = v;
    } catch (e) {}
  }
};

// Check word of stream chunk k: ties the 14 payload words to the chunk index and the stream id.
var check = function (k) {
  var h = S[7] * 7 + k * 131 + 1, i;
  for (i = 0; i < 14; i++) {
    h = (h * 31 + W[k * 14 + i]) % 16777213;
  }
  return h;
};

// Drawing state for the template: 64 + idx Map, 128 + idx the whole open topo on its card, 0 nothing.
var drawState = function () {
  if (S[5] > 8) {
    return 0;
  }
  return S[0] === 1 ? 64 + S[2] : (!S[0] && S[1] + (S[10] < 0 ? 1 : 0) === S[5] ? 128 + S[2] : 0);
};

// Pitch logged to the FIT file: the position on the slot topo or a schematic built-in once a press or lap of this session
// moved it (a position restored from an earlier exercise logs 0); the fictional built-ins (1 demo, 4 wall, so S[5] % 3 === 1)
// and no open topo log 0.
var logged = function () {
  return !moved || S[5] % 3 === 1 || S[5] > 8 ? 0 : Math.min(S[2], S[6]);
};

// Start-up: state arrays, then ext0.js reads the slot and the saved position and opens the saved topo or the default one.
// When nothing is open after it (ext0.js did not load, or no topo did), the demo opens on card 0. UI1 watches only show the
// not-supported template, so they stop after S (S[5] 9: nothing open, nothing streamed or saved).
var start = function () {
  S = new Float32Array(17);
  S[5] = 9;
  S[8] = 6;
  S[10] = -1;
  S[11] = 4;
  S[13] = 9;
  if (IS_UI1) {
    return;
  }
  W = new Float32Array(644);
  R = new Float32Array(200);
  try {
    user = ext(0)(S, W, R, localStorage, ext, open);
  } catch (e) {}
  if (S[5] > 8) {
    open(1);
  }
};

// Events: 1/2/3 long press up/down/middle (navigation in ext2.js, then saved), 4 lap advance (from onLap, not saved: the
// lap popup is a busy moment for memory; the next press, pause or end saves), 5/6 metric/imperial, 3000000 template
// activated. 4000000 + n (chunk requests) are answered in onEvent and never reach press.
// Text is rewritten (ext3.js topo cards, ext11.js the error and Help cards, ext8.js Map, ext10.js Info) for presses, units
// and activation. A file that fails to load leaves the state as it was (navigation) or skips the text (writers); onEvent
// writes the outputs in any case.
var press = function (eventId) {
  var o = -1, p = S[5], i = S[2];
  if (eventId >= 3000000) {
    // Activation: only the text below.
  } else if (eventId > 4) {
    S[9] = eventId - 5;
  } else {
    try {
      o = ext(2)(S, eventId);
    } catch (e) {}
    if (o >= 0) {
      if (open(o)) {
        // The topo did not load: stay on the list at its card and open the topo that was open again, at its position.
        S[0] = 0;
        S[2] = p < 9 && !open(p) ? i : 0;
      } else {
        S[0] = 1;
        S[2] = 0;
      }
    }
    if (o >= 0 || S[2] !== i) {
      moved = 1;
    }
    if (eventId < 4) {
      save();
    }
  }
  try {
    ext(S[0] ? (S[0] > 1 ? 10 : 8) : (S[1] + (S[10] < 0 ? 1 : 0) > S[11] || (!S[1] && S[10] > 0) ? 11 : 3))(S, str, R, user);
  } catch (e) {}
};

function onLoad(input, output) {
  start();
  output.ms = drawState();
  output.mh = S[7];
  output.pitch = 0;
}

function onEvent(input, output, eventId) {
  // Chunk request n = seq * 64 + k from the template: chunk k of the open topo to d0..d13, its check word to d14 and n to
  // ck last, so the template's ck callback reads a complete chunk. A chunk past the topo's end is not written.
  var k = (eventId - 4000000) % 64, b = k * 14;
  if (eventId >= 4000000) {
    if (S[5] < 9 && b < R[3]) {
      output.d0 = W[b];
      output.d1 = W[b + 1];
      output.d2 = W[b + 2];
      output.d3 = W[b + 3];
      output.d4 = W[b + 4];
      output.d5 = W[b + 5];
      output.d6 = W[b + 6];
      output.d7 = W[b + 7];
      output.d8 = W[b + 8];
      output.d9 = W[b + 9];
      output.d10 = W[b + 10];
      output.d11 = W[b + 11];
      output.d12 = W[b + 12];
      output.d13 = W[b + 13];
      output.d14 = check(k);
      output.ck = eventId - 4000000;
    }
    return;
  }
  press(eventId);
  output.ms = drawState();
  output.mh = S[7];
  output.pitch = logged();
}

// A lap advances one pitch on the Map when the setting is On and a topo with pitches is open (ext2.js, event 4).
function onLap(input, output) {
  if (S[12] && S[5] < 9 && S[6] > 0) {
    press(4);
    output.ms = drawState();
    output.pitch = logged();
  }
}

function onAutoLap(input, output) {
  // A distance autolap is not a belay: the position does not move.
}

function evaluate(input, output) {
  var cur;
  // The logged pitch while recording; 0 (Start, fictional, not moved) never raises best.
  cur = recording ? logged() : -1;
  holdTicks = cur >= 0 && cur === holdIdx ? holdTicks + 1 : 1;
  holdIdx = cur;
  if (holdTicks >= 30 && holdIdx > best) {
    best = holdIdx;
  }
}

function onExerciseStart(input, output) {
  recording = 1;
}

function onExerciseContinue(input, output) {
  recording = 1;
}

function onExercisePause(input, output) {
  recording = 0;
  save();
}

function onExerciseEnd(input, output) {
  recording = 0;
  save();
}

function getSummaryOutputs(input, output) {
  return best > 0 ? [{ id: 'p', name: '{{sumPitch}}', format: 'Count_Twodigits', value: best }] : [];
}

function getUserInterface() {
  return { template: IS_UI1 ? 'u' : 't' };
}
