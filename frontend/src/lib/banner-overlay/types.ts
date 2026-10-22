// Template config and buyer params, schema v1 (docs/banners/PLAN.md §2).
// Shared by the buyer editor, the admin zone editor and the renderer bundle,
// so this file must stay free of React and browser-only imports.

export type Align = 'left' | 'center' | 'right';
export type AlignY = 'top' | 'center' | 'bottom';
export type TextCase = 'none' | 'upper' | 'lower';

export interface ZoneRect {
  key: string;
  label: string;
  /** Percent of the video width / height */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextStyle {
  text: string;
  fontId: number;
  /** Percent of the video WIDTH */
  size: number;
  /** Auto-fit never shrinks below this, percent of the video width */
  minSize: number;
  case: TextCase;
  align: Align;
  color: string;
  glow: boolean;
  lineHeight: number;
  letterSpacing: number;
}

export interface TextControls {
  text: { enabled: boolean; maxLength: number; multiline: boolean };
  size: { enabled: boolean; min: number; max: number };
  color: { enabled: boolean; palette: string[]; custom: boolean };
  align: { enabled: boolean; options: Align[] };
  visible: { enabled: boolean };
}

export interface TextZone extends ZoneRect {
  type: 'text';
  style: TextStyle;
  controls: TextControls;
}

export interface ImageStyle {
  /** Percent of the zone */
  scale: number;
  alignX: Align;
  alignY: AlignY;
}

export interface ImageControls {
  upload: { enabled: boolean; maxBytes: number };
  scale: { enabled: boolean; min: number; max: number };
  align: { enabled: boolean; x: Align[]; y: AlignY[] };
}

export interface ImageZone extends ZoneRect {
  type: 'image';
  style: ImageStyle;
  controls: ImageControls;
}

export type Zone = TextZone | ImageZone;

export interface TemplateConfig {
  schemaVersion: 1;
  accent: string;
  hue: { enabled: boolean; default: number; presets: number[] };
  zones: Zone[];
}

/** Font face as the API returns it; `family` is the CSS name (bf-<id>). */
export interface BannerFontFace {
  id: number;
  family: string;
  name: string;
  weight: number;
  style: 'normal' | 'italic';
  url: string;
}

export interface TextZoneParams {
  text?: string;
  size?: number;
  color?: string;
  align?: Align;
  visible?: boolean;
}

export interface ImageZoneParams {
  scale?: number;
  alignX?: Align;
  alignY?: AlignY;
}

/** What the buyer chose. Only enabled controls are sent; the server drops the rest. */
export interface BuyerParams {
  schemaVersion: 1;
  hue: number;
  zones: Record<string, TextZoneParams | ImageZoneParams>;
}
