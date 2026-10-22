'use client';

import React, { useEffect, useRef, useState } from 'react';
import { adminApi } from '@/lib/api';
import { formatFileSize, getApiError, getImageUrl } from '@/lib/utils';
import { loadFonts } from '@/lib/banner-overlay/fonts';
import type { AdminBannerFont } from '@/types/banners';
import { Upload, Trash2, Edit2, Save, X, Type } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const SAMPLE = 'Аа Жж Ёё Zz Qq 0123 — «Smuzzie»';
const input =
  'bg-surface border border-white/5 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent-red/50';

export default function AdminBannerFontsPage() {
  const [fonts, setFonts] = useState<AdminBannerFont[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: '', weight: 700, style: 'normal' as 'normal' | 'italic' });
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', weight: 700, style: 'normal' as 'normal' | 'italic' });
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchFonts = async () => {
    try {
      const res = await adminApi.getBannerFonts();
      setFonts(res.data);
      loadFonts(res.data, (f) => getImageUrl(f.url));
    } catch (err) {
      toast.error(getApiError(err, 'Failed to load fonts'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFonts();
  }, []);

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.woff2')) {
      toast.error('Only .woff2 files');
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      toast.error('The font file is larger than 2 MB');
      return;
    }
    setFile(f);
    if (!form.name) {
      // "manrope-cyrillic-800-normal.woff2" -> "Manrope"
      const base = f.name.replace(/\.woff2$/i, '').split(/[-_ ]/)[0];
      setForm((prev) => ({ ...prev, name: base.charAt(0).toUpperCase() + base.slice(1) }));
    }
    const weight = f.name.match(/(?:^|[-_ ])([1-9]00)(?:[-_ .]|$)/);
    if (weight) setForm((prev) => ({ ...prev, weight: Number(weight[1]) }));
  };

  const handleUpload = async () => {
    if (!file || !form.name.trim()) {
      toast.error('Choose a file and enter a name');
      return;
    }
    setUploading(true);
    try {
      const data = new FormData();
      data.append('file', file);
      data.append('name', form.name.trim());
      data.append('weight', String(form.weight));
      data.append('style', form.style);
      await adminApi.createBannerFont(data);
      toast.success('Font uploaded');
      setFile(null);
      setForm({ name: '', weight: 700, style: 'normal' });
      if (fileRef.current) fileRef.current.value = '';
      fetchFonts();
    } catch (err) {
      toast.error(getApiError(err, 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (id: number) => {
    try {
      await adminApi.updateBannerFont(id, editForm);
      toast.success('Saved');
      setEditing(null);
      fetchFonts();
    } catch (err) {
      toast.error(getApiError(err, 'Save failed'));
    }
  };

  const handleDelete = async (font: AdminBannerFont) => {
    if (!confirm(`Delete ${font.name} ${font.weight}? Existing orders keep rendering with it.`)) return;
    try {
      await adminApi.deleteBannerFont(font.id);
      toast.success('Font deleted');
      setFonts((prev) => prev.filter((f) => f.id !== font.id));
    } catch (err: any) {
      const used = err?.response?.data?.templates as { name: string }[] | undefined;
      toast.error(used?.length ? `Used by: ${used.map((t) => t.name).join(', ')}` : getApiError(err, 'Delete failed'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-accent-red/30 border-t-accent-red rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid rgba(255,255,255,0.05)' } }} />

      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-white">Banner fonts</h1>
        <p className="text-gray-500 text-sm mt-1">
          One .woff2 file per face (weight + style). It needs Cyrillic and Latin glyphs: the preview and the render use the same file.
        </p>
      </div>

      {/* Upload */}
      <div className="glass-card p-6 border border-white/5 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Upload a font</h3>
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_0.7fr_0.7fr] gap-4">
          <label
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-white/10 hover:border-accent-red/40 cursor-pointer text-sm text-gray-400 min-w-0"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pickFile(e.dataTransfer.files[0]);
            }}
          >
            <Upload size={16} className="shrink-0" />
            <span className="truncate">{file ? file.name : 'Choose or drop a .woff2 file'}</span>
            <input ref={fileRef} type="file" accept=".woff2,font/woff2" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
          </label>
          <input className={input} placeholder="Name (e.g. Unbounded)" maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className={input} value={form.weight} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}>
            {WEIGHTS.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
          <select className={input} value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value as 'normal' | 'italic' })}>
            <option value="normal">normal</option>
            <option value="italic">italic</option>
          </select>
        </div>
        <button onClick={handleUpload} disabled={uploading || !file} className="btn-primary text-sm mt-4 disabled:opacity-50">
          <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {fonts.map((font) => (
          <div key={font.id} className="glass-card p-5 border border-white/5">
            {editing === font.id ? (
              <div className="flex flex-wrap items-center gap-3">
                <input className={`${input} flex-1 min-w-[160px]`} maxLength={80} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                <select className={input} value={editForm.weight} onChange={(e) => setEditForm({ ...editForm, weight: Number(e.target.value) })}>
                  {WEIGHTS.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
                <select className={input} value={editForm.style} onChange={(e) => setEditForm({ ...editForm, style: e.target.value as 'normal' | 'italic' })}>
                  <option value="normal">normal</option>
                  <option value="italic">italic</option>
                </select>
                <button onClick={() => handleSave(font.id)} className="btn-primary text-xs py-2 px-4"><Save size={12} /> Save</button>
                <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-white text-xs flex items-center gap-1"><X size={12} /> Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <span className="w-10 h-10 rounded-xl bg-accent-red/10 text-accent-red flex items-center justify-center shrink-0">
                  <Type size={18} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="text-white font-semibold text-sm">{font.name}</h3>
                    <span className="text-gray-500 text-xs font-mono">{font.weight} · {font.style} · {formatFileSize(font.file_size)} · {font.family}</span>
                  </div>
                  <p
                    className="text-white/90 text-xl mt-2 truncate"
                    style={{ fontFamily: `"${font.family}", sans-serif`, fontWeight: font.weight, fontStyle: font.style }}
                  >
                    {SAMPLE}
                  </p>
                  {font.templates.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">Used by: {font.templates.map((t) => t.name).join(', ')}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditing(font.id);
                      setEditForm({ name: font.name, weight: font.weight, style: font.style });
                    }}
                    className="p-2 text-gray-400 hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-all"
                    aria-label="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(font)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                    aria-label="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {fonts.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Type size={40} className="mx-auto mb-4 text-accent-red/60" />
          No fonts yet. Upload the faces your templates use.
        </div>
      )}
    </div>
  );
}
