'use client';

import React, { useEffect, useState } from 'react';
import { AlignLeft, AlignCenter, AlignRight, Blend, Eye, EyeOff, RotateCcw, Sparkles } from 'lucide-react';
import { charLength, fontFamily, resolveText, truncateChars } from '@/lib/banner-overlay';
import type { Align, BannerFontFace, TextCase, TextZone, TextZoneParams, ZoneFit } from '@/lib/banner-overlay';
import { Segmented, Slider, Swatch, fieldInput } from './ui';

const CASE_LABEL: Record<TextCase, string> = { none: 'Aa', upper: 'AA', lower: 'aa' };
const CASE_NAME: Record<TextCase, string> = { none: 'As typed', upper: 'Uppercase', lower: 'Lowercase' };

const ALIGN_ICON: Record<Align, React.ReactNode> = {
  left: <AlignLeft size={14} />,
  center: <AlignCenter size={14} />,
  right: <AlignRight size={14} />,
};

export function hasTextControls(zone: TextZone): boolean {
  const c = zone.controls;
  return (
    c.text.enabled || c.size.enabled || c.color.enabled || c.align.enabled || c.visible.enabled || !!c.position?.enabled ||
    hasStyleControls(zone)
  );
}

function hasStyleControls(zone: TextZone): boolean {
  const c = zone.controls;
  return !!(
    (c.font?.enabled && c.font.options.length > 1) ||
    (c.case?.enabled && c.case.options.length > 1) ||
    c.letterSpacing?.enabled || c.lineHeight?.enabled || c.glow?.enabled || c.opacity?.enabled || c.gradient?.enabled
  );
}

function LabeledSlider({
  id, label, ...rest
}: { label: string } & React.ComponentProps<typeof Slider>) {
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] text-gray-500 mb-0.5">
        {label}
      </label>
      <Slider id={id} label={label} {...rest} />
    </div>
  );
}

/** Controls for one text zone; only what the template allows is shown. */
export default function TextZoneControls({
  zone, params, fit, fonts, videoWidth, onChange, onReset,
}: {
  zone: TextZone;
  params: TextZoneParams | undefined;
  fit: ZoneFit | undefined;
  /** Faces of the template, to show each font choice in its own font */
  fonts: BannerFontFace[];
  /** Template width in px, to show and type the font size in pixels */
  videoWidth: number;
  onChange: (patch: TextZoneParams) => void;
  onReset: () => void;
}) {
  const c = zone.controls;
  const r = resolveText(zone, params);
  // The field shows what was typed; cleanup (trim etc.) only applies to the rendered text
  const raw = typeof params?.text === 'string' ? params.text : zone.style.text;
  const id = `f-${zone.key}`;
  const swatches = Array.from(new Set([zone.style.color, ...c.color.palette]));

  return (
    <div className={`space-y-3 ${r.visible ? '' : 'opacity-60'}`}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={c.text.enabled ? id : undefined} className="text-sm text-white font-medium truncate">
          {zone.label}
        </label>
        <div className="flex items-center gap-1 shrink-0">
          {c.text.enabled && (
            <span className={`text-xs font-mono tabular-nums ${charLength(raw) >= c.text.maxLength ? 'text-accent-red' : 'text-gray-500'}`}>
              {charLength(raw)}/{c.text.maxLength}
            </span>
          )}
          {c.visible.enabled && (
            <button
              type="button"
              onClick={() => onChange({ visible: !r.visible })}
              className="p-1.5 text-gray-400 hover:text-white"
              aria-label={r.visible ? `Hide ${zone.label}` : `Show ${zone.label}`}
              aria-pressed={!r.visible}
            >
              {r.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          )}
          <button type="button" onClick={onReset} className="p-1.5 text-gray-500 hover:text-white" aria-label={`Reset ${zone.label}`} title="Reset">
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {c.text.enabled &&
        (c.text.multiline ? (
          <textarea
            id={id}
            rows={2}
            value={raw}
            disabled={!r.visible}
            onChange={(e) => onChange({ text: truncateChars(e.target.value.replace(/\r\n?/g, '\n'), c.text.maxLength) })}
            className={`${fieldInput} resize-none`}
          />
        ) : (
          <input
            id={id}
            type="text"
            autoComplete="off"
            value={raw}
            disabled={!r.visible}
            // No trim while typing, so a space can be entered between words
            onChange={(e) => onChange({ text: truncateChars(e.target.value.replace(/[\r\n]/g, ''), c.text.maxLength) })}
            className={fieldInput}
          />
        ))}

      {r.visible && (c.size.enabled || c.align.enabled) && (
        <div className="flex flex-wrap items-center gap-3">
          {c.size.enabled && (
            <div className="flex-1 min-w-[200px] flex items-center gap-3">
              <input
                id={`${id}-size`}
                type="range"
                min={c.size.min}
                max={c.size.max}
                step={0.01}
                value={r.size}
                onChange={(e) => onChange({ size: Number(e.target.value) })}
                aria-label={`${zone.label} size`}
                className="flex-1 h-6 accent-[#ff2d3d]"
              />
              <SizeField size={r.size} min={c.size.min} max={c.size.max} videoWidth={videoWidth} label={`${zone.label} font size in pixels`} onChange={(size) => onChange({ size })} />
            </div>
          )}
          {c.align.enabled && c.align.options.length > 1 && (
            <Segmented<Align>
              label={`${zone.label} alignment`}
              value={r.align}
              options={c.align.options}
              onChange={(align) => onChange({ align })}
              render={(a) => ALIGN_ICON[a]}
            />
          )}
        </div>
      )}

      {r.visible && c.color.enabled && (
        <div className="flex flex-wrap items-center gap-1.5">
          {swatches.map((col) => (
            <Swatch key={col} color={col} selected={r.color === col} onClick={() => onChange({ color: col })} label={`Color ${col}`} />
          ))}
          {c.color.custom && (
            <label
              className={`relative w-9 h-9 rounded-full p-[3px] border-2 cursor-pointer ${!swatches.includes(r.color) ? 'border-white' : 'border-transparent hover:border-white/30'}`}
              title="Custom color"
            >
              <span
                className="block w-full h-full rounded-full"
                style={{ background: 'conic-gradient(#f43, #fd3, #4e6, #3cf, #64f, #f4c, #f43)' }}
              />
              <input
                type="color"
                value={r.color}
                onChange={(e) => onChange({ color: e.target.value.toLowerCase() })}
                className="absolute inset-0 opacity-0 cursor-pointer"
                aria-label={`${zone.label} custom color`}
              />
            </label>
          )}
        </div>
      )}

      {r.visible && hasStyleControls(zone) && (
        <StyleControls zone={zone} params={params} fonts={fonts} onChange={onChange} />
      )}

      {r.visible && fit && (fit.overflow || fit.shrunk) && (
        <p className="text-xs text-amber-300/80" role="status">
          {fit.overflow
            ? "The text doesn't fit even at the smallest size. Try a shorter text."
            : `Font reduced to fit (×${(fit.used / zone.style.size).toFixed(2)}).`}
        </p>
      )}
    </div>
  );
}

/**
 * Font size typed in pixels of the final banner. The slider works in % of the video width;
 * the typed value is applied once it's inside the allowed range (or on blur, clamped).
 */
function SizeField({
  size, min, max, videoWidth, label, onChange,
}: { size: number; min: number; max: number; videoWidth: number; label: string; onChange: (size: number) => void }) {
  const toPx = (pct: number) => Math.round((pct / 100) * videoWidth);
  const [draft, setDraft] = useState(String(toPx(size)));
  useEffect(() => setDraft(String(Math.round((size / 100) * videoWidth))), [size, videoWidth]);
  const commit = () => {
    const px = Number(draft);
    if (!Number.isFinite(px) || px <= 0) {
      setDraft(String(toPx(size)));
      return;
    }
    const pct = Math.round((px / videoWidth) * 100 * 1000) / 1000;
    onChange(Math.min(max, Math.max(min, pct)));
  };
  return (
    <label className="flex items-center gap-1 shrink-0">
      <input
        type="number"
        inputMode="numeric"
        min={toPx(min)}
        max={toPx(max)}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        aria-label={label}
        className="w-16 bg-white/[0.03] border border-white/[0.08] rounded-md px-2 py-1 text-right text-xs font-mono text-white focus:outline-none focus:border-accent-red/50"
      />
      <span className="text-[11px] text-gray-500 font-mono">px</span>
    </label>
  );
}

const GRADIENT_ANGLES: { angle: number; label: string }[] = [
  { angle: 90, label: '→' },
  { angle: 180, label: '↓' },
  { angle: 135, label: '↘' },
  { angle: 45, label: '↗' },
];

/** Gradient fill: on/off, two colors, direction. */
function GradientControls({
  zone, params, onChange,
}: { zone: TextZone; params: TextZoneParams | undefined; onChange: (patch: TextZoneParams) => void }) {
  const r = resolveText(zone, params);
  const g = r.gradient;
  const base = params?.gradient ?? zone.style.gradient ?? { enabled: false, from: r.color, to: '#ff2d8a', angle: 90 };
  const set = (patch: Partial<NonNullable<TextZoneParams['gradient']>>) => onChange({ gradient: { ...base, enabled: true, ...patch } });
  const colorInput = (value: string, key: 'from' | 'to', label: string) => (
    <label className="relative w-9 h-9 rounded-full p-[3px] border-2 border-white/20 cursor-pointer" title={label}>
      <span className="block w-full h-full rounded-full" style={{ background: value }} />
      <input
        type="color"
        value={value}
        onChange={(e) => set({ [key]: e.target.value.toLowerCase() })}
        className="absolute inset-0 opacity-0 cursor-pointer"
        aria-label={`${zone.label} ${label}`}
      />
    </label>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onChange({ gradient: { ...base, enabled: !g } })}
        aria-pressed={!!g}
        className={`h-9 px-3 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${
          g ? 'border-accent-red/60 bg-accent-red/15 text-white' : 'border-white/[0.08] bg-white/[0.02] text-gray-400 hover:text-white'
        }`}
      >
        <Blend size={13} /> Gradient
      </button>
      {g && (
        <>
          {colorInput(g.from, 'from', 'gradient start color')}
          <span className="w-10 h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${g.from}, ${g.to})` }} aria-hidden="true" />
          {colorInput(g.to, 'to', 'gradient end color')}
          <div role="radiogroup" aria-label={`${zone.label} gradient direction`} className="inline-flex rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
            {GRADIENT_ANGLES.map((a) => (
              <button
                key={a.angle}
                type="button"
                role="radio"
                aria-checked={g.angle === a.angle}
                onClick={() => set({ angle: a.angle })}
                className={`h-8 w-8 rounded-md text-sm ${g.angle === a.angle ? 'bg-accent-red/20 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Font, letter case, glow, spacing, line height and opacity: only what the template allows. */
function StyleControls({
  zone, params, fonts, onChange,
}: {
  zone: TextZone;
  params: TextZoneParams | undefined;
  fonts: BannerFontFace[];
  onChange: (patch: TextZoneParams) => void;
}) {
  const c = zone.controls;
  const r = resolveText(zone, params);
  const id = `f-${zone.key}`;
  const byId = new Map(fonts.map((f) => [f.id, f]));
  const fontOptions = c.font?.enabled ? c.font.options.filter((fid) => byId.has(fid)) : [];

  return (
    <div className="space-y-3">
      {fontOptions.length > 1 && (
        <div role="radiogroup" aria-label={`${zone.label} font`} className="flex flex-wrap gap-1.5">
          {fontOptions.map((fid) => {
            const f = byId.get(fid)!;
            const on = r.fontId === fid;
            return (
              <button
                key={fid}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange({ fontId: fid })}
                title={`${f.name} ${f.weight}`}
                className={`h-9 px-3 rounded-lg border text-sm transition-colors ${
                  on ? 'border-accent-red/60 bg-accent-red/15 text-white' : 'border-white/[0.08] bg-white/[0.02] text-gray-300 hover:text-white hover:border-white/20'
                }`}
                style={{ fontFamily: fontFamily(fid), fontWeight: f.weight, fontStyle: f.style }}
              >
                {f.name}
              </button>
            );
          })}
        </div>
      )}

      {c.gradient?.enabled && <GradientControls zone={zone} params={params} onChange={onChange} />}

      {((c.case?.enabled && c.case.options.length > 1) || c.glow?.enabled) && (
        <div className="flex flex-wrap items-center gap-2">
          {c.case?.enabled && c.case.options.length > 1 && (
            <Segmented<TextCase>
              label={`${zone.label} letter case`}
              value={r.case}
              options={c.case.options}
              onChange={(v) => onChange({ case: v })}
              render={(v) => <span title={CASE_NAME[v]} className="font-semibold">{CASE_LABEL[v]}</span>}
            />
          )}
          {c.glow?.enabled && (
            <button
              type="button"
              onClick={() => onChange({ glow: !r.glow })}
              aria-pressed={r.glow}
              className={`h-9 px-3 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${
                r.glow ? 'border-accent-red/60 bg-accent-red/15 text-white' : 'border-white/[0.08] bg-white/[0.02] text-gray-400 hover:text-white'
              }`}
            >
              <Sparkles size={13} /> Glow
            </button>
          )}
        </div>
      )}

      {(c.letterSpacing?.enabled || c.lineHeight?.enabled || c.opacity?.enabled) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
          {c.letterSpacing?.enabled && (
            <LabeledSlider
              id={`${id}-ls`}
              label="Letter spacing"
              value={r.letterSpacing}
              min={c.letterSpacing.min}
              max={c.letterSpacing.max}
              step={0.005}
              onChange={(letterSpacing) => onChange({ letterSpacing })}
              display={`${Math.round(r.letterSpacing * 1000) / 10}%`}
            />
          )}
          {c.lineHeight?.enabled && (
            <LabeledSlider
              id={`${id}-lh`}
              label="Line height"
              value={r.lineHeight}
              min={c.lineHeight.min}
              max={c.lineHeight.max}
              step={0.01}
              onChange={(lineHeight) => onChange({ lineHeight })}
              display={r.lineHeight.toFixed(2)}
            />
          )}
          {c.opacity?.enabled && (
            <LabeledSlider
              id={`${id}-op`}
              label="Opacity"
              value={r.opacity}
              min={c.opacity.min}
              max={c.opacity.max}
              step={1}
              onChange={(opacity) => onChange({ opacity })}
              display={`${r.opacity}%`}
            />
          )}
        </div>
      )}
    </div>
  );
}
