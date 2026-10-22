import type { BuyerParams } from '@/lib/banner-overlay';

// Per-template draft in localStorage. Storage can be unavailable or full (private mode,
// quota), so every access is guarded and the editor works without it. Logos are stored as
// data URLs only while they fit; otherwise the draft is saved without them.

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
}

const key = (slug: string) => `banner-draft:${slug}:v1`;

export function loadDraft(slug: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(key(slug));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    if (draft?.v !== 1 || typeof draft.params !== 'object' || !draft.params) return null;
    return { v: 1, params: draft.params, images: draft.images && typeof draft.images === 'object' ? draft.images : {}, email: draft.email };
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
