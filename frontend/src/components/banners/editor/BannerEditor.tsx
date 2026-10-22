'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Move, RotateCcw } from 'lucide-react';
import BannerPreview from '@/components/banners/BannerPreview';
import ZoneHandles, { type HandleItem } from '@/components/banners/ZoneHandles';
import {
  LAYER_ID, customConfig, defaultParams, defaultZoneParams, expandLayers, layerImageZone, layerTextZone, newLayerRect,
  nextLayerId, resolveRect, resolveText, zoneMinSize,
} from '@/lib/banner-overlay';
import type { BuyerLayer, BuyerParams, ImageZoneParams, OverlayResult, Rect, TextZoneParams, Zone } from '@/lib/banner-overlay';
import PositionControls from './PositionControls';
import LayersPanel from './LayersPanel';
import type { PublicBannerTemplate } from '@/types/banners';
import { Section } from './ui';
import { clearDraft, loadDraft, saveDraft, type DraftImage } from './draft';
import TextZoneControls, { hasTextControls } from './TextZoneControls';
import ImageZoneControls from './ImageZoneControls';
import HueControls from './HueControls';

export interface EditorState {
  params: BuyerParams;
  images: Record<string, DraftImage>;
}

/**
 * Buyer editor: live preview plus the control panel. Everything updates locally; nothing is
 * sent to the server until checkout. `footer` receives the current state (checkout panel).
 */
export default function BannerEditor({
  template, footer,
}: {
  template: PublicBannerTemplate;
  footer?: (state: EditorState, reset: () => void) => React.ReactNode;
}) {
  const { config } = template;
  const [params, setParams] = useState<BuyerParams>(() => defaultParams(config));
  const [images, setImages] = useState<Record<string, DraftImage>>({});
  const [result, setResult] = useState<OverlayResult | null>(null);
  const [restored, setRestored] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  // Restore the draft after mount (localStorage is client-only)
  useEffect(() => {
    const draft = loadDraft(template.slug);
    if (draft) {
      const base = defaultParams(config);
      setParams({
        schemaVersion: 1,
        hue: typeof draft.params.hue === 'number' ? draft.params.hue : base.hue,
        zones: Object.fromEntries(
          config.zones.map((z) => [z.key, { ...base.zones[z.key], ...(draft.params.zones?.[z.key] || {}) }]),
        ),
        layers: Array.isArray(draft.params.layers) ? draft.params.layers : [],
      });
      const imgs: Record<string, DraftImage> = {};
      const imageKeys = [
        ...config.zones.filter((z) => z.type === 'image').map((z) => z.key),
        ...(draft.params.layers || []).filter((l) => l.type === 'image').map((l) => l.id),
      ];
      for (const key of imageKeys) {
        const img = draft.images[key];
        if (img?.dataUrl?.startsWith('data:image/')) imgs[key] = img;
      }
      setImages(imgs);
    }
    setRestored(true);
  }, [template.slug, config]);

  // Save the draft shortly after changes
  useEffect(() => {
    if (!restored) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveDraft(template.slug, { v: 1, params, images }), 400);
    return () => clearTimeout(saveTimer.current);
  }, [params, images, restored, template.slug]);

  const patchZone = useCallback((key: string, patch: TextZoneParams | ImageZoneParams) => {
    setParams((prev) => ({ ...prev, zones: { ...prev.zones, [key]: { ...prev.zones[key], ...patch } } }));
  }, []);

  const resetZone = useCallback((zone: Zone) => {
    setParams((prev) => ({ ...prev, zones: { ...prev.zones, [zone.key]: defaultZoneParams(zone) } }));
  }, []);

  // ─── The buyer's own layers ───
  const patchLayer = useCallback((id: string, patch: TextZoneParams | ImageZoneParams) => {
    setParams((prev) => ({
      ...prev,
      layers: (prev.layers || []).map((l) => (l.id === id ? ({ ...l, ...patch } as BuyerLayer) : l)),
    }));
  }, []);

  const addLayer = useCallback(
    (type: 'text' | 'image') => {
      setParams((prev) => {
        const id = nextLayerId(prev);
        const count = (prev.layers || []).filter((l) => l.type === type).length;
        const zone = type === 'text' ? layerTextZone(config, id, '') : layerImageZone(config, id, '');
        const layer = { id, type, ...defaultZoneParams(zone), rect: newLayerRect(config, type, count) } as BuyerLayer;
        return { ...prev, layers: [...(prev.layers || []), layer] };
      });
    },
    [config],
  );

  const removeLayer = useCallback((id: string) => {
    setParams((prev) => ({ ...prev, layers: (prev.layers || []).filter((l) => l.id !== id) }));
    setImages((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const moveLayer = useCallback((id: string, dir: -1 | 1) => {
    setParams((prev) => {
      const layers = [...(prev.layers || [])];
      const i = layers.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= layers.length) return prev;
      [layers[i], layers[j]] = [layers[j], layers[i]];
      return { ...prev, layers };
    });
  }, []);

  // Keeps the layer's place, resets everything else
  const resetLayer = useCallback(
    (zone: Zone) => {
      const layer = (params.layers || []).find((l) => l.id === zone.key);
      if (layer) patchLayer(zone.key, { ...defaultZoneParams(zone), rect: layer.rect });
    },
    [params.layers, patchLayer],
  );

  const resetAll = useCallback(() => {
    setParams(defaultParams(config));
    setImages({});
    clearDraft(template.slug);
  }, [config, template.slug]);

  const setImage = useCallback((key: string, image: DraftImage | null) => {
    setImages((prev) => {
      const next = { ...prev };
      if (image) next[key] = image;
      else delete next[key];
      return next;
    });
  }, []);

  // Moving zones: "layout mode" shows the draggable frames over the preview
  const [layoutMode, setLayoutMode] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const setRect = useCallback(
    (zone: Zone, rect: Rect) =>
      (LAYER_ID.test(zone.key) ? patchLayer : patchZone)(zone.key, { rect: resolveRect(zone, { rect }) }),
    [patchZone, patchLayer],
  );

  const activateZone = useCallback((key: string) => {
    setLayoutMode(true);
    setSelectedZone(key);
  }, []);

  // Zones that can be moved right now (shown, and for logos: uploaded), the buyer's layers included
  const expanded = expandLayers(config, params);
  const movable = expanded.config.zones.filter((z) => {
    if (!z.controls.position?.enabled) return false;
    if (z.type === 'image') return z.controls.upload.enabled && !!images[z.key];
    return resolveText(z, expanded.params.zones[z.key] as TextZoneParams | undefined).visible;
  });
  const anyMovable = config.zones.some((z) => z.controls.position?.enabled) || !!customConfig(config);

  const handleItems: HandleItem[] = movable.map((z) => ({
    id: z.key,
    rect: resolveRect(z, expanded.params.zones[z.key]),
    bounds: z.controls.position!.bounds,
    resizable: z.controls.position!.resize,
    min: zoneMinSize(z),
    color: z.type === 'image' ? '#38bdf8' : '#ff2d3d',
    label: z.label,
  }));

  const positionFor = (zone: Zone, rect?: Rect) => (
    <PositionControls
      zone={zone}
      rect={rect ?? (params.zones[zone.key] as TextZoneParams | ImageZoneParams | undefined)?.rect}
      active={layoutMode && selectedZone === zone.key}
      onRect={(rect) => setRect(zone, rect)}
      onActivate={() => activateZone(zone.key)}
    />
  );

  const previewImages = useMemo(
    () => Object.fromEntries(Object.entries(images).map(([k, v]) => [k, v.dataUrl])),
    [images],
  );

  const imageZones = config.zones.filter((z) => z.type === 'image' && z.controls.upload.enabled);
  const textZones = config.zones.filter((z): z is Extract<Zone, { type: 'text' }> => z.type === 'text' && hasTextControls(z));
  const formats = template.outputs.gif.enabled ? `MP4 ${template.width}×${template.height} + GIF ${template.outputs.gif.width}px` : `MP4 ${template.width}×${template.height}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-8 items-start">
      {/* Preview: on top and sticky under the site header on phones (so edits stay visible while
          scrolling the controls), sticky on the left on desktops */}
      <div className="sticky top-14 z-10 -mx-4 px-4 pt-2 pb-3 bg-[#060608]/95 backdrop-blur border-b border-white/[0.04] lg:mx-0 lg:px-0 lg:pt-0 lg:pb-0 lg:bg-transparent lg:backdrop-blur-none lg:border-0 lg:sticky lg:top-24 min-w-0">
        {/* Width limited so the whole banner stays on screen: ~40% of the viewport height on phones */}
        <div
          className="mx-auto w-[min(100%,calc(40vh*var(--ar)))] lg:w-[min(100%,calc((100vh_-_9rem)*var(--ar)))]"
          style={{ ['--ar' as string]: template.width / template.height }}
        >
          <div>
            <BannerPreview
              width={template.width}
              height={template.height}
              previewUrl={template.preview_url}
              posterUrl={template.poster_url}
              config={config}
              params={params}
              images={previewImages}
              fonts={template.fonts}
              onResult={setResult}
              className="rounded-lg shadow-[0_30px_80px_-30px_rgba(255,45,61,0.35)] ring-1 ring-white/[0.06]"
            >
              {layoutMode && handleItems.length > 0 && (
                <ZoneHandles
                  items={handleItems}
                  selected={selectedZone}
                  onSelect={setSelectedZone}
                  onRect={(key, rect) => {
                    const zone = expanded.config.zones.find((z) => z.key === key);
                    if (zone) setRect(zone, rect);
                  }}
                  large
                  snapTo={expanded.config.zones
                    .filter((z) => !handleItems.some((h) => h.id === z.key))
                    .map((z) => resolveRect(z, expanded.params.zones[z.key]))}
                />
              )}
            </BannerPreview>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2 lg:mt-3 text-[11px] lg:text-xs text-gray-500">
            <span>Preview with a watermark. The file you buy has none.</span>
            {anyMovable && (
              <button
                type="button"
                onClick={() => {
                  setLayoutMode((v) => !v);
                  setSelectedZone(null);
                }}
                aria-pressed={layoutMode}
                className={`flex items-center gap-1 ${layoutMode ? 'text-white' : 'hover:text-white'}`}
              >
                <Move size={12} /> {layoutMode ? 'Done moving' : 'Move blocks'}
              </button>
            )}
          </div>
          {layoutMode && (
            <p className="text-center text-[11px] text-gray-500 mt-1">
              {handleItems.length ? 'Drag a block to move it, pull the corners to resize.' : 'Nothing to move yet: upload the logo or show a hidden text.'}
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="min-w-0 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-display font-bold text-white">{template.name}</h1>
            <p className="text-xs font-mono text-gray-500 mt-1">
              {formats} · {template.duration} s
            </p>
          </div>
          <button type="button" onClick={resetAll} className="shrink-0 text-xs text-gray-400 hover:text-white flex items-center gap-1 mt-1.5">
            <RotateCcw size={13} /> Reset all
          </button>
        </div>
        {template.description && <p className="text-sm text-gray-400 -mt-2">{template.description}</p>}

        {imageZones.map((zone) =>
          zone.type === 'image' ? (
            <Section key={zone.key} title={zone.label}>
              <ImageZoneControls
                zone={zone}
                params={params.zones[zone.key] as ImageZoneParams | undefined}
                image={images[zone.key]}
                onChange={(patch) => patchZone(zone.key, patch)}
                onImage={(img) => setImage(zone.key, img)}
              />
              {images[zone.key] && positionFor(zone)}
            </Section>
          ) : null,
        )}

        {textZones.length > 0 && (
          <Section title="Texts">
            <div className="space-y-6">
              {textZones.map((zone) => (
                <div key={zone.key} className="space-y-3">
                  <TextZoneControls
                    zone={zone}
                    params={params.zones[zone.key] as TextZoneParams | undefined}
                    fit={result?.zones[zone.key]}
                    fonts={template.fonts}
                    videoWidth={template.width}
                    onChange={(patch) => patchZone(zone.key, patch)}
                    onReset={() => resetZone(zone)}
                  />
                  {resolveText(zone, params.zones[zone.key] as TextZoneParams | undefined).visible && positionFor(zone)}
                </div>
              ))}
            </div>
          </Section>
        )}

        {customConfig(config) && (
          <Section title="Your layers">
            <LayersPanel
              config={config}
              params={params}
              images={images}
              fonts={template.fonts}
              videoWidth={template.width}
              fits={result?.zones}
              onAdd={addLayer}
              onPatch={patchLayer}
              onRemove={removeLayer}
              onMove={moveLayer}
              onReset={resetLayer}
              onImage={setImage}
              position={positionFor}
            />
          </Section>
        )}

        {config.hue.enabled && (
          <Section title="Background color">
            <HueControls config={config} hue={params.hue} onChange={(hue) => setParams((p) => ({ ...p, hue }))} />
          </Section>
        )}

        {footer?.({ params, images }, resetAll)}
      </div>
    </div>
  );
}
