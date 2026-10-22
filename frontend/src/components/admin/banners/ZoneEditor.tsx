'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Save, Type, Image as ImageIcon, ArrowUp, ArrowDown, Eye, EyeOff, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { defaultParams } from '@/lib/banner-overlay';
import type { TemplateConfig, Zone } from '@/lib/banner-overlay';
import type { AdminBannerFont, AdminBannerTemplate } from '@/types/banners';
import BannerPreview from '@/components/banners/BannerPreview';
import ZoneCanvas from './ZoneCanvas';
import ZoneForm, { type ZoneErrors } from './ZoneForm';
import { SAMPLE_LOGO, newImageZone, newTextZone } from './zoneDefaults';
import CustomLayersForm from './CustomLayersForm';
import type { CustomLayersConfig } from '@/lib/banner-overlay';

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
  const [selected, setSelected] = useState<number | null>(template.config.zones.length ? 0 : null);
  const [zoneErrors, setZoneErrors] = useState<Record<number, ZoneErrors>>({});
  const [generalErrors, setGeneralErrors] = useState<string[]>([]);
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const setCustom = (custom: CustomLayersConfig) => {
    setConfig((c) => ({ ...c, custom }));
    setDirty(true);
  };
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTexts, setShowTexts] = useState(true);

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

  const update = useCallback((zones: Zone[]) => {
    setConfig((c) => ({ ...c, zones }));
    setDirty(true);
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

  const add = (type: 'text' | 'image') => {
    const fontId = fonts[0]?.id ?? 0;
    if (type === 'text' && !fontId) {
      toast.error('Upload a font first (Banner fonts)');
      return;
    }
    const zone = type === 'text' ? newTextZone(config, fontId) : newImageZone(config);
    update([...config.zones, zone]);
    setSelected(config.zones.length);
  };

  const duplicate = () => {
    if (selected === null) return;
    const src = config.zones[selected];
    const taken = new Set(config.zones.map((z) => z.key));
    let key = `${src.key}_2`;
    for (let i = 3; taken.has(key); i++) key = `${src.key}_${i}`;
    const copy = { ...structuredClone(src), key, x: Math.min(src.x + 2, 100 - src.w), y: Math.min(src.y + 2, 100 - src.h) } as Zone;
    update([...config.zones, copy]);
    setSelected(config.zones.length);
  };

  const remove = () => {
    if (selected === null) return;
    if (!confirm(`Delete zone "${config.zones[selected].key}"?`)) return;
    update(config.zones.filter((_, i) => i !== selected));
    setSelected(null);
  };

  const move = (dir: -1 | 1) => {
    if (selected === null) return;
    const to = selected + dir;
    if (to < 0 || to >= config.zones.length) return;
    const zones = [...config.zones];
    [zones[selected], zones[to]] = [zones[to], zones[selected]];
    update(zones);
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
    () => Object.fromEntries(config.zones.filter((z) => z.type === 'image').map((z) => [z.key, SAMPLE_LOGO])),
    [config.zones],
  );
  const errorSet = useMemo(() => new Set(Object.keys(zoneErrors).map(Number)), [zoneErrors]);
  const zone = selected !== null ? config.zones[selected] : null;

  if (!template.has_media || !template.width || !template.height) {
    return <p className="text-sm text-gray-500">Upload and process the video first; zones are placed on top of it.</p>;
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_440px] gap-6 items-start">
      <div className="min-w-0 xl:sticky xl:top-6">
        <div className="mx-auto" style={{ width: `min(100%, calc((100vh - 8rem) * ${template.width / template.height}))` }}>
          <BannerPreview
            width={template.width}
            height={template.height}
            previewUrl={template.preview_url}
            posterUrl={template.poster_url}
            config={config}
            params={params}
            images={sampleImages}
            fonts={fonts}
            showOverlay={showTexts}
            className="rounded-lg ring-1 ring-white/10"
          >
            <ZoneCanvas zones={config.zones} selected={selected} onSelect={setSelected} onRect={setRect} errors={errorSet} />
          </BannerPreview>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-xs text-gray-500">
          <button type="button" onClick={() => setShowTexts((v) => !v)} className="flex items-center gap-1 hover:text-white">
            {showTexts ? <EyeOff size={13} /> : <Eye size={13} />} {showTexts ? 'Hide' : 'Show'} default texts
          </button>
          <span>Drag to move · handles resize · arrows nudge 0.1% (Shift: 1%)</span>
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button type="button" onClick={() => add('text')} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white flex items-center gap-1.5">
            <Plus size={14} /> <Type size={14} /> Text
          </button>
          <button type="button" onClick={() => add('image')} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white flex items-center gap-1.5">
            <Plus size={14} /> <ImageIcon size={14} /> Logo
          </button>
          <div className="flex-1" />
          {dirty && <span className="text-xs text-amber-300">Unsaved</span>}
          <button type="button" onClick={save} disabled={saving || !dirty} className="btn-primary text-sm disabled:opacity-50">
            <Save size={14} /> {saving ? 'Saving…' : 'Save zones'}
          </button>
        </div>

        {generalErrors.length > 0 && (
          <div className="text-sm text-red-300 bg-red-400/10 border border-red-400/20 rounded-lg p-3 mb-4">{generalErrors.join(' ')}</div>
        )}

        {/* Zone list (later = drawn on top) */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {config.zones.map((z, i) => (
            <button
              key={`${z.key}-${i}`}
              type="button"
              onClick={() => setSelected(i)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-mono flex items-center gap-1.5 border transition-colors ${
                i === selected ? 'border-accent-red/60 bg-accent-red/10 text-white' : 'border-white/5 bg-white/[0.03] text-gray-400 hover:text-white'
              } ${errorSet.has(i) ? '!border-red-400/70' : ''}`}
            >
              {z.type === 'image' ? <ImageIcon size={12} /> : <Type size={12} />}
              {z.key}
            </button>
          ))}
          {config.zones.length === 0 && <p className="text-sm text-gray-500">No zones yet. Add a text or logo zone.</p>}
        </div>

        {zone && selected !== null && (
          <div className="glass-card p-5 border border-white/5">
            <div className="flex items-center gap-1 mb-4">
              <h4 className="text-sm font-semibold text-white mr-auto">
                {zone.type === 'image' ? 'Logo zone' : 'Text zone'} <span className="font-mono text-gray-500">{zone.key}</span>
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
            <ZoneForm zone={zone} fonts={fonts} errors={zoneErrors[selected] || {}} onChange={(z) => setZone(selected, z)} />
          </div>
        )}

        <div className="mt-4">
          <CustomLayersForm value={config.custom} fonts={fonts} errors={customErrors} onChange={setCustom} />
        </div>
      </div>
    </div>
  );
}
