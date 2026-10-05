// ABOUTME: Turns a shipped SuuntoPlus template (t.xml from the .fea) into one JS view file plus metadata for the sp-mem driver.
// ABOUTME: The uiView onLoad script becomes the closure scope; handlers, canvas builds and <eval> scripts register into numbered slots via __v().

'use strict';

/* Minimal parser for the build tool's XML output: elements without attributes, text, <?xml?> and comments. */
function parseXml(text) {
	const root = { tag: '#root', children: [] };
	const stack = [root];
	const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(\/?)([A-Za-z_:][\w:.\-]*)[^>]*?(\/?)>|([^<]+)/g;
	let m;
	while ((m = re.exec(text)) !== null) {
		if (m[2] === undefined && m[4] === undefined) {
			continue; /* comment or declaration */
		}
		const top = stack[stack.length - 1];
		if (m[4] !== undefined) {
			top.children.push({ tag: '#text', text: unescapeXml(m[4]) });
		} else if (m[1] === '/') {
			if (stack.length > 1) {
				stack.pop();
			}
		} else {
			const node = { tag: m[2], children: [] };
			top.children.push(node);
			if (m[3] !== '/') {
				stack.push(node);
			}
		}
	}
	return root;
}

function unescapeXml(s) {
	return s
		.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
		.replace(/&#([0-9]+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');
}

function textOf(node) {
	return node.children.filter((c) => c.tag === '#text').map((c) => c.text).join('');
}

function child(node, tag) {
	return node.children.find((c) => c.tag === tag);
}

function childText(node, tag) {
	const c = child(node, tag);
	return c ? textOf(c).trim() : null;
}

function isScriptNode(node) {
	return /^on[A-Z]/.test(node.tag) && node.children.every((c) => c.tag === '#text');
}

/* 'ctx => drawScreen(ctx)' -> 'function(ctx){return (drawScreen(ctx));}'. Duktape 2.7 has no arrow functions,
 * so the firmware must translate these attribute forms itself; this mirrors that assumption. */
function arrowToFunction(code, defaultParam) {
	const src = code.trim();
	const m = src.match(/^\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>\s*([\s\S]*)$/);
	if (m) {
		/* Published apps ship expression bodies ending in ';' ("ctx => draw(ctx);"); dropped here so the body stays an expression.
		 * Whether the firmware accepts that form is not verified. */
		const body = m[2].trim().replace(/[;\s]+$/, '');
		return body.startsWith('{') ? `function(${m[1]})${body}` : `function(${m[1]}){return (${body});}`;
	}
	if (/^[A-Za-z_$][\w$.]*$/.test(src)) {
		return `function(${defaultParam}){return ${src}(${defaultParam});}`;
	}
	return `function(${defaultParam}){return (${src.replace(/[;\s]+$/, '')});}`;
}

function styleLength(styleNode, prop, displaySize) {
	const p = styleNode && child(styleNode, prop);
	if (!p) {
		return displaySize;
	}
	const prop1 = childText(p, 'proportion');
	if (prop1 !== null) {
		return Math.round(parseFloat(prop1) * displaySize);
	}
	const px = childText(p, 'pixel');
	if (px !== null) {
		return Math.round(parseFloat(px));
	}
	return displaySize;
}

function substituteRuntimeTokens(code) {
	return code.replace(/\{zapp_index\}/g, '0');
}

/* Build the view file text and its slot metadata. outNames maps <eval> inputs to output indexes. */
function buildView(xmlText, opts) {
	const root = parseXml(xmlText);
	const uiView = root.children.find((c) => c.tag === 'uiView');
	if (!uiView) {
		throw new Error('template has no <uiView> root');
	}
	const meta = { onActivate: -1, onDeactivate: -1, canvases: [], buttons: [], evals: [], others: [] };
	const regs = [];
	let onLoad = '';
	const addSlot = (fnSource) => {
		regs.push(`__v(${regs.length}, ${substituteRuntimeTokens(fnSource)});`);
		return regs.length - 1;
	};
	const handler = (code) => `function(target, targetData){\n${code}\n}`;

	for (const c of uiView.children) {
		if (c.tag === 'onLoad' && isScriptNode(c)) {
			onLoad = textOf(c);
		} else if (c.tag === 'onActivate' && isScriptNode(c)) {
			meta.onActivate = addSlot(handler(textOf(c)));
		} else if (c.tag === 'onDeactivate' && isScriptNode(c)) {
			meta.onDeactivate = addSlot(handler(textOf(c)));
		} else if (isScriptNode(c)) {
			meta.others.push({ tag: 'uiView', event: c.tag, slot: addSlot(handler(textOf(c))) });
		}
	}

	const outIndex = (input) => {
		const m = input && input.match(/Zapp\/\{zapp_index\}\/Output\/([\w$]+)/);
		return m ? opts.outNames.indexOf(m[1]) : -1;
	};

	const walk = (node) => {
		for (const el of node.children) {
			if (el.tag === '#text' || isScriptNode(el)) {
				continue;
			}
			if (el.tag === 'object' && childText(el, 'type') === 'canvas') {
				const id = childText(el, 'id') || `canvas${meta.canvases.length}`;
				const build = childText(el, 'build');
				const style = child(el, 'style');
				meta.canvases.push({
					id: '#' + id,
					name: id,
					w: styleLength(style, 'width', opts.displayW),
					h: styleLength(style, 'height', opts.displayH),
					slot: build ? addSlot(arrowToFunction(build, 'ctx')) : -1
				});
			} else if (el.tag === 'pushButton') {
				const name = childText(el, 'name');
				for (const c of el.children.filter(isScriptNode)) {
					meta.buttons.push({ name, event: c.tag, slot: addSlot(handler(textOf(c))) });
				}
			} else if (el.tag === 'eval') {
				const fmt = childText(el, 'outputFormat') || '';
				const changed = el.children.find((c) => c.tag === 'onValueChanged' && isScriptNode(c));
				const entry = { out: outIndex(childText(el, 'input')), format: -1, changed: -1 };
				if (/^script\s/.test(fmt)) {
					entry.format = addSlot(arrowToFunction(fmt.replace(/^script\s+/, ''), 'x'));
				}
				if (changed) {
					entry.changed = addSlot(handler(textOf(changed)));
				}
				if (entry.format >= 0 || entry.changed >= 0) {
					meta.evals.push(entry);
				}
			} else {
				for (const c of el.children.filter(isScriptNode)) {
					meta.others.push({ tag: el.tag, event: c.tag, slot: addSlot(handler(textOf(c))) });
				}
			}
			walk(el);
		}
	};
	walk(uiView);

	const source = [
		'// Generated by sp-mem from a shipped template: the onLoad script is the shared scope of all handlers.',
		substituteRuntimeTokens(onLoad),
		';',
		...regs,
		''
	].join('\n');
	return { source, meta, slots: regs.length };
}

module.exports = { buildView, parseXml, arrowToFunction };
