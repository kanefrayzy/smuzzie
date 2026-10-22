import { isHex } from './color';
import type {
  Align, AlignY, BuyerParams, ImageZone, ImageZoneParams, TemplateConfig, TextZone, TextZoneParams, Zone,
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

  return { visible, text, size, color, align };
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
  if (zone.type === 'text') {
    const s = zone.style;
    return { text: s.text, size: s.size, color: s.color, align: s.align, visible: true };
  }
  return { scale: zone.style.scale, alignX: zone.style.alignX, alignY: zone.style.alignY };
}

/**
 * Only what the buyer may change, resolved and clamped: the payload sent with an order.
 * Disabled controls are left out entirely (the server would ignore them anyway).
 */
export function exportParams(config: TemplateConfig, params: BuyerParams): BuyerParams {
  const zones: BuyerParams['zones'] = {};
  for (const zone of config.zones) {
    const raw = params.zones[zone.key];
    if (zone.type === 'text') {
      const r = resolveText(zone, raw as TextZoneParams);
      const c = zone.controls;
      const out: TextZoneParams = {};
      if (c.text.enabled) out.text = r.text;
      if (c.size.enabled) out.size = r.size;
      if (c.color.enabled) out.color = r.color;
      if (c.align.enabled) out.align = r.align;
      if (c.visible.enabled) out.visible = r.visible;
      if (Object.keys(out).length) zones[zone.key] = out;
    } else {
      const r = resolveImage(zone, raw as ImageZoneParams);
      const c = zone.controls;
      const out: ImageZoneParams = {};
      if (c.scale.enabled) out.scale = r.scale;
      if (c.align.enabled) {
        out.alignX = r.alignX;
        out.alignY = r.alignY;
      }
      if (Object.keys(out).length) zones[zone.key] = out;
    }
  }
  return { schemaVersion: 1, hue: resolveHue(config, params), zones };
}
