# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Smuzzie (smuzzie.com) is a design-portfolio site: a public showcase of portfolio items (images, GIFs, videos) grouped by category, plus reviews and a contact form, with an admin panel to manage it all. It is two independent apps in one repo; the root `package-lock.json` is empty and there is no root tooling.

- `backend/` — Laravel 10 (PHP 8.1+) JSON API. MySQL by default (`config/database.php`).
- `frontend/` — Next.js 14 App Router, TypeScript, Tailwind, Zustand, axios.
- `nginx-cache.conf` — production snippet that proxies `/storage/` to Laravel with long-lived cache headers.

## Commands

Backend (run from `backend/`):

```bash
composer install
php artisan migrate --seed          # seeds admin user, 8 categories, sample reviews
php artisan db:seed --class=DemoPortfolioSeeder
php artisan storage:link            # required: uploads are served from public/storage
php artisan serve                   # http://localhost:8000
php artisan test                    # PHPUnit; only Laravel example tests exist
php artisan test --filter=ExampleTest
./vendor/bin/pint                   # PHP code style
php artisan portfolio:video-thumbnails [--force]   # backfill video poster JPGs (needs ffmpeg)
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

### Frontend layout

- `src/app/(site)/` — public pages sharing the Header/Footer layout. Pages are client components that fetch from the API at runtime (`publicApi` in `src/lib/api.ts`), not at build time. Because client pages can't export `metadata`, each route has a small server `layout.tsx` that sets title/description/canonical/OG via `pageMetadata()` in `src/lib/site.ts`. `robots.ts`, `sitemap.ts` and `opengraph-image.tsx` (edge runtime — the Node build of `next/og` fails on Windows) live in `src/app/`.
- `useSearchParams` makes everything up to the nearest `<Suspense>` client-only, so keep that boundary tight (see `portfolio/page.tsx`) or the page ships as an empty spinner to crawlers.
- `src/app/admin/` — admin panel (dashboard, categories, portfolio, reviews, contacts); calls go through `adminApi`. Portfolio updates are sent as `POST` with `_method=PUT` because they're multipart.
- `src/components/sections/` — homepage sections; `src/components/portfolio/` — grid and lazy GIF/video cards.
- Shared types are in `src/types/index.ts`. Import alias `@/*` → `src/*`.
- Theme colors (`primary`, `surface`, `accent-red`, etc.) and custom animations are defined in `tailwind.config.js`; the site is dark-themed with red accents.
