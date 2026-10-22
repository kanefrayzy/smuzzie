// End-to-end render of a tiny generated template: overlay in Chromium + ffmpeg MP4/GIF.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { root, tmpDir, hasFfmpeg, launchBrowser, ffmpeg, readPixels } from './helpers.mjs';
import { shiftColor, parseHex } from '../dist/overlay.mjs';

const font = path.resolve(root, '../backend/resources/fonts/DejaVuSans-Bold.ttf');

function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
    'stream=codec_name,width,height,pix_fmt,color_space,color_primaries,color_transfer', '-of', 'json', file]);
  return JSON.parse(r.stdout.toString()).streams[0];
}

test('renders MP4 and GIF with the text burned in', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg is not installed');
  const probeBrowser = await launchBrowser();
  if (!probeBrowser) return t.skip('no Chromium available');
  await probeBrowser.close();

  const dir = path.join(tmpDir, 'render');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  // Dark-blue 2 s background, a white square "logo"
  const source = path.join(dir, 'source.mp4');
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=0x102040:s=640x360:r=25:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', source]);
  const logo = path.join(dir, 'logo.png');
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=white:s=100x100', '-frames:v', '1', logo]);

  const job = {
    width: 640, height: 360, workDir: path.join(dir, 'out'), source, threads: 2, sandbox: false,
    fonts: [{ id: 7, weight: 700, style: 'normal', file: font }],
    images: { logo },
    outputs: { mp4: true, gif: { enabled: true, width: 320, fps: 10 } },
    config: {
      schemaVersion: 1, accent: '#1e9bff', hue: { enabled: true, default: 0, presets: [] },
      zones: [
        {
          key: 'title', type: 'text', label: 'Title', x: 10, y: 10, w: 80, h: 30,
          style: { text: 'HELLO', fontId: 7, size: 8, minSize: 4, case: 'upper', align: 'center', color: '#ffffff', glow: false, lineHeight: 1.1, letterSpacing: 0 },
          controls: {
            text: { enabled: true, maxLength: 20, multiline: false }, size: { enabled: false, min: 4, max: 8 },
            color: { enabled: false, palette: [], custom: false }, align: { enabled: false, options: ['center'] }, visible: { enabled: false },
          },
        },
        {
          key: 'logo', type: 'image', label: 'Logo', x: 40, y: 60, w: 20, h: 30,
          style: { scale: 100, alignX: 'center', alignY: 'center' },
          controls: {
            upload: { enabled: true, maxBytes: 2097152 }, scale: { enabled: false, min: 30, max: 100 }, align: { enabled: false, x: ['center'], y: ['center'] },
            position: { enabled: true, resize: false, bounds: { x: 0, y: 0, w: 100, h: 100 } },
          },
        },
      ],
    },
    // The buyer dragged the logo to the left edge
    params: { schemaVersion: 1, hue: 180, zones: { title: { text: 'Привет, мир' }, logo: { rect: { x: 5, y: 60, w: 20, h: 30 } } } },
  };
  const jobFile = path.join(dir, 'job.json');
  fs.writeFileSync(jobFile, JSON.stringify(job));

  const r = spawnSync(process.execPath, [path.join(root, 'src/render.mjs'), jobFile], { env: process.env, timeout: 180000 });
  const out = JSON.parse(r.stdout.toString().trim().split('\n').pop());
  assert.equal(r.status, 0, r.stderr.toString());
  assert.equal(out.ok, true, out.error);
  assert.equal(out.hue, 180);
  assert.ok(out.fit.title.lines >= 1);

  const mp4 = probe(out.mp4.path);
  assert.deepEqual(
    [mp4.codec_name, mp4.width, mp4.height, mp4.pix_fmt, mp4.color_space, mp4.color_primaries, mp4.color_transfer],
    ['h264', 640, 360, 'yuv420p', 'bt709', 'bt709', 'bt709'],
  );
  const gif = probe(out.gif.path);
  assert.deepEqual([gif.codec_name, gif.width], ['gif', 320]);

  // A frame: the moved logo's center is white (the image), its old place and a corner are the
  // hue-shifted background
  const frame = path.join(dir, 'frame.png');
  ffmpeg(['-ss', '1', '-i', out.mp4.path, '-frames:v', '1', frame]);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const [logoPx, oldPx, cornerPx] = await readPixels(page, frame, [[96, 270], [320, 270], [5, 5]]);
    assert.ok(logoPx.every((v) => v > 235), `logo pixel ${logoPx}`);
    assert.ok(oldPx.every((v) => v < 200), `old logo place ${oldPx} should be background`);
    // 0x102040 rotated by 180°: red goes up, blue goes down
    assert.ok(cornerPx[0] > cornerPx[2], `background pixel ${cornerPx} should be hue-shifted`);
  } finally {
    await browser.close();
  }

  // The page could only talk to the local server: the overlay PNG exists and the job didn't fail
  assert.ok(fs.existsSync(path.join(job.workDir, 'overlay.png')));
});

/** PNG chunks in file order: { type: data } (the last one of each type) */
function pngChunks(file) {
  const b = fs.readFileSync(file);
  const chunks = {};
  for (let pos = 8; pos + 8 <= b.length; ) {
    const len = b.readUInt32BE(pos);
    chunks[b.toString('latin1', pos + 4, pos + 8)] = b.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
  }
  return chunks;
}

test('renders a static (image) template to PNG and JPG', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg is not installed');
  const probeBrowser = await launchBrowser();
  if (!probeBrowser) return t.skip('no Chromium available');
  await probeBrowser.close();

  const dir = path.join(tmpDir, 'render-image');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  // Odd size on purpose: stills have no even-size requirement
  const source = path.join(dir, 'source.png');
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=0x102040:s=641x361', '-frames:v', '1', '-pix_fmt', 'rgb24', source]);
  const logo = path.join(dir, 'logo.png');
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=white:s=100x100', '-frames:v', '1', logo]);

  const job = {
    kind: 'image', width: 641, height: 361, workDir: path.join(dir, 'out'), source, threads: 2, sandbox: false,
    fonts: [{ id: 7, weight: 700, style: 'normal', file: font }],
    images: { logo },
    outputs: { png: true, jpg: { enabled: true, quality: 92 } },
    config: {
      schemaVersion: 1, accent: '#1e9bff', hue: { enabled: true, default: 0, presets: [] },
      zones: [
        {
          key: 'title', type: 'text', label: 'Title', x: 10, y: 5, w: 80, h: 30,
          style: { text: 'HELLO', fontId: 7, size: 12, minSize: 4, case: 'upper', align: 'center', color: '#ff0000', glow: false, lineHeight: 1.1, letterSpacing: 0 },
          controls: {
            text: { enabled: true, maxLength: 20, multiline: false }, size: { enabled: false, min: 4, max: 12 },
            color: { enabled: false, palette: [], custom: false }, align: { enabled: false, options: ['center'] }, visible: { enabled: false },
          },
        },
        {
          key: 'logo', type: 'image', label: 'Logo', x: 40, y: 60, w: 20, h: 30,
          style: { scale: 100, alignX: 'center', alignY: 'center' },
          controls: { upload: { enabled: true, maxBytes: 2097152 }, scale: { enabled: false, min: 30, max: 100 }, align: { enabled: false, x: ['center'], y: ['center'] } },
        },
      ],
    },
    params: { schemaVersion: 1, hue: 180, zones: { title: { text: 'WWWW' } } },
  };
  const jobFile = path.join(dir, 'job.json');
  fs.writeFileSync(jobFile, JSON.stringify(job));

  const r = spawnSync(process.execPath, [path.join(root, 'src/render.mjs'), jobFile], { env: process.env, timeout: 120000 });
  const out = JSON.parse(r.stdout.toString().trim().split('\n').pop());
  assert.equal(r.status, 0, r.stderr.toString());
  assert.equal(out.ok, true, out.error);
  assert.equal(out.mp4, undefined);
  assert.ok(out.png.size > 0 && out.jpg.size > 0);

  const png = probe(out.png.path);
  assert.deepEqual([png.codec_name, png.width, png.height, png.pix_fmt], ['png', 641, 361, 'rgb24']);
  // Tagged sRGB; the fallback gAMA (for old decoders) must be sRGB's 1/2.2, not a video gamma
  const chunks = pngChunks(out.png.path);
  assert.ok(chunks.sRGB, `chunks: ${Object.keys(chunks)}`);
  if (chunks.gAMA) assert.equal(chunks.gAMA.readUInt32BE(0), 45455);
  const jpg = probe(out.jpg.path);
  assert.deepEqual([jpg.codec_name, jpg.width, jpg.height], ['mjpeg', 641, 361]);

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    // Background corner, logo center, and the text row (some pixel must be the red text)
    const textRow = Array.from({ length: 120 }, (_, i) => [200 + i * 2, 72]);
    const [corner, logoPx, ...row] = await readPixels(page, out.png.path, [[5, 5], [320, 270], ...textRow]);
    const expected = parseHex(shiftColor('#102040', 180));
    corner.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) <= 2, `background ${corner} vs CSS hue-rotate ${expected}`));
    assert.ok(logoPx.every((v) => v > 245), `logo pixel ${logoPx}`);
    assert.ok(row.some(([r, g, b]) => r > 200 && g < 60 && b < 60), 'the red text is drawn and not hue-shifted');

    // The JPG decodes to the same colors (full-range BT.601 as JFIF expects)
    const [jCorner, jLogo] = await readPixels(page, out.jpg.path, [[5, 5], [320, 270]]);
    jCorner.forEach((v, i) => assert.ok(Math.abs(v - corner[i]) <= 3, `JPG background ${jCorner} vs PNG ${corner}`));
    assert.ok(jLogo.every((v) => v > 240), `JPG logo pixel ${jLogo}`);
  } finally {
    await browser.close();
  }
});

test('animated GIF icons move in the video and keep their z-order', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg is not installed');
  const probeBrowser = await launchBrowser();
  if (!probeBrowser) return t.skip('no Chromium available');
  await probeBrowser.close();

  const dir = path.join(tmpDir, 'render-gif');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const source = path.join(dir, 'source.mp4');
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=0x102040:s=640x360:r=25:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', source]);
  // Two frames, half a second each: red, then green; loops forever
  const icon = path.join(dir, 'icon.gif');
  ffmpeg([
    '-f', 'lavfi', '-i', 'color=c=red:s=64x64:r=2:d=0.5', '-f', 'lavfi', '-i', 'color=c=lime:s=64x64:r=2:d=0.5',
    '-filter_complex', '[0:v][1:v]concat=n=2:v=1[v]', '-map', '[v]', '-loop', '0', icon,
  ]);
  const badge = path.join(dir, 'badge.png');
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=white:s=40x40', '-frames:v', '1', badge]);

  const imageZone = (key, x, y, w, h) => ({
    key, type: 'image', label: key, x, y, w, h,
    style: { scale: 100, alignX: 'center', alignY: 'center' },
    controls: { upload: { enabled: true, maxBytes: 2097152 }, scale: { enabled: false, min: 30, max: 100 }, align: { enabled: false, x: ['center'], y: ['center'] } },
  });
  const job = {
    width: 640, height: 360, duration: 2, workDir: path.join(dir, 'out'), source, threads: 2, sandbox: false,
    fonts: [{ id: 7, weight: 700, style: 'normal', file: font }],
    // icon box: 128x72 px at (64, 72); the 64x64 GIF is contained as 72x72 at (92, 72).
    // The badge (drawn after the icon, so above it) covers the icon's top-left part.
    images: { icon, badge },
    outputs: { mp4: true, gif: { enabled: true, width: 320, fps: 10 } },
    config: {
      schemaVersion: 1, accent: '#1e9bff', hue: { enabled: true, default: 0, presets: [] },
      zones: [
        {
          key: 'title', type: 'text', label: 'Title', x: 40, y: 60, w: 55, h: 30,
          style: { text: 'BELOW', fontId: 7, size: 8, minSize: 4, case: 'upper', align: 'center', color: '#ffffff', glow: false, lineHeight: 1.1, letterSpacing: 0 },
          controls: {
            text: { enabled: false, maxLength: 20, multiline: false }, size: { enabled: false, min: 4, max: 8 },
            color: { enabled: false, palette: [], custom: false }, align: { enabled: false, options: ['center'] }, visible: { enabled: false },
          },
        },
        imageZone('icon', 10, 20, 20, 20),
        imageZone('badge', 14, 20, 6, 10),
      ],
    },
    params: { schemaVersion: 1, hue: 180, zones: {} },
  };
  const jobFile = path.join(dir, 'job.json');
  fs.writeFileSync(jobFile, JSON.stringify(job));

  const r = spawnSync(process.execPath, [path.join(root, 'src/render.mjs'), jobFile], { env: process.env, timeout: 180000 });
  const out = JSON.parse(r.stdout.toString().trim().split('\n').pop());
  assert.equal(r.status, 0, r.stderr.toString());
  assert.equal(out.ok, true, out.error);
  assert.equal(out.animated, 1);
  assert.equal(out.timings.layers, 3); // title slice, the GIF, badge slice

  const mp4 = probe(out.mp4.path);
  assert.deepEqual(
    [mp4.codec_name, mp4.width, mp4.height, mp4.pix_fmt, mp4.color_space, mp4.color_primaries, mp4.color_transfer],
    ['h264', 640, 360, 'yuv420p', 'bt709', 'bt709', 'bt709'],
  );
  const dur = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out.mp4.path]).stdout.toString();
  assert.ok(Math.abs(Number(dur) - 2) < 0.1, `duration ${dur}`);

  const frame = (at) => {
    const f = path.join(dir, `frame-${at}.png`);
    ffmpeg(['-ss', String(at), '-i', out.mp4.path, '-frames:v', '1', f]);
    return f;
  };
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const points = [[150, 130], [100, 85], [5, 5]];
    const [iconA, badgeA, bgA] = await readPixels(page, frame(0.2), points);
    const [iconB, badgeB] = await readPixels(page, frame(0.7), points);
    const [iconC] = await readPixels(page, frame(1.2), points);

    // The icon animates (red -> green -> red again: it loops) and isn't hue-shifted
    assert.ok(iconA[0] > 200 && iconA[1] < 60, `icon at 0.2 s ${iconA} should be red`);
    assert.ok(iconB[1] > 200 && iconB[0] < 60, `icon at 0.7 s ${iconB} should be green`);
    assert.ok(iconC[0] > 200 && iconC[1] < 60, `icon at 1.2 s ${iconC} should be red again`);
    // The badge stays on top of the GIF in every frame
    assert.ok(badgeA.every((v) => v > 235) && badgeB.every((v) => v > 235), `badge ${badgeA} / ${badgeB}`);
    // Only the background is hue-shifted
    assert.ok(bgA[0] > bgA[2], `background ${bgA} should be hue-shifted`);
  } finally {
    await browser.close();
  }
  // The GIF output animates too
  assert.equal(probe(out.gif.path).codec_name, 'gif');
});

test('a GIF on an image template is drawn as its first frame', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg is not installed');
  const browser = await launchBrowser();
  if (!browser) return t.skip('no Chromium available');

  const dir = path.join(tmpDir, 'render-image-gif');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const source = path.join(dir, 'source.png');
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=0x102040:s=320x180', '-frames:v', '1', '-pix_fmt', 'rgb24', source]);
  const icon = path.join(dir, 'icon.gif');
  ffmpeg([
    '-f', 'lavfi', '-i', 'color=c=red:s=32x32:r=2:d=0.5', '-f', 'lavfi', '-i', 'color=c=lime:s=32x32:r=2:d=0.5',
    '-filter_complex', '[0:v][1:v]concat=n=2:v=1[v]', '-map', '[v]', '-loop', '0', icon,
  ]);
  const job = {
    kind: 'image', width: 320, height: 180, workDir: path.join(dir, 'out'), source, sandbox: false, fonts: [],
    images: { icon }, outputs: { png: true, jpg: { enabled: false, quality: 92 } },
    config: {
      schemaVersion: 1, accent: '#1e9bff', hue: { enabled: false, default: 0, presets: [] },
      zones: [{
        key: 'icon', type: 'image', label: 'Icon', x: 40, y: 30, w: 20, h: 40,
        style: { scale: 100, alignX: 'center', alignY: 'center' },
        controls: { upload: { enabled: true, maxBytes: 2097152 }, scale: { enabled: false, min: 30, max: 100 }, align: { enabled: false, x: ['center'], y: ['center'] } },
      }],
    },
    params: { schemaVersion: 1, hue: 0, zones: {} },
  };
  const jobFile = path.join(dir, 'job.json');
  fs.writeFileSync(jobFile, JSON.stringify(job));

  const r = spawnSync(process.execPath, [path.join(root, 'src/render.mjs'), jobFile], { env: process.env, timeout: 120000 });
  const out = JSON.parse(r.stdout.toString().trim().split('\n').pop());
  assert.equal(out.ok, true, out.error || r.stderr.toString());
  assert.equal(out.jpg, null);
  try {
    const page = await browser.newPage();
    const [px] = await readPixels(page, out.png.path, [[160, 90]]);
    assert.ok(px[0] > 230 && px[1] < 40, `icon ${px} should be the first (red) frame`);
  } finally {
    await browser.close();
  }
});

test('fails cleanly with a JSON error for a broken job', () => {
  const jobFile = path.join(tmpDir, 'broken.json');
  fs.writeFileSync(jobFile, JSON.stringify({ width: 10 }));
  const r = spawnSync(process.execPath, [path.join(root, 'src/render.mjs'), jobFile]);
  assert.equal(r.status, 1);
  const out = JSON.parse(r.stdout.toString().trim());
  assert.equal(out.ok, false);
  assert.match(out.error, /missing/);
});
