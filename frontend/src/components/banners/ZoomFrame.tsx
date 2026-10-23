'use client';

import React, { useEffect, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';

// A banner preview that can be opened full screen with zoom, for placing blocks precisely.
// The element tree is the same in both modes (only classes and sizes change), so the preview
// inside keeps its video and layout state when it opens or closes.
//
// The full screen view is `position: fixed`, so ancestors must not create a containing block
// (transform / filter / backdrop-filter) or a low stacking context while it is open.

const ZOOMS = [1, 1.5, 2, 3, 4];

export default function ZoomFrame({
  expanded, onClose, aspect, className = '', style, title, tools, children,
}: {
  expanded: boolean;
  onClose: () => void;
  /** Banner width / height */
  aspect: number;
  /** Size of the preview in the normal layout */
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  /** Extra buttons in the full screen toolbar */
  tools?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!expanded) {
      setZoom(1);
      return;
    }
    const body = document.body.style;
    const prev = body.overflow;
    body.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      body.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [expanded, onClose]);

  const i = ZOOMS.indexOf(zoom);
  const btn =
    'h-8 min-w-[2rem] px-2 rounded-md flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <div className={expanded ? 'fixed inset-0 z-[200] flex flex-col bg-[#060608]' : ''}>
      {expanded && (
        <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 sm:px-4 py-2 border-b border-white/[0.08] bg-[#0b0b0f]">
          {title && <span className="text-sm text-white font-medium truncate mr-2 hidden sm:block">{title}</span>}
          <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] p-0.5">
            <button type="button" className={btn} onClick={() => setZoom(ZOOMS[i - 1])} disabled={i <= 0} aria-label="Zoom out">
              <Minus size={15} />
            </button>
            <button type="button" className={`${btn} w-14 font-mono text-xs tabular-nums`} onClick={() => setZoom(1)} title="Fit to screen">
              {Math.round(zoom * 100)}%
            </button>
            <button type="button" className={btn} onClick={() => setZoom(ZOOMS[i + 1])} disabled={i >= ZOOMS.length - 1} aria-label="Zoom in">
              <Plus size={15} />
            </button>
          </div>
          <span className="hidden lg:block text-[11px] text-gray-500">Arrows nudge the selected block · Shift = bigger steps · Alt = no snapping</span>
          <div className="ml-auto flex items-center gap-2">
            {tools}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-semibold text-white"
            >
              <X size={14} /> Close
            </button>
          </div>
        </div>
      )}
      <div className={expanded ? 'flex-1 min-h-0 overflow-auto p-4 sm:p-6' : ''}>
        <div
          className={expanded ? 'mx-auto pt-[18px]' : `mx-auto ${className}`}
          // Full screen: fit the screen, times the zoom (the top padding leaves room for zone labels)
          style={expanded ? { width: `calc(min(100vw - 3rem, (100dvh - 7.5rem) * ${aspect}) * ${zoom})` } : style}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
