#!/usr/bin/env node
// Рендер готового баннера.
//   node tools/render.cjs <template_dir> <data.json> <out_dir>
// 1) headless Chromium рисует слой текста и логотипа (тот же overlay.js, что в превью) в прозрачный PNG
// 2) ffmpeg сдвигает оттенок фона той же матрицей, что CSS hue-rotate, накладывает PNG
// 3) на выходе banner.mp4 (оригинальное разрешение) и banner.gif (600px, 15 fps)
// В проде вызывается из Laravel job через Process::run(). Вместо playwright можно puppeteer, API почти такой же.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const [tplDir, dataFile, outDir] = process.argv.slice(2);
if (!tplDir || !dataFile || !outDir) {
  console.error('usage: render.cjs <template_dir> <data.json> <out_dir>');
  process.exit(1);
}

const PUBLIC = path.resolve(__dirname, '..', 'public');
const tpl = JSON.parse(fs.readFileSync(path.join(tplDir, 'template.json'), 'utf8'));
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

// Логотип: путь к файлу -> data URL, чтобы страница не ходила на диск
for (const f of tpl.fields) {
  if (f.type === 'image' && data[f.key] && !String(data[f.key]).startsWith('data:')) {
    const p = path.resolve(path.dirname(dataFile), data[f.key]);
    const ext = path.extname(p).slice(1).toLowerCase().replace('jpg', 'jpeg');
    data[f.key] = 'data:image/' + ext + ';base64,' + fs.readFileSync(p).toString('base64');
  }
}

// Шрифты по file:// Chromium может не отдать, поэтому крошечный статический сервер
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const file = path.join(PUBLIC, path.normalize(decodeURIComponent(req.url.split('?')[0])));
      if (!file.startsWith(PUBLIC) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    }).listen(0, '127.0.0.1', () => resolve(srv));
  });
}

(async () => {
  const t0 = Date.now();
  const srv = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: tpl.width, height: tpl.height }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:' + srv.address().port + '/render.html');
  await page.evaluate(([t, d]) => window.renderOverlay(t, d), [tpl, data]);
  const overlay = path.join(outDir, 'overlay.png');
  await page.locator('#stage').screenshot({ path: overlay, omitBackground: true });
  await browser.close();
  srv.close();
  const t1 = Date.now();

  const m = hueMatrix(Number(data.hue) || 0).map(v => v.toFixed(6));
  const mixer = `colorchannelmixer=rr=${m[0]}:rg=${m[1]}:rb=${m[2]}:gr=${m[3]}:gg=${m[4]}:gb=${m[5]}:br=${m[6]}:bg=${m[7]}:bb=${m[8]}`;
  const graph = [
    `[0:v]scale=in_color_matrix=bt709,format=gbrp${Number(data.hue) ? ',' + mixer : ''}[bg]`,
    `[bg][1:v]overlay=0:0:format=rgb[mix]`,
    `[mix]scale=out_color_matrix=bt709,format=yuv420p[v]`
  ].join(';');
  const mp4 = path.join(outDir, 'banner.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(tplDir, tpl.source), '-i', overlay,
    '-filter_complex', graph, '-map', '[v]', '-an',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-movflags', '+faststart', mp4]);
  const t2 = Date.now();

  const gif = path.join(outDir, 'banner.gif');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-filter_complex',
    'fps=15,scale=600:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle',
    '-loop', '0', gif]);
  const t3 = Date.now();

  console.log(JSON.stringify({
    overlay_ms: t1 - t0, mp4_ms: t2 - t1, gif_ms: t3 - t2,
    mp4_kb: Math.round(fs.statSync(mp4).size / 1024), gif_kb: Math.round(fs.statSync(gif).size / 1024)
  }));
})().catch(e => { console.error(e); process.exit(1); });

function hueMatrix(deg) {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072
  ];
}
