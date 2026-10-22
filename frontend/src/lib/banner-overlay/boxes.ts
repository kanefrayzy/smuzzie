// Geometry of a drawn overlay, read back from the DOM. The renderer uses it to cut animated images
// (GIF logos and icons) out of the overlay screenshot and composite them frame by frame with ffmpeg,
// at exactly the place and size Chromium drew them. Works on any stage built by BannerOverlay.

/** Where an image zone's picture is drawn, in stage pixels (after contain-fit and alignment). */
export interface ImageBox {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Combined opacity of the picture and its parents, 0..1 */
  opacity: number;
}

export interface ZoneInfo {
  key: string;
  type: 'text' | 'image';
  /** Drawn at all: not hidden, and for images a picture is set */
  shown: boolean;
}

/** An image source that may animate (GIF); the renderer composites these separately. */
export function isAnimatedSource(src: string | null | undefined): boolean {
  return !!src && /^data:image\/gif[;,]/i.test(src);
}

function zoneElements(stage: HTMLElement): HTMLElement[] {
  return Array.from(stage.querySelectorAll<HTMLElement>('.bn-layer > .bn-zone'));
}

/** Zones bottom to top (DOM order is drawing order). */
export function zoneOrder(stage: HTMLElement): ZoneInfo[] {
  return zoneElements(stage).map((el) => {
    const type = el.classList.contains('bn-image-zone') ? 'image' : 'text';
    const img = type === 'image' ? el.querySelector('img') : null;
    return { key: el.dataset.key || '', type, shown: !el.hidden && (type === 'text' || !!img?.getAttribute('src')) };
  });
}

/** Percent along the free space for one object-position component ("0%", "50%", "left", "12px"). */
function positionFraction(value: string | undefined, free: number): number {
  const v = (value || '50%').trim();
  if (v === 'left' || v === 'top') return 0;
  if (v === 'right' || v === 'bottom') return 1;
  if (v === 'center') return 0.5;
  if (v.endsWith('%')) return parseFloat(v) / 100;
  if (v.endsWith('px')) return free ? parseFloat(v) / free : 0;
  return 0.5;
}

/** The drawn picture of an image zone, or null when nothing is drawn there. */
export function imageBox(stage: HTMLElement, key: string): ImageBox | null {
  const zone = zoneElements(stage).find((el) => el.dataset.key === key);
  const img = zone?.querySelector('img');
  if (!zone || zone.hidden || !img || !img.naturalWidth || !img.naturalHeight) return null;

  const stageRect = stage.getBoundingClientRect();
  // Stage pixels even when the stage is scaled with a transform (the site preview)
  const unit = stage.offsetWidth / (stageRect.width || stage.offsetWidth || 1);
  const r = img.getBoundingClientRect();
  const boxW = r.width * unit;
  const boxH = r.height * unit;
  const ratio = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
  const w = img.naturalWidth * ratio;
  const h = img.naturalHeight * ratio;
  const [px, py] = getComputedStyle(img).objectPosition.split(/\s+/);

  let opacity = 1;
  for (let el: HTMLElement | null = img; el && el !== stage; el = el.parentElement) {
    opacity *= Number(getComputedStyle(el).opacity) || 0;
  }

  return {
    key,
    x: (r.left - stageRect.left) * unit + (boxW - w) * positionFraction(px, boxW - w),
    y: (r.top - stageRect.top) * unit + (boxH - h) * positionFraction(py, boxH - h),
    w,
    h,
    opacity,
  };
}

/**
 * Show only the given zones (the others become invisible but keep their layout), for a
 * screenshot of one slice of the layer stack. Returns a function that shows everything again.
 */
export function isolateZones(stage: HTMLElement, keys: Set<string>): () => void {
  const els = zoneElements(stage);
  els.forEach((el) => {
    el.style.visibility = keys.has(el.dataset.key || '') ? '' : 'hidden';
  });
  return () => els.forEach((el) => (el.style.visibility = ''));
}
