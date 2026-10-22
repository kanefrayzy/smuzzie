// Bundles the shared overlay module from the frontend (single source of the layout code):
//   dist/overlay.js   IIFE for the render page (window.BannerOverlay)
//   dist/overlay.mjs  ESM for Node (hue matrix, param resolution) used by the render script
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const entry = path.resolve(here, '../frontend/src/lib/banner-overlay/index.ts');

const common = { entryPoints: [entry], bundle: true, target: ['chrome110', 'node18'], logLevel: 'warning', legalComments: 'none' };

await Promise.all([
  build({ ...common, format: 'iife', globalName: 'BannerOverlay', outfile: path.join(here, 'dist/overlay.js') }),
  build({ ...common, format: 'esm', platform: 'neutral', outfile: path.join(here, 'dist/overlay.mjs') }),
]);

console.log('built dist/overlay.js and dist/overlay.mjs');
