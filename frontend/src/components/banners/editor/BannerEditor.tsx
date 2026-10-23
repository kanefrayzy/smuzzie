'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Image as ImageIcon, Maximize2, Move, RotateCcw, Trash2, Type } from 'lucide-react';
import BannerPreview from '@/components/banners/BannerPreview';
import ZoomFrame from '@/components/banners/ZoomFrame';
import ZoneHandles, { type HandleItem } from '@/components/banners/ZoneHandles';
import {
  LAYER_ID, customConfig, defaultParams, defaultZoneParams, expandLayers, layerImageZone, layerTextZone, newLayerRect,
  nextLayerId, resolveImage, resolveRect, resolveText, zoneMinSize,
} from '@/lib/banner-overlay';
import { zoneImageUrl } from '@/lib/banner-formats';
import type { BuyerLayer, BuyerParams, ImageZoneParams, OverlayResult, Rect, TextZoneParams, Zone } from '@/lib/banner-overlay';
import PositionControls from './PositionControls';
import LayersPanel from './LayersPanel';
import type { PublicBannerTemplate } from '@/types/banners';
import { FORMAT_LABEL, isImageTemplate, templateFormats } from '@/lib/banner-formats';
import { LayerCard, Section } from './ui';
import { clearDraft, configFingerprint, loadDraft, saveDraft, type DraftImage } from './draft';
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
  const cfg = useMemo(() => configFingerprint(config), [config]);
  const [params, setParams] = useState<BuyerParams>(() => defaultParams(config));
  const [images, setImages] = useState<Record<string, DraftImage>>({});
  const [result, setResult] = useState<OverlayResult | null>(null);
  const [restored, setRestored] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  // Restore the draft after mount (localStorage is client-only)
  useEffect(() => {
    const draft = loadDraft(template.slug, cfg);
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
  }, [template.slug, config, cfg]);

  // Save the draft shortly after changes
  useEffect(() => {
    if (!restored) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveDraft(template.slug, { v: 1, params, images, cfg }), 400);
    return () => clearTimeout(saveTimer.current);
  }, [params, images, restored, template.slug, cfg]);

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

  // Accordion: only one text / image / layer shows its controls at a time
  const [openKey, setOpenKey] = useState<string | null>(null);
  const toggle = useCallback((key: string) => setOpenKey((k) => (k === key ? null : key)), []);

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

  // Full screen preview with zoom, for precise placement (opens with the blocks movable)
  const [fullscreen, setFullscreen] = useState(false);
  const closeFullscreen = useCallback(() => setFullscreen(false), []);

  // Picking a block on the preview opens its controls
  const selectOnPreview = useCallback((key: string | null) => {
    setSelectedZone(key);
    if (key) setOpenKey(key);
  }, []);

  // Zones that can be moved right now (shown, and for logos: uploaded), the buyer's layers included
  const expanded = expandLayers(config, params);
  const movable = expanded.config.zones.filter((z) => {
    if (!z.controls.position?.enabled) return false;
    if (z.type === 'image') {
      const shown = (z.controls.upload.enabled && !!images[z.key]) || !!z.style.image;
      return shown && resolveImage(z, expanded.params.zones[z.key] as ImageZoneParams | undefined).visible;
    }
    return resolveText(z, expanded.params.zones[z.key] as TextZoneParams | undefined).visible;
  });
  const anyMovable = config.zones.some((z) => z.controls.position?.enabled) || !!customConfig(config);

  const openFullscreen = () => {
    if (anyMovable) setLayoutMode(true);
    setFullscreen(true);
  };

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

  // The buyer's uploads, else the template's own images
  const previewImages = useMemo(() => {
    const out: Record<string, string> = {};
    for (const z of config.zones) {
      if (z.type === 'image' && z.style.image) out[z.key] = zoneImageUrl(z.style.image);
    }
    for (const [k, v] of Object.entries(images)) out[k] = v.dataUrl;
    return out;
  }, [images, config]);

  // Image zones with something to do: upload, or remove / move the template's image
  const imageZones = config.zones.filter(
    (z) => z.type === 'image' && (z.controls.upload.enabled || (!!z.style.image && (!!z.controls.visible?.enabled || !!z.controls.position?.enabled))),
  );

  // Remove / restore right on a card's header (texts and images the template lets the buyer remove)
  const removeAction = (zone: Zone, visible: boolean) => (
    <button
      type="button"
      onClick={() => patchZone(zone.key, { visible: !visible })}
      className={`p-1.5 rounded-md ${visible ? 'text-gray-500 hover:text-accent-red' : 'text-gray-300 hover:text-white'}`}
      aria-label={visible ? `Remove ${zone.label}` : `Restore ${zone.label}`}
      title={visible ? 'Remove from the banner' : 'Restore'}
    >
      {visible ? <Trash2 size={14} /> : <RotateCcw size={14} />}
    </button>
  );
  const textZones = config.zones.filter((z): z is Extract<Zone, { type: 'text' }> => z.type === 'text' && hasTextControls(z));
  const still = isImageTemplate(template);
  const [firstFormat, ...otherFormats] = templateFormats(template);
  const gif = !still && 'gif' in template.outputs && template.outputs.gif.enabled ? ` ${template.outputs.gif.width}px` : '';
  const formats = [`${FORMAT_LABEL[firstFormat]} ${template.width}×${template.height}`, ...otherFormats.map((f) => FORMAT_LABEL[f] + (f === 'gif' ? gif : ''))].join(' + ');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-8 items-start">
      {/* Preview: on top and sticky under the site header on phones (so edits stay visible while
          scrolling the controls), sticky on the left on desktops */}
      <div
        className={
          fullscreen
            ? // The full screen view is fixed: no blur (it would become its container) and above the header
              'sticky top-14 z-[200] min-w-0 lg:top-24'
            : 'sticky top-14 z-10 -mx-4 px-4 pt-2 pb-3 bg-[#060608]/95 backdrop-blur border-b border-white/[0.04] lg:mx-0 lg:px-0 lg:pt-0 lg:pb-0 lg:bg-transparent lg:backdrop-blur-none lg:border-0 lg:sticky lg:top-24 min-w-0'
        }
      >
        {/* Width limited so the whole banner stays on screen: ~40% of the viewport height on phones */}
        <div className="mx-auto" style={{ ['--ar' as string]: template.width / template.height }}>
          <ZoomFrame
            expanded={fullscreen}
            onClose={closeFullscreen}
            aspect={template.width / template.height}
            className="w-[min(100%,calc(40vh*var(--ar)))] lg:w-[min(100%,calc((100vh_-_9rem)*var(--ar)))]"
            title={template.name}
            tools={
              anyMovable && (
                <button
                  type="button"
                  onClick={() => {
                    setLayoutMode((v) => !v);
                    setSelectedZone(null);
                  }}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white ${
                    layoutMode ? 'bg-accent-red hover:bg-accent-red/90' : 'bg-white/10 hover:bg-white/15'
                  }`}
                >
                  {layoutMode ? <Check size={14} /> : <Move size={14} />} {layoutMode ? 'Done moving' : 'Move blocks'}
                </button>
              )
            }
          >
            <BannerPreview
              width={template.width}
              height={template.height}
              previewUrl={template.preview_url}
              posterUrl={template.poster_url}
              kind={still ? 'image' : 'video'}
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
                  onSelect={selectOnPreview}
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
          </ZoomFrame>
          {layoutMode ? (
            /* While moving blocks: a clear way out right under the preview (sticky on phones too) */
            <div className="flex items-center justify-center gap-3 mt-2 lg:mt-3">
              <span className="flex items-center gap-1.5 text-[11px] lg:text-xs text-gray-300">
                <Move size={13} className="text-accent-red shrink-0" />
                {handleItems.length ? 'Drag blocks, pull corners to resize' : 'Nothing to move yet: upload an image or show a hidden text'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setLayoutMode(false);
                  setSelectedZone(null);
                }}
                className="shrink-0 flex items-center gap-1 rounded-full bg-accent-red hover:bg-accent-red/90 px-4 py-1.5 text-xs font-semibold text-white shadow-[0_0_20px_rgba(230,57,70,0.35)]"
              >
                <Check size={14} /> Done
              </button>
              <button
                type="button"
                onClick={openFullscreen}
                className="shrink-0 hidden sm:flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-semibold text-white"
              >
                <Maximize2 size={13} /> Full screen
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2 lg:mt-3 text-[11px] lg:text-xs text-gray-500">
              <span>Preview with a watermark. The file you buy has none.</span>
              {anyMovable && (
                <button
                  type="button"
                  onClick={() => {
                    setLayoutMode(true);
                    setSelectedZone(null);
                  }}
                  className="flex items-center gap-1 hover:text-white"
                >
                  <Move size={12} /> Move blocks
                </button>
              )}
              <button type="button" onClick={openFullscreen} className="flex items-center gap-1 hover:text-white">
                <Maximize2 size={12} /> Full screen
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="min-w-0 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-display font-bold text-white">{template.name}</h1>
            <p className="text-xs font-mono text-gray-500 mt-1">
              {formats}
              {!still && template.duration ? ` · ${template.duration} s` : ''}
            </p>
          </div>
          <button type="button" onClick={resetAll} className="shrink-0 text-xs text-gray-400 hover:text-white flex items-center gap-1 mt-1.5">
            <RotateCcw size={13} /> Reset all
          </button>
        </div>
        {template.description && <p className="text-sm text-gray-400 -mt-2">{template.description}</p>}

        {customConfig(config) && (
          <Section title="Add text & images">
            <LayersPanel
              config={config}
              params={params}
              images={images}
              fonts={template.fonts}
              videoWidth={template.width}
              fits={result?.zones}
              onAdd={(type) => {
                // Open the new layer right away
                const id = nextLayerId(params);
                addLayer(type);
                setOpenKey(id);
              }}
              onPatch={patchLayer}
              onRemove={removeLayer}
              onMove={moveLayer}
              onReset={resetLayer}
              onImage={setImage}
              position={positionFor}
              still={still}
              openKey={openKey}
              onToggle={toggle}
            />
          </Section>
        )}

        {imageZones.length > 0 && (
          <Section title={imageZones.length > 1 ? 'Logo & images' : imageZones[0].label}>
            <div className="space-y-2">
              {imageZones.map((zone) => {
                if (zone.type !== 'image') return null;
                const p = params.zones[zone.key] as ImageZoneParams | undefined;
                const visible = resolveImage(zone, p).visible;
                const defaultUrl = zone.style.image ? zoneImageUrl(zone.style.image) : undefined;
                return (
                  <LayerCard
                    key={zone.key}
                    icon={<ImageIcon size={15} />}
                    title={zone.label}
                    subtitle={!visible ? 'Removed' : images[zone.key] ? images[zone.key].name : defaultUrl ? 'Template image' : 'No image yet'}
                    dim={!visible}
                    open={openKey === zone.key}
                    onToggle={() => toggle(zone.key)}
                    actions={zone.controls.visible?.enabled && defaultUrl ? removeAction(zone, visible) : undefined}
                  >
                    <ImageZoneControls
                      zone={zone}
                      params={p}
                      image={images[zone.key]}
                      defaultUrl={defaultUrl}
                      still={still}
                      onChange={(patch) => patchZone(zone.key, patch)}
                      onImage={(img) => setImage(zone.key, img)}
                    />
                    {visible && (images[zone.key] || defaultUrl) && positionFor(zone)}
                  </LayerCard>
                );
              })}
            </div>
          </Section>
        )}

        {textZones.length > 0 && (
          <Section title="Texts">
            <div className="space-y-2">
              {textZones.map((zone) => {
                const r = resolveText(zone, params.zones[zone.key] as TextZoneParams | undefined);
                return (
                  <LayerCard
                    key={zone.key}
                    icon={<Type size={15} />}
                    title={zone.label}
                    subtitle={r.visible ? r.text.replace(/\s*\n\s*/g, ' ') || 'Empty' : 'Removed'}
                    dim={!r.visible}
                    open={openKey === zone.key}
                    onToggle={() => toggle(zone.key)}
                    actions={zone.controls.visible.enabled ? removeAction(zone, r.visible) : undefined}
                  >
                    <TextZoneControls
                      zone={zone}
                      params={params.zones[zone.key] as TextZoneParams | undefined}
                      fit={result?.zones[zone.key]}
                      fonts={template.fonts}
                      videoWidth={template.width}
                      hideLabel
                      onChange={(patch) => patchZone(zone.key, patch)}
                      onReset={() => resetZone(zone)}
                    />
                    {r.visible && positionFor(zone)}
                  </LayerCard>
                );
              })}
            </div>
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
