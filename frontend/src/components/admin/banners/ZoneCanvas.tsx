'use client';

import React, { useMemo } from 'react';
import type { Rect, Zone } from '@/lib/banner-overlay';
import ZoneHandles, { type HandleItem } from '@/components/banners/ZoneHandles';

const FRAME: Rect = { x: 0, y: 0, w: 100, h: 100 };
const MIN = { w: 0.5, h: 0.5 }; // percent

/**
 * Zone rectangles drawn over the template preview in the admin editor. Drag to move, pull the
 * handles to resize, arrow keys nudge the selected zone (0.1%, Shift = 1%). For the selected
 * zone, the area the buyer may drag it in is drawn dotted.
 */
export default function ZoneCanvas({
  zones, selected, onSelect, onRect, errors,
}: {
  zones: Zone[];
  selected: number | null;
  onSelect: (index: number | null) => void;
  onRect: (index: number, rect: Rect) => void;
  errors: Set<number>;
}) {
  const items = useMemo<HandleItem[]>(
    () =>
      zones.map((z, i) => ({
        id: String(i),
        rect: { x: z.x, y: z.y, w: z.w, h: z.h },
        bounds: FRAME,
        resizable: true,
        min: MIN,
        color: errors.has(i) ? '#f87171' : z.type === 'image' ? '#38bdf8' : '#ff2d3d',
        label: z.key,
      })),
    [zones, errors],
  );
  const pos = selected !== null ? zones[selected]?.controls.position : undefined;

  return (
    <>
      {pos?.enabled && (
        <div
          className="absolute pointer-events-none border border-dotted border-amber-300/70"
          style={{ left: `${pos.bounds.x}%`, top: `${pos.bounds.y}%`, width: `${pos.bounds.w}%`, height: `${pos.bounds.h}%` }}
          aria-hidden="true"
        />
      )}
      <ZoneHandles
        items={items}
        selected={selected === null ? null : String(selected)}
        onSelect={(id) => onSelect(id === null ? null : Number(id))}
        onRect={(id, rect) => onRect(Number(id), rect)}
        labels="all"
      />
    </>
  );
}
