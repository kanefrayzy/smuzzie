'use client';

import React, { useState } from 'react';
import { X, Plus, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { zoneImageUrl } from '@/lib/banner-formats';
import type {
  Align, AlignY, ImageControls, ImageZone, PositionControl, RangeControl, TextCase, TextControls, TextZone, Zone,
} from '@/lib/banner-overlay';
import type { AdminBannerFont } from '@/types/banners';
import { TEXT_MAX_LENGTH, withImageControls, withStyleControls } from './zoneDefaults';
import FontChecklist from './FontChecklist';

const input =
  'w-full bg-surface border border-white/5 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-accent-red/50';
const ALIGNS: Align[] = ['left', 'center', 'right'];
const ALIGNS_Y: AlignY[] = ['top', 'center', 'bottom'];
const CASES: TextCase[] = ['none', 'upper', 'lower'];
const MAX_FONT_OPTIONS = 12;

function Field({ label, children, error, className = '' }: { label: string; children: React.ReactNode; error?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[11px] text-gray-400 mb-1">{label}</span>
      {children}
      {error && <span className="block text-[11px] text-red-400 mt-1">{error}</span>}
    </label>
  );
}

function Num({ value, onChange, step = 0.1, min, max }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <input
      type="number"
      className={`${input} font-mono`}
      value={Number.isFinite(value) ? value : ''}
      step={step}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
    />
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-300">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function OptionChecks<T extends string>({ all, value, onChange }: { all: T[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      {all.map((opt) => (
        <Check key={opt} label={opt} checked={value.includes(opt)} onChange={(on) => onChange(all.filter((o) => (o === opt ? on : value.includes(o))))} />
      ))}
    </div>
  );
}

function Palette({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('#ffffff');
  return (
    <div className="flex flex-wrap items-center gap-2">
      {value.map((c) => (
        <span key={c} className="flex items-center gap-1 pl-1 pr-1.5 py-1 rounded-md bg-white/5 text-xs font-mono text-gray-300">
          <span className="w-4 h-4 rounded-sm border border-white/20" style={{ background: c }} />
          {c}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== c))} aria-label={`Remove ${c}`} className="text-gray-500 hover:text-white">
            <X size={12} />
          </button>
        </span>
      ))}
      {value.length < 12 && (
        <span className="flex items-center gap-1">
          <input type="color" value={draft} onChange={(e) => setDraft(e.target.value)} className="w-8 h-8 rounded bg-surface border border-white/5 p-0.5" aria-label="New palette color" />
          <button
            type="button"
            onClick={() => !value.includes(draft) && onChange([...value, draft])}
            className="p-1.5 rounded-md bg-white/5 text-gray-300 hover:text-white"
            aria-label="Add color"
          >
            <Plus size={12} />
          </button>
        </span>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-white/5 pt-4 mt-4 space-y-3">
      <legend className="text-xs font-semibold text-white uppercase tracking-wider pr-2">{title}</legend>
      {children}
    </fieldset>
  );
}

/** A "buyer can change" slider: checkbox plus min/max. */
function RangeRow({
  label, unit, ctl, step, err, errKey, onChange,
}: {
  label: string;
  unit: string;
  ctl: RangeControl;
  step: number;
  err: (p: string) => string | undefined;
  errKey: string;
  onChange: (patch: Partial<RangeControl>) => void;
}) {
  return (
    <div className="space-y-2">
      <Check label={label} checked={ctl.enabled} onChange={(enabled) => onChange({ enabled })} />
      {ctl.enabled && (
        <>
          <div className="grid grid-cols-2 gap-3 pl-6">
            <Field label={`Min${unit}`} error={err(`controls.${errKey}.min`)}>
              <Num value={ctl.min} step={step} onChange={(min) => onChange({ min })} />
            </Field>
            <Field label={`Max${unit}`} error={err(`controls.${errKey}.max`)}>
              <Num value={ctl.max} step={step} onChange={(max) => onChange({ max })} />
            </Field>
          </div>
          {err(`controls.${errKey}`) && <p className="text-[11px] text-red-400 pl-6">{err(`controls.${errKey}`)}</p>}
        </>
      )}
    </div>
  );
}

/** "Buyer can move it": on/off, resizing, and the area it can't leave. */
function PositionForm({
  pos, err, onChange,
}: {
  pos: PositionControl;
  err: (p: string) => string | undefined;
  onChange: (patch: Partial<PositionControl>) => void;
}) {
  const b = pos.bounds;
  const whole = b.x === 0 && b.y === 0 && b.w === 100 && b.h === 100;
  return (
    <div className="space-y-2">
      <Check label="Position (drag in the preview)" checked={pos.enabled} onChange={(enabled) => onChange({ enabled })} />
      {pos.enabled && (
        <div className="pl-6 space-y-2">
          <Check label="Resize too" checked={pos.resize} onChange={(resize) => onChange({ resize })} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-gray-500">Allowed area, % of the video (dotted on the preview)</span>
            {!whole && (
              <button type="button" onClick={() => onChange({ bounds: { x: 0, y: 0, w: 100, h: 100 } })} className="text-[11px] text-gray-400 hover:text-white">
                Whole frame
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(['x', 'y', 'w', 'h'] as const).map((k) => (
              <Field key={k} label={k.toUpperCase()} error={err(`controls.position.bounds.${k}`)}>
                <Num value={b[k]} min={0} max={100} onChange={(v) => onChange({ bounds: { ...b, [k]: v } })} />
              </Field>
            ))}
          </div>
          {err('controls.position.bounds') && <p className="text-[11px] text-red-400">{err('controls.position.bounds')}</p>}
        </div>
      )}
    </div>
  );
}

/** Errors for this zone from the server, keyed by the rest of the path ("style.size", "key"...). */
export type ZoneErrors = Record<string, string>;

export default function ZoneForm({
  zone, fonts, errors, videoWidth, templateId, onChange,
}: {
  zone: Zone;
  fonts: AdminBannerFont[];
  errors: ZoneErrors;
  /** For uploading a zone's default image */
  templateId: number;
  /** Template width, to show sizes in px */
  videoWidth?: number;
  onChange: (zone: Zone) => void;
}) {
  const err = (path: string) => errors[path];

  const common = (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Key (letters, digits, _)" error={err('key')}>
        <input className={`${input} font-mono`} value={zone.key} maxLength={32} onChange={(e) => onChange({ ...zone, key: e.target.value.toLowerCase() } as Zone)} />
      </Field>
      <Field label="Label for the buyer" error={err('label')}>
        <input className={input} value={zone.label} maxLength={60} onChange={(e) => onChange({ ...zone, label: e.target.value } as Zone)} />
      </Field>
      <div className="col-span-2 grid grid-cols-4 gap-2">
        {(['x', 'y', 'w', 'h'] as const).map((k) => (
          <Field key={k} label={`${k.toUpperCase()}, %`} error={err(k)}>
            <Num value={zone[k]} min={0} max={100} onChange={(v) => onChange({ ...zone, [k]: v } as Zone)} />
          </Field>
        ))}
      </div>
    </div>
  );

  if (zone.type === 'image') return <ImageForm zone={zone} common={common} err={err} templateId={templateId} onChange={onChange} />;
  return <TextForm zone={zone} fonts={fonts} common={common} err={err} videoWidth={videoWidth} onChange={onChange} />;
}

function TextForm({
  zone: rawZone, fonts, common, err, videoWidth, onChange,
}: {
  zone: TextZone;
  fonts: AdminBannerFont[];
  common: React.ReactNode;
  videoWidth?: number;
  err: (p: string) => string | undefined;
  onChange: (z: Zone) => void;
}) {
  const zone = withStyleControls(rawZone);
  const s = zone.style;
  const c = zone.controls as Required<TextControls>;
  const setStyle = (patch: Partial<TextZone['style']>) => onChange({ ...zone, style: { ...s, ...patch } });
  const setCtl = <K extends keyof TextControls>(k: K, patch: Partial<Required<TextControls>[K]>) =>
    onChange({ ...zone, controls: { ...c, [k]: { ...c[k], ...patch } } });
  const gradient = s.gradient ?? { enabled: false, from: s.color, to: '#ff2d8a', angle: 90 };
  const px = (pct: number) => (videoWidth && Number.isFinite(pct) ? ` (≈${Math.round((pct / 100) * videoWidth)} px)` : '');
  const fontErrors = Array.from({ length: MAX_FONT_OPTIONS }, (_, j) => err(`controls.font.options.${j}`)).filter(Boolean);

  return (
    <div>
      {common}

      <Group title="Default look">
        <Field label="Default text" error={err('style.text')}>
          {c.text.multiline ? (
            <textarea className={`${input} resize-y`} rows={3} value={s.text} onChange={(e) => setStyle({ text: e.target.value })} />
          ) : (
            <input className={input} value={s.text} onChange={(e) => setStyle({ text: e.target.value })} />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Font" error={err('style.fontId')} className="col-span-2">
            <select className={input} value={s.fontId} onChange={(e) => setStyle({ fontId: Number(e.target.value) })}>
              {!fonts.some((f) => f.id === s.fontId) && <option value={s.fontId}>— pick a font —</option>}
              {/* Grouped by family: the library can hold hundreds of faces */}
              {Array.from(new Set(fonts.map((f) => f.name))).map((family) => (
                <optgroup key={family} label={family}>
                  {fonts
                    .filter((f) => f.name === family)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} {f.weight}
                        {f.style === 'italic' ? ' italic' : ''}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label={`Base size, % of width${px(s.size)}`} error={err('style.size')}>
            <Num value={s.size} step={0.05} onChange={(size) => setStyle({ size })} />
          </Field>
          <Field label={`Auto-fit minimum, %${px(s.minSize)}`} error={err('style.minSize')}>
            <Num value={s.minSize} step={0.05} onChange={(minSize) => setStyle({ minSize })} />
          </Field>
          <Field label="Case" error={err('style.case')}>
            <select className={input} value={s.case} onChange={(e) => setStyle({ case: e.target.value as TextCase })}>
              <option value="none">As typed</option>
              <option value="upper">UPPERCASE</option>
              <option value="lower">lowercase</option>
            </select>
          </Field>
          <Field label="Alignment" error={err('style.align')}>
            <select className={input} value={s.align} onChange={(e) => setStyle({ align: e.target.value as Align })}>
              {ALIGNS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </Field>
          <Field label="Color" error={err('style.color')}>
            <div className="flex gap-2">
              <input type="color" value={s.color} onChange={(e) => setStyle({ color: e.target.value })} className="w-10 h-[38px] rounded-lg bg-surface border border-white/5 p-1" />
              <input className={`${input} font-mono`} value={s.color} maxLength={7} onChange={(e) => setStyle({ color: e.target.value.toLowerCase() })} />
            </div>
          </Field>
          <div className="flex items-end pb-2">
            <Check label="Glow (accent color)" checked={s.glow} onChange={(glow) => setStyle({ glow })} />
          </div>
          <div className="col-span-2 space-y-2">
            <Check label="Gradient fill" checked={gradient.enabled} onChange={(enabled) => setStyle({ gradient: { ...gradient, enabled } })} />
            {gradient.enabled && (
              <div className="pl-6 grid grid-cols-3 gap-3">
                {(['from', 'to'] as const).map((k) => (
                  <Field key={k} label={k === 'from' ? 'Start color' : 'End color'} error={err(`style.gradient.${k}`)}>
                    <input type="color" value={gradient[k]} onChange={(e) => setStyle({ gradient: { ...gradient, [k]: e.target.value.toLowerCase() } })} className="w-full h-[38px] rounded-lg bg-surface border border-white/5 p-1" />
                  </Field>
                ))}
                <Field label="Angle, °" error={err('style.gradient.angle')}>
                  <Num value={gradient.angle} step={15} min={0} max={359} onChange={(angle) => setStyle({ gradient: { ...gradient, angle } })} />
                </Field>
              </div>
            )}
          </div>
          <Field label="Line height" error={err('style.lineHeight')}>
            <Num value={s.lineHeight} step={0.01} onChange={(lineHeight) => setStyle({ lineHeight })} />
          </Field>
          <Field label="Letter spacing, em" error={err('style.letterSpacing')}>
            <Num value={s.letterSpacing} step={0.005} onChange={(letterSpacing) => setStyle({ letterSpacing })} />
          </Field>
          <Field label="Opacity, %" error={err('style.opacity')}>
            <Num value={s.opacity ?? 100} step={1} min={10} max={100} onChange={(opacity) => setStyle({ opacity })} />
          </Field>
        </div>
      </Group>

      <Group title="Buyer can change">
        <div className="space-y-2">
          <Check label="Text" checked={c.text.enabled} onChange={(enabled) => setCtl('text', { enabled })} />
          <div className="grid grid-cols-2 gap-3 pl-6">
            <Field label="Max characters" error={err('controls.text.maxLength')}>
              <Num value={c.text.maxLength} step={1} min={1} max={TEXT_MAX_LENGTH} onChange={(maxLength) => setCtl('text', { maxLength })} />
            </Field>
            <div className="flex items-end pb-2">
              <Check label="Line breaks allowed" checked={c.text.multiline} onChange={(multiline) => setCtl('text', { multiline })} />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Check label="Size (slider)" checked={c.size.enabled} onChange={(enabled) => setCtl('size', { enabled })} />
          <div className="grid grid-cols-2 gap-3 pl-6">
            <Field label="Slider min, %" error={err('controls.size.min')}>
              <Num value={c.size.min} step={0.05} onChange={(min) => setCtl('size', { min })} />
            </Field>
            <Field label="Slider max, %" error={err('controls.size.max')}>
              <Num value={c.size.max} step={0.05} onChange={(max) => setCtl('size', { max })} />
            </Field>
          </div>
          {err('controls.size') && <p className="text-[11px] text-red-400 pl-6">{err('controls.size')}</p>}
        </div>
        <div className="space-y-2">
          <Check label="Color" checked={c.color.enabled} onChange={(enabled) => setCtl('color', { enabled })} />
          <div className="pl-6 space-y-2">
            <Palette value={c.color.palette} onChange={(palette) => setCtl('color', { palette })} />
            <Check label="Any custom color" checked={c.color.custom} onChange={(custom) => setCtl('color', { custom })} />
          </div>
        </div>
        <div className="space-y-2">
          <Check label="Alignment" checked={c.align.enabled} onChange={(enabled) => setCtl('align', { enabled })} />
          <div className="pl-6">
            <OptionChecks all={ALIGNS} value={c.align.options} onChange={(options) => setCtl('align', { options })} />
          </div>
        </div>
        <Check label="Remove this text (the buyer can delete it from the banner)" checked={c.visible.enabled} onChange={(enabled) => setCtl('visible', { enabled })} />
        <div className="space-y-2">
          <Check label="Font" checked={c.font.enabled} onChange={(enabled) => setCtl('font', { enabled })} />
          {c.font.enabled && (
            <div className="pl-6 space-y-1.5">
              <p className="text-[11px] text-gray-500">Fonts the buyer can pick (the default one is always included, up to {MAX_FONT_OPTIONS})</p>
              <FontChecklist
                fonts={fonts}
                checked={(id) => id === s.fontId || c.font.options.includes(id)}
                disabled={(id) => id === s.fontId || (!c.font.options.includes(id) && c.font.options.length >= MAX_FONT_OPTIONS)}
                onToggle={(id, on) =>
                  setCtl('font', { options: on ? [...c.font.options, id] : c.font.options.filter((x) => x !== id) })
                }
              />
              {fontErrors.map((m, j) => (
                <p key={j} className="text-[11px] text-red-400">{m}</p>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Check label="Letter case" checked={c.case.enabled} onChange={(enabled) => setCtl('case', { enabled })} />
          {c.case.enabled && (
            <div className="pl-6">
              <OptionChecks all={CASES} value={c.case.options} onChange={(options) => setCtl('case', { options })} />
            </div>
          )}
        </div>
        <Check label="Glow on / off" checked={c.glow.enabled} onChange={(enabled) => setCtl('glow', { enabled })} />
        <Check label="Gradient (on / off, colors, direction)" checked={c.gradient.enabled} onChange={(enabled) => setCtl('gradient', { enabled })} />
        <RangeRow label="Letter spacing (slider)" unit=", em" ctl={c.letterSpacing} step={0.005} err={err} errKey="letterSpacing" onChange={(p) => setCtl('letterSpacing', p)} />
        <RangeRow label="Line height (slider)" unit="" ctl={c.lineHeight} step={0.01} err={err} errKey="lineHeight" onChange={(p) => setCtl('lineHeight', p)} />
        <RangeRow label="Opacity (slider)" unit=", %" ctl={c.opacity} step={1} err={err} errKey="opacity" onChange={(p) => setCtl('opacity', p)} />
        <PositionForm pos={c.position} err={err} onChange={(p) => setCtl('position', p)} />
      </Group>
    </div>
  );
}

function ImageForm({
  zone: rawZone, common, err, templateId, onChange,
}: {
  zone: ImageZone;
  common: React.ReactNode;
  err: (p: string) => string | undefined;
  templateId: number;
  onChange: (z: Zone) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const zone = withImageControls(rawZone);
  const s = zone.style;
  const c = zone.controls as Required<ImageControls>;
  const setStyle = (patch: Partial<ImageZone['style']>) => onChange({ ...zone, style: { ...s, ...patch } });
  const setCtl = <K extends keyof ImageControls>(k: K, patch: Partial<Required<ImageControls>[K]>) =>
    onChange({ ...zone, controls: { ...c, [k]: { ...c[k], ...patch } } });

  // The template's own image for this zone: shown in the banner until the buyer replaces or removes it
  const uploadDefault = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('w', String(zone.w));
      fd.append('h', String(zone.h));
      const res = await adminApi.uploadBannerZoneImage(templateId, fd);
      setStyle({ image: res.data.path });
      toast.success('Image added. Save zones to keep it');
    } catch (e) {
      toast.error(getApiError(e, 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {common}

      <Group title="Image in the banner">
        <div className="flex items-center gap-3">
          <span
            className="w-20 h-14 shrink-0 rounded-md flex items-center justify-center overflow-hidden border border-white/10"
            style={{ background: 'repeating-conic-gradient(#1b1b22 0 25%, #141419 0 50%) 0 0 / 12px 12px' }}
          >
            {s.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={zoneImageUrl(s.image)} alt="" className="max-w-[90%] max-h-[85%] object-contain" />
            ) : (
              <span className="text-[10px] text-gray-500 text-center px-1">none</span>
            )}
          </span>
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <label className={`px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white flex items-center gap-1.5 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                <Upload size={13} /> {uploading ? 'Uploading…' : s.image ? 'Replace' : 'Upload image'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => {
                    uploadDefault(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              {s.image && (
                <button type="button" onClick={() => setStyle({ image: undefined })} className="text-xs text-gray-400 hover:text-red-400">
                  Remove
                </button>
              )}
            </div>
            <p className="text-[11px] text-gray-500 leading-snug">
              Optional. An icon or logo the banner shows by default (PNG, JPG, WebP or animated GIF). Without one the zone stays empty until the buyer uploads.
            </p>
            {err('style.image') && <p className="text-[11px] text-red-400">{err('style.image')}</p>}
          </div>
        </div>
      </Group>

      <Group title="Default placement">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Size, % of zone" error={err('style.scale')}>
            <Num value={s.scale} step={1} min={10} max={100} onChange={(scale) => setStyle({ scale })} />
          </Field>
          <Field label="Horizontal">
            <select className={input} value={s.alignX} onChange={(e) => setStyle({ alignX: e.target.value as Align })}>
              {ALIGNS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </Field>
          <Field label="Vertical">
            <select className={input} value={s.alignY} onChange={(e) => setStyle({ alignY: e.target.value as AlignY })}>
              {ALIGNS_Y.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </Field>
        </div>
      </Group>

      <Group title="Buyer can change">
        <div className="space-y-2">
          <Check label={s.image ? 'Replace the image with their own' : 'Upload an image'} checked={c.upload.enabled} onChange={(enabled) => setCtl('upload', { enabled })} />
          <div className="pl-6 max-w-[200px]">
            <Field label="Max file size, KB" error={err('controls.upload.maxBytes')}>
              <Num value={Math.round(c.upload.maxBytes / 1024)} step={1} min={10} max={2048} onChange={(kb) => setCtl('upload', { maxBytes: Math.round(kb * 1024) })} />
            </Field>
          </div>
        </div>
        <Check
          label="Remove the image (the buyer can delete it from the banner)"
          checked={c.visible.enabled}
          onChange={(enabled) => setCtl('visible', { enabled })}
        />
        <div className="space-y-2">
          <Check label="Size (slider)" checked={c.scale.enabled} onChange={(enabled) => setCtl('scale', { enabled })} />
          <div className="grid grid-cols-2 gap-3 pl-6">
            <Field label="Min, %" error={err('controls.scale.min')}>
              <Num value={c.scale.min} step={1} onChange={(min) => setCtl('scale', { min })} />
            </Field>
            <Field label="Max, %" error={err('controls.scale.max')}>
              <Num value={c.scale.max} step={1} onChange={(max) => setCtl('scale', { max })} />
            </Field>
          </div>
          {err('controls.scale') && <p className="text-[11px] text-red-400 pl-6">{err('controls.scale')}</p>}
        </div>
        <div className="space-y-2">
          <Check label="Alignment inside the zone" checked={c.align.enabled} onChange={(enabled) => setCtl('align', { enabled })} />
          <div className="pl-6 space-y-2">
            <OptionChecks all={ALIGNS} value={c.align.x} onChange={(x) => setCtl('align', { x })} />
            <OptionChecks all={ALIGNS_Y} value={c.align.y} onChange={(y) => setCtl('align', { y })} />
          </div>
        </div>
        <PositionForm pos={c.position} err={err} onChange={(p) => setCtl('position', p)} />
      </Group>
    </div>
  );
}
