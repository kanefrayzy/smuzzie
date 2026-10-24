import { imageBox } from '@/lib/banner-overlay';
import type { Rect } from '@/lib/banner-overlay';

// Align and distribute, like Photoshop's "Align" panel. Everything works on what is visible:
// the drawn text (not the whole text zone) and the drawn picture of an image zone, so
// "equal spacing" means equal pixels between the texts themselves. Zones are then moved by
// the same amount as their contents. Units are percent of the banner.

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

export interface ArrangeItem {
  id: string;
  /** The zone */
  rect: Rect;
  /** What is visible inside it (falls back to the zone) */
  box: Rect;
  /** The zone has to stay inside this area */
  bounds: Rect;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

function shifted(item: ArrangeItem, dx: number, dy: number): Rect {
  const { rect: r, bounds: b } = item;
  const x = Math.min(b.x + b.w - r.w, Math.max(b.x, r.x + dx));
  const y = Math.min(b.y + b.h - r.h, Math.max(b.y, r.y + dy));
  return { x: r3(x), y: r3(y), w: r.w, h: r.h };
}

/** Bounding box of the items' visible contents. */
export function unionBox(items: ArrangeItem[]): Rect {
  const x = Math.min(...items.map((i) => i.box.x));
  const y = Math.min(...items.map((i) => i.box.y));
  const right = Math.max(...items.map((i) => i.box.x + i.box.w));
  const bottom = Math.max(...items.map((i) => i.box.y + i.box.h));
  return { x, y, w: right - x, h: bottom - y };
}

/** Line the items up against `target` (the selection's box, or the whole frame). */
export function alignItems(items: ArrangeItem[], mode: AlignMode, target: Rect): Record<string, Rect> {
  const out: Record<string, Rect> = {};
  for (const it of items) {
    const b = it.box;
    let dx = 0;
    let dy = 0;
    if (mode === 'left') dx = target.x - b.x;
    if (mode === 'hcenter') dx = target.x + target.w / 2 - (b.x + b.w / 2);
    if (mode === 'right') dx = target.x + target.w - (b.x + b.w);
    if (mode === 'top') dy = target.y - b.y;
    if (mode === 'vcenter') dy = target.y + target.h / 2 - (b.y + b.h / 2);
    if (mode === 'bottom') dy = target.y + target.h - (b.y + b.h);
    out[it.id] = shifted(it, dx, dy);
  }
  return out;
}

/**
 * Equal space between the items along an axis. Without `gap` the first and last stay where
 * they are and the ones in between move; with `gap` (percent) everything after the first is
 * placed that far apart.
 */
export function distributeItems(items: ArrangeItem[], axis: 'x' | 'y', gap?: number): Record<string, Rect> {
  const pos = (r: Rect) => (axis === 'x' ? r.x : r.y);
  const size = (r: Rect) => (axis === 'x' ? r.w : r.h);
  const sorted = [...items].sort((a, b) => pos(a.box) - pos(b.box));
  const out: Record<string, Rect> = {};
  if (sorted.length < 2) return out;

  const first = sorted[0].box;
  const last = sorted[sorted.length - 1].box;
  const used = sorted.reduce((s, it) => s + size(it.box), 0);
  const step = gap ?? (pos(last) + size(last) - pos(first) - used) / (sorted.length - 1);

  let at = pos(first);
  for (const it of sorted) {
    const d = at - pos(it.box);
    out[it.id] = axis === 'x' ? shifted(it, d, 0) : shifted(it, 0, d);
    at += size(it.box) + step;
  }
  return out;
}

/** Current gap between neighbours along an axis (percent), when they are all equal; else null. */
export function currentGap(items: ArrangeItem[], axis: 'x' | 'y'): number | null {
  const pos = (r: Rect) => (axis === 'x' ? r.x : r.y);
  const size = (r: Rect) => (axis === 'x' ? r.w : r.h);
  const sorted = [...items].sort((a, b) => pos(a.box) - pos(b.box));
  if (sorted.length < 2) return null;
  const gaps = sorted.slice(1).map((it, i) => pos(it.box) - (pos(sorted[i].box) + size(sorted[i].box)));
  return gaps.every((g) => Math.abs(g - gaps[0]) < 0.05) ? gaps[0] : null;
}

/**
 * The visible part of each zone in a rendered preview, in percent of the banner: the text's
 * glyph boxes for text zones, the contain-fitted picture for image zones. Zones that draw
 * nothing (hidden, empty, no picture) are left out.
 */
export function measureBoxes(root: HTMLElement | null, keys: string[]): Record<string, Rect> {
  const stage = root?.querySelector<HTMLElement>('.bn-stage');
  if (!stage) return {};
  const s = stage.getBoundingClientRect();
  if (!s.width || !s.height) return {};
  const out: Record<string, Rect> = {};
  for (const key of keys) {
    const zone = Array.from(stage.querySelectorAll<HTMLElement>('.bn-zone')).find((el) => el.dataset.key === key);
    if (!zone || zone.hidden || getComputedStyle(zone).display === 'none') continue;
    if (zone.classList.contains('bn-image-zone')) {
      const b = imageBox(stage, key);
      if (b) out[key] = { x: (b.x / stage.offsetWidth) * 100, y: (b.y / stage.offsetHeight) * 100, w: (b.w / stage.offsetWidth) * 100, h: (b.h / stage.offsetHeight) * 100 };
      continue;
    }
    const range = stage.ownerDocument.createRange();
    range.selectNodeContents(zone);
    const r = range.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    // The range covers the font's full line box; trim it to the glyphs actually drawn
    // (caps height, descenders), so the gaps match what the eye sees
    const scale = s.width / stage.offsetWidth;
    const ink = inkInsets(zone);
    const top = r.top + ink.top * scale;
    const bottom = r.bottom - ink.bottom * scale;
    out[key] = {
      x: ((r.left - s.left) / s.width) * 100,
      y: ((top - s.top) / s.height) * 100,
      w: (r.width / s.width) * 100,
      h: (Math.max(1, bottom - top) / s.height) * 100,
    };
  }
  return out;
}

let measureCtx: CanvasRenderingContext2D | null = null;

/** Space between the line box and the drawn glyphs at the top and bottom, in CSS pixels. */
function inkInsets(zone: HTMLElement): { top: number; bottom: number } {
  const el = zone.querySelector<HTMLElement>('.bn-text') ?? zone;
  let text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  if (!text) return { top: 0, bottom: 0 };
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return { top: 0, bottom: 0 };
  const cs = getComputedStyle(el);
  if (cs.textTransform === 'uppercase') text = text.toUpperCase();
  else if (cs.textTransform === 'lowercase') text = text.toLowerCase();
  measureCtx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const m = measureCtx.measureText(text);
  if (!m.fontBoundingBoxAscent) return { top: 0, bottom: 0 };
  return {
    top: Math.max(0, m.fontBoundingBoxAscent - m.actualBoundingBoxAscent),
    bottom: Math.max(0, m.fontBoundingBoxDescent - m.actualBoundingBoxDescent),
  };
}
