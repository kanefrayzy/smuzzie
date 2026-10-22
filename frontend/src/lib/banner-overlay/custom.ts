import type {
  BuyerLayer, BuyerParams, ImageZone, ImageZoneParams, Rect, TemplateConfig, TextZone, TextZoneParams, Zone,
} from './types';

// Layers the buyer adds (template.config.custom). Each layer becomes a synthetic zone with
// every control switched on, so the editor, the overlay and the server reuse the zone rules
// instead of having a second set. The server builds the same zones in
// backend/app/Services/Banners/BannerCustomLayers.php: keep the limits below in sync.

export const LAYER_ID = /^layer_[0-9]{1,3}$/;

export const CUSTOM_LIMITS = {
  textMaxLength: 100,
  size: { min: 0.5, max: 20, default: 4 },
  minSize: 0.5,
  letterSpacing: { min: -0.1, max: 0.5 },
  lineHeight: { min: 0.7, max: 2.5, default: 1.15 },
  opacity: { min: 10, max: 100 },
  imageScale: { min: 10, max: 100 },
  logoMaxBytes: 2 * 1024 * 1024,
};

const ALL_ALIGN = ['left', 'center', 'right'] as const;
const ALL_ALIGN_Y = ['top', 'center', 'bottom'] as const;

/** The custom layers block when the template allows adding layers, else null. */
export function customConfig(config: TemplateConfig) {
  const c = config.custom;
  return c?.enabled && (c.maxText > 0 || c.maxImage > 0) ? c : null;
}

// The synthetic zone's own place is the starting rectangle; where the layer actually is comes
// from its `rect` param, so it is clamped to the allowed area like any moved zone.

export function layerTextZone(config: TemplateConfig, id: string, label: string): TextZone {
  const c = config.custom!;
  const L = CUSTOM_LIMITS;
  return {
    key: id, type: 'text', label, ...newLayerRect(config, 'text', 0),
    style: {
      text: 'Your text', fontId: c.fonts[0] ?? 0, size: L.size.default, minSize: L.minSize, case: 'none', align: 'center',
      color: '#ffffff', glow: false, lineHeight: L.lineHeight.default, letterSpacing: 0, opacity: 100,
    },
    controls: {
      text: { enabled: true, maxLength: L.textMaxLength, multiline: true },
      size: { enabled: true, min: L.size.min, max: L.size.max },
      color: { enabled: true, palette: Array.from(new Set(['#ffffff', '#000000', config.accent])), custom: true },
      align: { enabled: true, options: [...ALL_ALIGN] },
      visible: { enabled: false },
      font: { enabled: true, options: c.fonts },
      case: { enabled: true, options: ['none', 'upper', 'lower'] },
      letterSpacing: { enabled: true, ...L.letterSpacing },
      lineHeight: { enabled: true, min: L.lineHeight.min, max: L.lineHeight.max },
      glow: { enabled: true },
      opacity: { enabled: true, ...L.opacity },
      position: { enabled: true, resize: true, bounds: c.bounds },
    },
  };
}

export function layerImageZone(config: TemplateConfig, id: string, label: string): ImageZone {
  return {
    key: id, type: 'image', label, ...newLayerRect(config, 'image', 0),
    style: { scale: 100, alignX: 'center', alignY: 'center' },
    controls: {
      upload: { enabled: true, maxBytes: CUSTOM_LIMITS.logoMaxBytes },
      scale: { enabled: true, ...CUSTOM_LIMITS.imageScale },
      align: { enabled: true, x: [...ALL_ALIGN], y: [...ALL_ALIGN_Y] },
      position: { enabled: true, resize: true, bounds: config.custom!.bounds },
    },
  };
}

const isRect = (r: unknown): r is Rect =>
  !!r && typeof r === 'object' && ['x', 'y', 'w', 'h'].every((k) => typeof (r as Record<string, unknown>)[k] === 'number');

/**
 * The buyer's layers the template accepts (known type, valid unique id, within the limits),
 * each with its synthetic zone and display label ("Text 1", "Image 2").
 */
export function layerZones(config: TemplateConfig, params: Pick<BuyerParams, 'layers'>): { layer: BuyerLayer; zone: Zone }[] {
  const c = customConfig(config);
  if (!c || !Array.isArray(params.layers)) return [];
  const seen = new Set<string>();
  const out: { layer: BuyerLayer; zone: Zone }[] = [];
  let texts = 0;
  let images = 0;
  for (const layer of params.layers) {
    if (!layer || !LAYER_ID.test(String(layer.id)) || seen.has(layer.id) || !isRect(layer.rect)) continue;
    if (layer.type === 'text' && texts < c.maxText) {
      texts++;
      out.push({ layer, zone: layerTextZone(config, layer.id, `Text ${texts}`) });
    } else if (layer.type === 'image' && images < c.maxImage) {
      images++;
      out.push({ layer, zone: layerImageZone(config, layer.id, `Image ${images}`) });
    } else {
      continue;
    }
    seen.add(layer.id);
  }
  return out;
}

/** Config and params with the buyer's layers turned into zones on top: what gets drawn. */
export function expandLayers(config: TemplateConfig, params: BuyerParams): { config: TemplateConfig; params: BuyerParams } {
  const layers = layerZones(config, params);
  if (!layers.length) return { config, params };
  const zones = { ...params.zones };
  for (const { layer, zone } of layers) zones[zone.key] = layerParams(layer);
  return {
    config: { ...config, zones: [...config.zones, ...layers.map((l) => l.zone)] },
    params: { ...params, zones },
  };
}

/** A layer without its id and type: plain zone params. */
export function layerParams(layer: BuyerLayer): TextZoneParams | ImageZoneParams {
  const rest: Record<string, unknown> = { ...layer };
  delete rest.id;
  delete rest.type;
  return rest as TextZoneParams | ImageZoneParams;
}

/** A free layer id (layer_1, layer_2, ...). */
export function nextLayerId(params: Pick<BuyerParams, 'layers'>): string {
  const taken = new Set((params.layers || []).map((l) => l.id));
  for (let i = 1; ; i++) if (!taken.has(`layer_${i}`)) return `layer_${i}`;
}

/** Starting rectangle for a new layer: centered in the allowed area, nudged so new layers don't stack exactly. */
export function newLayerRect(config: TemplateConfig, type: 'text' | 'image', count: number): Rect {
  const b = config.custom!.bounds;
  const w = Math.min(b.w, type === 'text' ? 60 : 30);
  const h = Math.min(b.h, type === 'text' ? 10 : 12);
  const shift = (count % 5) * 3;
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return {
    x: r(b.x + (b.w - w) / 2),
    y: r(Math.min(b.y + b.h - h, b.y + (b.h - h) / 2 + shift)),
    w: r(w),
    h: r(h),
  };
}
