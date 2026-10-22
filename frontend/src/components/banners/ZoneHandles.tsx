'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Rect } from '@/lib/banner-overlay';

// Draggable zone rectangles over a banner preview, shared by the admin zone editor and the
// buyer editor. Coordinates are percent of the video. Drag to move, pull the handles to
// resize, arrow keys nudge the selected zone (0.1%, Shift = 1%).

type Mode = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface HandleItem {
  id: string;
  rect: Rect;
  /** The zone can't leave this area */
  bounds: Rect;
  resizable: boolean;
  /** Smallest size when resizing, percent */
  min: { w: number; h: number };
  color: string;
  /** Shown above the zone; for the selected zone only unless `labels` is "all" */
  label?: string;
}

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

const snap = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Apply a drag delta (percent) to a rect, keeping it inside the bounds and above the minimum size. */
export function dragRect(start: Rect, mode: Mode, dx: number, dy: number, b: Rect, min: { w: number; h: number }): Rect {
  const right = b.x + b.w;
  const bottom = b.y + b.h;
  if (mode === 'move') {
    return {
      x: clamp(snap(start.x + dx), b.x, right - start.w),
      y: clamp(snap(start.y + dy), b.y, bottom - start.h),
      w: start.w,
      h: start.h,
    };
  }
  let { x, y, w, h } = start;
  if (mode.includes('w')) {
    x = clamp(snap(start.x + dx), b.x, start.x + start.w - min.w);
    w = start.x + start.w - x;
  }
  if (mode.includes('e')) w = clamp(snap(start.w + dx), min.w, right - start.x);
  if (mode.includes('n')) {
    y = clamp(snap(start.y + dy), b.y, start.y + start.h - min.h);
    h = start.y + start.h - y;
  }
  if (mode.includes('s')) h = clamp(snap(start.h + dy), min.h, bottom - start.y);
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return { x: r(x), y: r(y), w: r(w), h: r(h) };
}

// ─── Snapping ───────────────────────────────────────────────
// While dragging, an edge or the center of the zone sticks to the frame's edges and center
// and to the edges and centers of the other zones, and a guide line shows what it lined up
// with. Hold Alt to place freely.

const SNAP_PX = 6;

export interface Guides {
  x: number[];
  y: number[];
}

function lines(rects: Rect[], axis: 'x' | 'y'): number[] {
  const out = [0, 50, 100];
  for (const r of rects) {
    const a = axis === 'x' ? r.x : r.y;
    const size = axis === 'x' ? r.w : r.h;
    out.push(a, a + size / 2, a + size);
  }
  return out;
}

/** The target nearest to any of the candidates, within the threshold. */
function nearest(candidates: number[], targets: number[], threshold: number): { delta: number; at: number; index: number } | null {
  let best: { delta: number; at: number; index: number } | null = null;
  candidates.forEach((c, index) => {
    for (const t of targets) {
      const d = t - c;
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, at: t, index };
    }
  });
  return best;
}

/** Snap a dragged rect (after dragRect) to the target lines, then keep it in bounds. */
export function snapRect(
  rect: Rect, mode: Mode, others: Rect[], threshold: { x: number; y: number }, b: Rect, min: { w: number; h: number },
): { rect: Rect; guides: Guides } {
  const r = { ...rect };
  const guides: Guides = { x: [], y: [] };
  const tx = lines(others, 'x');
  const ty = lines(others, 'y');
  const right = b.x + b.w;
  const bottom = b.y + b.h;

  if (mode === 'move') {
    const sx = nearest([r.x, r.x + r.w / 2, r.x + r.w], tx, threshold.x);
    if (sx) {
      r.x = Math.min(right - r.w, Math.max(b.x, r.x + sx.delta));
      guides.x.push(sx.at);
    }
    const sy = nearest([r.y, r.y + r.h / 2, r.y + r.h], ty, threshold.y);
    if (sy) {
      r.y = Math.min(bottom - r.h, Math.max(b.y, r.y + sy.delta));
      guides.y.push(sy.at);
    }
  } else {
    if (mode.includes('w')) {
      const s = nearest([r.x], tx, threshold.x);
      if (s && s.at >= b.x && r.x + r.w - s.at >= min.w) {
        r.w = r.x + r.w - s.at;
        r.x = s.at;
        guides.x.push(s.at);
      }
    }
    if (mode.includes('e')) {
      const s = nearest([r.x + r.w], tx, threshold.x);
      if (s && s.at <= right && s.at - r.x >= min.w) {
        r.w = s.at - r.x;
        guides.x.push(s.at);
      }
    }
    if (mode.includes('n')) {
      const s = nearest([r.y], ty, threshold.y);
      if (s && s.at >= b.y && r.y + r.h - s.at >= min.h) {
        r.h = r.y + r.h - s.at;
        r.y = s.at;
        guides.y.push(s.at);
      }
    }
    if (mode.includes('s')) {
      const s = nearest([r.y + r.h], ty, threshold.y);
      if (s && s.at <= bottom && s.at - r.y >= min.h) {
        r.h = s.at - r.y;
        guides.y.push(s.at);
      }
    }
  }
  const q = (v: number) => Math.round(v * 1000) / 1000;
  return { rect: { x: q(r.x), y: q(r.y), w: q(r.w), h: q(r.h) }, guides };
}

export default function ZoneHandles({
  items, selected, onSelect, onRect, labels = 'selected', large = false, snapTo = [],
}: {
  items: HandleItem[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onRect: (id: string, rect: Rect) => void;
  labels?: 'all' | 'selected';
  /** Bigger hit areas for the handles (touch screens) */
  large?: boolean;
  /** Extra rectangles to line up with (e.g. zones that can't be moved) */
  snapTo?: Rect[];
}) {
  const [guides, setGuides] = useState<Guides>({ x: [], y: [] });
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ item: HandleItem; mode: Mode; x: number; y: number; w: number; h: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent, item: HandleItem, mode: Mode) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const box = boxRef.current!.getBoundingClientRect();
    drag.current = { item, mode, x: e.clientX, y: e.clientY, w: box.width, h: box.height };
    onSelect(item.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = ((e.clientX - d.x) / d.w) * 100;
    const dy = ((e.clientY - d.y) / d.h) * 100;
    let rect = dragRect(d.item.rect, d.mode, dx, dy, d.item.bounds, d.item.min);
    if (e.altKey) {
      setGuides({ x: [], y: [] });
    } else {
      const others = [...items.filter((i) => i.id !== d.item.id).map((i) => i.rect), ...snapTo];
      const snapped = snapRect(rect, d.mode, others, { x: (SNAP_PX / d.w) * 100, y: (SNAP_PX / d.h) * 100 }, d.item.bounds, d.item.min);
      rect = snapped.rect;
      setGuides(snapped.guides);
    }
    onRect(d.item.id, rect);
  };

  const endDrag = () => {
    drag.current = null;
    setGuides({ x: [], y: [] });
  };

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const item = items.find((i) => i.id === selected);
      if (!item) return;
      const target = e.target as HTMLElement;
      if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;
      const step = e.shiftKey ? 1 : 0.1;
      const delta: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
      };
      const d = delta[e.key];
      if (!d) return;
      e.preventDefault();
      onRect(item.id, dragRect(item.rect, 'move', d[0], d[1], item.bounds, item.min));
    },
    [selected, items, onRect],
  );

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  const handleBox = large ? 'w-7 h-7 -ml-3.5 -mt-3.5' : 'w-4 h-4 -ml-2 -mt-2';

  return (
    <div ref={boxRef} className="absolute inset-0" onPointerDown={() => onSelect(null)}>
      {guides.x.map((x) => (
        <div key={`gx-${x}`} className="absolute top-0 bottom-0 w-px bg-[#ff4fd8] pointer-events-none z-[3]" style={{ left: `${x}%` }} aria-hidden="true" />
      ))}
      {guides.y.map((y) => (
        <div key={`gy-${y}`} className="absolute left-0 right-0 h-px bg-[#ff4fd8] pointer-events-none z-[3]" style={{ top: `${y}%` }} aria-hidden="true" />
      ))}
      {items.map((item) => {
        const isSel = item.id === selected;
        const { color, rect } = item;
        return (
          <div
            key={item.id}
            className="absolute touch-none"
            style={{
              left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%`,
              outline: `${isSel ? 2 : 1}px ${isSel ? 'solid' : 'dashed'} ${color}`,
              background: isSel ? `${color}22` : `${color}0d`,
              cursor: 'move',
              zIndex: isSel ? 2 : 1,
            }}
            onPointerDown={(e) => onPointerDown(e, item, 'move')}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {item.label && (isSel || labels === 'all') && (
              <span
                className="absolute -top-5 left-0 px-1.5 text-[10px] leading-4 font-mono text-white whitespace-nowrap rounded-sm pointer-events-none"
                style={{ background: color }}
              >
                {item.label}
              </span>
            )}
            {isSel &&
              item.resizable &&
              HANDLES.map((hd) => (
                <span
                  key={hd.mode}
                  className={`absolute ${handleBox} flex items-center justify-center touch-none`}
                  style={{ ...hd.style, cursor: hd.cursor }}
                  onPointerDown={(e) => onPointerDown(e, item, hd.mode)}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  <span className="block w-3 h-3 bg-white border-2 rounded-sm" style={{ borderColor: color }} />
                </span>
              ))}
          </div>
        );
      })}
    </div>
  );
}
