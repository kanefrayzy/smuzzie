# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Smuzzie (smuzzie.com) is a design-portfolio site: a public showcase of portfolio items (images, GIFs, videos) grouped by category, plus reviews and a contact form, with an admin panel to manage it all. It is two independent apps in one repo; the root `package-lock.json` is empty and there is no root tooling.

- `backend/` — Laravel 10 (PHP 8.1+) JSON API. MySQL by default (`config/database.php`).
- `frontend/` — Next.js 14 App Router, TypeScript, Tailwind, Zustand, axios.
- `renderer/` — Node script that renders banner orders (headless Chromium + ffmpeg); see "Banner builder".
- `deploy/` — server config for the banner builder (supervisor worker, AppArmor profile).
- `docs/banners/` — banner builder plan, server setup (`DEPLOY.md`) and the original prototype.
- `nginx-cache.conf` — production snippet that proxies `/storage/` to Laravel with long-lived cache headers.

## Commands

Backend (run from `backend/`):

```bash
composer install
php artisan migrate --seed          # seeds admin user, 8 categories, sample reviews
php artisan db:seed --class=DemoPortfolioSeeder
php artisan storage:link            # required: uploads are served from public/storage
php artisan serve                   # http://localhost:8000
php vendor/bin/phpunit              # in-memory SQLite (phpunit.xml), no .env needed; needs doctrine/dbal (require-dev)
php vendor/bin/phpunit --filter=AdminRoutesAccessTest
./vendor/bin/pint                   # PHP code style
php artisan portfolio:video-thumbnails [--force]   # backfill video poster JPGs (needs ffmpeg)
php artisan queue:work banners --queue=banners     # banner worker (template videos + renders)
php artisan banners:cleanup [--dry-run]            # daily via the scheduler
php artisan mail:preview [type] [--to=addr]        # emails -> storage/app/mail-previews, or send them
```

Renderer (run from `renderer/`):

```bash
npm ci && npm run build   # bundles frontend/src/lib/banner-overlay into dist/ (rebuild after changing it)
npm test                  # hue matrix, layout, end-to-end render; set BANNERS_CHROMIUM_PATH to a local Chrome
```

Frontend (run from `frontend/`):

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint     # next lint
```

No `.env.example` is committed for either app. Backend `.env` needs the usual Laravel DB settings, `APP_URL` (used to build storage URLs), and `JWT_SECRET` (`php artisan jwt:secret`). Frontend reads `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000/api/v1`) and `NEXT_PUBLIC_SITE_URL` (public origin for canonicals/sitemap/OG, defaults to `https://smuzzie.com`).

Seeded admin login: `admin@designportfolio.com` / `password123`.

## Architecture

### API (`backend/routes/api.php`)

All routes live under `/api/v1`. Public routes: categories, portfolio, reviews (read-only), `POST /contact` (throttled 3/min), `POST /auth/login` (throttled 10/min). Everything under `/api/v1/admin/*` requires `auth:api` + `admin` middleware.

The same controller serves both public and admin routes (e.g. `PortfolioController@index`). Inactive records are returned only when the request is on an admin route (`Controller::isAdminRequest()`) *and* passes `include_inactive`; public routes always filter to active. Keep that check when adding public/admin shared endpoints. Errors come back as `{errors: {...}}` (422) or `{error: '...'}` (500/503); the frontend reads them with `getApiError()` in `src/lib/utils.ts`.

### Auth

JWT via `tymon/jwt-auth` on the `api` guard (`config/auth.php`). Sanctum is installed but unused. Login rejects non-admin users (`User::isAdmin()`, based on the `role` column). The frontend stores the token in `localStorage` as `admin_token`; `frontend/src/lib/api.ts` attaches it as a Bearer header and redirects to `/admin/login` on any 401. Admin route protection on the frontend is purely client-side in `src/components/admin/AdminShell.tsx` via the Zustand store in `src/lib/store.ts`; `src/app/admin/layout.tsx` is a server wrapper that only adds `noindex` metadata.

### Media pipeline

Uploads go to the Laravel `public` disk via `app/Services/LocalStorageService.php`:

- Files get UUID names under `portfolio/`; thumbnails are written to `portfolio/thumbnails/<uuid>_thumb.jpg`. `delete()` relies on this naming to remove both.
- Images/GIFs are thumbnailed with Intervention Image 2.7; videos (mp4/webm) get a poster frame via a shell call to `ffmpeg`. If thumbnailing fails, the original file URL is stored as `thumbnail_url` (the `portfolio:video-thumbnails` command looks for exactly that case).
- `PortfolioItem.file_type` is `image | gif | video`; for GIFs and videos `gif_url` is set to the original file URL.
- Max upload is 500MB, so PHP/nginx upload limits matter in deployment.

After upload, `App\Jobs\OptimizePortfolioMedia` runs via `dispatchAfterResponse()` (same PHP process, after the response is sent — no queue worker) and `App\Services\MediaOptimizer` writes web-optimized derivatives to `portfolio/variants/<uuid>_*`, recorded in the `variants` JSON column:

- images → WebP at 640/1280/1920 px (never upscaled), quality 88;
- videos and GIFs → H.264 MP4 (`_preview.mp4` ≤720 px for the grid, `_full.mp4` ≤1920 px for the lightbox) plus a WebP poster.

The quality settings were chosen by comparing against originals at 2× zoom: WebP q80 visibly softened red edges and paper textures, q88 didn't. Don't lower them without re-checking. Originals are never modified and remain the zoom-viewer source. `php artisan portfolio:optimize-media [--force] [--id=N]` (re)builds variants for existing items. Requires `ffmpeg`/`ffprobe` with libwebp + libx264.

`LocalStorageService::delete()` also removes an item's variants, so any code path deleting media through it stays clean.

The project migrated off Cloudinary (see the `2026_02_07` migration). `app/Services/CloudinaryService.php` is dead code and its package is not in `composer.json`; don't use it.

On the frontend, pick what to render with `getItemMedia()` in `src/lib/media.ts` (variants when present, originals as fallback — so unprocessed items keep working); raw URLs go through `getImageUrl()` in `src/lib/utils.ts`. It rewrites whatever host the DB stored to the current backend origin derived from `NEXT_PUBLIC_API_URL`, which covers stale `APP_URL` values in old rows.

### Production server

`ssh smuzzie` (root, key `~/.ssh/smuzzie_root`). Ubuntu 24.04; repo checked out at `/var/www/smuzzie` (deployed via `git pull` from `origin/main`); nginx site config `/etc/nginx/sites-enabled/smuzzie.com` (serves `smuzzie.com` and `smuzzie.design`); Laravel on PHP 8.3-FPM (`www-data`); Next.js under pm2 as `smuzzie-frontend` (`npm start -- -p 3000`); MySQL database `design_portfolio`. `/storage` is served by nginx straight from `backend/storage/app/public`. Pre-deploy backups go to `/root/backups/smuzzie-<timestamp>/` (DB dump, env files, nginx config, previous commit).

Deploy without downtime:
1. Back up the DB, then `git pull` in `/var/www/smuzzie` (check `git status` first — production has had hand edits before).
2. Backend: `sudo -u www-data php artisan migrate --force` (run artisan as `www-data` so log/cache files stay writable by FPM).
3. Banner worker: `sudo -u www-data php artisan queue:restart` after every deploy (supervisor restarts it with the new code). If `frontend/src/lib/banner-overlay/` or `renderer/` changed, first `cd renderer && npm ci && npm run build`.
4. Frontend: `cd frontend && NEXT_DIST_DIR=.next-new npm run build`, smoke-test with `NEXT_DIST_DIR=.next-new npx next start -p 3001`, then `mv .next .next.prev && mv .next-new .next && pm2 restart smuzzie-frontend`. Don't build into the live `.next` (pages 500 mid-build), and don't build in another directory and copy it over (the build embeds absolute source paths).

### Banner builder

Buyers customize video templates (After Effects render without text + zones JSON), or static ones (a PNG/JPG background), at `/banners` (public: in the header, footer, homepage and sitemap). The catalog and template pages are server components (`src/lib/banners-server.ts`, rendered per request so admin changes show at once) so crawlers get HTML, metadata and JSON-LD (Product/Offer, BreadcrumbList, FAQPage); the editor itself is the client component `BannerTemplateClient`. Order pages (`/banners/order/*`) are `noindex`. Full design: `docs/banners/PLAN.md`; server setup: `docs/banners/DEPLOY.md`.

- **One layout module.** `frontend/src/lib/banner-overlay/` (plain TS, no React) lays out the text/logo layer for the site preview, the admin zone editor and the renderer (bundled by `renderer/build.mjs`). It decides font size and line breaks itself (canvas measurements, explicit lines) so the preview and the file match; never duplicate that logic. User data goes into the DOM only via `textContent`/style properties/`img.src`.
- **Color.** The preview shifts the background with CSS `hue-rotate` on the `<video>`; the renderer applies the same matrix with ffmpeg `colorchannelmixer` (not the `hue` filter). Video outputs are bt709-tagged via `setparams` (ffmpeg takes color metadata from frames).
- **Config format** (`banner_templates.config`, `schemaVersion` 1): zones in % of the video, text sizes in % of the video width, `style` = defaults, `controls` = what the buyer may change and the limits. Validated by `BannerConfigValidator`; buyer input by `BannerParamsValidator` against the order's snapshot (unknown keys / disabled controls dropped, bad values 422). The frontend mirror is `banner-overlay/resolve.ts`.
- **Orders** store a full template snapshot; the renderer reads only the snapshot. Status changes go through `BannerOrderService`; `markPaid()` is the single, idempotent way into the paid state (admin button now, payment webhook later). `BANNERS_AUTO_APPROVE=true` skips payment in development.
- **Storage.** Private disk `banners` (`storage/app/banners`): template masters, buyer logos, results, temp folders. Public disk: watermarked previews, posters, fonts. Files are never overwritten (new names per upload), so snapshots stay valid. Downloads only via `temporarySignedRoute` (7 days).
- **Queue.** Banner jobs use their own `banners` database connection (`retry_after` 900) with one supervisor worker; the default `QUEUE_CONNECTION` stays `sync` (`OptimizePortfolioMedia` runs in-process anyway). After deploying, run `php artisan queue:restart`.
- **Mail.** All site email goes through `App\Services\Mail\MailSender`: never throws (errors are logged), sends after the HTTP response (the global `SendMailAfterResponse` middleware flushes in `terminate()`) or, outside a request, right after the DB commit. No queued mail: the single banner worker is busy with renders. Who gets what is in `BannerNotifications` (order received / paid / ready, admin: paid, payment review, render failed) and `ContactNotifications`; each order email is sent once via an atomically claimed `*_notified_at` column. Never for test orders or `BANNERS_AUTO_APPROVE`. Mailables extend `App\Mail\SiteMail` (one layout `resources/views/mail/layout.blade.php`, text versions in `mail/text/`; HTML views use `{{ }}`, text views `{!! !!}`). `php artisan mail:preview [type] [--to=]` renders or sends every email with sample data. SMTP is Resend; settings in `docs/banners/DEPLOY.md`.
- **Payments.** WestWallet crypto on the order page (no redirect): a deposit address per order + coin, IPN at `/api/v1/payments/westwallet/ipn` (IP + secret checked, every transaction re-verified through their API) and `banners:payments-sync` every minute as a safety net; the only way to "paid" is still `markPaid()`. Keys and rules are env vars (`WESTWALLET_*`, `BANNERS_PAYMENT_*`), see `docs/banners/DEPLOY.md`; `php artisan payments:westwallet-check` tests the setup read-only. The API key only works from the prod server IP.
- **Static templates.** `banner_templates.kind` is `video` or `image`, set by what the admin uploads (MP4/MOV, or PNG/JPG/WebP in sRGB). Image templates get a PNG master and WebP preview/poster (GD, `TemplateMediaProcessor`), render to PNG (+ optional JPG) in RGB with the same hue matrix, and their snapshots carry `kind`. Formats per kind live in `App\Services\Banners\BannerMedia` (frontend: `src/lib/banner-formats.ts`); `validateOutputs` checks outputs by kind. GIF output defaults to 1000 px, capped by the template width.
- **Icons and animated GIFs.** Up to 40 image zones ("+ Icon" preset; 70 zones in all, env `BANNERS_MAX_*`). An image zone may carry the template's own image (`style.image`, public disk `banners/zone-images/`, uploaded via `zone-image`); the renderer uses it where the buyer uploaded nothing, and `controls.visible` lets the buyer remove it (`params.zones.<key>.visible = false`), same as for texts. Buyer images may be GIFs: `GifInfo` reads the structure (limits in `banners.logo.gif`), ffmpeg re-encodes them with a timeout, stored as `image-<key>.gif`. In video renders the overlay page reports each GIF's drawn box (`banner-overlay/boxes.ts`), the layer is screenshotted in z-order slices around the GIFs and ffmpeg stacks slices and looped GIFs; image templates use the GIF's first frame.
- **Buyer freedom per template** (all opt-in in the admin zone editor): style controls per text zone (font, case, spacing, line height, glow, opacity), moving/resizing zones inside an area (`controls.position`), and own text/image layers (`config.custom`, `params.layers`, synthetic zones built in `banner-overlay/custom.ts` and `BannerCustomLayers.php`, keep both in sync). A text may offer the whole font library (up to 500 faces, "Select all" in the admin): the editor, catalog cards and the renderer download only the faces in use (`usedFontIds`), the buyer's picker loads each face when it scrolls into view. `php artisan banners:import-fonts <dir>` bulk-imports a folder of woff2 files.

### Frontend layout

- `src/app/(site)/` — public pages sharing the Header/Footer layout. Pages are client components that fetch from the API at runtime (`publicApi` in `src/lib/api.ts`), not at build time. Because client pages can't export `metadata`, each route has a small server `layout.tsx` that sets title/description/canonical/OG via `pageMetadata()` in `src/lib/site.ts`. `robots.ts`, `sitemap.ts` and `opengraph-image.tsx` (edge runtime — the Node build of `next/og` fails on Windows) live in `src/app/`.
- `useSearchParams` makes everything up to the nearest `<Suspense>` client-only, so keep that boundary tight (see `portfolio/page.tsx`) or the page ships as an empty spinner to crawlers.
- `src/app/admin/` — admin panel (dashboard, categories, portfolio, reviews, contacts); calls go through `adminApi`. Portfolio updates are sent as `POST` with `_method=PUT` because they're multipart.
- `src/components/sections/` — homepage sections; `src/components/portfolio/` — grid and lazy GIF/video cards.
- Shared types are in `src/types/index.ts`. Import alias `@/*` → `src/*`.
- Theme colors (`primary`, `surface`, `accent-red`, etc.) and custom animations are defined in `tailwind.config.js`; the site is dark-themed with red accents.
