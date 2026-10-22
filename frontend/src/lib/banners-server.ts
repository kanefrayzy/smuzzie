import { cache } from 'react';
import type { PublicBannerTemplate, PublicBannerTemplateCard } from '@/types/banners';
import { getImageUrl } from '@/lib/utils';
import { SITE_URL } from '@/lib/site';
import { FORMAT_LABEL, templateFormats } from '@/lib/banner-formats';

// Server-side reads of the public banner catalog, so the catalog and template pages ship real
// HTML (texts, prices, structured data) to crawlers instead of a spinner. Cached for 5 minutes.

const API = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');
const REVALIDATE = 300;

async function get<T>(path: string): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  try {
    const res = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' }, next: { revalidate: REVALIDATE } });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** Published templates, or null when the API can't be reached. */
export const fetchBannerTemplates = cache(async (): Promise<PublicBannerTemplateCard[] | null> => {
  const r = await get<PublicBannerTemplateCard[]>('/banners/templates');
  return r.ok ? r.data : null;
});

/** A template, 'missing' for 404, or null when the API can't be reached. */
export const fetchBannerTemplate = cache(async (slug: string): Promise<PublicBannerTemplate | 'missing' | null> => {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return 'missing';
  const r = await get<PublicBannerTemplate>(`/banners/templates/${slug}`);
  if (r.ok) return r.data;
  return r.status === 404 ? 'missing' : null;
});

/** Absolute media URL for metadata and JSON-LD. */
export function absoluteMedia(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const u = getImageUrl(url);
  return u.startsWith('http') ? u : `${SITE_URL}${u.startsWith('/') ? '' : '/'}${u}`;
}

export function formatPrice(price: string, currency: string): string {
  const n = Number(price);
  const symbol = currency === 'USD' ? '$' : '';
  const amount = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return symbol ? `${symbol}${amount}` : `${amount} ${currency}`;
}

/** "MP4 1450×1694 + GIF", "PNG 1200×628 + JPG" */
export function formatsLabel(t: PublicBannerTemplateCard): string {
  const [first, ...rest] = templateFormats(t).map((f) => FORMAT_LABEL[f]);
  return [`${first} ${t.width}×${t.height}`, ...rest].join(' + ');
}

/** Serialize JSON-LD safely for a <script> tag (no "</script>" breakouts). */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
