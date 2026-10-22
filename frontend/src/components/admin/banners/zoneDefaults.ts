import type { ImageZone, PositionControl, TemplateConfig, TextControls, TextZone, Zone } from '@/lib/banner-overlay';

// Starting values for zones added in the admin zone editor.

/** Moving is opt-in per zone (text on animated elements usually has to stay put) */
const POSITION_OFF: PositionControl = { enabled: false, resize: true, bounds: { x: 0, y: 0, w: 100, h: 100 } };

function uniqueKey(config: TemplateConfig, base: string): string {
  const taken = new Set(config.zones.map((z) => z.key));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}${i}`)) return `${base}${i}`;
}

export function newTextZone(config: TemplateConfig, fontId: number): TextZone {
  const key = uniqueKey(config, 'text');
  return {
    key,
    type: 'text',
    label: 'Text',
    x: 20, y: 20, w: 60, h: 10,
    style: {
      text: 'Your text', fontId, size: 4, minSize: 2, case: 'none', align: 'center',
      color: '#ffffff', glow: true, lineHeight: 1.14, letterSpacing: -0.01, opacity: 100,
    },
    controls: {
      text: { enabled: true, maxLength: 40, multiline: false },
      size: { enabled: true, min: 2, max: 5.6 },
      color: { enabled: true, palette: ['#ffffff', config.accent], custom: true },
      align: { enabled: true, options: ['left', 'center', 'right'] },
      visible: { enabled: true },
      font: { enabled: true, options: [fontId] },
      case: { enabled: true, options: ['none', 'upper', 'lower'] },
      letterSpacing: { enabled: true, min: -0.05, max: 0.2 },
      lineHeight: { enabled: false, min: 0.9, max: 1.6 },
      glow: { enabled: true },
      opacity: { enabled: false, min: 40, max: 100 },
      position: POSITION_OFF,
    },
  };
}

/**
 * Zones saved before the style controls existed lack those blocks: fill them in switched off
 * (same as the server does), so the form always has every field.
 */
export function withStyleControls(zone: TextZone): TextZone {
  const s = zone.style;
  const c = zone.controls;
  const range = (v: number) => ({ enabled: false, min: v, max: v });
  const controls: Required<TextControls> = {
    ...c,
    font: c.font ?? { enabled: false, options: [s.fontId] },
    case: c.case ?? { enabled: false, options: ['none', 'upper', 'lower'] },
    letterSpacing: c.letterSpacing ?? range(s.letterSpacing),
    lineHeight: c.lineHeight ?? range(s.lineHeight),
    glow: c.glow ?? { enabled: false },
    opacity: c.opacity ?? range(s.opacity ?? 100),
    position: c.position ?? POSITION_OFF,
  };
  return { ...zone, style: { ...s, opacity: s.opacity ?? 100 }, controls };
}

export function newImageZone(config: TemplateConfig): ImageZone {
  return {
    key: uniqueKey(config, 'logo'),
    type: 'image',
    label: 'Logo',
    x: 30, y: 4, w: 40, h: 8,
    style: { scale: 100, alignX: 'center', alignY: 'center' },
    controls: {
      upload: { enabled: true, maxBytes: 2 * 1024 * 1024 },
      scale: { enabled: true, min: 30, max: 100 },
      align: { enabled: true, x: ['left', 'center', 'right'], y: ['top', 'center', 'bottom'] },
      position: POSITION_OFF,
    },
  };
}

/** Image zones saved before moving existed: add the block switched off. */
export function withImageControls(zone: ImageZone): ImageZone {
  return zone.controls.position ? zone : { ...zone, controls: { ...zone.controls, position: POSITION_OFF } };
}

/** Placeholder logo for the admin preview (never uploaded anywhere). */
export const SAMPLE_LOGO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="120" viewBox="0 0 480 120">' +
      '<circle cx="60" cy="60" r="44" fill="#fff"/><circle cx="60" cy="60" r="20" fill="#111"/>' +
      '<text x="124" y="80" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="#fff">LOGO</text></svg>',
  );

export function isText(z: Zone): z is TextZone {
  return z.type === 'text';
}
