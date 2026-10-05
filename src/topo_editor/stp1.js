// ABOUTME: STP1 encoder for the topo editor: turns an editor project into the one-line topo the Suuntopo watch app reads,
// ABOUTME: with text sanitising, grade bands, the slot (1500 B) and built-in file (3500 B) limits. Runs in the browser and in Node.
(function (root) {
  'use strict';

  var SLOT_BYTES = 1500;
  var BUILTIN_BYTES = 3500;
  var FEATURE_LETTER = {
    roof: 'r', overhang: 'o', ledge: 'l', crack: 'k', chimney: 'h', corner: 'd', arete: 'a', ramp: 'p', couloir: 'g',
    slab: 's', contour: 'c', contour_poly: 'q', bolt: 'b', piton: 'n', rappel: 'v', chockstone: 'x', tree: 't', grass: 'w', cross: 'z'
  };
  var POINT_TYPES = ['bolt', 'piton', 'rappel', 'chockstone', 'tree', 'grass', 'cross'];
  // Patterned lines (ticks, zig-zag). The watch draws a piece of one longer than two screen widths on the zoomed-in Map
  // (466 units at the Map's largest zoom) as a plain line, which bounds its drawing work (watch SPEC §7).
  var PATTERNED_TYPES = ['roof', 'overhang', 'crack', 'ramp'];
  var PATTERN_MAX = 466;

  // Grade ladders per system, easiest first, and the index where bands 2, 3 and 4 start.
  // Band 1 easy: UIAA <= IV+, French <= 4c, YDS <= 5.6; 2 moderate: up to VI-, 5c, 5.9; 3 hard: up to VII, 6b, 5.10d; 4 above.
  var LADDERS = {
    uiaa: { steps: ['I', 'II', 'III', 'IV-', 'IV', 'IV+', 'V-', 'V', 'V+', 'VI-', 'VI', 'VI+', 'VII-', 'VII', 'VII+', 'VIII-', 'VIII', 'VIII+', 'IX', 'X', 'XI', 'XII'], starts: [6, 10, 14] },
    french: { steps: ['1', '2', '3', '4a', '4b', '4c', '5a', '5b', '5c', '6a', '6a+', '6b', '6b+', '6c', '6c+', '7a', '7a+', '7b', '7b+', '7c', '7c+', '8a', '8b', '8c', '9a'], starts: [6, 9, 12] },
    yds: { steps: ['5.0', '5.1', '5.2', '5.3', '5.4', '5.5', '5.6', '5.7', '5.8', '5.9', '5.10a', '5.10b', '5.10c', '5.10d', '5.11a', '5.11b', '5.11c', '5.11d', '5.12a', '5.13a', '5.14a', '5.15a'], starts: [7, 10, 14] }
  };

  function utf8Bytes(s) {
    return new TextEncoder().encode(s).length;
  }

  // Text the watch can store: NFC, no control characters, no record separator, trimmed; built-in files also avoid quotes.
  // The watch's setText reads markup and character entities, so its parser rejects '<' and '&' (E2, E5, E7): '<' becomes
  // the single guillemet '\u2039' and '&' becomes '+'. A '>' without a '<' is plain text and stays.
  function clean(s, builtin) {
    var t = String(s == null ? '' : s).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\|/g, '/')
      .replace(/</g, '\u2039').replace(/&/g, '+').trim();
    if (builtin) t = t.replace(/'/g, '’').replace(/\\/g, '/');
    return t;
  }

  // Difficulty band 0-4 of grade in system (uiaa, french, yds, other). Unknown grades are band 0.
  function gradeBand(grade, system) {
    var ladder = LADDERS[system];
    var g = String(grade || '').trim().replace(/−/g, '-');
    if (!ladder || !g) return 0;
    // Mixed grades like 'IV/V' or '6a/6b' take the harder part.
    var parts = g.split('/');
    var best = -1;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      p = system === 'uiaa' ? p.toUpperCase() : p.toLowerCase();
      if (system === 'yds') {
        // 5.10 means 5.10a; 5.12c and harder letters map to the 5.12a step; a trailing + or - is ignored.
        p = p.replace(/[+-]$/, '');
        if (/^5\.1\d$/.test(p)) p += 'a';
        if (/^5\.1[2-5][b-d]$/.test(p)) p = p.slice(0, 4) + 'a';
      }
      var idx = ladder.steps.indexOf(p);
      if (idx < 0) idx = ladder.steps.indexOf(p.replace(/[+-]$/, ''));
      best = Math.max(best, idx);
    }
    if (best < 0) return 0;
    var s = ladder.starts;
    return best < s[0] ? 1 : (best < s[1] ? 2 : (best < s[2] ? 3 : 4));
  }

  function pathText(points) {
    var out = '';
    var px = 0;
    var py = 0;
    for (var i = 0; i < points.length; i++) {
      var x = Math.round(points[i][0]);
      var y = Math.round(points[i][1]);
      out += i ? ',' + (x - px) + ',' + (y - py) : x + ',' + y;
      px = x;
      py = y;
    }
    return out;
  }

  // Editor feature to watch paths (rect to 2-point line along its long side, slab rect to a closed 4-point outline).
  function featurePaths(f) {
    if (f.points) return [f.points];
    if (f.x1 !== undefined) return [[[f.x1, f.y1], [f.x2, f.y2]]];
    if (f.w !== undefined && f.h !== undefined) {
      if (f.type === 'slab') return [[[f.x, f.y], [f.x + f.w, f.y], [f.x + f.w, f.y + f.h], [f.x, f.y + f.h]]];
      return f.w >= f.h ? [[[f.x, f.y + f.h / 2], [f.x + f.w, f.y + f.h / 2]]] : [[[f.x + f.w / 2, f.y], [f.x + f.w / 2, f.y + f.h]]];
    }
    if (f.x !== undefined) return [[[f.x, f.y]]];
    return [];
  }

  // Route vertex index nearest to (x, y).
  function nearestVertex(route, x, y) {
    var best = -1;
    var bestD = Infinity;
    for (var i = 0; i < route.length; i++) {
      var d = (route[i][0] - x) * (route[i][0] - x) + (route[i][1] - y) * (route[i][1] - y);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  // Anchors sorted by route order, each with its route vertex index. The first is the start stance; anchor k ends pitch k.
  function stances(project) {
    var route = project.route || [];
    var seen = {};
    var out = [];
    (project.anchors || []).forEach(function (a) {
      var v = nearestVertex(route, a.x, a.y);
      if (v >= 0 && !seen[v]) {
        seen[v] = 1;
        out.push({ vertex: v, anchor: a });
      }
    });
    out.sort(function (p, q) { return p.vertex - q.vertex; });
    return out;
  }

  // Encodes project. opts.builtin applies the built-in file rules. Returns { text, bytes, limit, errors, warnings }.
  function encode(project, opts) {
    var builtin = !!(opts && opts.builtin);
    var errors = [];
    var warnings = [];
    var system = project.gradeSystem || 'uiaa';
    var route = project.route || [];
    var name = clean(project.name, builtin);
    var rec = ['STP1', 'N' + name];
    var limits = [['W', project.wall, 32], ['G', project.grade, 10], ['A', project.approach, 200], ['D', project.descent, 200]];
    if (!name.length || name.length > 32) errors.push('Name must be 1 to 32 characters (E2).');
    limits.forEach(function (l) {
      var t = clean(l[1], builtin);
      if (l[0] === 'G') t = t.replace(/~/g, '-');
      if (t.length > l[2]) errors.push(l[0] + ' text longer than ' + l[2] + ' characters (E7).');
      if (t) rec.push(l[0] + t);
    });
    if (route.length < 2 || route.length > 120) errors.push('The route needs 2 to 120 points (E3).');
    rec.push('R' + pathText(route));
    var st = stances(project);
    if (st.length < 2 || st.length > 61) errors.push('Mark 2 to 61 belays on the route, start included (E4).');
    rec.push('B' + st.map(function (s) { return s.vertex; }).join(','));
    if (st.length && (st[0].anchor.grade || st[0].anchor.info)) warnings.push('The first belay is the start: its grade and notes are not used (pitch k is described on the belay that ends it).');
    for (var k = 1; k < st.length; k++) {
      var a = st[k].anchor;
      var grade = clean(a.grade, builtin).replace(/~/g, '-');
      var len = parseInt(String(a.length || '').replace(/[^0-9]/g, ''), 10) || 0;
      var band = a.band !== undefined && a.band !== '' && a.band !== 'auto' ? Number(a.band) : gradeBand(grade, system);
      var info = clean(a.info, builtin);
      if (grade.length > 10) errors.push('Pitch ' + k + ': grade longer than 10 characters (E5).');
      if (len > 999) errors.push('Pitch ' + k + ': length over 999 m (E5).');
      if (info.length > 200) errors.push('Pitch ' + k + ': notes longer than 200 characters (E5).');
      rec.push('P' + band + '~' + grade + '~' + len + '~' + info);
    }
    // Terrain grouped by type: one F record per type.
    var groups = {};
    var order = [];
    var paths = 0;
    var points = 0;
    (project.features || []).forEach(function (f) {
      var letter = FEATURE_LETTER[f.type];
      if (!letter) {
        if (f.type === 'label') warnings.push('Labels are editor-only and are not sent to the watch.');
        return;
      }
      featurePaths(f).forEach(function (p) {
        if (!p.length) return;
        if (POINT_TYPES.indexOf(f.type) < 0 && p.length < 2) return;
        for (var i = 1; PATTERNED_TYPES.indexOf(f.type) >= 0 && i < p.length; i++) {
          if (Math.sqrt((p[i][0] - p[i - 1][0]) * (p[i][0] - p[i - 1][0]) + (p[i][1] - p[i - 1][1]) * (p[i][1] - p[i - 1][1])) > PATTERN_MAX) {
            warnings.push('A crack, roof, overhang or ramp piece longer than ' + PATTERN_MAX + ' units shows as a plain line when the watch zooms in: draw it as shorter pieces.');
          }
        }
        if (!groups[letter]) { groups[letter] = []; order.push(letter); }
        groups[letter].push(pathText(p));
        paths++;
        points += p.length;
      });
    });
    if (groups.q) warnings.push('Contour fills are not drawn on the watch.');
    order.forEach(function (letter) { rec.push('F' + letter + groups[letter].join(';')); });
    if (order.length > 40 || paths > 100 || points > 400) errors.push('Too much terrain: at most 40 types, 100 shapes and 400 points (E7).');
    var all = route.slice();
    (project.features || []).forEach(function (f) {
      featurePaths(f).forEach(function (p) { all = all.concat(p); });
    });
    all.forEach(function (p) {
      if (Math.round(p[0]) < 0 || Math.round(p[0]) > 4095 || Math.round(p[1]) < 0 || Math.round(p[1]) > 4095) {
        errors.push('A point lies outside 0..4095 (E6).');
      }
    });
    var text = rec.join('|');
    var bytes = utf8Bytes(text);
    var limit = builtin ? BUILTIN_BYTES : SLOT_BYTES;
    if (bytes > limit) errors.push('The topo is ' + bytes + ' bytes; the ' + (builtin ? 'built-in file' : 'Topo line setting') + ' holds ' + limit + ' (E7).');
    if (name.length > 15) warnings.push('Names longer than 15 characters are shortened on the watch.');
    return { text: text, bytes: bytes, limit: limit, errors: errors.filter(function (e, i, a) { return a.indexOf(e) === i; }), warnings: warnings.filter(function (e, i, a) { return a.indexOf(e) === i; }) };
  }

  // A built-in topo file for the watch app (ext4.js-ext7.js style): one function returning the topo line.
  function builtinFile(text, title) {
    var t = clean(title || 'topo', false).replace(/[\r\n]/g, ' ');
    return '// ABOUTME: Built-in topo: ' + t + ' (schematic). Loaded by main.js with evalFile.\n' +
      '// ABOUTME: Returns the topo as one STP1 line. Exported from the topo editor.\n' +
      'function () {\n  return \'' + text + '\';\n}\n';
  }

  var api = { encode: encode, gradeBand: gradeBand, utf8Bytes: utf8Bytes, clean: clean, stances: stances, builtinFile: builtinFile, SLOT_BYTES: SLOT_BYTES, BUILTIN_BYTES: BUILTIN_BYTES };
  root.STP1 = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
