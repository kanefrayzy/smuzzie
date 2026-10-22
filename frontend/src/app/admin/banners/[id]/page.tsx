'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { formatFileSize, getApiError, getImageUrl } from '@/lib/utils';
import type { AdminBannerFont, AdminBannerTemplate } from '@/types/banners';
import { ArrowLeft, Upload, RefreshCw, Save, Film, ExternalLink, AlertTriangle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import TemplateStatusBadge from '@/components/admin/banners/TemplateStatusBadge';
import ZoneEditor from '@/components/admin/banners/ZoneEditor';
import TestRenderPanel from '@/components/admin/banners/TestRenderPanel';

const input =
  'w-full bg-surface border border-white/5 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent-red/50';
const label = 'block text-xs text-gray-400 mb-1.5';
const MAX_UPLOAD = 500 * 1024 * 1024;
const MAX_IMAGE_UPLOAD = 50 * 1024 * 1024;
const VIDEO_EXT = ['mp4', 'mov', 'm4v'];
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp'];

interface SettingsForm {
  name: string;
  slug: string;
  description: string;
  price: string;
  currency: string;
  sort_order: number;
  is_active: boolean;
  accent: string;
  hueEnabled: boolean;
  huePresets: string;
  gifEnabled: boolean;
  gifWidth: number;
  gifFps: number;
  jpgEnabled: boolean;
  jpgQuality: number;
  wmText: string;
  wmOpacity: number;
}

function toForm(t: AdminBannerTemplate): SettingsForm {
  // Only one of the two exists, by the template's kind; the other keeps its defaults
  const gif = 'gif' in t.outputs ? t.outputs.gif : { enabled: false, width: Math.min(1000, t.width || 1000), fps: 15 };
  const jpg = 'jpg' in t.outputs ? t.outputs.jpg : { enabled: true, quality: 92 };
  return {
    name: t.name,
    slug: t.slug,
    description: t.description || '',
    price: t.price,
    currency: t.currency,
    sort_order: t.sort_order,
    is_active: t.is_active,
    accent: t.config.accent,
    hueEnabled: t.config.hue.enabled,
    huePresets: t.config.hue.presets.join(', '),
    gifEnabled: gif.enabled,
    gifWidth: gif.width,
    gifFps: gif.fps,
    jpgEnabled: jpg.enabled,
    jpgQuality: jpg.quality,
    wmText: t.watermark.text,
    wmOpacity: t.watermark.opacity,
  };
}

export default function AdminBannerTemplatePage() {
  const { id } = useParams<{ id: string }>();
  const templateId = Number(id);
  const [template, setTemplate] = useState<AdminBannerTemplate | null>(null);
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [fonts, setFonts] = useState<AdminBannerFont[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout>>();
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchTemplate = useCallback(
    async (resetForm = false) => {
      try {
        const res = await adminApi.getBannerTemplate(templateId);
        setTemplate(res.data);
        if (resetForm) setForm(toForm(res.data));
      } catch (err) {
        toast.error(getApiError(err, 'Failed to load the template'));
      }
    },
    [templateId],
  );

  useEffect(() => {
    fetchTemplate(true);
    adminApi.getBannerFonts().then((res) => setFonts(res.data)).catch(() => toast.error('Failed to load fonts'));
    return () => clearTimeout(pollRef.current);
  }, [fetchTemplate]);

  // Poll while the video is queued or being processed
  useEffect(() => {
    clearTimeout(pollRef.current);
    if (template?.is_processing) {
      pollRef.current = setTimeout(() => fetchTemplate(false), 3000);
    }
  }, [template, fetchTemplate]);

  // A video makes an animated template, a PNG/JPG/WebP a static one (PNG + JPG results)
  const uploadSource = async (file: File | undefined) => {
    if (!file || !template) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isImage = IMAGE_EXT.includes(ext);
    if (!isImage && !VIDEO_EXT.includes(ext)) {
      toast.error('MP4 or MOV video, or a PNG, JPG or WebP image');
      return;
    }
    if (file.size > (isImage ? MAX_IMAGE_UPLOAD : MAX_UPLOAD)) {
      toast.error(`The file is larger than ${isImage ? 50 : 500} MB (${formatFileSize(file.size)})`);
      return;
    }
    if (template.has_media && isImage !== (template.kind === 'image')) {
      const to = isImage ? 'a static template (PNG + JPG results)' : 'an animated template (MP4 results)';
      if (!confirm(`This turns the template into ${to}. Output settings reset to the defaults. Continue?`)) return;
    }
    const data = new FormData();
    data.append('file', file);
    setUploadProgress(0);
    try {
      const res = await adminApi.uploadBannerSource(template.id, data, (e) => {
        if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      });
      setTemplate(res.data);
      toast.success('Uploaded, processing started');
    } catch (err) {
      toast.error(getApiError(err, 'Upload failed'));
    } finally {
      setUploadProgress(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const rebuildPreview = async () => {
    if (!template) return;
    try {
      const res = await adminApi.reprocessBannerTemplate(template.id);
      setTemplate(res.data);
    } catch (err) {
      toast.error(getApiError(err, 'Failed to start'));
    }
  };

  const save = async () => {
    if (!template || !form) return;
    const presets = form.huePresets
      .split(/[\s,;]+/)
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isFinite(n));
    setSaving(true);
    try {
      const res = await adminApi.updateBannerTemplate(template.id, {
        name: form.name,
        slug: form.slug,
        description: form.description || null,
        price: Number(form.price) || 0,
        currency: form.currency.toUpperCase(),
        sort_order: form.sort_order,
        is_active: form.is_active,
        config: { ...template.config, accent: form.accent, hue: { ...template.config.hue, enabled: form.hueEnabled, presets } },
        outputs:
          template.kind === 'image'
            ? { png: true, jpg: { enabled: form.jpgEnabled, quality: form.jpgQuality } }
            : { mp4: true, gif: { enabled: form.gifEnabled, width: form.gifWidth, fps: form.gifFps } },
        watermark: { text: form.wmText, opacity: form.wmOpacity },
      });
      setTemplate(res.data);
      setForm(toForm(res.data));
      toast.success(res.data.processing_status === 'pending' ? 'Saved, the preview is being rebuilt' : 'Saved');
    } catch (err) {
      toast.error(getApiError(err, 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  if (!template || !form) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-accent-red/30 border-t-accent-red rounded-full animate-spin" />
      </div>
    );
  }

  const set = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => setForm({ ...form, [key]: value });
  const still = template.kind === 'image';

  return (
    <div>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid rgba(255,255,255,0.05)' } }} />

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <Link href="/admin/banners" className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg" aria-label="Back">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-display font-bold text-white mr-1">{template.name}</h1>
        <TemplateStatusBadge template={template} />
        {template.is_active && template.has_media && (
          <a href={`/banners/${template.slug}`} target="_blank" rel="noopener" className="ml-auto text-sm text-gray-400 hover:text-white flex items-center gap-1">
            Open editor <ExternalLink size={14} />
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6 items-start">
        {/* Background: video or image */}
        <section className="glass-card p-6 border border-white/5">
          <h3 className="text-lg font-semibold text-white mb-4">
            Background{template.has_media ? (still ? ' · static image' : ' · video') : ''}
          </h3>

          {template.preview_url && still ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={template.preview_url}
              src={getImageUrl(template.preview_url)}
              alt="Template preview"
              className="w-full max-h-[60vh] object-contain rounded-xl bg-black mb-4"
            />
          ) : template.preview_url ? (
            <video
              key={template.preview_url}
              src={getImageUrl(template.preview_url)}
              poster={template.poster_url ? getImageUrl(template.poster_url) : undefined}
              className="w-full max-h-[60vh] object-contain rounded-xl bg-black mb-4"
              muted
              loop
              autoPlay
              playsInline
              controls
            />
          ) : (
            <div className="aspect-video rounded-xl bg-black/40 flex items-center justify-center text-gray-600 mb-4">
              <Film size={32} />
            </div>
          )}

          {template.width && (
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4">
              <div><dt className="text-gray-500">Size</dt><dd className="text-white font-mono">{template.width}×{template.height}</dd></div>
              {still ? (
                <div><dt className="text-gray-500">Type</dt><dd className="text-white font-mono">Still image</dd></div>
              ) : (
                <>
                  <div><dt className="text-gray-500">FPS</dt><dd className="text-white font-mono">{template.fps}</dd></div>
                  <div><dt className="text-gray-500">Duration</dt><dd className="text-white font-mono">{template.duration} s</dd></div>
                  <div><dt className="text-gray-500">Frames</dt><dd className="text-white font-mono">{template.frame_count}</dd></div>
                </>
              )}
            </dl>
          )}

          {template.processing_error && (
            <div className="flex gap-2 text-sm text-red-300 bg-red-400/10 border border-red-400/20 rounded-xl p-3 mb-4">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span className="break-words min-w-0">{template.processing_error}</span>
            </div>
          )}

          <label
            className={`flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-dashed text-sm cursor-pointer transition-colors ${
              dragOver ? 'border-accent-red/60 bg-accent-red/5' : 'border-white/10 hover:border-accent-red/40'
            } ${uploadProgress !== null || template.is_processing ? 'pointer-events-none opacity-60' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              uploadSource(e.dataTransfer.files[0]);
            }}
          >
            <Upload size={20} className="text-gray-400" />
            <span className="text-gray-300">
              {uploadProgress !== null
                ? `Uploading… ${uploadProgress}%`
                : template.is_processing
                  ? 'Processing…'
                  : template.has_media
                    ? 'Replace the background (video or image)'
                    : 'Upload the background: a video (MP4 or MOV, up to 500 MB) or an image (PNG, JPG or WebP, up to 50 MB)'}
            </span>
            <span className="text-gray-500 text-xs text-center">
              Without text. A video makes an animated banner (H.264 is kept as-is; other formats are converted once in high
              quality). An image makes a static banner with PNG and JPG results; use sRGB, up to 4096 px on a side.
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="video/mp4,video/quicktime,.mp4,.mov,.m4v,image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
              className="sr-only"
              onChange={(e) => uploadSource(e.target.files?.[0])}
            />
          </label>

          {template.has_media && (
            <button onClick={rebuildPreview} disabled={template.is_processing} className="mt-3 text-sm text-gray-400 hover:text-white flex items-center gap-1 disabled:opacity-40">
              <RefreshCw size={14} /> Rebuild preview and poster
            </button>
          )}
        </section>

        {/* Settings */}
        <section className="glass-card p-6 border border-white/5">
          <h3 className="text-lg font-semibold text-white mb-4">Settings</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="t-name">Name</label>
              <input id="t-name" className={input} maxLength={120} value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="t-slug">Slug (URL)</label>
              <input id="t-slug" className={`${input} font-mono`} maxLength={80} value={form.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} />
            </div>
            <div className="sm:col-span-2">
              <label className={label} htmlFor="t-desc">Description</label>
              <textarea id="t-desc" className={`${input} resize-none`} rows={2} maxLength={2000} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="t-price">Price (stored, not charged yet)</label>
              <div className="flex gap-2">
                <input id="t-price" className={input} type="number" min={0} step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)} />
                <input className={`${input} w-24 font-mono uppercase`} maxLength={3} value={form.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} aria-label="Currency" />
              </div>
            </div>
            <div>
              <label className={label} htmlFor="t-sort">Sort order</label>
              <input id="t-sort" className={input} type="number" min={0} value={form.sort_order} onChange={(e) => set('sort_order', Number(e.target.value) || 0)} />
            </div>
          </div>

          <h4 className="text-sm font-semibold text-white mt-6 mb-3">Background color</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="t-accent">Accent (text glow, swatches)</label>
              <div className="flex gap-2">
                <input id="t-accent" type="color" value={form.accent} onChange={(e) => set('accent', e.target.value)} className="h-[46px] w-14 rounded-xl bg-surface border border-white/5 p-1" />
                <input className={`${input} font-mono`} value={form.accent} maxLength={7} onChange={(e) => set('accent', e.target.value.toLowerCase())} aria-label="Accent hex" />
              </div>
            </div>
            <div>
              <label className={label} htmlFor="t-presets">Hue presets, degrees</label>
              <input id="t-presets" className={`${input} font-mono`} value={form.huePresets} onChange={(e) => set('huePresets', e.target.value)} placeholder="0, 35, 95, 150" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300 sm:col-span-2">
              <input type="checkbox" checked={form.hueEnabled} onChange={(e) => set('hueEnabled', e.target.checked)} />
              Buyers can change the background hue
            </label>
          </div>

          <h4 className="text-sm font-semibold text-white mt-6 mb-3">Output</h4>
          {still ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <label className="flex items-center gap-2 text-sm text-gray-300 h-[46px]">
                <input type="checkbox" checked disabled /> PNG (always)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300 h-[46px]">
                <input type="checkbox" checked={form.jpgEnabled} onChange={(e) => set('jpgEnabled', e.target.checked)} /> JPG
              </label>
              {form.jpgEnabled ? (
                <div>
                  <label className={label} htmlFor="t-jpgq">JPG quality, 60–100</label>
                  <input id="t-jpgq" className={input} type="number" min={60} max={100} value={form.jpgQuality} onChange={(e) => set('jpgQuality', Number(e.target.value) || 0)} />
                </div>
              ) : (
                <div />
              )}
            </div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <label className="flex items-center gap-2 text-sm text-gray-300 h-[46px]">
              <input type="checkbox" checked disabled /> MP4 (always)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300 h-[46px]">
              <input type="checkbox" checked={form.gifEnabled} onChange={(e) => set('gifEnabled', e.target.checked)} /> GIF
            </label>
            <div />
            {form.gifEnabled && (
              <>
                <div>
                  <label className={label} htmlFor="t-gifw">GIF width, px</label>
                  <input id="t-gifw" className={input} type="number" min={120} max={Math.min(1080, template.width || 1080)} value={form.gifWidth} onChange={(e) => set('gifWidth', Number(e.target.value) || 0)} />
                  <p className="text-[11px] text-gray-500 mt-1">Up to {Math.min(1080, template.width || 1080)} px. At 1000 px and 15 fps a GIF is about 3 MB per second.</p>
                </div>
                <div>
                  <label className={label} htmlFor="t-giff">GIF fps</label>
                  <input id="t-giff" className={input} type="number" min={5} max={30} value={form.gifFps} onChange={(e) => set('gifFps', Number(e.target.value) || 0)} />
                </div>
              </>
            )}
          </div>
          )}

          <h4 className="text-sm font-semibold text-white mt-6 mb-3">Preview watermark</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="t-wm">Text</label>
              <input id="t-wm" className={input} maxLength={40} value={form.wmText} onChange={(e) => set('wmText', e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="t-wmo">
                Opacity: {form.wmOpacity}/255 ({Math.round((form.wmOpacity / 255) * 100)}%)
              </label>
              <input id="t-wmo" type="range" min={0} max={255} value={form.wmOpacity} onChange={(e) => set('wmOpacity', Number(e.target.value))} className="w-full accent-[#ff2d3d] h-[46px]" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">The watermark is burned into the public preview; changing it rebuilds the preview.</p>

          <div className="flex flex-wrap items-center gap-4 mt-6 pt-6 border-t border-white/5">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
              Visible in the catalog
            </label>
            <div className="flex-1" />
            <button onClick={save} disabled={saving} className="btn-primary text-sm disabled:opacity-50">
              <Save size={14} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </section>
      </div>

      {/* Zones */}
      <section className="glass-card p-6 border border-white/5 mt-6">
        <h3 className="text-lg font-semibold text-white mb-1">Zones</h3>
        <p className="text-sm text-gray-500 mb-5">
          Where the buyer&apos;s texts and logo go, how they look by default and what the buyer may change.
        </p>
        <ZoneEditor template={template} fonts={fonts} onSaved={(t) => setTemplate(t)} />
      </section>

      {/* Test render */}
      <section className="glass-card p-6 border border-white/5 mt-6">
        <h3 className="text-lg font-semibold text-white mb-4">Test render</h3>
        <TestRenderPanel template={template} />
      </section>
    </div>
  );
}
