'use client';

import React from 'react';
import { AlignLeft, AlignCenter, AlignRight, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { charLength, resolveText, truncateChars } from '@/lib/banner-overlay';
import type { Align, TextZone, TextZoneParams, ZoneFit } from '@/lib/banner-overlay';
import { Segmented, Slider, Swatch, fieldInput } from './ui';

const ALIGN_ICON: Record<Align, React.ReactNode> = {
  left: <AlignLeft size={14} />,
  center: <AlignCenter size={14} />,
  right: <AlignRight size={14} />,
};

export function hasTextControls(zone: TextZone): boolean {
  const c = zone.controls;
  return c.text.enabled || c.size.enabled || c.color.enabled || c.align.enabled || c.visible.enabled;
}

/** Controls for one text zone; only what the template allows is shown. */
export default function TextZoneControls({
  zone, params, fit, onChange, onReset,
}: {
  zone: TextZone;
  params: TextZoneParams | undefined;
  fit: ZoneFit | undefined;
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
            <div className="flex-1 min-w-[160px]">
              <Slider
                id={`${id}-size`}
                label={`${zone.label} size`}
                value={r.size}
                min={c.size.min}
                max={c.size.max}
                step={0.01}
                onChange={(size) => onChange({ size })}
                display={`×${(r.size / zone.style.size).toFixed(2)}`}
              />
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
