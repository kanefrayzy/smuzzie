// Styles of the text/logo layer. Injected once per document by the overlay itself, so the site
// preview and the renderer page always use exactly the same rules.

export const OVERLAY_CSS = `
.bn-stage{position:relative;overflow:hidden}
.bn-layer{position:absolute;inset:0;pointer-events:none}
.bn-zone{position:absolute;display:flex;overflow:hidden}
.bn-zone[hidden]{display:none}
.bn-text-zone{align-items:center;justify-content:center}
.bn-text{width:100%;min-width:0;-webkit-font-smoothing:antialiased;font-kerning:normal;font-synthesis:none}
.bn-line{display:block;white-space:pre;overflow:visible}
.bn-img{display:block;object-fit:contain}
`;

const STYLE_ID = 'bn-overlay-css';

export function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = OVERLAY_CSS;
  doc.head.appendChild(style);
}
