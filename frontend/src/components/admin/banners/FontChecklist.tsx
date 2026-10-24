'use client';

import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { AdminBannerFont } from '@/types/banners';

const faceLabel = (f: AdminBannerFont) => `${f.name} ${f.weight}${f.style === 'italic' ? ' italic' : ''}`;

/**
 * Checkboxes for picking fonts out of a large library: a search field, select all / clear
 * (for what the search shows), the checked faces on top, the rest in a scrolling list.
 */
export default function FontChecklist({
  fonts, checked, disabled, onToggle, onSetMany,
}: {
  fonts: AdminBannerFont[];
  checked: (id: number) => boolean;
  disabled?: (id: number) => boolean;
  onToggle: (id: number, on: boolean) => void;
  /** Check or uncheck many at once (ids that are disabled are left out) */
  onSetMany: (ids: number[], on: boolean) => void;
}) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const list = useMemo(() => {
    const on = fonts.filter((f) => checked(f.id));
    const off = fonts.filter((f) => !checked(f.id) && (!query || faceLabel(f).toLowerCase().includes(query)));
    return [...on, ...off];
  }, [fonts, checked, query]);

  // Select all / clear apply to what the search shows (everything without a search)
  const matching = fonts.filter((f) => !query || faceLabel(f).toLowerCase().includes(query)).map((f) => f.id);
  const changeable = (ids: number[]) => ids.filter((id) => !disabled?.(id) || checked(id));
  const nChecked = fonts.filter((f) => checked(f.id)).length;
  const link = 'text-[11px] text-gray-300 hover:text-white underline-offset-2 hover:underline disabled:opacity-40 disabled:no-underline';

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[11px] text-gray-500">
          {nChecked} of {fonts.length} selected
        </span>
        <button type="button" className={link} onClick={() => onSetMany(changeable(matching), true)} disabled={matching.length === 0}>
          {query ? `Select ${matching.length} found` : 'Select all'}
        </button>
        <button type="button" className={link} onClick={() => onSetMany(changeable(matching), false)} disabled={nChecked === 0}>
          {query ? 'Clear found' : 'Clear'}
        </button>
      </div>
      {fonts.length > 12 && (
        <label className="relative block">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${fonts.length} fonts`}
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-red/50"
          />
        </label>
      )}
      <div className="max-h-56 overflow-y-auto rounded-lg border border-white/[0.06] p-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
        {list.map((f) => {
          const on = checked(f.id);
          const off = disabled?.(f.id) ?? false;
          return (
            <label key={f.id} className={`flex items-center gap-2 text-sm truncate ${off ? 'text-gray-500' : on ? 'text-white' : 'text-gray-300'}`}>
              <input type="checkbox" checked={on} disabled={off} onChange={(e) => onToggle(f.id, e.target.checked)} />
              <span className="truncate">{faceLabel(f)}</span>
            </label>
          );
        })}
        {list.length === 0 && <span className="text-xs text-gray-500">Nothing found</span>}
      </div>
    </div>
  );
}
