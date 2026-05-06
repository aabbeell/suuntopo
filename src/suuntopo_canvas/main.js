// ABOUTME: SUUNTOPO v2 — state management with topo selector + topo viewer + info panel
// ABOUTME: appMode: 0=selector, 1=topo map, 2=info. anchorIdx = route waypoint index (not pitch)

var appMode = 0;
var selectorIdx = 0;
var topoIdx = 0;
var anchorIdx = 0;
var zoomLvl = 12;
var TOPO_COUNT = 1;
// Route point counts per topo (for navigation bounds)
var ROUTE_COUNTS = [7];

function onLoad(_input, output) {
  output.appMode = 0;
  output.selectorIdx = 0;
  output.topoIdx = 0;
  output.anchorIdx = 0;
  output.zoomLvl = 12;

  // Check if synced topos exist and update counts
  // Try getItem+JSON.parse (settings sync) then getObject (data.json objects)
  try {
    var si;
    for (si = 0; si < 3; si++) {
      var synced = null;
      try {
        var str = localStorage.getItem('topo' + si);
        if (str && str.length > 2) { synced = JSON.parse(str); }
      } catch(e2) { /* parse failed */ }
      if (!synced) {
        try { synced = localStorage.getObject('topo' + si); } catch(e3) { /* no object */ }
      }
      if (synced && synced.route) {
        if (TOPO_COUNT <= 1 + si) {
          TOPO_COUNT = 1 + si + 1;
        }
        ROUTE_COUNTS[1 + si] = synced.route.length;
      }
    }
  } catch(e) { /* localStorage not available */ }
}

function onEvent(_input, output, eventId) {
  var maxWP = ROUTE_COUNTS[topoIdx] || 10;
  switch (eventId) {
    case 1: // up — next waypoint (towards summit)
      if (appMode === 0) {
        if (selectorIdx > 0) { selectorIdx--; }
      } else {
        if (anchorIdx < maxWP - 1) { anchorIdx++; }
      }
      break;
    case 2: // up long — zoom in
      if (appMode === 1) {
        if (zoomLvl < 30) { zoomLvl = zoomLvl + 2; }
      }
      break;
    case 3: // down — prev waypoint (towards base)
      if (appMode === 0) {
        if (selectorIdx < TOPO_COUNT - 1) { selectorIdx++; }
      } else {
        if (anchorIdx > 0) { anchorIdx--; }
      }
      break;
    case 4: // down long — zoom out
      if (appMode === 1) {
        if (zoomLvl > 5) { zoomLvl = zoomLvl - 2; }
      }
      break;
    case 5: // crown — select topo or toggle view
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
  output.zoomLvl = zoomLvl;
}

function getUserInterface() {
  return {
    template: 't'
  };
}
