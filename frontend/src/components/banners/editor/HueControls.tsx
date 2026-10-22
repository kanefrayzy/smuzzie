'use client';

import React from 'react';
import { shiftColor } from '@/lib/banner-overlay';
import type { TemplateConfig } from '@/lib/banner-overlay';
import { Slider, Swatch } from './ui';

/** Background hue: swatches show the real resulting accent color, plus a 0-359° slider. */
export default function HueControls({ config, hue, onChange }: { config: TemplateConfig; hue: number; onChange: (hue: number) => void }) {
  const track = [0, 60, 120, 180, 240, 300, 360].map((d) => shiftColor(config.accent, d % 360)).join(', ');

  return (
    <div className="space-y-3">
      {config.hue.presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ready colors">
          {config.hue.presets.map((deg) => (
            <Swatch key={deg} color={shiftColor(config.accent, deg)} selected={hue === deg} onClick={() => onChange(deg)} label={`Hue ${deg}°`} />
          ))}
        </div>
      )}
      <div>
        <Slider id="hue" label="Hue, degrees" value={hue} min={0} max={359} step={1} onChange={onChange} display={`${hue}°`} />
        <div className="h-1.5 rounded-full mr-[68px] -mt-1" style={{ background: `linear-gradient(90deg, ${track})` }} aria-hidden="true" />
      </div>
    </div>
  );
}
