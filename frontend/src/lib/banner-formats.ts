import type { BannerFormat, BannerKind, BannerOutputs } from '@/types/banners';
import { getImageUrl } from '@/lib/utils';

// Video templates produce MP4 (+ GIF), image ("static") templates PNG (+ JPG). Same rules as
// App\Services\Banners\BannerMedia on the server, which also sends `formats` with templates.

export const FORMAT_LABEL: Record<BannerFormat, string> = { mp4: 'MP4', gif: 'GIF', png: 'PNG', jpg: 'JPG' };

/** Download buttons in this order; the first one available is the main file */
export const DOWNLOAD_ORDER: BannerFormat[] = ['mp4', 'gif', 'png', 'jpg'];

interface HasFormats {
  kind?: BannerKind;
  formats?: BannerFormat[];
  outputs?: BannerOutputs;
}

export function isImageTemplate(t: { kind?: BannerKind } | null | undefined): boolean {
  return t?.kind === 'image';
}

/** What an order of this template produces, in display order. */
export function templateFormats(t: HasFormats): BannerFormat[] {
  if (t.formats?.length) return t.formats;
  const o = (t.outputs || {}) as Partial<Record<string, { enabled?: boolean }>>;
  if (isImageTemplate(t)) return o.jpg?.enabled ? ['png', 'jpg'] : ['png'];
  return o.gif?.enabled ? ['mp4', 'gif'] : ['mp4'];
}

/** "MP4 + GIF", "PNG + JPG" */
export function formatList(formats: BannerFormat[]): string {
  return formats.map((f) => FORMAT_LABEL[f]).join(' + ');
}

/** URL of a template's own zone image (`style.image`, a public disk path) */
export function zoneImageUrl(path: string): string {
  return getImageUrl(`/storage/${path}`);
}
