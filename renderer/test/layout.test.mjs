// Text layout decisions, with a fake monospace measure (every character is 60px wide at 100px),
// so the expectations can be worked out by hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutText, cleanText, truncateChars, charLength, resolveText, exportParams } from '../dist/overlay.mjs';

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
  assert.deepEqual(r, { visible: true, text: 'Hello', size: 5, color: '#ffffff', align: 'center' });

  const config = { schemaVersion: 1, accent: '#000000', hue: { enabled: false, default: 20, presets: [] }, zones: [zone] };
  assert.deepEqual(exportParams(config, { schemaVersion: 1, hue: 200, zones: { t: { text: 'Hi', size: 4.5, color: '#ff0000' } } }), {
    schemaVersion: 1, hue: 20, zones: { t: { text: 'Hi', size: 4.5, color: '#ff0000' } },
  });
});
