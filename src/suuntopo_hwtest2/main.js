// ABOUTME: HW Test 2 — tests multi-output subscribe pattern
// ABOUTME: Same output vars as full suuntopo_canvas app

var appMode = 0;
var selectorIdx = 0;
var topoIdx = 0;
var anchorIdx = 0;
var zoomLvl = 12;

function onLoad(_input, output) {
  output.appMode = 0;
  output.selectorIdx = 0;
  output.topoIdx = 0;
  output.anchorIdx = 0;
  output.zoomLvl = 12;
}

function onEvent(_input, output, eventId) {
  if (eventId === 1) {
    if (anchorIdx < 2) { anchorIdx = anchorIdx + 1; }
  } else if (eventId === 2) {
    if (anchorIdx > 0) { anchorIdx = anchorIdx - 1; }
  }
  output.appMode = appMode;
  output.selectorIdx = selectorIdx;
  output.topoIdx = topoIdx;
  output.anchorIdx = anchorIdx;
  output.zoomLvl = zoomLvl;
}

function getUserInterface() {
  return { template: 't' };
}
