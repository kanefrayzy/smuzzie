import { shiftColor } from './color';
import { ensureStyles } from './css';
import { canvasMeasure, layoutText, type Measure, type TextLayout } from './layout';
import { expandLayers } from './custom';
import { configFontIds, resolveHue, resolveImage, resolveRect, resolveText } from './resolve';
import type { BannerFontFace, BuyerParams, ImageZone, ImageZoneParams, Rect, TemplateConfig, TextZone, TextZoneParams } from './types';

// The text + logo layer, drawn in the template's native resolution. The site preview scales
// the stage down with a CSS transform; the renderer screenshots it 1:1 with a transparent
// background. User data reaches the DOM only through textContent, style properties and img.src.

export interface OverlayState {
  config: TemplateConfig;
  params: BuyerParams;
  /** zone key => image URL (data:, blob: or http) */
  images?: Record<string, string | null | undefined>;
}

export interface ZoneFit {
  /** Requested and used font size, percent of the video width */
  requested: number;
  used: number;
  shrunk: boolean;
  overflow: boolean;
  lines: string[];
}

export interface OverlayResult {
  hue: number;
  zones: Record<string, ZoneFit>;
}

interface ZoneEls {
  key: string;
  type: 'text' | 'image';
  zone: HTMLDivElement;
  inner: HTMLDivElement | HTMLImageElement;
}

const JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' } as const;
const ALIGN_ITEMS = { top: 'flex-start', center: 'center', bottom: 'flex-end' } as const;

export class BannerOverlay {
  readonly stage: HTMLElement;
  private layer: HTMLDivElement;
  private els: ZoneEls[] = [];
  private signature = '';
  private fonts = new Map<number, BannerFontFace>();
  private measures = new Map<string, Measure>();

  constructor(stage: HTMLElement, private width: number, private height: number) {
    const doc = stage.ownerDocument;
    ensureStyles(doc);
    this.stage = stage;
    stage.classList.add('bn-stage');
    stage.style.width = `${width}px`;
    stage.style.height = `${height}px`;
    this.layer = doc.createElement('div');
    this.layer.className = 'bn-layer';
    stage.appendChild(this.layer);
  }

  /** Font faces the config refers to (by id). Call before render; see `fontsReady`. */
  setFonts(fonts: BannerFontFace[]): void {
    this.fonts = new Map(fonts.map((f) => [f.id, f]));
    this.measures.clear();
  }

  /**
   * Wait until every face the config can use (defaults and the buyer's choices) can be measured
   * and drawn. Measurements taken before this would use the fallback font, so render again afterwards.
   */
  async fontsReady(config: TemplateConfig): Promise<void> {
    const doc = this.stage.ownerDocument;
    const jobs: Promise<unknown>[] = [];
    for (const id of configFontIds(config)) {
      const f = this.fonts.get(id);
      if (f) jobs.push(doc.fonts.load(`${f.style} ${f.weight} 100px "${f.family}"`, 'AaЯя0'));
    }
    await Promise.all(jobs);
    await doc.fonts.ready;
    this.measures.clear();
  }

  /** Resolves once every visible logo has been decoded. */
  async imagesReady(): Promise<void> {
    await Promise.all(
      this.els
        .filter((e) => e.type === 'image' && !e.zone.hidden)
        .map((e) => (e.inner as HTMLImageElement).decode().catch(() => undefined)),
    );
  }

  render(state: OverlayState): OverlayResult {
    // The buyer's own layers are drawn as extra zones on top
    const { config, params } = expandLayers(state.config, state.params);
    this.syncZones(config);
    const hue = resolveHue(config, params);
    const accent = shiftColor(config.accent, hue);
    const result: OverlayResult = { hue, zones: {} };

    config.zones.forEach((zone, i) => {
      const els = this.els[i];
      const rect = resolveRect(zone, params.zones[zone.key]);
      Object.assign(els.zone.style, { left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` });
      if (zone.type === 'text') {
        result.zones[zone.key] = this.renderText(els, zone, rect, params.zones[zone.key] as TextZoneParams | undefined, accent);
      } else {
        this.renderImage(els, zone, params.zones[zone.key] as ImageZoneParams | undefined, state.images?.[zone.key]);
      }
    });

    return result;
  }

  destroy(): void {
    this.layer.remove();
    this.els = [];
  }

  // ─── Zones ────────────────────────────────────────────────

  /** Rebuild the zone elements only when the set of zones changes. */
  private syncZones(config: TemplateConfig): void {
    const signature = config.zones.map((z) => `${z.type}:${z.key}`).join('|');
    if (signature === this.signature) return;
    this.signature = signature;

    const doc = this.stage.ownerDocument;
    this.layer.replaceChildren();
    this.els = config.zones.map((zone) => {
      const el = doc.createElement('div');
      el.className = `bn-zone bn-${zone.type}-zone`;
      el.dataset.key = zone.key;
      let inner: HTMLDivElement | HTMLImageElement;
      if (zone.type === 'image') {
        const img = doc.createElement('img');
        img.className = 'bn-img';
        img.alt = '';
        img.decoding = 'sync';
        inner = img;
      } else {
        inner = doc.createElement('div');
        inner.className = 'bn-text';
      }
      el.appendChild(inner);
      this.layer.appendChild(el);
      return { key: zone.key, type: zone.type, zone: el, inner };
    });
  }

  private renderText(els: ZoneEls, zone: TextZone, rect: Rect, p: TextZoneParams | undefined, accent: string): ZoneFit {
    const r = resolveText(zone, p);
    const box = els.inner as HTMLDivElement;
    // A chosen font that isn't available falls back to the template's own
    const font = this.fonts.get(r.fontId) || this.fonts.get(zone.style.fontId);
    const requested = r.size;

    els.zone.hidden = !r.visible;
    const sane = [r.size, zone.style.minSize, r.lineHeight, rect.w, rect.h].every((n) => Number.isFinite(n) && n > 0);
    if (!r.visible || r.text.trim() === '' || !font || !sane) {
      box.replaceChildren();
      return { requested, used: requested, shrunk: false, overflow: false, lines: [] };
    }

    const text = r.case === 'upper' ? r.text.toUpperCase() : r.case === 'lower' ? r.text.toLowerCase() : r.text;
    const layout: TextLayout = layoutText(
      {
        text,
        boxW: (rect.w / 100) * this.width,
        boxH: (rect.h / 100) * this.height,
        sizePx: (r.size / 100) * this.width,
        minPx: (zone.style.minSize / 100) * this.width,
        lineHeight: r.lineHeight,
        letterSpacing: r.letterSpacing,
      },
      this.measureFor(font),
    );

    Object.assign(box.style, {
      fontFamily: `"${font.family}", sans-serif`,
      fontWeight: String(font.weight),
      fontStyle: font.style,
      fontSize: `${layout.sizePx}px`,
      lineHeight: String(r.lineHeight),
      letterSpacing: `${r.letterSpacing}em`,
      color: r.color,
      opacity: r.opacity < 100 ? String(r.opacity / 100) : '',
      textAlign: r.align,
      textShadow: r.glow
        ? `0 0 0.35em ${accent}, 0 0.04em 0.1em rgba(0,0,0,.55)`
        : '0 0.04em 0.12em rgba(0,0,0,.35)',
    });

    // Gradient fill: the box shrinks to the text (so the gradient spans the words, not the whole
    // zone) and the zone aligns it instead. A text-shadow would paint over a clipped background,
    // so the glow/shadow moves to a drop-shadow filter.
    const g = r.gradient;
    const set = (prop: string, value: string) => (value ? box.style.setProperty(prop, value) : box.style.removeProperty(prop));
    set('width', g ? 'fit-content' : '');
    set('max-width', g ? '100%' : '');
    set('background-image', g ? `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})` : '');
    set('-webkit-background-clip', g ? 'text' : '');
    set('background-clip', g ? 'text' : '');
    set('-webkit-text-fill-color', g ? 'transparent' : '');
    set('filter', g ? (r.glow ? `drop-shadow(0 0 0.3em ${accent}) drop-shadow(0 0.04em 0.08em rgba(0,0,0,.5))` : 'drop-shadow(0 0.04em 0.1em rgba(0,0,0,.35))') : '');
    if (g) box.style.textShadow = 'none';
    els.zone.style.justifyContent = g ? JUSTIFY[r.align] : '';

    // One element per line; reuse existing ones to keep typing in the editor cheap
    const doc = this.stage.ownerDocument;
    while (box.children.length > layout.lines.length) box.lastElementChild!.remove();
    layout.lines.forEach((line, i) => {
      let el = box.children[i] as HTMLElement | undefined;
      if (!el) {
        el = doc.createElement('span');
        el.className = 'bn-line';
        box.appendChild(el);
      }
      // An empty line still needs its height
      if (el.textContent !== (line || ' ')) el.textContent = line || ' ';
    });

    return {
      requested,
      used: (layout.sizePx / this.width) * 100,
      shrunk: layout.shrunk,
      overflow: layout.overflow,
      lines: layout.lines,
    };
  }

  private renderImage(els: ZoneEls, zone: ImageZone, p: ImageZoneParams | undefined, src: string | null | undefined): void {
    const img = els.inner as HTMLImageElement;
    const r = resolveImage(zone, p);

    // The buyer's image, or the template's own one (also when uploads are off); hidden when removed
    if (!src || !r.visible || (!zone.controls.upload.enabled && !zone.style.image)) {
      els.zone.hidden = true;
      img.removeAttribute('src');
      return;
    }
    els.zone.hidden = false;
    els.zone.style.justifyContent = JUSTIFY[r.alignX];
    els.zone.style.alignItems = ALIGN_ITEMS[r.alignY];
    // The logo box is scale% of the zone; the picture is contained inside it
    Object.assign(img.style, {
      width: `${r.scale}%`,
      height: `${r.scale}%`,
      objectPosition: `${r.alignX} ${r.alignY}`,
    });
    if (img.getAttribute('src') !== src) img.src = src;
  }

  private measureFor(font: BannerFontFace): Measure {
    const k = `${font.family}|${font.weight}|${font.style}`;
    let m = this.measures.get(k);
    if (!m) {
      m = canvasMeasure(this.stage.ownerDocument, font);
      this.measures.set(k, m);
    }
    return m;
  }
}
