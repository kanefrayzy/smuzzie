// Text layout for a zone: font size, line breaks and balancing are decided here, not by the
// browser, and the lines are rendered explicitly (white-space: pre). The same code runs in the
// buyer's browser and in headless Chromium at render time, and depends only on text widths of
// the shared woff2 font, so engine differences in line breaking (text-wrap: balance etc.)
// can't change the result.

/** Width of `text` set at 100px, without letter spacing. */
export type Measure = (text: string) => number;

export interface TextLayoutInput {
  text: string;
  /** Zone size in px (template resolution) */
  boxW: number;
  boxH: number;
  /** Requested font size and the auto-fit floor, px */
  sizePx: number;
  minPx: number;
  /** Line height as a multiple of the font size */
  lineHeight: number;
  /** Letter spacing in em */
  letterSpacing: number;
}

export interface TextLayout {
  sizePx: number;
  lines: string[];
  /** Font was reduced below the requested size to fit */
  shrunk: boolean;
  /** Words had to be broken inside to fit the width */
  brokeWords: boolean;
  /** Doesn't fit even at the minimum size (text is clipped by the zone) */
  overflow: boolean;
}

// Canvas and DOM widths can differ by a fraction of a pixel; keep a little room so a line that
// "just fits" in the measurement never wraps or clips when rendered.
const WIDTH_SAFETY = 0.985;
const SEARCH_STEPS = 12;

let segmenter: { segment(s: string): Iterable<{ segment: string }> } | null | undefined;

/** User-perceived characters, so a break never splits an emoji or a combining accent. */
export function graphemes(text: string): string[] {
  if (segmenter === undefined) {
    const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: object) => typeof segmenter }).Segmenter;
    segmenter = Seg ? new Seg(undefined, { granularity: 'grapheme' }) : null;
  }
  return segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text);
}

export function layoutText(input: TextLayoutInput, measure: Measure): TextLayout {
  const maxW = Math.max(1, input.boxW * WIDTH_SAFETY);
  const paragraphs = input.text.split('\n').map((p) => p.split(/ +/).filter((w) => w.length > 0));

  const width = (s: string, size: number) =>
    (measure(s) * size) / 100 + input.letterSpacing * size * graphemes(s).length;

  const wrap = (size: number, limit: number, breakWords: boolean): { lines: string[]; tooWide: boolean } => {
    const lines: string[] = [];
    let tooWide = false;
    for (const words of paragraphs) {
      let cur = '';
      for (const word of words) {
        const candidate = cur ? `${cur} ${word}` : word;
        if (width(candidate, size) <= limit) {
          cur = candidate;
          continue;
        }
        if (cur) lines.push(cur);
        cur = '';
        if (width(word, size) <= limit) {
          cur = word;
        } else if (breakWords) {
          // Split an over-long word by characters
          for (const g of graphemes(word)) {
            if (cur && width(cur + g, size) > limit) {
              lines.push(cur);
              cur = g;
            } else {
              cur += g;
            }
          }
        } else {
          cur = word;
          tooWide = true;
        }
      }
      lines.push(cur); // an empty paragraph keeps its empty line
    }
    return { lines, tooWide };
  };

  const fits = (size: number, breakWords: boolean) => {
    const { lines, tooWide } = wrap(size, maxW, breakWords);
    return !tooWide && lines.length * input.lineHeight * size <= input.boxH + 0.5;
  };

  const minPx = Math.min(input.minPx, input.sizePx);
  let size = input.sizePx;
  let breakWords = false;
  let overflow = false;

  if (!fits(size, false)) {
    // Largest size in [min, requested] that fits; first without breaking words, like the
    // prototype, and only if that is impossible even at the minimum, with broken words.
    breakWords = !fits(minPx, false);
    if (breakWords && !fits(minPx, true)) {
      size = minPx;
      overflow = true;
    } else {
      let lo = minPx;
      let hi = size;
      for (let i = 0; i < SEARCH_STEPS; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid, breakWords)) lo = mid;
        else hi = mid;
      }
      size = lo;
    }
  }
  size = Math.floor(size * 100) / 100;

  let lines = wrap(size, maxW, breakWords).lines;

  // Balance: the narrowest width that keeps the same number of lines evens them out
  if (lines.length > 1 && !overflow) {
    const count = lines.length;
    let lo = 0;
    let hi = maxW;
    for (let i = 0; i < SEARCH_STEPS; i++) {
      const mid = (lo + hi) / 2;
      const attempt = wrap(size, mid, breakWords);
      if (!attempt.tooWide && attempt.lines.length <= count) hi = mid;
      else lo = mid;
    }
    const balanced = wrap(size, hi, breakWords);
    if (!balanced.tooWide && balanced.lines.length === count) lines = balanced.lines;
  }

  return { sizePx: size, lines, shrunk: size < input.sizePx - 0.01, brokeWords: breakWords, overflow };
}

/**
 * Canvas-based measure for a font face, cached per string. The face must already be loaded
 * (document.fonts) or the fallback font is measured instead.
 */
export function canvasMeasure(doc: Document, font: { family: string; weight: number; style: string }): Measure {
  const canvas = doc.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.font = `${font.style} ${font.weight} 100px "${font.family}", sans-serif`;
  const kerning = ctx as unknown as { fontKerning?: string; letterSpacing?: string };
  if ('fontKerning' in kerning) kerning.fontKerning = 'normal';
  if ('letterSpacing' in kerning) kerning.letterSpacing = '0px';

  const cache = new Map<string, number>();
  return (text: string) => {
    let w = cache.get(text);
    if (w === undefined) {
      w = ctx.measureText(text).width;
      cache.set(text, w);
    }
    return w;
  };
}
