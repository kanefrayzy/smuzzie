import { isHex } from './color';
import { customConfig, layerParams, layerZones } from './custom';
import type {
  Align, AlignY, BuyerLayer, BuyerParams, ImageZone, ImageZoneParams, RangeControl, Rect, TemplateConfig, TextCase, TextGradient, TextZone,
  TextZoneParams, Zone,
} from './types';

// Effective values of a zone: what the buyer chose where the template allows it, the
// template default everywhere else. Same rules the server applies when it normalizes an
// order (BannerParamsValidator), but clamping instead of rejecting, so stale drafts still work.

export interface ResolvedText {
  visible: boolean;
  text: string;
  /** Percent of the video width */
  size: number;
  color: string;
  align: Align;
  fontId: number;
  case: TextCase;
  /** em */
  letterSpacing: number;
  lineHeight: number;
  glow: boolean;
  /** Percent */
  opacity: number;
  /** Gradient fill, or null for the flat color */
  gradient: TextGradient | null;
}

export interface ResolvedImage {
  scale: number;
  alignX: Align;
  alignY: AlignY;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Characters (code points), the unit both the editor counter and the server count in. */
export function charLength(text: string): number {
  return Array.from(text).length;
}

export function truncateChars(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length > max ? chars.slice(0, max).join('') : text;
}

// Unicode "Other" category: control, format (zero-width etc.), private use, unassigned.
// Built with the constructor because the project's TS target (es5) rejects the u flag in literals.
const CONTROL = new RegExp('\\p{C}', 'gu');
const CONTROL_EXCEPT_NEWLINE = new RegExp('(?!\\n)\\p{C}', 'gu');

/** Same cleanup as the server: drop control characters, keep \n only for multiline fields, NFC. */
export function cleanText(text: string, multiline: boolean): string {
  let t = String(text).replace(/\r\n?/g, '\n');
  t = t.replace(multiline ? CONTROL_EXCEPT_NEWLINE : CONTROL, '');
  t = t.normalize('NFC');
  return multiline ? t : t.trim();
}

export function resolveText(zone: TextZone, p: TextZoneParams | undefined): ResolvedText {
  const { style, controls } = zone;
  p = p || {};

  let text = style.text;
  if (controls.text.enabled && typeof p.text === 'string') {
    text = truncateChars(cleanText(p.text, controls.text.multiline), controls.text.maxLength);
  }

  let size = style.size;
  if (controls.size.enabled && typeof p.size === 'number' && Number.isFinite(p.size)) {
    size = clamp(p.size, controls.size.min, controls.size.max);
  }

  let color = style.color;
  if (controls.color.enabled && isHex(p.color)) {
    const c = p.color.toLowerCase();
    if (controls.color.custom || controls.color.palette.includes(c) || c === style.color) color = c;
  }

  let align = style.align;
  if (controls.align.enabled && p.align && controls.align.options.includes(p.align)) align = p.align;

  const visible = controls.visible.enabled ? p.visible !== false : true;

  let fontId = style.fontId;
  if (controls.font?.enabled && typeof p.fontId === 'number' && controls.font.options.includes(p.fontId)) fontId = p.fontId;

  let textCase = style.case;
  if (controls.case?.enabled && p.case && controls.case.options.includes(p.case)) textCase = p.case;

  const glow = controls.glow?.enabled && typeof p.glow === 'boolean' ? p.glow : style.glow;

  return {
    visible, text, size, color, align, fontId, glow,
    case: textCase,
    letterSpacing: range(controls.letterSpacing, p.letterSpacing, style.letterSpacing, 1000),
    lineHeight: range(controls.lineHeight, p.lineHeight, style.lineHeight, 100),
    opacity: range(controls.opacity, p.opacity, style.opacity ?? 100, 1),
    gradient: resolveGradient(style.gradient, controls.gradient?.enabled ? p.gradient : undefined),
  };
}

/** The template's gradient, or the buyer's when the template lets them change it. */
function resolveGradient(base: TextGradient | undefined, chosen: TextGradient | undefined): TextGradient | null {
  const own = base?.enabled && isHex(base.from) && isHex(base.to) ? base : null;
  if (!chosen || typeof chosen !== 'object') return own;
  if (chosen.enabled !== true) return null;
  if (!isHex(chosen.from) || !isHex(chosen.to)) return own;
  const a = Number(chosen.angle);
  const angle = Number.isFinite(a) ? ((Math.round(a) % 360) + 360) % 360 : own?.angle ?? 90;
  return { enabled: true, from: chosen.from.toLowerCase(), to: chosen.to.toLowerCase(), angle };
}

/** A buyer number inside an enabled range control, rounded like the server stores it. */
function range(ctl: RangeControl | undefined, value: unknown, fallback: number, precision: number): number {
  if (!ctl?.enabled || typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return clamp(Math.round(value * precision) / precision, ctl.min, ctl.max);
}

/** Every font a config can use: the zone defaults plus the fonts offered to the buyer. */
export function configFontIds(config: TemplateConfig): number[] {
  const ids = new Set<number>();
  for (const zone of config.zones) {
    if (zone.type !== 'text') continue;
    ids.add(zone.style.fontId);
    if (zone.controls.font?.enabled) zone.controls.font.options.forEach((id) => ids.add(id));
  }
  customConfig(config)?.fonts.forEach((id) => ids.add(id));
  return Array.from(ids);
}

export function resolveImage(zone: ImageZone, p: ImageZoneParams | undefined): ResolvedImage {
  const { style, controls } = zone;
  p = p || {};

  let scale = style.scale;
  if (controls.scale.enabled && typeof p.scale === 'number' && Number.isFinite(p.scale)) {
    scale = clamp(Math.round(p.scale), controls.scale.min, controls.scale.max);
  }
  let alignX = style.alignX;
  let alignY = style.alignY;
  if (controls.align.enabled) {
    if (p.alignX && controls.align.x.includes(p.alignX)) alignX = p.alignX;
    if (p.alignY && controls.align.y.includes(p.alignY)) alignY = p.alignY;
  }
  return { scale, alignX, alignY };
}

/** Smallest zone a buyer can resize to, percent of the video (or the zone's own size if smaller). */
export const MIN_BUYER_ZONE = 2;

const round3 = (v: number) => Math.round(v * 1000) / 1000;

export function zoneMinSize(zone: Rect): { w: number; h: number } {
  return { w: Math.min(MIN_BUYER_ZONE, zone.w), h: Math.min(MIN_BUYER_ZONE, zone.h) };
}

/**
 * Where the zone is drawn: the buyer's rectangle when the template lets them move it (kept
 * inside the allowed area, the size fixed unless resizing is allowed), the template's otherwise.
 */
export function resolveRect(zone: Zone, p: { rect?: Rect } | undefined): Rect {
  const own = { x: zone.x, y: zone.y, w: zone.w, h: zone.h };
  const pos = zone.controls.position;
  const r = p?.rect;
  if (!pos?.enabled || !r || ![r.x, r.y, r.w, r.h].every((n) => typeof n === 'number' && Number.isFinite(n))) return own;
  // Not moved: the template's own place is always allowed
  if (r.x === own.x && r.y === own.y && r.w === own.w && r.h === own.h) return own;
  const b = pos.bounds;
  const min = zoneMinSize(zone);
  const w = pos.resize ? clamp(round3(r.w), min.w, b.w) : zone.w;
  const h = pos.resize ? clamp(round3(r.h), min.h, b.h) : zone.h;
  return {
    x: round3(clamp(r.x, b.x, b.x + b.w - w)),
    y: round3(clamp(r.y, b.y, b.y + b.h - h)),
    w, h,
  };
}

export function resolveHue(config: TemplateConfig, params: Pick<BuyerParams, 'hue'> | undefined): number {
  if (!config.hue.enabled) return config.hue.default;
  const h = Number(params?.hue);
  return Number.isFinite(h) ? ((Math.round(h) % 360) + 360) % 360 : config.hue.default;
}

/** Template defaults expressed as buyer params (the editor's starting point and "reset all"). */
export function defaultParams(config: TemplateConfig): BuyerParams {
  const zones: BuyerParams['zones'] = {};
  for (const zone of config.zones) zones[zone.key] = defaultZoneParams(zone);
  return { schemaVersion: 1, hue: config.hue.default, zones };
}

export function defaultZoneParams(zone: Zone): TextZoneParams | ImageZoneParams {
  const rect = { x: zone.x, y: zone.y, w: zone.w, h: zone.h };
  if (zone.type === 'text') {
    const s = zone.style;
    return {
      text: s.text, size: s.size, color: s.color, align: s.align, visible: true,
      fontId: s.fontId, case: s.case, letterSpacing: s.letterSpacing, lineHeight: s.lineHeight, glow: s.glow,
      opacity: s.opacity ?? 100, rect,
      gradient: s.gradient ? { ...s.gradient } : { enabled: false, from: s.color, to: '#ff2d8a', angle: 90 },
    };
  }
  return { scale: zone.style.scale, alignX: zone.style.alignX, alignY: zone.style.alignY, rect };
}

/** One zone's params as sent with an order: only enabled controls, resolved and clamped. */
function exportZone(zone: Zone, raw: TextZoneParams | ImageZoneParams | undefined): TextZoneParams | ImageZoneParams {
  if (zone.type === 'text') {
    const r = resolveText(zone, raw as TextZoneParams);
    const c = zone.controls;
    const out: TextZoneParams = {};
    if (c.text.enabled) out.text = r.text;
    if (c.size.enabled) out.size = r.size;
    if (c.color.enabled) out.color = r.color;
    if (c.align.enabled) out.align = r.align;
    if (c.visible.enabled) out.visible = r.visible;
    if (c.font?.enabled) out.fontId = r.fontId;
    if (c.case?.enabled) out.case = r.case;
    if (c.letterSpacing?.enabled) out.letterSpacing = r.letterSpacing;
    if (c.lineHeight?.enabled) out.lineHeight = r.lineHeight;
    if (c.glow?.enabled) out.glow = r.glow;
    if (c.opacity?.enabled) out.opacity = r.opacity;
    if (c.gradient?.enabled) out.gradient = r.gradient ? { ...r.gradient } : { enabled: false, from: r.color, to: r.color, angle: 90 };
    if (c.position?.enabled) out.rect = resolveRect(zone, raw);
    return out;
  }
  const r = resolveImage(zone, raw as ImageZoneParams);
  const c = zone.controls;
  const out: ImageZoneParams = {};
  if (c.scale.enabled) out.scale = r.scale;
  if (c.align.enabled) {
    out.alignX = r.alignX;
    out.alignY = r.alignY;
  }
  if (c.position?.enabled) out.rect = resolveRect(zone, raw);
  return out;
}

/**
 * Only what the buyer may change, resolved and clamped: the payload sent with an order.
 * Disabled controls are left out entirely (the server would ignore them anyway).
 */
export function exportParams(config: TemplateConfig, params: BuyerParams): BuyerParams {
  const zones: BuyerParams['zones'] = {};
  for (const zone of config.zones) {
    const out = exportZone(zone, params.zones[zone.key]);
    if (Object.keys(out).length) zones[zone.key] = out;
  }
  const result: BuyerParams = { schemaVersion: 1, hue: resolveHue(config, params), zones };
  const layers = layerZones(config, params);
  if (layers.length) {
    result.layers = layers.map(({ layer, zone }) => ({ id: layer.id, type: layer.type, ...exportZone(zone, layerParams(layer)) }) as BuyerLayer);
  }
  return result;
}
