'use client';

import React from 'react';

// Small form primitives for the buyer editor, in the site's dark/red style.

export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-white/[0.06] pt-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase text-gray-400">{title}</h2>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function Segmented<T extends string>({
  value, options, onChange, label, render,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  label: string;
  render: (v: T) => React.ReactNode;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          role="radio"
          aria-checked={value === opt}
          onClick={() => onChange(opt)}
          className={`h-8 min-w-[2.25rem] px-2 rounded-md flex items-center justify-center text-xs transition-colors ${
            value === opt ? 'bg-accent-red/20 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          {render(opt)}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  id, value, min, max, step, onChange, label, display, style,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  label: string;
  display: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="flex-1 h-6 accent-[#ff2d3d]"
        style={style}
      />
      <output htmlFor={id} className="w-14 text-right text-xs font-mono tabular-nums text-gray-400">
        {display}
      </output>
    </div>
  );
}

export function Swatch({ color, selected, onClick, label }: { color: string; selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      className={`w-9 h-9 rounded-full p-[3px] border-2 transition-colors ${selected ? 'border-white' : 'border-transparent hover:border-white/30'}`}
    >
      <span className="block w-full h-full rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]" style={{ background: color }} />
    </button>
  );
}

// scroll-margin keeps a focused field below the sticky preview on phones
export const fieldInput =
  'w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-accent-red/50 transition-colors scroll-mt-[50vh] lg:scroll-mt-28';
