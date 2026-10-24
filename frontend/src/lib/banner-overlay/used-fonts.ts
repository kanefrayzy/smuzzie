import { expandLayers } from './custom';
import { resolveText } from './resolve';
import type { BannerFontFace, BuyerParams, TemplateConfig, TextZoneParams } from './types';

/**
 * Fonts the visible texts use right now: zone defaults, the buyer's picks and added layers.
 * A template may offer hundreds of faces; only these need to be downloaded to lay out and draw
 * the banner (the editor's font picker loads the others when they are shown).
 */
export function usedFontIds(config: TemplateConfig, params: BuyerParams): number[] {
  const { config: c, params: p } = expandLayers(config, params);
  const ids = new Set<number>();
  for (const zone of c.zones) {
    if (zone.type !== 'text') continue;
    const r = resolveText(zone, p.zones[zone.key] as TextZoneParams | undefined);
    if (r.visible && r.text.trim() !== '') ids.add(r.fontId);
  }
  return Array.from(ids).sort((a, b) => a - b);
}

/** The faces among `fonts` that the current banner uses. */
export function usedFonts<T extends BannerFontFace>(fonts: T[], config: TemplateConfig, params: BuyerParams): T[] {
  const ids = new Set(usedFontIds(config, params));
  return fonts.filter((f) => ids.has(f.id));
}
