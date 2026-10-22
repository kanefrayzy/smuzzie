// Background hue shift. The preview uses CSS `filter: hue-rotate()` on the <video>; the
// renderer applies the SAME 3x3 matrix with ffmpeg's colorchannelmixer (ffmpeg's own `hue`
// filter computes a different color). Coefficients from the W3C Filter Effects spec.

export type Matrix3 = [number, number, number, number, number, number, number, number, number];

/** Row-major RGB matrix of CSS hue-rotate(deg). */
export function hueMatrix(deg: number): Matrix3 {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
}

export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex(rgb: [number, number, number]): string {
  return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function isHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

/** Apply the hue matrix to an sRGB color, clamped like the CSS filter and colorchannelmixer. */
export function applyHue(rgb: [number, number, number], deg: number): [number, number, number] {
  const m = hueMatrix(deg);
  return [0, 1, 2].map((i) =>
    Math.max(0, Math.min(255, Math.round(m[i * 3] * rgb[0] + m[i * 3 + 1] * rgb[1] + m[i * 3 + 2] * rgb[2]))),
  ) as [number, number, number];
}

/** A template color after the background hue shift, as #rrggbb. */
export function shiftColor(hex: string, deg: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return toHex(deg ? applyHue(rgb, deg) : rgb);
}

/** CSS filter value for the preview video. */
export function hueFilter(deg: number): string {
  return deg ? `hue-rotate(${deg}deg)` : 'none';
}
