// Text layout decisions, with a fake monospace measure (every character is 60px wide at 100px),
// so the expectations can be worked out by hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutText, cleanText, truncateChars, charLength, resolveText, resolveRect, exportParams, expandLayers } from '../dist/overlay.mjs';

const measure = (s) => Array.from(s).length * 60;
const base = { boxW: 600, boxH: 300, lineHeight: 1, letterSpacing: 0 };

test('fits on one line at the requested size', () => {
  const r = layoutText({ ...base, text: 'HELLO', sizePx: 100, minPx: 50 }, measure);
  assert.deepEqual(r.lines, ['HELLO']);
  assert.equal(r.sizePx, 100);
  assert.equal(r.shrunk, false);
});

test('wraps and balances lines instead of leaving a short last line', () => {
  // 100px: 10 chars per 600px line (with the 1.5% safety margin: 9). Greedy would give
  // "AAAA BBBB" + "CC"; balanced keeps 2 lines but evens them out
  const r = layoutText({ ...base, text: 'AAAA BBBB CC', sizePx: 100, minPx: 50 }, measure);
  assert.equal(r.lines.length, 2);
  assert.deepEqual(r.lines, ['AAAA', 'BBBB CC']);
});

test('shrinks the font to fit the height, but not below the minimum', () => {
  const r = layoutText({ ...base, boxH: 100, text: 'AAAA BBBB CCCC', sizePx: 100, minPx: 20 }, measure);
  assert.equal(r.shrunk, true);
  assert.ok(r.sizePx < 100 && r.sizePx >= 20);
  assert.ok(r.lines.length * r.sizePx <= 100.5);
  assert.equal(r.overflow, false);
});

test('long words are broken only when nothing else fits, and the result is flagged', () => {
  const r = layoutText({ ...base, boxH: 1000, text: 'A'.repeat(30), sizePx: 100, minPx: 60 }, measure);
  assert.equal(r.brokeWords, true);
  for (const line of r.lines) assert.ok(measure(line) * (r.sizePx / 100) <= 600);
});

test('overflow is reported when even the minimum size is too big', () => {
  // At the 40px minimum one line is 40px tall: more than the 30px box
  const r = layoutText({ ...base, boxH: 30, text: 'AAAA BBBB CCCC DDDD', sizePx: 100, minPx: 40 }, measure);
  assert.equal(r.overflow, true);
  assert.equal(r.sizePx, 40);
});

test('explicit line breaks are kept', () => {
  const r = layoutText({ ...base, text: 'AB\nCD', sizePx: 100, minPx: 50 }, measure);
  assert.deepEqual(r.lines, ['AB', 'CD']);
});

test('letter spacing counts per character', () => {
  const r = layoutText({ ...base, boxW: 610, letterSpacing: 0.1, text: 'ABCDEFGH', sizePx: 100, minPx: 100 }, measure);
  // 8 * 60 + 8 * 10 = 560 <= 610 * 0.985
  assert.deepEqual(r.lines, ['ABCDEFGH']);
});

test('text cleanup and limits work in characters like the server', () => {
  assert.equal(cleanText('  a​b\u0007 ', false), 'ab');
  assert.equal(cleanText('a\r\nb', true), 'a\nb');
  assert.equal(charLength('😀😀'), 2);
  assert.equal(truncateChars('Привет', 3), 'При');
});

test('disabled controls fall back to the template, enabled ones are clamped', () => {
  const zone = {
    key: 't', type: 'text', label: 'T', x: 0, y: 0, w: 50, h: 10,
    style: { text: 'Default', fontId: 1, size: 4, minSize: 2, case: 'none', align: 'center', color: '#ffffff', glow: true, lineHeight: 1.1, letterSpacing: 0 },
    controls: {
      text: { enabled: true, maxLength: 5, multiline: false },
      size: { enabled: true, min: 3, max: 5 },
      color: { enabled: true, palette: ['#ff0000'], custom: false },
      align: { enabled: false, options: ['center'] },
      visible: { enabled: false },
    },
  };
  const r = resolveText(zone, { text: 'Hello world', size: 9, color: '#00ff00', align: 'left', visible: false });
  // Old configs have no style control blocks: everything comes from the template
  assert.deepEqual(r, {
    visible: true, text: 'Hello', size: 5, color: '#ffffff', align: 'center',
    fontId: 1, case: 'none', letterSpacing: 0, lineHeight: 1.1, glow: true, opacity: 100,
  });

  const config = { schemaVersion: 1, accent: '#000000', hue: { enabled: false, default: 20, presets: [] }, zones: [zone] };
  assert.deepEqual(exportParams(config, { schemaVersion: 1, hue: 200, zones: { t: { text: 'Hi', size: 4.5, color: '#ff0000' } } }), {
    schemaVersion: 1, hue: 20, zones: { t: { text: 'Hi', size: 4.5, color: '#ff0000' } },
  });
});

test('style controls: font, case, spacing, line height, glow and opacity', () => {
  const zone = {
    key: 't', type: 'text', label: 'T', x: 0, y: 0, w: 50, h: 10,
    style: { text: 'Hi', fontId: 1, size: 4, minSize: 2, case: 'upper', align: 'center', color: '#ffffff', glow: true, lineHeight: 1.1, letterSpacing: 0, opacity: 90 },
    controls: {
      text: { enabled: false, maxLength: 5, multiline: false },
      size: { enabled: false, min: 4, max: 4 },
      color: { enabled: false, palette: [], custom: false },
      align: { enabled: false, options: ['center'] },
      visible: { enabled: false },
      font: { enabled: true, options: [1, 2] },
      case: { enabled: true, options: ['none', 'upper'] },
      letterSpacing: { enabled: true, min: -0.05, max: 0.2 },
      lineHeight: { enabled: true, min: 0.9, max: 1.6 },
      glow: { enabled: true },
      opacity: { enabled: false, min: 90, max: 90 },
    },
  };
  const r = resolveText(zone, { fontId: 2, case: 'none', letterSpacing: 0.12345, lineHeight: 9, glow: false, opacity: 20 });
  assert.equal(r.fontId, 2);
  assert.equal(r.case, 'none');
  assert.equal(r.letterSpacing, 0.123); // rounded like the server
  assert.equal(r.lineHeight, 1.6); // clamped
  assert.equal(r.glow, false);
  assert.equal(r.opacity, 90); // control off

  // Not offered: template values
  const r2 = resolveText(zone, { fontId: 3, case: 'lower' });
  assert.equal(r2.fontId, 1);
  assert.equal(r2.case, 'upper');

  const config = { schemaVersion: 1, accent: '#000000', hue: { enabled: false, default: 0, presets: [] }, zones: [zone] };
  assert.deepEqual(exportParams(config, { schemaVersion: 1, hue: 0, zones: { t: { fontId: 2, glow: false, opacity: 20 } } }).zones.t, {
    fontId: 2, case: 'upper', letterSpacing: 0, lineHeight: 1.1, glow: false,
  });
});

test('zone position: inside the allowed area, fixed size without resizing', () => {
  const zone = {
    key: 'l', type: 'image', label: 'L', x: 30, y: 10, w: 40, h: 10,
    style: { scale: 100, alignX: 'center', alignY: 'center' },
    controls: {
      upload: { enabled: true, maxBytes: 1 }, scale: { enabled: false, min: 100, max: 100 },
      align: { enabled: false, x: ['center'], y: ['center'] },
      position: { enabled: true, resize: false, bounds: { x: 0, y: 0, w: 100, h: 50 } },
    },
  };
  // Clamped to the area, size kept
  assert.deepEqual(resolveRect(zone, { rect: { x: 80, y: 70, w: 5, h: 5 } }), { x: 60, y: 40, w: 40, h: 10 });
  assert.deepEqual(resolveRect(zone, { rect: { x: 1.23456, y: 2, w: 40, h: 10 } }), { x: 1.235, y: 2, w: 40, h: 10 });
  // Junk or no position: the template's place
  assert.deepEqual(resolveRect(zone, { rect: { x: 'a', y: 0, w: 1, h: 1 } }), { x: 30, y: 10, w: 40, h: 10 });

  const resizable = { ...zone, controls: { ...zone.controls, position: { ...zone.controls.position, resize: true } } };
  assert.deepEqual(resolveRect(resizable, { rect: { x: 0, y: 0, w: 0.5, h: 80 } }), { x: 0, y: 0, w: 2, h: 50 });

  const off = { ...zone, controls: { ...zone.controls, position: undefined } };
  assert.deepEqual(resolveRect(off, { rect: { x: 0, y: 0, w: 40, h: 10 } }), { x: 30, y: 10, w: 40, h: 10 });

  const config = { schemaVersion: 1, accent: '#000000', hue: { enabled: false, default: 0, presets: [] }, zones: [zone] };
  assert.deepEqual(exportParams(config, { schemaVersion: 1, hue: 0, zones: { l: { rect: { x: 0, y: 45, w: 40, h: 10 } } } }).zones.l.rect, {
    x: 0, y: 40, w: 40, h: 10,
  });
});

test('buyer layers become zones on top, within the template limits', () => {
  const config = {
    schemaVersion: 1, accent: '#ff0000', hue: { enabled: false, default: 0, presets: [] }, zones: [],
    custom: { enabled: true, maxText: 1, maxImage: 1, fonts: [5], bounds: { x: 0, y: 0, w: 100, h: 50 } },
  };
  const params = {
    schemaVersion: 1, hue: 0, zones: {},
    layers: [
      { id: 'layer_1', type: 'text', text: 'Hi', fontId: 5, size: 99, rect: { x: 10, y: 45, w: 50, h: 10 } },
      { id: 'layer_2', type: 'text', text: 'Over the limit', rect: { x: 0, y: 0, w: 10, h: 10 } },
      { id: 'bad', type: 'image', rect: { x: 0, y: 0, w: 10, h: 10 } },
      { id: 'layer_3', type: 'image', scale: 50, rect: { x: 0, y: 0, w: 30, h: 12 } },
    ],
  };
  const ex = expandLayers(config, params);
  assert.deepEqual(ex.config.zones.map((z) => z.key), ['layer_1', 'layer_3']);
  const r = resolveText(ex.config.zones[0], ex.params.zones.layer_1);
  assert.equal(r.size, 20); // clamped to the layer limit

  const out = exportParams(config, params);
  assert.deepEqual(out.layers.map((l) => l.id), ['layer_1', 'layer_3']);
  assert.deepEqual(out.layers[0].rect, { x: 10, y: 40, w: 50, h: 10 }); // kept inside the area
  assert.equal(out.layers[0].size, 20);
  assert.equal(out.layers[1].scale, 50);

  // Switched off: no layers at all
  assert.equal(exportParams({ ...config, custom: { ...config.custom, enabled: false } }, params).layers, undefined);
});
