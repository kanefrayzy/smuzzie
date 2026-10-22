#!/usr/bin/env node
// Banner render: node src/render.mjs <job.json>
//
// 1. headless Chromium draws the text/logo layer with the shared overlay module (the same code
//    as the site preview) into a transparent PNG at the template's native resolution;
// 2. ffmpeg shifts the background hue with the CSS hue-rotate matrix and lays the PNG on top;
// 3. video templates: MP4 (always) and GIF (optional); image templates (job.kind "image"):
//    PNG (always) and JPG (optional). Files go to job.workDir.
//
// Animated GIF logos/icons can't live in a screenshot. On video templates the page leaves them out
// and reports where each one is drawn; the overlay is then cut into slices by z-order (zones below
// a GIF, the GIF, zones above it, ...) and ffmpeg stacks the slices and the GIFs, each GIF looped
// for the length of the video. Usually that is one or two screenshots. On image templates GIFs are
// drawn as their first frame.
//
// Prints ONE line of JSON to stdout: { ok: true, mp4, gif | png, jpg, timings, fit } or { ok: false, error }.
// Diagnostics go to stderr. Exit code 0 on success, 1 on failure.
//
// The page can only reach the local static server (every other request is aborted), and the
// buyer's logos are passed as data: URLs, so the page never touches the network or the disk.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { startServer } from './server.mjs';
import { mp4Args, gifArgs, pngArgs, jpgArgs, firstFrameArgs } from './ffmpeg.mjs';
import { resolveHue } from '../dist/overlay.mjs';

function fail(message, extra = {}) {
  process.stdout.write(JSON.stringify({ ok: false, error: message, ...extra }) + '\n');
  process.exit(1);
}

function readJob(file) {
  if (!file) fail('usage: render.mjs <job.json>');
  const job = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const key of ['width', 'height', 'config', 'params', 'source', 'fonts', 'workDir']) {
    if (job[key] === undefined) fail(`job.json: missing "${key}"`);
  }
  if (!Number.isInteger(job.width) || !Number.isInteger(job.height) || job.width < 2 || job.height < 2 || job.width > 4096 || job.height > 4096) {
    fail('job.json: bad size');
  }
  if (!fs.existsSync(job.source)) fail(job.kind === 'image' ? 'Template image not found' : 'Template source video not found');
  for (const f of job.fonts) if (!fs.existsSync(f.file)) fail(`Font file not found (id ${f.id})`);
  return job;
}

const isGif = (file) => path.extname(file).toLowerCase() === '.gif';

function dataUrl(file) {
  return `data:image/${isGif(file) ? 'gif' : 'png'};base64,` + fs.readFileSync(file).toString('base64');
}

function run(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => (stderr = (stderr + d).slice(-8000)));
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(cmd)} failed (${signal || code}): ${stderr.trim().split('\n').slice(-5).join(' | ')}`));
    });
  });
}

/**
 * Draws the overlay and screenshots it. Without animated images: one full PNG. With them: the
 * stack bottom to top as [{ file } | { file, animated: true, x, y, w, h, opacity }].
 */
async function drawOverlay(job, images, animatedKeys) {
  const server = await startServer(job.fonts);
  const browser = await chromium.launch({
    headless: true,
    chromiumSandbox: job.sandbox !== false,
    executablePath: process.env.BANNERS_CHROMIUM_PATH || undefined,
    // Unhinted glyph metrics, so measurements don't depend on the host's font settings
    args: ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: job.width, height: job.height },
      deviceScaleFactor: 1,
      javaScriptEnabled: true,
      offline: false,
    });
    const page = await context.newPage();
    // Only the local static server; data: URLs (logos) aren't routed
    await page.route('**/*', (route) =>
      route.request().url().startsWith(server.origin + '/') ? route.continue() : route.abort('blockedbyclient'),
    );
    page.on('console', (m) => m.type() === 'error' && process.stderr.write(`[page] ${m.text()}\n`));

    await page.goto(`${server.origin}/render.html`, { waitUntil: 'load', timeout: 30000 });

    const urls = {};
    for (const [key, file] of Object.entries(images)) urls[key] = dataUrl(file);

    const fonts = job.fonts.map((f) => ({
      id: f.id, family: `bf-${Number(f.id)}`, name: '', weight: f.weight, style: f.style, url: `/fonts/${Number(f.id)}`,
    }));

    const layout = await page.evaluate((input) => window.renderOverlay(input), {
      width: job.width, height: job.height, config: job.config, params: job.params, images: urls, fonts,
    });

    const shoot = (file) => page.locator('#stage').screenshot({ path: file, omitBackground: true, animations: 'disabled', timeout: 30000 });
    const plan = animatedKeys.length ? await page.evaluate((keys) => window.planLayers(keys), animatedKeys) : [];
    if (!plan.some((p) => p.type === 'animated')) {
      const file = path.join(job.workDir, 'overlay.png');
      await shoot(file);
      return { layout, layers: [{ file }] };
    }

    const layers = [];
    for (const [i, p] of plan.entries()) {
      if (p.type === 'animated') {
        layers.push({ file: images[p.key], animated: true, ...p.box });
        continue;
      }
      const file = path.join(job.workDir, `overlay-${i}.png`);
      await page.evaluate((keys) => window.showOnly(keys), p.keys);
      await shoot(file);
      layers.push({ file });
    }
    return { layout, layers };
  } finally {
    await browser.close();
    await server.close();
  }
}

async function main() {
  const job = readJob(process.argv[2]);
  fs.mkdirSync(job.workDir, { recursive: true });
  const ffmpeg = job.ffmpeg || 'ffmpeg';
  const threads = job.threads || 3;
  const timings = {};

  let t = Date.now();
  const images = { ...(job.images || {}) };
  const gifKeys = Object.keys(images).filter((k) => isGif(images[k]));
  if (job.kind === 'image') {
    // A still can't move: animated logos are drawn as their first frame
    for (const key of gifKeys) {
      const png = path.join(job.workDir, `first-frame-${gifKeys.indexOf(key)}.png`);
      await run(ffmpeg, firstFrameArgs({ gif: images[key], out: png }), 30 * 1000);
      images[key] = png;
    }
  }
  const { layout, layers } = await drawOverlay(job, images, job.kind === 'image' ? [] : gifKeys);
  timings.overlay_ms = Date.now() - t;
  const overlayPng = layers[0].file;

  const hue = resolveHue(job.config, job.params);
  const fit = {};
  for (const [key, z] of Object.entries(layout.zones)) {
    fit[key] = { requested: z.requested, used: Math.round(z.used * 1000) / 1000, shrunk: z.shrunk, overflow: z.overflow, lines: z.lines.length };
  }
  const file = (f) => (f ? { path: f, size: fs.statSync(f).size } : null);

  if (job.kind === 'image') {
    const png = path.join(job.workDir, 'banner.png');
    t = Date.now();
    await run(ffmpeg, pngArgs({ source: job.source, overlay: overlayPng, out: png, hue }), 2 * 60 * 1000);
    timings.png_ms = Date.now() - t;

    let jpg = null;
    if (job.outputs?.jpg?.enabled) {
      jpg = path.join(job.workDir, 'banner.jpg');
      t = Date.now();
      await run(ffmpeg, jpgArgs({ png, out: jpg, quality: job.outputs.jpg.quality }), 2 * 60 * 1000);
      timings.jpg_ms = Date.now() - t;
    }
    process.stdout.write(JSON.stringify({ ok: true, png: file(png), jpg: file(jpg), hue, timings, fit }) + '\n');
    return;
  }

  const mp4 = path.join(job.workDir, 'banner.mp4');
  t = Date.now();
  await run(ffmpeg, mp4Args({ source: job.source, layers, out: mp4, hue, threads }), 6 * 60 * 1000);
  timings.mp4_ms = Date.now() - t;
  timings.layers = layers.length;

  let gif = null;
  const gifOut = job.outputs?.gif;
  if (gifOut?.enabled) {
    gif = path.join(job.workDir, 'banner.gif');
    t = Date.now();
    // Never wider than the video itself
    const width = Math.min(Number(gifOut.width) || job.width, job.width);
    await run(ffmpeg, gifArgs({ mp4, out: gif, width, fps: gifOut.fps, threads }), 4 * 60 * 1000);
    timings.gif_ms = Date.now() - t;
  }

  const animated = layers.filter((l) => l.animated).length;
  process.stdout.write(JSON.stringify({ ok: true, mp4: file(mp4), gif: file(gif), hue, animated, timings, fit }) + '\n');
}

main().catch((e) => {
  process.stderr.write(String(e?.stack || e) + '\n');
  fail(String(e?.message || e).slice(0, 1000));
});
