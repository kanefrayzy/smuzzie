'use client';

import React from 'react';
import type { CustomLayersConfig } from '@/lib/banner-overlay';
import type { AdminBannerFont } from '@/types/banners';
import FontChecklist from './FontChecklist';

export const CUSTOM_OFF: CustomLayersConfig = {
  enabled: false, maxText: 3, maxImage: 1, fonts: [], bounds: { x: 0, y: 0, w: 100, h: 100 },
};

const input =
  'w-full bg-surface border border-white/5 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-accent-red/50';

/** Template setting: may the buyer add their own texts and images on top, with which fonts and where. */
export default function CustomLayersForm({
  value, fonts, errors, onChange, maxText = 20, maxImages = 20,
}: {
  value: CustomLayersConfig | undefined;
  fonts: AdminBannerFont[];
  errors: Record<string, string>;
  onChange: (v: CustomLayersConfig) => void;
  /** Ceilings set on the server (BANNERS_CUSTOM_MAX_TEXT / BANNERS_CUSTOM_MAX_IMAGES) */
  maxText?: number;
  maxImages?: number;
}) {
  const c = value ?? CUSTOM_OFF;
  const set = (patch: Partial<CustomLayersConfig>) => onChange({ ...c, ...patch });
  const num = (v: string) => (v === '' ? NaN : Number(v));
  const err = (k: string) => errors[k] && <span className="block text-[11px] text-red-400 mt-1">{errors[k]}</span>;

  return (
    <div className="glass-card p-5 border border-white/5 space-y-3">
      <label className="flex items-center gap-2 text-sm font-semibold text-white">
        <input type="checkbox" checked={c.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        Buyer can add own texts and images
      </label>
      {c.enabled && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[11px] text-gray-400 mb-1">Max texts (0–{maxText})</span>
              <input type="number" min={0} max={maxText} className={input} value={Number.isFinite(c.maxText) ? c.maxText : ''} onChange={(e) => set({ maxText: num(e.target.value) })} />
              {err('config.custom.maxText')}
            </label>
            <label className="block">
              <span className="block text-[11px] text-gray-400 mb-1">Max images (0–{maxImages})</span>
              <input type="number" min={0} max={maxImages} className={input} value={Number.isFinite(c.maxImage) ? c.maxImage : ''} onChange={(e) => set({ maxImage: num(e.target.value) })} />
              {err('config.custom.maxImage')}
            </label>
          </div>
          <div>
            <span className="block text-[11px] text-gray-400 mb-1">Fonts for added texts (the first checked is the starting font)</span>
            <FontChecklist
              fonts={fonts}
              checked={(id) => c.fonts.includes(id)}
              onToggle={(id, on) => set({ fonts: on ? [...c.fonts, id] : c.fonts.filter((x) => x !== id) })}
            />
            {err('config.custom.fonts')}
            {err('config.custom.fonts.0')}
          </div>
          <div>
            <span className="block text-[11px] text-gray-400 mb-1">Area where layers may be placed, % of the video</span>
            <div className="grid grid-cols-4 gap-2">
              {(['x', 'y', 'w', 'h'] as const).map((k) => (
                <label key={k} className="block">
                  <span className="block text-[11px] text-gray-500 mb-1">{k.toUpperCase()}</span>
                  <input type="number" step={0.1} className={input} value={Number.isFinite(c.bounds[k]) ? c.bounds[k] : ''} onChange={(e) => set({ bounds: { ...c.bounds, [k]: num(e.target.value) } })} />
                </label>
              ))}
            </div>
            {err('config.custom.bounds')}
          </div>
        </>
      )}
    </div>
  );
}
