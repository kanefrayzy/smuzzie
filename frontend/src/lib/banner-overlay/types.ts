// Template config and buyer params, schema v1 (docs/banners/PLAN.md §2).
// Shared by the buyer editor, the admin zone editor and the renderer bundle,
// so this file must stay free of React and browser-only imports.

export type Align = 'left' | 'center' | 'right';
export type AlignY = 'top' | 'center' | 'bottom';
export type TextCase = 'none' | 'upper' | 'lower';

/** Percent of the video width / height */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ZoneRect extends Rect {
  key: string;
  label: string;
}

/**
 * The buyer may drag the zone (and, with `resize`, change its size) inside `bounds`.
 * Added after the first templates: missing = off.
 */
export interface PositionControl {
  enabled: boolean;
  resize: boolean;
  bounds: Rect;
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
  /** Percent, 10..100. Missing in configs saved before it existed: treat as 100 */
  opacity?: number;
  /** Gradient fill instead of the flat color. Missing = off */
  gradient?: TextGradient;
}

export interface TextGradient {
  enabled: boolean;
  from: string;
  to: string;
  /** CSS linear-gradient angle, 0..359 (90 = left to right) */
  angle: number;
}

export interface RangeControl {
  enabled: boolean;
  min: number;
  max: number;
}

// The blocks marked optional were added after the first templates and orders were saved;
// the server always writes them now, but old snapshots don't have them (= switched off).
export interface TextControls {
  text: { enabled: boolean; maxLength: number; multiline: boolean };
  size: RangeControl;
  color: { enabled: boolean; palette: string[]; custom: boolean };
  align: { enabled: boolean; options: Align[] };
  visible: { enabled: boolean };
  /** Font ids the buyer can pick from; always includes the default font */
  font?: { enabled: boolean; options: number[] };
  case?: { enabled: boolean; options: TextCase[] };
  /** em */
  letterSpacing?: RangeControl;
  lineHeight?: RangeControl;
  glow?: { enabled: boolean };
  /** Percent */
  opacity?: RangeControl;
  position?: PositionControl;
  /** Buyer may switch the gradient on/off and pick its colors and direction */
  gradient?: { enabled: boolean };
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
  position?: PositionControl;
}

export interface ImageZone extends ZoneRect {
  type: 'image';
  style: ImageStyle;
  controls: ImageControls;
}

export type Zone = TextZone | ImageZone;

/** Layers the buyer adds on top of the template's zones. Missing in older configs = off. */
export interface CustomLayersConfig {
  enabled: boolean;
  maxText: number;
  maxImage: number;
  /** Fonts for added texts; the first one is the starting font */
  fonts: number[];
  /** Where added layers may be placed */
  bounds: Rect;
}

export interface TemplateConfig {
  schemaVersion: 1;
  accent: string;
  hue: { enabled: boolean; default: number; presets: number[] };
  zones: Zone[];
  custom?: CustomLayersConfig;
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
  fontId?: number;
  case?: TextCase;
  letterSpacing?: number;
  lineHeight?: number;
  glow?: boolean;
  opacity?: number;
  rect?: Rect;
  gradient?: TextGradient;
}

export interface ImageZoneParams {
  scale?: number;
  alignX?: Align;
  alignY?: AlignY;
  rect?: Rect;
}

/** A layer the buyer added; drawn above the template's zones, in list order. */
export type BuyerLayer =
  | ({ id: string; type: 'text' } & TextZoneParams)
  | ({ id: string; type: 'image' } & ImageZoneParams);

/** What the buyer chose. Only enabled controls are sent; the server drops the rest. */
export interface BuyerParams {
  schemaVersion: 1;
  hue: number;
  zones: Record<string, TextZoneParams | ImageZoneParams>;
  layers?: BuyerLayer[];
}
