'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { fontFamily, loadFonts } from '@/lib/banner-overlay';
import type { BannerFontFace } from '@/lib/banner-overlay';
import { getImageUrl } from '@/lib/utils';

// The buyer's font choice for one text. A few fonts are buttons; a long list (a template can
// offer the whole library) gets a search field and a scrolling list. Each font is downloaded
// only when its name is on screen, to show it in its own face.

const WEIGHT: Record<number, string> = {
  100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black',
};
const BUTTONS_UP_TO = 8;

export const faceStyle = (f: BannerFontFace) => (WEIGHT[f.weight] ?? String(f.weight)) + (f.style === 'italic' ? ' Italic' : '');

const load = (f: BannerFontFace) => loadFonts([f], (x) => getImageUrl(x.url));

function Row({ font, on, onPick }: { font: BannerFontFace; on: boolean; onPick: () => void }) {
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: '120px' });
  useEffect(() => {
    if (inView) load(font);
  }, [inView, font]);
  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPick}
      className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-md transition-colors ${
        on ? 'bg-accent-red/15 text-white' : 'text-gray-300 hover:bg-white/[0.04] hover:text-white'
      }`}
    >
      <span className="flex-1 min-w-0 truncate text-[15px]" style={{ fontFamily: fontFamily(font.id), fontWeight: font.weight, fontStyle: font.style }}>
        {font.name}
      </span>
      <span className="shrink-0 text-[11px] text-gray-500">{faceStyle(font)}</span>
      {on && <Check size={14} className="shrink-0 text-accent-red" />}
    </button>
  );
}

export default function FontPicker({
  fonts, value, onChange, label,
}: {
  /** The faces offered, in the template's order */
  fonts: BannerFontFace[];
  value: number;
  onChange: (id: number) => void;
  label: string;
}) {
  const [q, setQ] = useState('');
  const few = fonts.length <= BUTTONS_UP_TO;

  // Buttons show every face at once: load them all (there are only a few)
  useEffect(() => {
    if (few) loadFonts(fonts, (x) => getImageUrl(x.url));
  }, [few, fonts]);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    const sorted = [...fonts].sort((a, b) => a.name.localeCompare(b.name) || a.weight - b.weight || a.style.localeCompare(b.style));
    return query ? sorted.filter((f) => `${f.name} ${faceStyle(f)}`.toLowerCase().includes(query)) : sorted;
  }, [fonts, q]);

  if (few) {
    // Same family twice (e.g. Regular and Bold): name the style too
    const dupes = new Set(fonts.filter((f, i) => fonts.findIndex((g) => g.name === f.name) !== i).map((f) => f.name));
    return (
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {fonts.map((f) => {
          const on = value === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(f.id)}
              title={`${f.name} ${faceStyle(f)}`}
              className={`h-9 px-3 rounded-lg border text-sm transition-colors ${
                on ? 'border-accent-red/60 bg-accent-red/15 text-white' : 'border-white/[0.08] bg-white/[0.02] text-gray-300 hover:text-white hover:border-white/20'
              }`}
              style={{ fontFamily: fontFamily(f.id), fontWeight: f.weight, fontStyle: f.style }}
            >
              {f.name}
              {dupes.has(f.name) ? ` ${faceStyle(f)}` : ''}
            </button>
          );
        })}
      </div>
    );
  }

  const current = fonts.find((f) => f.id === value);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500">
        <span>Font · {fonts.length} to choose from</span>
        {current && (
          <span className="truncate text-gray-300">
            {current.name} {faceStyle(current)}
          </span>
        )}
      </div>
      <label className="relative block">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search fonts"
          aria-label={`Search fonts for ${label}`}
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-red/50"
        />
      </label>
      <div role="radiogroup" aria-label={label} className="max-h-64 overflow-y-auto rounded-lg border border-white/[0.06] bg-white/[0.015] p-1">
        {list.map((f) => (
          <Row key={f.id} font={f} on={value === f.id} onPick={() => onChange(f.id)} />
        ))}
        {list.length === 0 && <p className="px-3 py-2 text-xs text-gray-500">No fonts match</p>}
      </div>
    </div>
  );
}
