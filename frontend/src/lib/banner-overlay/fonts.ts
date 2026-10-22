import type { BannerFontFace } from './types';

// Registers template fonts with the FontFace API under their internal family name (bf-<id>).
// No CSS text is built from data, so nothing from the admin or the buyer reaches a stylesheet.
// Works the same in the site preview and in the renderer page.

const loaded = new Map<string, Promise<FontFace | null>>();

function key(font: BannerFontFace, url: string): string {
  return `${font.family}|${font.weight}|${font.style}|${url}`;
}

/**
 * Load the given faces; resolves when all of them are usable (failed ones resolve to null).
 * `resolveUrl` lets the caller rewrite storage URLs (site) or map them to local files (renderer).
 */
export function loadFonts(
  fonts: BannerFontFace[],
  resolveUrl: (font: BannerFontFace) => string = (f) => f.url,
): Promise<(FontFace | null)[]> {
  return Promise.all(
    fonts.map((font) => {
      const url = resolveUrl(font);
      const k = key(font, url);
      let p = loaded.get(k);
      if (!p) {
        // No format() hint: the browser detects woff2/ttf from the data itself
        const face = new FontFace(font.family, `url(${JSON.stringify(url)})`, {
          weight: String(font.weight),
          style: font.style,
          display: 'block',
        });
        p = face
          .load()
          .then((f) => {
            document.fonts.add(f);
            return f;
          })
          .catch(() => {
            loaded.delete(k);
            return null;
          });
        loaded.set(k, p);
      }
      return p;
    }),
  );
}

/** CSS font-family value for a font id; falls back to a generic family until the face loads. */
export function fontFamily(fontId: number): string {
  return `"bf-${fontId}", sans-serif`;
}
