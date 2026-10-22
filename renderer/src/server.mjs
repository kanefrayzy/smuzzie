// Tiny static server for the render page. Serves exactly: the page, the overlay bundle and
// the fonts listed in the job (by id). Everything else is 404. Bound to 127.0.0.1 only.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {{ id: number, file: string }[]} fonts
 * @returns {Promise<{ origin: string, close: () => Promise<void> }>}
 */
export function startServer(fonts) {
  const files = new Map([
    ['/render.html', { file: path.join(root, 'page/render.html'), type: 'text/html; charset=utf-8' }],
    ['/overlay.js', { file: path.join(root, 'dist/overlay.js'), type: 'text/javascript; charset=utf-8' }],
  ]);
  for (const f of fonts) {
    files.set(`/fonts/${Number(f.id)}`, { file: f.file, type: 'font/woff2' });
  }

  const server = http.createServer((req, res) => {
    const entry = req.method === 'GET' ? files.get(new URL(req.url, 'http://x').pathname) : undefined;
    if (!entry || !fs.existsSync(entry.file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': entry.type, 'Cache-Control': 'no-store' });
    fs.createReadStream(entry.file).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}
