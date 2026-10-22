// Shared banner overlay: one module for the site preview, the admin zone editor and the
// renderer (bundled into renderer/dist/overlay.js with esbuild). No React, no network.

export * from './types';
export { hueMatrix, applyHue, shiftColor, hueFilter, parseHex, toHex, isHex } from './color';
export { OVERLAY_CSS, ensureStyles } from './css';
export { layoutText, canvasMeasure, graphemes } from './layout';
export type { Measure, TextLayout, TextLayoutInput } from './layout';
export {
  resolveText, resolveImage, resolveHue, defaultParams, defaultZoneParams, exportParams, configFontIds,
  resolveRect, zoneMinSize, MIN_BUYER_ZONE,
  cleanText, charLength, truncateChars,
} from './resolve';
export type { ResolvedText, ResolvedImage } from './resolve';
export { loadFonts, fontFamily } from './fonts';
export {
  LAYER_ID, CUSTOM_LIMITS, customConfig, layerTextZone, layerImageZone, layerZones, expandLayers, layerParams,
  nextLayerId, newLayerRect,
} from './custom';
export { BannerOverlay } from './overlay';
export type { OverlayState, OverlayResult, ZoneFit } from './overlay';
export { imageBox, zoneOrder, isolateZones, isAnimatedSource } from './boxes';
export type { ImageBox, ZoneInfo } from './boxes';
