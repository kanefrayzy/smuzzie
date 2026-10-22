'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { getApiError, getImageUrl } from '@/lib/utils';
import type { AdminBannerTemplate } from '@/types/banners';
import { Plus, Trash2, Edit2, Save, X, Film, ArrowUp, ArrowDown, Eye, EyeOff } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import TemplateStatusBadge from '@/components/admin/banners/TemplateStatusBadge';

const input =
  'bg-surface border border-white/5 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent-red/50';

export default function AdminBannersPage() {
  const [templates, setTemplates] = useState<AdminBannerTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', price: '15' });
  const [saving, setSaving] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout>>();
  const router = useRouter();

  const fetchTemplates = async () => {
    try {
      const res = await adminApi.getBannerTemplates();
      setTemplates(res.data);
    } catch (err) {
      toast.error(getApiError(err, 'Failed to load templates'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
    return () => clearTimeout(pollRef.current);
  }, []);

  // Refresh while a video is being processed
  useEffect(() => {
    clearTimeout(pollRef.current);
    if (templates.some((t) => t.is_processing)) {
      pollRef.current = setTimeout(fetchTemplates, 4000);
    }
  }, [templates]);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Enter a name');
      return;
    }
    setSaving(true);
    try {
      const res = await adminApi.createBannerTemplate({
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        price: Number(form.price) || 0,
      });
      toast.success('Template created');
      router.push(`/admin/banners/${res.data.id}`);
    } catch (err) {
      toast.error(getApiError(err, 'Failed to create'));
      setSaving(false);
    }
  };

  const toggleActive = async (t: AdminBannerTemplate) => {
    try {
      const res = await adminApi.updateBannerTemplate(t.id, { is_active: !t.is_active });
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? res.data : x)));
    } catch (err) {
      toast.error(getApiError(err, 'Failed to update'));
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...templates];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    const items = next.map((t, i) => ({ id: t.id, sort_order: i }));
    setTemplates(next.map((t, i) => ({ ...t, sort_order: i })));
    try {
      await adminApi.reorderBannerTemplates(items);
    } catch (err) {
      toast.error(getApiError(err, 'Failed to reorder'));
      fetchTemplates();
    }
  };

  const handleDelete = async (t: AdminBannerTemplate) => {
    if (!confirm(`Delete "${t.name}"? It disappears from the catalog; existing orders are kept.`)) return;
    try {
      await adminApi.deleteBannerTemplate(t.id);
      setTemplates((prev) => prev.filter((x) => x.id !== t.id));
      toast.success('Template deleted');
    } catch (err) {
      toast.error(getApiError(err, 'Failed to delete'));
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

      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Banner templates</h1>
          <p className="text-gray-500 text-sm mt-1">Video templates buyers customize at /banners</p>
        </div>
        <button onClick={() => setShowCreate((v) => !v)} className="btn-primary text-sm">
          <Plus size={16} /> New template
        </button>
      </div>

      {showCreate && (
        <div className="glass-card p-6 border border-white/5 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">New template</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input className={input} placeholder="Name" maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className={input} placeholder="Slug (auto from name)" maxLength={80} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} />
            <input className={input} placeholder="Price" type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div className="flex items-center gap-4 mt-4">
            <button onClick={handleCreate} disabled={saving} className="btn-primary text-sm disabled:opacity-50">
              <Save size={14} /> Create and set up
            </button>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white text-sm flex items-center gap-1">
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {templates.map((t, i) => (
          <div key={t.id} className="glass-card p-4 border border-white/5 hover:border-white/10 transition-all flex items-center gap-4">
            <div className="flex flex-col">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-gray-500 hover:text-white disabled:opacity-20" aria-label="Move up">
                <ArrowUp size={14} />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === templates.length - 1} className="p-1 text-gray-500 hover:text-white disabled:opacity-20" aria-label="Move down">
                <ArrowDown size={14} />
              </button>
            </div>

            <Link href={`/admin/banners/${t.id}`} className="w-16 h-16 rounded-lg overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
              {t.poster_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={getImageUrl(t.poster_url)} alt="" className="w-full h-full object-cover" />
              ) : (
                <Film size={20} className="text-gray-600" />
              )}
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/banners/${t.id}`} className="text-white font-semibold text-sm hover:text-accent-red truncate">
                  {t.name}
                </Link>
                <TemplateStatusBadge template={t} />
                {!t.is_active && <span className="text-[10px] px-2 py-0.5 bg-white/5 text-gray-400 rounded-full">Hidden</span>}
              </div>
              <div className="text-gray-500 text-xs font-mono mt-1 truncate">
                /banners/{t.slug} · {t.config.zones.length} zones
                {t.width ? ` · ${t.width}×${t.height}` : ''} · {t.price} {t.currency} · {t.orders_count ?? 0} orders
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => toggleActive(t)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                aria-label={t.is_active ? 'Hide from catalog' : 'Show in catalog'}
                title={t.is_active ? 'Hide from catalog' : 'Show in catalog'}
              >
                {t.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <Link href={`/admin/banners/${t.id}`} className="p-2 text-gray-400 hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-all" aria-label="Edit">
                <Edit2 size={14} />
              </Link>
              <button onClick={() => handleDelete(t)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all" aria-label="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Film size={40} className="mx-auto mb-4 text-accent-red/60" />
          No templates yet. Upload fonts first, then create a template.
        </div>
      )}
    </div>
  );
}
