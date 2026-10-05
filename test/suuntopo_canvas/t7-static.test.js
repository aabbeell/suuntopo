// ABOUTME: T7: static checks on t.html, u.html, main.js and the ext files: ES5 only (acorn), ABOUTME headers, no clicks overridden,
// ABOUTME: lockable long presses, an allocation-free renderer, and main.js storage and output rules from the deep-dive research.

'use strict';
const assert = require('assert');
const os = require('os');
const path = require('path');
const h = require('./lib/harness');

const acorn = require(path.join(os.homedir(), '.vscode/extensions/suunto.suuntoplus-editor-1.42.0/node_modules/acorn'));

const parse5 = (code, where) => {
  try {
    return acorn.parse(code, { ecmaVersion: 5, sourceType: 'script', allowReturnOutsideFunction: true });
  } catch (err) {
    throw new Error(where + ' is not ES5: ' + err.message);
  }
};

function walk(node, visit, parents) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, parents || []);
  for (const key of Object.keys(node)) {
    const v = node[key];
    const next = (parents || []).concat([node]);
    if (Array.isArray(v)) v.forEach((x) => walk(x, visit, next));
    else if (v && typeof v.type === 'string') walk(v, visit, next);
  }
}

// Every script that ships: template attributes, main.js and each ext file (an expression).
function scripts() {
  const html = h.templateSource('q');
  const out = { onLoad: h.attribute(html, 'onLoad'), onActivate: h.attribute(html, 'onActivate'), onDeactivate: h.attribute(html, 'onDeactivate') };
  for (const m of html.matchAll(/onLongPressStart="([^"]*)"/g)) out['button ' + m[1]] = m[1];
  out['main.js'] = h.substitute(h.readApp('main.js'), 'q');
  for (const f of h.extFiles()) out[f] = '(' + h.substitute(h.readApp(f), 'q') + ')';
  return out;
}

// The renderer's scope: makeRenderer, the function the template onLoad script calls once to make drawTile.
function rendererScope(ast) {
  for (const node of ast.body) {
    if (node.type !== 'VariableDeclaration') continue;
    for (const d of node.declarations) {
      if (d.id.name === 'makeRenderer' && d.init && d.init.type === 'FunctionExpression') return d.init;
    }
  }
  return null;
}

const RENDER_FUNCTIONS = ['wd', 'stance', 'fitRange', 'flush', 'pen', 'op', 'costOf', 'vis', 'pt', 'cTo', 'drawRun', 'drawRoute', 'drawBelays', 'drawGlyphs', 'drawLine', 'drawTile'];
const LIFECYCLE = ['onLoad', 'onEvent', 'onLap', 'onAutoLap', 'evaluate', 'onExerciseStart', 'onExerciseContinue', 'onExercisePause', 'onExerciseEnd', 'getSummaryOutputs', 'getUserInterface'];

module.exports = (test) => {
  test('T7 every code file starts with two ABOUTME lines', () => {
    for (const f of ['t.html', 'u.html']) {
      const lines = h.readApp(f).split('\n');
      assert(/^<!-- ABOUTME: .+-->$/.test(lines[0]) && /^<!-- ABOUTME: .+-->$/.test(lines[1]), f);
    }
    for (const f of ['main.js'].concat(h.extFiles())) {
      const m = h.readApp(f).split('\n');
      assert(/^\/\/ ABOUTME: /.test(m[0]) && /^\/\/ ABOUTME: /.test(m[1]), f);
    }
  });

  test('T7 every shipped script parses as ES5 and avoids Date, 16/32-bit typed arrays and regex literals', () => {
    for (const [name, code] of Object.entries(scripts())) {
      walk(parse5(code, name), (n) => {
        if (n.type === 'Identifier') assert(['Date', 'Int16Array', 'Uint16Array', 'Int32Array', 'Float64Array', 'JSON'].indexOf(n.name) < 0, name + ' uses ' + n.name);
        if (n.type === 'Literal') assert(!n.regex, name + ' has a regex literal');
      });
    }
  });

  test('T7 each ext file is a single function expression', () => {
    for (const f of h.extFiles()) {
      const ast = parse5('(' + h.substitute(h.readApp(f), 'q') + ')', f);
      assert.strictEqual(ast.body.length, 1, f);
      assert.strictEqual(ast.body[0].expression.type, 'FunctionExpression', f + ' must be a function (the simulator calls what evalFile returns)');
    }
  });

  test('T7 the template defines no onClick and every pushButton is lockable (longType action)', () => {
    const html = h.readApp('t.html');
    assert(!/onClick/i.test(html), 't.html must leave clicks to the watch');
    const buttons = [...html.matchAll(/<pushButton ([^>]*)\/>/g)].map((m) => m[1]);
    assert.strictEqual(buttons.length, 3);
    for (const name of ['up', 'down', 'next']) {
      const b = buttons.find((x) => x.indexOf('name="' + name + '"') >= 0);
      assert(b, name + ' button missing');
      assert(/longType="action"/.test(b), name + ' long press must be blocked by the button lock');
      assert(/onLongPressStart="send\([123]\);"/.test(b), name + ' long press handler');
    }
  });

  test('T7 attribute hygiene: no double quote inside scripts, arrows only in canvas build, no leftover tokens', () => {
    const raw = h.readApp('t.html');
    const after = raw.substring(raw.indexOf('onLoad="') + 8);
    assert(/^\s*onActivate="/.test(after.substring(after.indexOf('"') + 1)), 'onLoad must end right before onActivate (no stray double quote)');
    assert(!/{{/.test(h.templateSource('q')), 'unsubstituted token left');
    const builds = [...raw.matchAll(/build="ctx => drawTile\(ctx, [012]\)"/g)].length;
    assert.strictEqual(builds, 3);
    assert.strictEqual([...raw.matchAll(/=>/g)].length, builds, 'arrow functions outside the canvas build attributes');
  });

  test('T7 element count is at most 16 and text elements start with a dash', () => {
    const html = h.readApp('t.html');
    const body = html.substring(html.indexOf('<div id="bg"'));
    assert([...body.matchAll(/<(div|object|span|img)\b/g)].length <= 16);
    for (const m of body.matchAll(/<div id="(tn|h1|h2|it|l\d|ld)"[^>]*>([^<]*)<\/div>/g)) assert.strictEqual(m[2], '-', m[1]);
  });

  // Round 2: a second 'var units' (the units callback) silently replaced the renderer's unit counter of the same name,
  // so the callback became a number after the first frame. Round 4: the renderer has its own scope inside the template's
  // (makeRenderer, which returns drawTile); a name declared in both would hide the template's from the renderer.
  // Duktape gives a scope record of 56 or more names a hash part: measured with the sp-mem harness (lowmem, 32-bit),
  // 55 names make a 728 B record and 57 names a 1,876 B one, so each scope stays at 55 names or fewer.
  test('T7 the template onLoad script and the renderer scope declare each name once, in one scope, at most 55 each', () => {
    const ast = parse5(h.attribute(h.templateSource('q'), 'onLoad'), 'onLoad');
    const names = (body) => [].concat(...body.filter((n) => n.type === 'VariableDeclaration').map((n) => n.declarations.map((d) => d.id.name)));
    const outer = names(ast.body);
    const iife = rendererScope(ast);
    assert(iife, 'the renderer scope (var makeRenderer = function () { ... }) is missing');
    const inner = names(iife.body.body);
    for (const [label, list] of [['onLoad', outer], ['renderer', inner]]) {
      const seen = new Set();
      for (const name of list) {
        assert(!seen.has(name), label + ' declares ' + name + ' twice');
        seen.add(name);
      }
      console.log('     ' + label + ' scope: ' + list.length + ' names');
      assert(list.length <= 55, label + ' scope has ' + list.length + ' names: 56 or more get a hash part (about 1.2 KB)');
    }
    for (const name of inner) assert(outer.indexOf(name) < 0, name + ' is declared in both scopes');
  });

  test('T7 the renderer allocates nothing per frame (no new, array, object or function literals)', () => {
    const ast = parse5(h.attribute(h.templateSource('q'), 'onLoad'), 'onLoad');
    let found = 0;
    walk(ast, (n) => {
      if (n.type !== 'VariableDeclarator' || RENDER_FUNCTIONS.indexOf(n.id.name) < 0) return;
      found++;
      // drawTile is the function makeRenderer returns; makeRenderer itself runs once, at load.
      const fn = n.id.name === 'drawTile' ? rendererScope(ast).body.body.find((s) => s.type === 'ReturnStatement').argument : n.init;
      assert.strictEqual(fn.type, 'FunctionExpression', n.id.name);
      walk(fn.body, (m) => {
        assert(['NewExpression', 'ArrayExpression', 'ObjectExpression', 'FunctionExpression'].indexOf(m.type) < 0, n.id.name + ' allocates (' + m.type + ')');
      });
    });
    assert.strictEqual(found, RENDER_FUNCTIONS.length);
  });

  test('T7 main.js: lifecycle declarations only, at most 8 helpers, output only as output.<name> in lifecycle functions', () => {
    const ast = parse5(h.substitute(h.readApp('main.js'), 'q'), 'main.js');
    let helpers = 0;
    for (const node of ast.body) {
      if (node.type === 'FunctionDeclaration') assert(LIFECYCLE.indexOf(node.id.name) >= 0, 'global function ' + node.id.name);
      if (node.type === 'VariableDeclaration') {
        for (const d of node.declarations) if (d.init && d.init.type === 'FunctionExpression') helpers++;
      }
    }
    assert(helpers <= 8, helpers + ' module-level helper functions');
    walk(ast, (n, parents) => {
      if (n.type === 'FunctionDeclaration') assert.strictEqual(parents.length, 1, 'nested function declaration ' + n.id.name);
      if (n.type === 'Identifier' && n.name === 'output') {
        const parent = parents[parents.length - 1];
        const fn = parents.find((p) => p.type === 'FunctionDeclaration');
        const isParam = parent.type === 'FunctionDeclaration';
        assert(isParam || (parent.type === 'MemberExpression' && parent.object === n && !parent.computed), 'bare output');
        assert(fn && LIFECYCLE.indexOf(fn.id.name) >= 0, 'output used outside a lifecycle function');
      }
    });
  });

  // Round 4: open() reads the slot from storage each time the slot opens (main.js keeps only its card), so it runs only
  // from press() (long presses) and at start-up (start(), and ext0.js through the open() main.js hands it).
  test('T7 main.js touches localStorage only in save(), start() (which hands it to ext0.js) and open(); save() runs only on presses, pause and end; open() only on presses and at start-up', () => {
    const ast = parse5(h.substitute(h.readApp('main.js'), 'q'), 'main.js');
    const owner = (parents) => {
      const fn = parents.find((p) => p.type === 'FunctionDeclaration');
      if (fn) return fn.id.name;
      const v = [...parents].reverse().find((p) => p.type === 'VariableDeclarator');
      return v ? v.id.name : '(top)';
    };
    walk(ast, (n, parents) => {
      if (n.type === 'Identifier' && n.name === 'localStorage') assert(['save', 'start', 'open'].indexOf(owner(parents)) >= 0, 'localStorage in ' + owner(parents));
      // save() runs from onEvent (through press, for long presses only), pause and end, never from onLap (the lap popup is a
      // busy moment for memory). press() runs from onEvent and onLap (event 4); start() has one caller.
      if (n.type === 'CallExpression' && n.callee.name === 'save') {
        assert(['press', 'onExercisePause', 'onExerciseEnd'].indexOf(owner(parents)) >= 0, 'save() called from ' + owner(parents));
      }
      if (n.type === 'CallExpression' && n.callee.name === 'press') assert(['onEvent', 'onLap'].indexOf(owner(parents)) >= 0, 'press() called from ' + owner(parents));
      if (n.type === 'CallExpression' && n.callee.name === 'start') assert.strictEqual(owner(parents), 'onLoad');
      if (n.type === 'CallExpression' && n.callee.name === 'open') assert(['press', 'start'].indexOf(owner(parents)) >= 0, 'open() called from ' + owner(parents));
    });
  });

  // Review round 2: the reference documents evalFile for main.js only, and the simulator cannot show whether the watch
  // expands '{file_path}' in code that came from an ext file. ext0.js uses the loader main.js passes it.
  test('T7 only main.js calls evalFile, from its ext() loader, which drops the loaded function\'s prototype', () => {
    for (const f of h.extFiles()) {
      walk(parse5('(' + h.substitute(h.readApp(f), 'q') + ')', f), (n) => {
        assert(!(n.type === 'Identifier' && n.name === 'evalFile'), f + ' calls evalFile');
      });
    }
    const src = h.substitute(h.readApp('main.js'), 'q');
    let calls = 0;
    walk(parse5(src, 'main.js'), (n, parents) => {
      if (n.type === 'CallExpression' && n.callee.name === 'evalFile') {
        calls++;
        assert(parents.some((p) => p.type === 'VariableDeclarator' && p.id.name === 'ext'), 'evalFile outside ext()');
      }
    });
    assert.strictEqual(calls, 1);
    assert(/f\.prototype = null;/.test(src), 'ext() keeps the prototype of what it loads');
  });

  // Review round 2: an inner helper and the call's scope refer to each other, and the helper to its automatic prototype;
  // reference counting cannot free either cycle, so every call left several KB until a full mark-and-sweep. Every helper
  // made inside a code ext file must have its prototype and its variable set to null on every path that returns.
  test('T7 code ext files drop their inner helpers (prototype and variable) before every return after making them', () => {
    for (const f of h.extFiles().filter((x) => h.TOPO_EXT.indexOf(x) < 0)) {
      const ast = parse5('(' + h.substitute(h.readApp(f), 'q') + ')', f);
      const top = ast.body[0].expression;
      const made = {};
      const protoNull = {};
      const varNull = {};
      const returns = [];
      // Names on the left of a chain a = b = ... = null (member: the x of x.prototype).
      const nulled = (n, out, member) => {
        let end = n;
        while (end.type === 'AssignmentExpression') end = end.right;
        if (!(end.type === 'Literal' && end.value === null)) return;
        for (let e = n; e.type === 'AssignmentExpression'; e = e.right) {
          if (member && e.left.type === 'MemberExpression' && e.left.property.name === 'prototype') out[e.left.object.name] = e.start;
          if (!member && e.left.type === 'Identifier') out[e.left.name] = e.start;
        }
      };
      walk(top.body, (n, parents) => {
        const inner = parents.some((p) => p.type === 'FunctionExpression');
        if (inner) return;
        if (n.type === 'VariableDeclarator' && n.init && n.init.type === 'FunctionExpression') made[n.id.name] = n.start;
        if (n.type === 'AssignmentExpression' && n.right.type === 'FunctionExpression') made[n.left.name] = n.start;
        if (n.type === 'ExpressionStatement' && n.expression.type === 'AssignmentExpression') {
          nulled(n.expression, protoNull, true);
          nulled(n.expression, varNull, false);
        }
        if (n.type === 'ReturnStatement') returns.push(n.start);
      });
      for (const name of Object.keys(made)) {
        assert(protoNull[name] > made[name], f + ': ' + name + '.prototype is not set to null');
        assert(varNull[name] > protoNull[name], f + ': ' + name + ' is not set to null after its prototype');
        for (const r of returns) assert(r < made[name] || r > varNull[name], f + ': a return between making ' + name + ' and dropping it');
      }
    }
  });

  test('T7 the ext files touch no outputs or global storage; ext0.js (run from onLoad) reads the storage main.js passes it', () => {
    for (const f of h.extFiles()) {
      walk(parse5('(' + h.substitute(h.readApp(f), 'q') + ')', f), (n) => {
        if (n.type === 'Identifier') assert(n.name !== 'output', f + ' uses output');
        if (n.type === 'Identifier') assert(n.name !== 'localStorage', f + ' uses the global localStorage');
        if (n.type === 'MemberExpression' && n.object.name === 'ls') assert(['getItem', 'getObject'].indexOf(n.property.name) >= 0, 'ext0 only reads: ' + n.property.name);
      });
    }
    const main = parse5(h.substitute(h.readApp('main.js'), 'q'), 'main.js');
    let calls = 0;
    walk(main, (n, parents) => {
      if (n.type === 'Literal' && n.value === 0 && parents.length && parents[parents.length - 1].type === 'CallExpression' && parents[parents.length - 1].callee.name === 'ext') {
        calls++;
        assert(parents.some((p) => p.type === 'VariableDeclarator' && p.id.name === 'start'), 'ext0 runs only from start() (onLoad)');
      }
    });
    assert.strictEqual(calls, 1);
  });
};
