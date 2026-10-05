// ABOUTME: SUUNTOPO image variant — state management with topo selector
// ABOUTME: appMode: 0=selector, 1=topo map, 2=info panel. Max 2 topos (image limit)

var appMode = 0;
var selectorIdx = 0;
var topoIdx = 0;
var anchorIdx = 0;
var viewMode = 0;
var TOPO_COUNT = 2;
var WP_COUNTS = [17, 15];

function onLoad(_input, output) {
  output.appMode = 0;
  output.selectorIdx = 0;
  output.topoIdx = 0;
  output.anchorIdx = 0;
  output.viewMode = 0;
}

function onEvent(_input, output, eventId) {
  switch (eventId) {
    case 1: // up
      if (appMode === 0) {
        if (selectorIdx > 0) { selectorIdx--; }
      } else if (appMode === 1) {
        if (anchorIdx < WP_COUNTS[topoIdx] - 1) { anchorIdx++; }
      } else {
        if (anchorIdx < WP_COUNTS[topoIdx] - 1) { anchorIdx++; }
      }
      break;
    case 3: // down
      if (appMode === 0) {
        if (selectorIdx < TOPO_COUNT - 1) { selectorIdx++; }
      } else {
        if (anchorIdx > 0) { anchorIdx--; }
      }
      break;
    case 5: // crown
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
    case 6: // crown long — back to selector
      if (appMode !== 0) {
        appMode = 0;
      }
      break;
  }
  output.appMode = appMode;
  output.selectorIdx = selectorIdx;
  output.topoIdx = topoIdx;
  output.anchorIdx = anchorIdx;
  output.viewMode = appMode;
}

function getUserInterface() {
  return {
    template: 't'
  };
}
