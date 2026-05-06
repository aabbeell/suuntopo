// ABOUTME: Minimal hardware test — topo viewer with navigation
// ABOUTME: UP=next anchor, DOWN=prev anchor

var cur = 0;

function onLoad(_input, output) {
  output.cnt = 0;
}

function onEvent(_input, output, eventId) {
  if (eventId === 1) {
    if (cur < 2) { cur = cur + 1; }
  } else if (eventId === 2) {
    if (cur > 0) { cur = cur - 1; }
  }
  output.cnt = cur;
}

function getUserInterface() {
  return { template: 't' };
}
