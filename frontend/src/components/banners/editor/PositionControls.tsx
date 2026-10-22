'use client';

import React from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Move, RotateCcw } from 'lucide-react';
import { resolveRect, zoneMinSize } from '@/lib/banner-overlay';
import type { Rect, Zone } from '@/lib/banner-overlay';
import { Slider } from './ui';

const STEP = 1; // percent per arrow press

/**
 * Position of a zone the template lets the buyer move: arrow buttons, size sliders when
 * resizing is allowed, and a reset. The same zone can be dragged in the preview.
 */
export default function PositionControls({
  zone, rect: raw, active, onRect, onActivate,
}: {
  zone: Zone;
  rect: Rect | undefined;
  /** The zone is selected in the preview */
  active: boolean;
  onRect: (rect: Rect) => void;
  onActivate: () => void;
}) {
  const pos = zone.controls.position;
  if (!pos?.enabled) return null;
  const rect = resolveRect(zone, { rect: raw });
  const own = { x: zone.x, y: zone.y, w: zone.w, h: zone.h };
  const moved = rect.x !== own.x || rect.y !== own.y || rect.w !== own.w || rect.h !== own.h;
  const min = zoneMinSize(zone);
  const nudge = (dx: number, dy: number) => {
    onActivate();
    onRect({ ...rect, x: rect.x + dx, y: rect.y + dy });
  };
  const btn = 'w-8 h-8 rounded-md border border-white/[0.08] bg-white/[0.02] text-gray-400 hover:text-white flex items-center justify-center';
  const id = `pos-${zone.key}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onActivate}
          aria-pressed={active}
          className={`h-8 px-2.5 rounded-md border text-xs flex items-center gap-1.5 transition-colors ${
            active ? 'border-accent-red/60 bg-accent-red/15 text-white' : 'border-white/[0.08] bg-white/[0.02] text-gray-400 hover:text-white'
          }`}
        >
          <Move size={13} /> {pos.resize ? 'Move & resize' : 'Move'}
        </button>
        <button type="button" className={btn} onClick={() => nudge(-STEP, 0)} aria-label={`Move ${zone.label} left`}>
          <ArrowLeft size={14} />
        </button>
        <button type="button" className={btn} onClick={() => nudge(0, -STEP)} aria-label={`Move ${zone.label} up`}>
          <ArrowUp size={14} />
        </button>
        <button type="button" className={btn} onClick={() => nudge(0, STEP)} aria-label={`Move ${zone.label} down`}>
          <ArrowDown size={14} />
        </button>
        <button type="button" className={btn} onClick={() => nudge(STEP, 0)} aria-label={`Move ${zone.label} right`}>
          <ArrowRight size={14} />
        </button>
        {moved && (
          <button type="button" onClick={() => onRect(own)} className="ml-auto text-xs text-gray-400 hover:text-white flex items-center gap-1">
            <RotateCcw size={12} /> Original place
          </button>
        )}
      </div>
      {pos.resize && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
          <div>
            <label htmlFor={`${id}-w`} className="block text-[11px] text-gray-500 mb-0.5">Width</label>
            <Slider
              id={`${id}-w`}
              label={`${zone.label} width`}
              value={rect.w}
              min={min.w}
              max={pos.bounds.w}
              step={0.1}
              // Grow from the center, the way people expect a size slider to work
              onChange={(w) => onRect({ ...rect, w, x: rect.x - (w - rect.w) / 2 })}
              display={`${Math.round(rect.w)}%`}
            />
          </div>
          <div>
            <label htmlFor={`${id}-h`} className="block text-[11px] text-gray-500 mb-0.5">Height</label>
            <Slider
              id={`${id}-h`}
              label={`${zone.label} height`}
              value={rect.h}
              min={min.h}
              max={pos.bounds.h}
              step={0.1}
              onChange={(h) => onRect({ ...rect, h, y: rect.y - (h - rect.h) / 2 })}
              display={`${Math.round(rect.h)}%`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
