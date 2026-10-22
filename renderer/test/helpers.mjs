// Shared test helpers: locating a Chromium, running ffmpeg, reading pixels of a PNG.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const tmpDir = path.join(root, 'test/.tmp');
fs.mkdirSync(tmpDir, { recursive: true });

export const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;

/** Launch Chromium (BANNERS_CHROMIUM_PATH or Playwright's own) or return null if none is installed. */
export async function launchBrowser() {
  try {
    return await chromium.launch({
      headless: true,
      executablePath: process.env.BANNERS_CHROMIUM_PATH || undefined,
      args: ['--font-render-hinting=none', '--force-color-profile=srgb'],
    });
  } catch {
    return null;
  }
}

export function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', ...args]);
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + r.stderr.toString());
}

/** Decode a PNG in the browser and return RGB at the given points. */
export async function readPixels(page, pngFile, points) {
  const src = 'data:image/png;base64,' + fs.readFileSync(pngFile).toString('base64');
  return page.evaluate(
    async ({ src, points }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d', { colorSpace: 'srgb' });
      ctx.drawImage(img, 0, 0);
      return points.map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3)));
    },
    { src, points },
  );
}
