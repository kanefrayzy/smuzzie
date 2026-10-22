'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import type { Zone } from '@/lib/banner-overlay';

type Mode = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type Rect = Pick<Zone, 'x' | 'y' | 'w' | 'h'>;

const HANDLES: { mode: Exclude<Mode, 'move'>; style: React.CSSProperties; cursor: string }[] = [
  { mode: 'nw', style: { left: 0, top: 0 }, cursor: 'nwse-resize' },
  { mode: 'n', style: { left: '50%', top: 0 }, cursor: 'ns-resize' },
  { mode: 'ne', style: { left: '100%', top: 0 }, cursor: 'nesw-resize' },
  { mode: 'e', style: { left: '100%', top: '50%' }, cursor: 'ew-resize' },
  { mode: 'se', style: { left: '100%', top: '100%' }, cursor: 'nwse-resize' },
  { mode: 's', style: { left: '50%', top: '100%' }, cursor: 'ns-resize' },
  { mode: 'sw', style: { left: 0, top: '100%' }, cursor: 'nesw-resize' },
  { mode: 'w', style: { left: 0, top: '50%' }, cursor: 'ew-resize' },
];

const MIN = 0.5; // percent
const snap = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Apply a drag delta (percent) to a zone rect, keeping it inside the video. */
function dragRect(start: Rect, mode: Mode, dx: number, dy: number): Rect {
  let { x, y, w, h } = start;
  if (mode === 'move') {
    x = clamp(start.x + dx, 0, 100 - w);
    y = clamp(start.y + dy, 0, 100 - h);
    return { x: snap(x), y: snap(y), w, h };
  }
  if (mode.includes('w')) {
    const nx = clamp(start.x + dx, 0, start.x + start.w - MIN);
    w = start.w + (start.x - nx);
    x = nx;
  }
  if (mode.includes('e')) w = clamp(start.w + dx, MIN, 100 - start.x);
  if (mode.includes('n')) {
    const ny = clamp(start.y + dy, 0, start.y + start.h - MIN);
    h = start.h + (start.y - ny);
    y = ny;
  }
  if (mode.includes('s')) h = clamp(start.h + dy, MIN, 100 - start.y);
  return { x: snap(x), y: snap(y), w: snap(w), h: snap(h) };
}

/**
 * Zone rectangles drawn over the template preview. Drag to move, pull the handles to resize,
 * arrow keys nudge the selected zone (0.1%, Shift = 1%). Coordinates are percent of the video.
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
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ index: number; mode: Mode; x: number; y: number; start: Rect; w: number; h: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent, index: number, mode: Mode) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const box = boxRef.current!.getBoundingClientRect();
    const z = zones[index];
    drag.current = { index, mode, x: e.clientX, y: e.clientY, start: { x: z.x, y: z.y, w: z.w, h: z.h }, w: box.width, h: box.height };
    onSelect(index);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = ((e.clientX - d.x) / d.w) * 100;
    const dy = ((e.clientY - d.y) / d.h) * 100;
    onRect(d.index, dragRect(d.start, d.mode, dx, dy));
  };

  const endDrag = () => {
    drag.current = null;
  };

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (selected === null) return;
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const step = e.shiftKey ? 1 : 0.1;
      const delta: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
      };
      const d = delta[e.key];
      if (!d) return;
      e.preventDefault();
      const z = zones[selected];
      onRect(selected, dragRect({ x: z.x, y: z.y, w: z.w, h: z.h }, 'move', d[0], d[1]));
    },
    [selected, zones, onRect],
  );

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  return (
    <div ref={boxRef} className="absolute inset-0" onPointerDown={() => onSelect(null)}>
      {zones.map((z, i) => {
        const isSel = i === selected;
        const color = errors.has(i) ? '#f87171' : z.type === 'image' ? '#38bdf8' : '#ff2d3d';
        return (
          <div
            key={`${z.key}-${i}`}
            className="absolute touch-none"
            style={{
              left: `${z.x}%`, top: `${z.y}%`, width: `${z.w}%`, height: `${z.h}%`,
              outline: `${isSel ? 2 : 1}px ${isSel ? 'solid' : 'dashed'} ${color}`,
              background: isSel ? `${color}22` : `${color}0d`,
              cursor: 'move',
              zIndex: isSel ? 2 : 1,
            }}
            onPointerDown={(e) => onPointerDown(e, i, 'move')}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <span
              className="absolute -top-5 left-0 px-1.5 text-[10px] leading-4 font-mono text-white whitespace-nowrap rounded-sm pointer-events-none"
              style={{ background: color }}
            >
              {z.key}
            </span>
            {isSel &&
              HANDLES.map((hd) => (
                <span
                  key={hd.mode}
                  className="absolute w-3 h-3 -ml-1.5 -mt-1.5 bg-white border-2 rounded-sm touch-none"
                  style={{ ...hd.style, borderColor: color, cursor: hd.cursor }}
                  onPointerDown={(e) => onPointerDown(e, i, hd.mode)}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}
