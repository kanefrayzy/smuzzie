import type { BuyerParams, TemplateConfig } from '@/lib/banner-overlay';

// Per-template draft in localStorage. Storage can be unavailable or full (private mode,
// quota), so every access is guarded and the editor works without it. Logos are stored as
// data URLs only while they fit; otherwise the draft is saved without them.
//
// A draft belongs to one version of the template: once the admin changes the zones (texts,
// sizes, positions), an old draft would hide those changes, so it is dropped.

export interface DraftImage {
  dataUrl: string;
  name: string;
  size: number;
}

export interface Draft {
  v: 1;
  params: BuyerParams;
  images: Record<string, DraftImage>;
  email?: string;
  /** Fingerprint of the template config the draft was made for */
  cfg?: string;
}

/** Short fingerprint of a config (FNV-1a over its JSON) */
export function configFingerprint(config: TemplateConfig): string {
  const s = JSON.stringify(config);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36) + s.length.toString(36);
}

const key = (slug: string) => `banner-draft:${slug}:v1`;

/** The saved draft, or null when there is none or it was made for another version of the template. */
export function loadDraft(slug: string, cfg: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(key(slug));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    if (draft?.v !== 1 || typeof draft.params !== 'object' || !draft.params) return null;
    if (draft.cfg !== cfg) {
      window.localStorage.removeItem(key(slug));
      return null;
    }
    return { v: 1, params: draft.params, images: draft.images && typeof draft.images === 'object' ? draft.images : {}, email: draft.email, cfg };
  } catch {
    return null;
  }
}

export function saveDraft(slug: string, draft: Draft): void {
  try {
    window.localStorage.setItem(key(slug), JSON.stringify(draft));
  } catch {
    // Probably over quota because of the logo: keep at least the texts and colors
    try {
      window.localStorage.setItem(key(slug), JSON.stringify({ ...draft, images: {} }));
    } catch {
      /* storage unavailable */
    }
  }
}

export function clearDraft(slug: string): void {
  try {
    window.localStorage.removeItem(key(slug));
  } catch {
    /* storage unavailable */
  }
}
