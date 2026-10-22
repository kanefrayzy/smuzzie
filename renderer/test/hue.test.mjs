// The background hue shift must look the same in the preview (CSS hue-rotate on <video>)
// and in the rendered file (ffmpeg colorchannelmixer). Checks:
//  1. hueMatrix() equals the W3C Filter Effects hue-rotate matrix (reference numbers computed
//     separately from the spec formula, not with this code);
//  2. real Chromium CSS filter == shiftColor() == ffmpeg with the renderer's mixer filter,
//     within 2/255 per channel, on a set of color patches.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { hueMatrix, shiftColor, parseHex } from '../dist/overlay.mjs';
import { mixerFilter } from '../src/ffmpeg.mjs';
import { launchBrowser, ffmpeg, hasFfmpeg, readPixels, tmpDir } from './helpers.mjs';

const REFERENCE = {
  0: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  35: [0.735501, -0.280801, 0.5453, 0.120542, 1.028759, -0.149301, -0.412884, 0.539413, 0.873471],
  90: [0, 0, 1, 0.356, 0.855, -0.211, -0.574, 1.43, 0.144],
  150: [-0.575062, 0.976708, 0.598354, 0.468963, 0.538183, -0.007146, 0.003963, 1.691708, -0.695672],
  250: [0.143985, 1.631425, -0.775409, 0.151474, 0.485967, 0.362558, 1.025388, 0.287664, -0.313053],
};

test('hueMatrix matches the W3C hue-rotate matrix', () => {
  for (const [deg, ref] of Object.entries(REFERENCE)) {
    hueMatrix(Number(deg)).forEach((v, i) => assert.ok(Math.abs(v - ref[i]) < 1e-6, `deg ${deg} [${i}]: ${v} vs ${ref[i]}`));
  }
});

test('mixer filter carries the same matrix', () => {
  assert.equal(mixerFilter(0), null);
  const f = mixerFilter(150);
  assert.match(f, /^colorchannelmixer=rr=-0\.575062:rg=0\.976708:rb=0\.598354:gr=0\.468963:gg=0\.538183:gb=-0\.007146:br=0\.003963:bg=1\.691708:bb=-0\.695672$/);
});

const PATCHES = [
  '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff',
  '#1e9bff', '#ff2d3d', '#7a3cff', '#ffd400', '#20c997', '#ff7a00',
  '#804020', '#204080', '#408020', '#c0c0c0', '#808080', '#202020',
  '#ffffff', '#000000', '#f5d0c5', '#3b1f5c', '#0d3b2e', '#b3e5fc',
];
const SIZE = 24;

function pageHtml(filter) {
  const cells = PATCHES.map((c) => `<div style="width:${SIZE}px;height:${SIZE}px;background:${c}"></div>`).join('');
  return `<!doctype html><html><body style="margin:0;background:#000">
    <div id="grid" style="display:grid;grid-template-columns:repeat(6,${SIZE}px);width:${SIZE * 6}px;filter:${filter}">${cells}</div>
  </body></html>`;
}

const centers = PATCHES.map((_, i) => [(i % 6) * SIZE + SIZE / 2, Math.floor(i / 6) * SIZE + SIZE / 2]);

test('CSS hue-rotate in Chromium == shiftColor() == ffmpeg colorchannelmixer', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg is not installed');
  const browser = await launchBrowser();
  if (!browser) return t.skip('no Chromium available (set BANNERS_CHROMIUM_PATH or install chromium-headless-shell)');

  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const source = path.join(tmpDir, 'patches.png');
    await page.setContent(pageHtml('none'));
    await page.locator('#grid').screenshot({ path: source });

    let worst = 0;
    for (const deg of [35, 150, 250]) {
      const cssPng = path.join(tmpDir, `css-${deg}.png`);
      await page.setContent(pageHtml(`hue-rotate(${deg}deg)`));
      await page.locator('#grid').screenshot({ path: cssPng });

      const ffPng = path.join(tmpDir, `ff-${deg}.png`);
      ffmpeg(['-i', source, '-vf', `format=gbrp,${mixerFilter(deg)},format=rgb24`, '-frames:v', '1', ffPng]);

      const css = await readPixels(page, cssPng, centers);
      const ff = await readPixels(page, ffPng, centers);

      PATCHES.forEach((hex, i) => {
        const js = parseHex(shiftColor(hex, deg));
        for (let ch = 0; ch < 3; ch++) {
          const d1 = Math.abs(css[i][ch] - js[ch]);
          const d2 = Math.abs(css[i][ch] - ff[i][ch]);
          worst = Math.max(worst, d1, d2);
          assert.ok(d1 <= 2, `${hex} @${deg}°: CSS ${css[i]} vs shiftColor ${js}`);
          assert.ok(d2 <= 2, `${hex} @${deg}°: CSS ${css[i]} vs ffmpeg ${ff[i]}`);
        }
      });
    }
    t.diagnostic(`max difference: ${worst}/255`);
  } finally {
    await browser.close();
  }
});
