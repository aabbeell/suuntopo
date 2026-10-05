// ABOUTME: HW Test 3 — selector + topo viewer + info, no sync
// ABOUTME: UP/DOWN navigate, CROWN selects/toggles view, long CROWN back

var appMode = 0;
var selectorIdx = 0;
var topoIdx = 0;
var anchorIdx = 0;
var zoomLvl = 12;
var modeCounter = 0;
var TOPO_COUNT = 1;
var ANCHOR_COUNTS = [3];

function onLoad(_input, output) {
  modeCounter = 0; output.appMode = 0;
  output.selectorIdx = 0;
  output.topoIdx = 0;
  output.anchorIdx = 0;
  output.zoomLvl = 12;
}

function onEvent(_input, output, eventId) {
  switch (eventId) {
    case 1:
      if (appMode === 0) {
        if (selectorIdx > 0) { selectorIdx = selectorIdx - 1; }
      } else {
        if (anchorIdx < ANCHOR_COUNTS[topoIdx] - 1) { anchorIdx = anchorIdx + 1; }
      }
      break;
    case 3:
      if (appMode === 0) {
        if (selectorIdx < TOPO_COUNT - 1) { selectorIdx = selectorIdx + 1; }
      } else {
        if (anchorIdx > 0) { anchorIdx = anchorIdx - 1; }
      }
      break;
    case 5:
      if (appMode === 0) {
        topoIdx = selectorIdx;
        anchorIdx = 0;
        appMode = 1;
      } else if (appMode === 1) {
        appMode = 2;
      } else {
        appMode = 1;
      }
      break;
    case 6:
      if (appMode === 2) { appMode = 1; }
      else if (appMode === 1) { appMode = 0; }
      break;
  }
  modeCounter = modeCounter + 1; output.appMode = appMode * 100 + modeCounter;
  output.selectorIdx = selectorIdx;
  output.topoIdx = topoIdx;
  output.anchorIdx = anchorIdx;
  output.zoomLvl = zoomLvl;
}

function getUserInterface() {
  return { template: 't' };
}
