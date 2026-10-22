'use client';

import React from 'react';
import { ArrowDown, ArrowUp, Image as ImageIcon, Plus, Trash2, Type } from 'lucide-react';
import { customConfig, layerParams, layerZones } from '@/lib/banner-overlay';
import type {
  BannerFontFace, BuyerParams, ImageZoneParams, Rect, TemplateConfig, TextZoneParams, Zone, ZoneFit,
} from '@/lib/banner-overlay';
import TextZoneControls from './TextZoneControls';
import ImageZoneControls from './ImageZoneControls';
import type { DraftImage } from './draft';

/** Texts and images the buyer adds on top of the template, drawn in list order. */
export default function LayersPanel({
  config, params, images, fonts, videoWidth, fits, onAdd, onPatch, onRemove, onMove, onReset, onImage, position, still = false,
}: {
  config: TemplateConfig;
  params: BuyerParams;
  images: Record<string, DraftImage>;
  fonts: BannerFontFace[];
  videoWidth: number;
  fits: Record<string, ZoneFit> | undefined;
  onAdd: (type: 'text' | 'image') => void;
  onPatch: (id: string, patch: TextZoneParams | ImageZoneParams) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onReset: (zone: Zone) => void;
  onImage: (id: string, image: DraftImage | null) => void;
  /** Position controls for a zone (shared with the template zones) */
  position: (zone: Zone, rect: Rect | undefined) => React.ReactNode;
  /** Image template: animated GIFs are used as their first frame */
  still?: boolean;
}) {
  const custom = customConfig(config);
  if (!custom) return null;
  const layers = layerZones(config, params);
  const texts = layers.filter((l) => l.layer.type === 'text').length;
  const imgs = layers.length - texts;
  const addBtn =
    'h-9 px-3 rounded-lg border border-white/[0.08] bg-white/[0.02] text-sm text-gray-200 hover:text-white hover:border-accent-red/40 flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {custom.maxText > 0 && (
          <button type="button" className={addBtn} disabled={texts >= custom.maxText} onClick={() => onAdd('text')}>
            <Plus size={14} /> <Type size={14} /> Text
            <span className="text-[11px] text-gray-500 font-mono">{texts}/{custom.maxText}</span>
          </button>
        )}
        {custom.maxImage > 0 && (
          <button type="button" className={addBtn} disabled={imgs >= custom.maxImage} onClick={() => onAdd('image')}>
            <Plus size={14} /> <ImageIcon size={14} /> Image
            <span className="text-[11px] text-gray-500 font-mono">{imgs}/{custom.maxImage}</span>
          </button>
        )}
      </div>
      {layers.length === 0 && <p className="text-xs text-gray-500">Add your own text or picture on top of the banner. Later layers are drawn above earlier ones.</p>}

      {layers.map(({ layer, zone }, i) => {
        const p = layerParams(layer);
        return (
          <div key={layer.id} className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3 space-y-3">
            <div className="flex items-center gap-1">
              <span className="text-xs font-mono uppercase tracking-wider text-gray-400 mr-auto flex items-center gap-1.5">
                {layer.type === 'text' ? <Type size={12} /> : <ImageIcon size={12} />} {zone.label}
              </span>
              <button type="button" onClick={() => onMove(layer.id, -1)} disabled={i === 0} className="p-1.5 text-gray-500 hover:text-white disabled:opacity-30" aria-label={`Move ${zone.label} below`} title="Lower">
                <ArrowDown size={13} />
              </button>
              <button type="button" onClick={() => onMove(layer.id, 1)} disabled={i === layers.length - 1} className="p-1.5 text-gray-500 hover:text-white disabled:opacity-30" aria-label={`Move ${zone.label} above`} title="Higher">
                <ArrowUp size={13} />
              </button>
              <button type="button" onClick={() => onRemove(layer.id)} className="p-1.5 text-gray-500 hover:text-red-400" aria-label={`Delete ${zone.label}`} title="Delete">
                <Trash2 size={13} />
              </button>
            </div>
            {zone.type === 'text' ? (
              <TextZoneControls
                zone={zone}
                params={p as TextZoneParams}
                fit={fits?.[layer.id]}
                fonts={fonts}
                videoWidth={videoWidth}
                onChange={(patch) => onPatch(layer.id, patch)}
                onReset={() => onReset(zone)}
              />
            ) : (
              <ImageZoneControls
                zone={zone}
                params={p as ImageZoneParams}
                image={images[layer.id]}
                still={still}
                onChange={(patch) => onPatch(layer.id, patch)}
                onImage={(img) => onImage(layer.id, img)}
              />
            )}
            {(zone.type === 'text' || images[layer.id]) && position(zone, p.rect)}
          </div>
        );
      })}
    </div>
  );
}
