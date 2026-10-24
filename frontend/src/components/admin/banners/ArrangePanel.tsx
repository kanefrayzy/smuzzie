'use client';

import React, { useState } from 'react';
import {
  AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal,
  AlignEndHorizontal, AlignVerticalSpaceAround, AlignHorizontalSpaceAround,
} from 'lucide-react';
import type { AlignMode } from '@/components/banners/arrange';

export type AlignTarget = 'selection' | 'frame';

const ALIGN: { mode: AlignMode; icon: React.ElementType; title: string }[] = [
  { mode: 'left', icon: AlignStartVertical, title: 'Align left edges' },
  { mode: 'hcenter', icon: AlignCenterVertical, title: 'Align horizontal centers' },
  { mode: 'right', icon: AlignEndVertical, title: 'Align right edges' },
  { mode: 'top', icon: AlignStartHorizontal, title: 'Align top edges' },
  { mode: 'vcenter', icon: AlignCenterHorizontal, title: 'Align vertical centers' },
  { mode: 'bottom', icon: AlignEndHorizontal, title: 'Align bottom edges' },
];

const btn =
  'w-9 h-9 flex items-center justify-center rounded-md bg-white/[0.04] border border-white/[0.06] text-gray-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/[0.04]';

/**
 * Photoshop-style align panel for the selected zones. Works on what is drawn: the texts
 * themselves, not their zone boxes. Spacing evens out the gaps between three or more zones,
 * or sets an exact gap in pixels.
 */
export default function ArrangePanel({
  count, target, onTarget, onAlign, onDistribute, gaps,
}: {
  count: number;
  target: AlignTarget;
  onTarget: (t: AlignTarget) => void;
  onAlign: (mode: AlignMode) => void;
  /** `gapPx` empty: even out between the first and the last */
  onDistribute: (axis: 'x' | 'y', gapPx?: number) => void;
  /** Current gaps between neighbours in px, top to bottom and left to right */
  gaps: { x: number[]; y: number[] };
}) {
  const [gap, setGap] = useState('');
  const gapPx = gap.trim() === '' ? undefined : Number(gap);
  const gapOk = gapPx === undefined || (Number.isFinite(gapPx) && Math.abs(gapPx) <= 5000);
  const toFrame = count === 1 || target === 'frame';
  const fmt = (list: number[]) => list.map((g) => Math.round(g)).join(' · ');

  return (
    <div className="glass-card p-5 border border-white/5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-white">
          {count > 1 ? `${count} zones selected` : 'Align'}
        </h4>
        <label className="flex items-center gap-2 text-[11px] text-gray-400">
          Align to
          <select
            value={toFrame ? 'frame' : 'selection'}
            disabled={count === 1}
            onChange={(e) => onTarget(e.target.value as AlignTarget)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-md px-2 py-1 text-xs text-white disabled:opacity-60"
          >
            <option value="selection">Selection</option>
            <option value="frame">Banner</option>
          </select>
        </label>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1.5">Align</div>
        <div className="flex flex-wrap gap-1.5">
          {ALIGN.map(({ mode, icon: Icon, title }, i) => (
            <React.Fragment key={mode}>
              {i === 3 && <span className="w-2" />}
              <button type="button" className={btn} title={title} aria-label={title} onClick={() => onAlign(mode)}>
                <Icon size={16} />
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1.5">Space between</div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={btn}
            disabled={count < 2 || (gapPx === undefined && count < 3) || !gapOk}
            title="Equal vertical spacing (top to bottom)"
            aria-label="Equal vertical spacing"
            onClick={() => onDistribute('y', gapPx)}
          >
            <AlignVerticalSpaceAround size={16} />
          </button>
          <button
            type="button"
            className={btn}
            disabled={count < 2 || (gapPx === undefined && count < 3) || !gapOk}
            title="Equal horizontal spacing (left to right)"
            aria-label="Equal horizontal spacing"
            onClick={() => onDistribute('x', gapPx)}
          >
            <AlignHorizontalSpaceAround size={16} />
          </button>
          <label className="flex items-center gap-1.5 ml-2 text-xs text-gray-400">
            Gap
            <input
              type="number"
              value={gap}
              onChange={(e) => setGap(e.target.value)}
              placeholder="auto"
              className={`w-20 bg-white/[0.04] border rounded-md px-2 py-1 text-xs text-white placeholder-gray-600 ${gapOk ? 'border-white/[0.08]' : 'border-red-400/60'}`}
            />
            px
          </label>
        </div>
        <p className="mt-1.5 text-[11px] text-gray-500 leading-relaxed">
          Gap empty: even spacing, the first and last stay put. A number: exactly that many pixels between
          the texts.
        </p>
        {count > 1 && (gaps.y.length > 0 || gaps.x.length > 0) && (
          <p className="mt-1 text-[11px] font-mono text-gray-400">
            {gaps.y.length > 0 && <>Now, top to bottom: {fmt(gaps.y)} px</>}
            {gaps.y.length > 0 && gaps.x.length > 0 && <br />}
            {gaps.x.length > 0 && <>Left to right: {fmt(gaps.x)} px</>}
          </p>
        )}
      </div>

      <p className="text-[11px] text-gray-500 leading-relaxed">
        Shift / Ctrl + click or drag a frame on the empty area to select several zones · drag any of them to move
        them together · Ctrl+A selects all · Esc clears.
      </p>
    </div>
  );
}
