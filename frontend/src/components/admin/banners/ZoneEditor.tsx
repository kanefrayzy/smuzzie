'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Save, Type, Image as ImageIcon, ArrowUp, ArrowDown, Eye, EyeOff, Copy, Star, Maximize2, Undo2, Redo2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { defaultParams } from '@/lib/banner-overlay';
import type { TemplateConfig, Zone } from '@/lib/banner-overlay';
import type { AdminBannerFont, AdminBannerTemplate } from '@/types/banners';
import BannerPreview from '@/components/banners/BannerPreview';
import ZoomFrame from '@/components/banners/ZoomFrame';
import { zoneImageUrl } from '@/lib/banner-formats';
import ZoneCanvas from './ZoneCanvas';
import ZoneForm, { type ZoneErrors } from './ZoneForm';
import { MAX_IMAGE_ZONES, MAX_ZONES, SAMPLE_ICON, SAMPLE_LOGO, newIconZone, newImageZone, newTextZone } from './zoneDefaults';
import CustomLayersForm from './CustomLayersForm';
import type { CustomLayersConfig, Rect } from '@/lib/banner-overlay';
import { useUndo, useUndoKeys } from '@/components/banners/useUndo';
import { alignItems, distributeItems, measureBoxes, unionBox, type AlignMode, type ArrangeItem } from '@/components/banners/arrange';
import ArrangePanel, { type AlignTarget } from './ArrangePanel';

const FRAME: Rect = { x: 0, y: 0, w: 100, h: 100 };
const MAX_FONT_OPTIONS = 500;

/** What undo steps through: the zones and the buyer's custom layer settings. */
type Snapshot = { zones: Zone[]; custom: CustomLayersConfig | undefined };

/**
 * Visual zone editor: rectangles over the template preview with the live overlay
 * (default texts, a sample logo), plus a form with exact values for the selected zone.
 * Saving sends the whole config; the server validates and returns it normalized.
 */
export default function ZoneEditor({
  template, fonts, onSaved,
}: {
  template: AdminBannerTemplate;
  fonts: AdminBannerFont[];
  onSaved: (t: AdminBannerTemplate) => void;
}) {
  const [config, setConfig] = useState<TemplateConfig>(template.config);
  const configRef = useRef(config);
  configRef.current = config;
  // Selected zones; the last one picked is the "primary" with resize handles and the form
  const [selection, setSelection] = useState<number[]>(template.config.zones.length ? [0] : []);
  const selected = selection.length ? selection[selection.length - 1] : null;
  const setSelected = useCallback((i: number | null) => setSelection(i === null ? [] : [i]), []);
  const history = useUndo<Snapshot>();
  const snapshot = (): Snapshot => ({ zones: configRef.current.zones, custom: configRef.current.custom });
  const [zoneErrors, setZoneErrors] = useState<Record<number, ZoneErrors>>({});
  const [generalErrors, setGeneralErrors] = useState<string[]>([]);
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const setCustom = (custom: CustomLayersConfig) => {
    history.record(snapshot());
    setConfig((c) => ({ ...c, custom }));
    setDirty(true);
  };
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTexts, setShowTexts] = useState(true);
  const { record } = history;

  // Accent and hue are edited in the settings form on the same page: always take them from the
  // latest saved template and keep only the zones from this editor
  useEffect(() => {
    setConfig((c) => (dirty ? { ...template.config, zones: c.zones, custom: c.custom } : template.config));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.config]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Every edit of the zones goes through here, so it can be undone. Edits that follow each other
  // closely (a drag, typing a value) are one step; `step` makes a separate one (add, align...).
  const update = useCallback(
    (zones: Zone[], step = false) => {
      record({ zones: configRef.current.zones, custom: configRef.current.custom }, step);
      setConfig((c) => ({ ...c, zones }));
      setDirty(true);
    },
    [record],
  );

  const restore = (snap: Snapshot | undefined) => {
    if (!snap) return;
    setConfig((c) => ({ ...c, zones: snap.zones, custom: snap.custom }));
    setSelection((sel) => sel.filter((i) => i < snap.zones.length));
    setDirty(true);
  };
  const undo = () => restore(history.undo(snapshot()));
  const redo = () => restore(history.redo(snapshot()));
  useUndoKeys(undo, redo);

  const toggleSelected = useCallback(
    (i: number) => setSelection((sel) => (sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i])),
    [],
  );
  const selectMany = useCallback(
    (ids: number[], additive: boolean) => setSelection((sel) => (additive ? [...sel.filter((i) => !ids.includes(i)), ...ids] : ids)),
    [],
  );

  // Ctrl/Cmd+A selects every zone, Esc clears the selection
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelection(configRef.current.zones.map((_, i) => i));
      } else if (e.key === 'Escape') {
        setSelection([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setZone = useCallback(
    (index: number, zone: Zone) => update(config.zones.map((z, i) => (i === index ? zone : z))),
    [config.zones, update],
  );

  const setRect = useCallback(
    (index: number, rect: Pick<Zone, 'x' | 'y' | 'w' | 'h'>) =>
      update(config.zones.map((z, i) => (i === index ? ({ ...z, ...rect } as Zone) : z))),
    [config.zones, update],
  );

  const setRects = useCallback(
    (rects: Record<number, Rect>, step = false) =>
      update(config.zones.map((z, i) => (rects[i] ? ({ ...z, ...rects[i] } as Zone) : z)), step),
    [config.zones, update],
  );

  // ─── Align / distribute ───
  const previewRef = useRef<HTMLDivElement>(null);
  const [alignTarget, setAlignTarget] = useState<AlignTarget>('selection');

  // The selected zones with what they draw: the text itself, or the template's own picture.
  // A logo zone without its own image is measured by its box (the buyer's logo can be any shape).
  const arrangeItems = (indexes: number[]): ArrangeItem[] => {
    const zones = configRef.current.zones;
    const measurable = indexes.map((i) => zones[i]).filter((z) => z && (z.type === 'text' || !!z.style.image));
    const boxes = showTexts ? measureBoxes(previewRef.current, measurable.map((z) => z.key)) : {};
    return indexes
      .filter((i) => zones[i])
      .map((i) => {
        const z = zones[i];
        const rect = { x: z.x, y: z.y, w: z.w, h: z.h };
        return { id: String(i), rect, box: boxes[z.key] ?? rect, bounds: FRAME };
      });
  };
  const byIndex = (rects: Record<string, Rect>) => Object.fromEntries(Object.entries(rects).map(([k, v]) => [Number(k), v]));

  const align = (mode: AlignMode) => {
    const items = arrangeItems(selection);
    if (!items.length) return;
    const target = items.length === 1 || alignTarget === 'frame' ? FRAME : unionBox(items);
    setRects(byIndex(alignItems(items, mode, target)), true);
  };

  const distribute = (axis: 'x' | 'y', gapPx?: number) => {
    const items = arrangeItems(selection);
    const size = axis === 'x' ? template.width || 1 : template.height || 1;
    setRects(byIndex(distributeItems(items, axis, gapPx === undefined ? undefined : (gapPx / size) * 100)), true);
  };

  // Gaps between the selected zones as they are now, in px (shown in the panel)
  const [gaps, setGaps] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  useEffect(() => {
    if (selection.length < 2) {
      setGaps({ x: [], y: [] });
      return;
    }
    // After the overlay has drawn the new positions
    const raf = requestAnimationFrame(() => {
      const items = arrangeItems(selection);
      const along = (axis: 'x' | 'y') => {
        const pos = (r: Rect) => (axis === 'x' ? r.x : r.y);
        const len = (r: Rect) => (axis === 'x' ? r.w : r.h);
        const px = (axis === 'x' ? template.width : template.height) || 0;
        const sorted = [...items].sort((a, b) => pos(a.box) - pos(b.box));
        const list = sorted.slice(1).map((it, i) => ((pos(it.box) - pos(sorted[i].box) - len(sorted[i].box)) / 100) * px);
        // Only meaningful when the zones sit next to each other along this axis
        return list.every((g) => g > -0.5) ? list : [];
      };
      setGaps({ x: along('x'), y: along('y') });
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, config.zones, showTexts]);

  // ─── Fonts: every text may use the whole library ───
  const fontIds = fonts.map((f) => f.id);
  const textZones = config.zones.filter((z) => z.type === 'text');
  const allFontsOn = (z: Zone) =>
    z.type === 'text' && !!z.controls.font?.enabled &&
    fontIds.filter((id) => id !== z.style.fontId).slice(0, MAX_FONT_OPTIONS).every((id) => z.controls.font!.options.includes(id));
  const nAllFonts = textZones.filter(allFontsOn).length;
  const setAllFonts = (on: boolean) =>
    update(
      config.zones.map((z) => {
        if (z.type !== 'text') return z;
        const options = on ? fontIds.filter((id) => id !== z.style.fontId).slice(0, MAX_FONT_OPTIONS) : [];
        return { ...z, controls: { ...z.controls, font: { enabled: on, options } } } as Zone;
      }),
      true,
    );

  const imageZoneCount = config.zones.filter((z) => z.type === 'image').length;
  // Server limits (env), with the defaults as a fallback
  const maxImageZones = template.limits?.max_image_zones ?? MAX_IMAGE_ZONES;
  const maxZones = template.limits?.max_zones ?? MAX_ZONES;

  const add = (type: 'text' | 'image' | 'icon') => {
    const fontId = fonts[0]?.id ?? 0;
    if (type === 'text' && !fontId) {
      toast.error('Upload a font first (Banner fonts)');
      return;
    }
    if (config.zones.length >= maxZones) {
      toast.error(`At most ${maxZones} zones`);
      return;
    }
    if (type !== 'text' && imageZoneCount >= maxImageZones) {
      toast.error(`At most ${maxImageZones} logo and icon zones`);
      return;
    }
    const zone =
      type === 'text'
        ? newTextZone(config, fontId)
        : type === 'icon'
          ? newIconZone(config, template.width || 1, template.height || 1)
          : newImageZone(config);
    update([...config.zones, zone], true);
    setSelected(config.zones.length);
  };

  const duplicate = () => {
    if (selected === null) return;
    const src = config.zones[selected];
    const taken = new Set(config.zones.map((z) => z.key));
    let key = `${src.key}_2`;
    for (let i = 3; taken.has(key); i++) key = `${src.key}_${i}`;
    const copy = { ...structuredClone(src), key, x: Math.min(src.x + 2, 100 - src.w), y: Math.min(src.y + 2, 100 - src.h) } as Zone;
    update([...config.zones, copy], true);
    setSelected(config.zones.length);
  };

  const remove = () => {
    if (!selection.length) return;
    const keys = selection.map((i) => config.zones[i]?.key).filter(Boolean);
    if (!confirm(keys.length > 1 ? `Delete ${keys.length} zones (${keys.join(', ')})?` : `Delete zone "${keys[0]}"?`)) return;
    update(config.zones.filter((_, i) => !selection.includes(i)), true);
    setSelected(null);
  };

  const move = (dir: -1 | 1) => {
    if (selected === null) return;
    const to = selected + dir;
    if (to < 0 || to >= config.zones.length) return;
    const zones = [...config.zones];
    [zones[selected], zones[to]] = [zones[to], zones[selected]];
    update(zones, true);
    setSelected(to);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await adminApi.updateBannerTemplate(template.id, { config: { ...template.config, zones: config.zones, custom: config.custom } });
      setConfig(res.data.config);
      setZoneErrors({});
      setGeneralErrors([]);
      setCustomErrors({});
      setDirty(false);
      onSaved(res.data);
      toast.success('Zones saved');
    } catch (err: any) {
      const errors = err?.response?.data?.errors as Record<string, string[]> | undefined;
      if (errors) {
        const byZone: Record<number, ZoneErrors> = {};
        const custom: Record<string, string> = {};
        const general: string[] = [];
        for (const [path, messages] of Object.entries(errors)) {
          const m = /^config\.zones\.(\d+)\.(.+)$/.exec(path);
          if (m) (byZone[Number(m[1])] ||= {})[m[2]] = messages[0];
          else if (path.startsWith('config.custom')) custom[path] = messages[0];
          else general.push(messages[0]);
        }
        setZoneErrors(byZone);
        setGeneralErrors(general);
        setCustomErrors(custom);
        const first = Object.keys(byZone)[0];
        if (first !== undefined) setSelected(Number(first));
        toast.error('Some values need fixing');
      } else {
        toast.error(getApiError(err, 'Save failed'));
      }
    } finally {
      setSaving(false);
    }
  };

  const params = useMemo(() => defaultParams(config), [config]);
  const sampleImages = useMemo(
    () =>
      Object.fromEntries(
        config.zones
          .filter((z) => z.type === 'image')
          .map((z) => [z.key, z.type === 'image' && z.style.image ? zoneImageUrl(z.style.image) : z.key.startsWith('icon') ? SAMPLE_ICON : SAMPLE_LOGO]),
      ),
    [config.zones],
  );
  // Full screen canvas with zoom, for placing zones precisely
  const [fullscreen, setFullscreen] = useState(false);
  const closeFullscreen = useCallback(() => setFullscreen(false), []);

  const errorSet = useMemo(() => new Set(Object.keys(zoneErrors).map(Number)), [zoneErrors]);
  const zone = selected !== null ? config.zones[selected] : null;

  if (!template.has_media || !template.width || !template.height) {
    return <p className="text-sm text-gray-500">Upload and process the video or image first; zones are placed on top of it.</p>;
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_440px] gap-6 items-start">
      <div ref={previewRef} className={`min-w-0 xl:sticky xl:top-6 ${fullscreen ? 'relative z-[200]' : ''}`}>
        <ZoomFrame
          expanded={fullscreen}
          onClose={closeFullscreen}
          aspect={template.width / template.height}
          style={{ width: `min(100%, calc((100vh - 8rem) * ${template.width / template.height}))` }}
          title={zone ? `${template.name} · ${zone.label}` : template.name}
          tools={
            <button
              type="button"
              onClick={() => setShowTexts((v) => !v)}
              className="flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-semibold text-white"
            >
              {showTexts ? <EyeOff size={13} /> : <Eye size={13} />} {showTexts ? 'Hide' : 'Show'} texts
            </button>
          }
        >
          <BannerPreview
            width={template.width}
            height={template.height}
            previewUrl={template.preview_url}
            posterUrl={template.poster_url}
            kind={template.kind}
            config={config}
            params={params}
            images={sampleImages}
            fonts={fonts}
            showOverlay={showTexts}
            className="rounded-lg ring-1 ring-white/10"
          >
            <ZoneCanvas
              zones={config.zones}
              selected={selected}
              selection={selection}
              onSelect={setSelected}
              onToggle={toggleSelected}
              onSelectMany={selectMany}
              onRect={setRect}
              onRects={setRects}
              onDragEnd={history.breakStep}
              errors={errorSet}
            />
          </BannerPreview>
        </ZoomFrame>
        <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-xs text-gray-500">
          <button type="button" onClick={() => setShowTexts((v) => !v)} className="flex items-center gap-1 hover:text-white">
            {showTexts ? <EyeOff size={13} /> : <Eye size={13} />} {showTexts ? 'Hide' : 'Show'} default texts
          </button>
          <button type="button" onClick={() => setFullscreen(true)} className="flex items-center gap-1 text-white hover:text-accent-red">
            <Maximize2 size={13} /> Full screen
          </button>
          <span>Drag to move · handles resize · arrows nudge 0.1% (Shift: 1%) · Shift+click or drag a frame to select several · Ctrl+Z undo</span>
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button type="button" onClick={() => add('text')} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white flex items-center gap-1.5">
            <Plus size={14} /> <Type size={14} /> Text
          </button>
          <button
            type="button"
            onClick={() => add('image')}
            disabled={imageZoneCount >= maxImageZones}
            className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white flex items-center gap-1.5 disabled:opacity-40"
          >
            <Plus size={14} /> <ImageIcon size={14} /> Logo
          </button>
          <button
            type="button"
            onClick={() => add('icon')}
            disabled={imageZoneCount >= maxImageZones}
            title="A small square image zone, e.g. above a feature card. Buyers can upload animated GIFs too."
            className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white flex items-center gap-1.5 disabled:opacity-40"
          >
            <Plus size={14} /> <Star size={14} /> Icon
            <span className="text-[11px] text-gray-500 font-mono">{imageZoneCount}/{maxImageZones}</span>
          </button>
          <div className="flex-1" />
          <button type="button" onClick={undo} disabled={!history.canUndo} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30" title="Undo (Ctrl+Z)" aria-label="Undo">
            <Undo2 size={15} />
          </button>
          <button type="button" onClick={redo} disabled={!history.canRedo} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30" title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
            <Redo2 size={15} />
          </button>
          {dirty && <span className="text-xs text-amber-300">Unsaved</span>}
          <button type="button" onClick={save} disabled={saving || !dirty} className="btn-primary text-sm disabled:opacity-50">
            <Save size={14} /> {saving ? 'Saving…' : 'Save zones'}
          </button>
        </div>

        {generalErrors.length > 0 && (
          <div className="text-sm text-red-300 bg-red-400/10 border border-red-400/20 rounded-lg p-3 mb-4">{generalErrors.join(' ')}</div>
        )}

        {config.zones.length > 0 && (
          <div className="glass-card p-5 border border-white/5 mb-4 space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-white">
              <input
                type="checkbox"
                checked={config.zones.every((z) => z.controls.position?.enabled)}
                ref={(el) => {
                  if (el) {
                    const on = config.zones.filter((z) => z.controls.position?.enabled).length;
                    el.indeterminate = on > 0 && on < config.zones.length;
                  }
                }}
                onChange={(e) =>
                  update(
                    config.zones.map((z) => {
                      const pos = z.controls.position ?? { enabled: false, resize: true, bounds: { x: 0, y: 0, w: 100, h: 100 } };
                      return { ...z, controls: { ...z.controls, position: { ...pos, enabled: e.target.checked, resize: true } } } as Zone;
                    }),
                    true,
                  )
                }
              />
              Buyer can move and resize all zones
            </label>
            {textZones.length > 0 && fonts.length > 1 && (
              <label className="flex items-center gap-2 text-sm font-semibold text-white pt-1">
                <input
                  type="checkbox"
                  checked={nAllFonts === textZones.length}
                  ref={(el) => {
                    if (el) el.indeterminate = nAllFonts > 0 && nAllFonts < textZones.length;
                  }}
                  onChange={(e) => setAllFonts(e.target.checked)}
                />
                Buyer can pick any font for every text ({fonts.length} fonts)
              </label>
            )}
            <p className="text-[11px] text-gray-500">
              Per zone (and the area it may move in, or a smaller font list): select a zone, then &quot;Position&quot; or
              &quot;Font&quot; under &quot;Buyer can change&quot;. Fonts uploaded later are not added by themselves: tick the box again.
            </p>
          </div>
        )}

        <div className="mb-4">
          <CustomLayersForm
            value={config.custom}
            fonts={fonts}
            errors={customErrors}
            onChange={setCustom}
            maxText={template.limits?.custom_max_text ?? 20}
            maxImages={template.limits?.custom_max_images ?? 20}
          />
        </div>

        {/* Zone list (later = drawn on top) */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {config.zones.map((z, i) => (
            <button
              key={`${z.key}-${i}`}
              type="button"
              onClick={(e) => (e.shiftKey || e.ctrlKey || e.metaKey ? toggleSelected(i) : setSelected(i))}
              className={`px-2.5 py-1.5 rounded-md text-xs font-mono flex items-center gap-1.5 border transition-colors ${
                selection.includes(i) ? 'border-accent-red/60 bg-accent-red/10 text-white' : 'border-white/5 bg-white/[0.03] text-gray-400 hover:text-white'
              } ${errorSet.has(i) ? '!border-red-400/70' : ''}`}
            >
              {z.type === 'image' ? <ImageIcon size={12} /> : <Type size={12} />}
              {z.key}
            </button>
          ))}
          {config.zones.length === 0 && <p className="text-sm text-gray-500">No zones yet. Add a text or logo zone.</p>}
        </div>

        {selection.length > 0 && (
          <div className="mb-4">
            <ArrangePanel
              count={selection.length}
              target={alignTarget}
              onTarget={setAlignTarget}
              onAlign={align}
              onDistribute={distribute}
              gaps={gaps}
            />
          </div>
        )}

        {selection.length > 1 && (
          <div className="glass-card p-4 border border-white/5 flex items-center justify-between gap-3">
            <span className="text-xs text-gray-400 font-mono truncate">{selection.map((i) => config.zones[i]?.key).join(', ')}</span>
            <button type="button" onClick={remove} className="shrink-0 flex items-center gap-1 text-xs text-gray-400 hover:text-red-400">
              <Trash2 size={13} /> Delete {selection.length}
            </button>
          </div>
        )}

        {zone && selected !== null && selection.length === 1 && (
          <div className="glass-card p-5 border border-white/5">
            <div className="flex items-center gap-1 mb-4">
              <h4 className="text-sm font-semibold text-white mr-auto">
                {zone.type === 'image' ? 'Image zone' : 'Text zone'} <span className="font-mono text-gray-500">{zone.key}</span>
              </h4>
              <button type="button" onClick={() => move(-1)} disabled={selected === 0} className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30" title="Lower layer" aria-label="Move down a layer">
                <ArrowDown size={14} />
              </button>
              <button type="button" onClick={() => move(1)} disabled={selected === config.zones.length - 1} className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30" title="Upper layer" aria-label="Move up a layer">
                <ArrowUp size={14} />
              </button>
              <button type="button" onClick={duplicate} className="p-1.5 text-gray-400 hover:text-white" title="Duplicate" aria-label="Duplicate zone">
                <Copy size={14} />
              </button>
              <button type="button" onClick={remove} className="p-1.5 text-gray-400 hover:text-red-400" title="Delete" aria-label="Delete zone">
                <Trash2 size={14} />
              </button>
            </div>
            <ZoneForm zone={zone} fonts={fonts} errors={zoneErrors[selected] || {}} videoWidth={template.width ?? undefined} templateId={template.id} onChange={(z) => setZone(selected, z)} />
          </div>
        )}

      </div>
    </div>
  );
}
