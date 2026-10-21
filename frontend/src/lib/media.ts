import type { PortfolioItem } from '@/types';
import { getImageUrl, isVideoUrl } from '@/lib/utils';

/**
 * Picks which file to show where for a portfolio item.
 *
 * Optimized variants (responsive WebP, MP4 previews, posters) are produced by the backend's
 * MediaOptimizer after upload. Until an item has them, everything falls back to the original
 * file, so the site keeps working while processing is pending.
 */
export interface ItemMedia {
  /** 'video' covers real videos and GIFs that were converted to MP4 */
  kind: 'image' | 'video' | 'gif';
  width: number | null;
  height: number | null;

  // Images
  src: string;
  srcSet?: string;
  /** Biggest web-optimized size, for the lightbox */
  largeSrc: string;

  // Videos (and converted GIFs)
  previewVideo?: string;
  fullVideo?: string;
  poster?: string;
  /** Converted GIFs autoplay while visible, like the original GIF did */
  autoplay: boolean;

  /** Untouched original, for the fullscreen zoom viewer */
  originalUrl: string;
  originalIsVideo: boolean;
}

export function getItemMedia(item: PortfolioItem): ItemMedia {
  const v = item.variants;
  const width = v?.width ?? item.width ?? null;
  const height = v?.height ?? item.height ?? null;
  const originalUrl = getImageUrl(item.gif_url || item.image_url);
  const originalIsVideo = item.file_type === 'video';

  // Optimized MP4 for videos and GIFs
  if (v?.video?.preview) {
    return {
      kind: 'video',
      width,
      height,
      src: getImageUrl(v.poster),
      largeSrc: getImageUrl(v.poster),
      previewVideo: getImageUrl(v.video.preview),
      fullVideo: getImageUrl(v.video.full || v.video.preview),
      poster: v.poster ? getImageUrl(v.poster) : undefined,
      autoplay: item.file_type === 'gif',
      // Full-size MP4 rather than the original: WebM doesn't play on older iPhones,
      // and it's visually identical to the original GIF at a fraction of the size
      originalUrl: getImageUrl(v.video.full || v.video.preview),
      originalIsVideo: true,
    };
  }

  // Responsive WebP for images
  if (v?.images?.length) {
    const sorted = [...v.images].sort((a, b) => a.w - b.w);
    const mid = sorted.find((i) => i.w >= 1200) || sorted[sorted.length - 1];
    return {
      kind: 'image',
      width,
      height,
      src: getImageUrl(mid.url),
      srcSet: sorted.map((i) => `${getImageUrl(i.url)} ${i.w}w`).join(', '),
      largeSrc: getImageUrl(sorted[sorted.length - 1].url),
      autoplay: false,
      originalUrl,
      originalIsVideo: false,
    };
  }

  // Not processed yet — original files, same as before optimization existed
  if (item.file_type === 'video') {
    const poster = item.thumbnail_url && !isVideoUrl(item.thumbnail_url) ? getImageUrl(item.thumbnail_url) : undefined;
    return {
      kind: 'video',
      width,
      height,
      src: poster || '',
      largeSrc: poster || '',
      previewVideo: originalUrl,
      fullVideo: originalUrl,
      poster,
      autoplay: false,
      originalUrl,
      originalIsVideo: true,
    };
  }

  return {
    kind: item.file_type === 'gif' ? 'gif' : 'image',
    width,
    height,
    src: getImageUrl(item.file_type === 'gif' ? item.gif_url || item.image_url : item.image_url),
    largeSrc: originalUrl,
    poster: item.file_type === 'gif' && item.thumbnail_url ? getImageUrl(item.thumbnail_url) : undefined,
    autoplay: false,
    originalUrl,
    originalIsVideo: false,
  };
}
