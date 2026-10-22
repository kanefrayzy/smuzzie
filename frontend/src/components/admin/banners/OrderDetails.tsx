'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, RefreshCw, Download, AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '@/lib/api';
import { formatFileSize, getApiError } from '@/lib/utils';
import type { AdminBannerOrderDetails } from '@/types/banners';
import BannerPreview from '@/components/banners/BannerPreview';
import OrderStatusBadge from './OrderStatusBadge';

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' }) : '—';
}

/** Side panel with everything about one order and the admin actions. */
export default function OrderDetails({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const [order, setOrder] = useState<AdminBannerOrderDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async () => {
    try {
      const res = await adminApi.getBannerOrder(id);
      setOrder(res.data);
    } catch (err) {
      toast.error(getApiError(err, 'Failed to load the order'));
    }
  }, [id]);

  useEffect(() => {
    load();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(pollRef.current);
    };
  }, [load, onClose]);

  useEffect(() => {
    clearTimeout(pollRef.current);
    if (order && (order.status === 'queued' || order.status === 'rendering')) {
      pollRef.current = setTimeout(load, 3000);
    }
  }, [order, load]);

  const act = async (action: 'paid' | 'rerender') => {
    if (!order) return;
    if (action === 'paid' && !confirm('Confirm the payment and start the render?')) return;
    setBusy(true);
    try {
      const res = action === 'paid' ? await adminApi.markBannerOrderPaid(order.id) : await adminApi.rerenderBannerOrder(order.id);
      setOrder(res.data);
      onChanged();
      toast.success(action === 'paid' ? 'Payment confirmed, render queued' : 'Render queued');
    } catch (err) {
      toast.error(getApiError(err, 'Action failed'));
    } finally {
      setBusy(false);
    }
  };

  const preview = useMemo(() => {
    if (!order?.snapshot?.config || !order.snapshot.media?.width) return null;
    return {
      config: order.snapshot.config,
      params: order.params,
      images: order.images,
      fonts: order.snapshot.fonts,
      width: order.snapshot.media.width,
      height: order.snapshot.media.height,
    };
  }, [order]);

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <aside className="relative w-full max-w-3xl h-full overflow-y-auto bg-surface border-l border-white/5 p-6" role="dialog" aria-label="Order details">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white" aria-label="Close">
          <X size={18} />
        </button>

        {!order ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-accent-red/30 border-t-accent-red rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-display font-bold text-white">#{order.token.slice(0, 8)}</h2>
                <OrderStatusBadge status={order.status} />
                {order.is_test && <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-400/10 text-sky-300">Test render</span>}
              </div>
              <p className="text-sm text-gray-400 mt-1">
                {order.template.name} · {order.email || 'no email'} · {order.amount} {order.currency}
              </p>
              <a href={`/banners/order/${order.token}`} target="_blank" rel="noopener" className="text-xs text-gray-500 hover:text-white">
                Buyer&apos;s order page ↗
              </a>
            </div>

            <div className="flex flex-wrap gap-2">
              {order.status === 'pending_payment' && (
                <button onClick={() => act('paid')} disabled={busy} className="btn-primary text-sm disabled:opacity-50">
                  <CheckCircle2 size={14} /> Confirm payment
                </button>
              )}
              {(order.status === 'ready' || order.status === 'failed') && (
                <button onClick={() => act('rerender')} disabled={busy} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white flex items-center gap-1.5 disabled:opacity-50">
                  <RefreshCw size={14} /> Render again
                </button>
              )}
              {order.downloads?.mp4 && (
                <a href={order.downloads.mp4} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white flex items-center gap-1.5">
                  <Download size={14} /> MP4 {order.result?.mp4_size ? `(${formatFileSize(order.result.mp4_size)})` : ''}
                </a>
              )}
              {order.downloads?.gif && (
                <a href={order.downloads.gif} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white flex items-center gap-1.5">
                  <Download size={14} /> GIF {order.result?.gif_size ? `(${formatFileSize(order.result.gif_size)})` : ''}
                </a>
              )}
            </div>

            {order.error && (
              <div className="text-sm text-red-300 bg-red-400/10 border border-red-400/20 rounded-lg p-3 flex gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span className="break-words min-w-0">{order.error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6">
              <div>
                <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">What the buyer composed</h3>
                {preview ? (
                  <BannerPreview
                    width={preview.width}
                    height={preview.height}
                    previewUrl={order.preview_url}
                    config={preview.config}
                    params={preview.params}
                    images={preview.images}
                    fonts={preview.fonts}
                    className="rounded-lg ring-1 ring-white/10"
                  />
                ) : (
                  <p className="text-sm text-gray-500">No snapshot.</p>
                )}
                <p className="text-[11px] text-gray-500 mt-2">Text layer from the order snapshot over the template&apos;s current preview video.</p>
              </div>

              <div className="space-y-4 min-w-0">
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">Timeline</h3>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                    {(
                      [
                        ['Created', order.created_at],
                        ['Paid', order.paid_at],
                        ['Queued', order.queued_at],
                        ['Render started', order.rendering_started_at],
                        ['Ready', order.ready_at],
                        ['Failed', order.failed_at],
                        ['Emailed', order.notified_at],
                        ['Files removed', order.result_purged_at],
                      ] as const
                    ).map(([label, value]) => (
                      <React.Fragment key={label}>
                        <dt className="text-gray-500">{label}</dt>
                        <dd className="text-gray-200 font-mono">{when(value)}</dd>
                      </React.Fragment>
                    ))}
                    <dt className="text-gray-500">Attempts</dt>
                    <dd className="text-gray-200 font-mono">{order.attempts}</dd>
                    <dt className="text-gray-500">Payment</dt>
                    <dd className="text-gray-200 font-mono">{order.payment_provider || '—'}</dd>
                    <dt className="text-gray-500">IP</dt>
                    <dd className="text-gray-200 font-mono">{order.ip || '—'}</dd>
                  </dl>
                </div>

                <div>
                  <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">Buyer settings</h3>
                  <pre className="text-[11px] leading-relaxed text-gray-300 bg-black/30 border border-white/5 rounded-lg p-3 overflow-x-auto max-h-64">
                    {JSON.stringify(order.params, null, 2)}
                  </pre>
                </div>

                {Object.keys(order.images).length > 0 && (
                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">Uploaded images</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(order.images).map(([key, url]) => (
                        <a key={key} href={url} target="_blank" rel="noopener" className="block p-2 rounded-lg border border-white/5" style={{ background: 'repeating-conic-gradient(#1b1b22 0 25%, #141419 0 50%) 0 0 / 12px 12px' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={key} className="max-h-16 max-w-[160px] object-contain" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {order.result?.timings && (
                  <p className="text-xs text-gray-500 font-mono">
                    Render: {Object.entries(order.result.timings).map(([k, v]) => `${k} ${(Number(v) / 1000).toFixed(1)}s`).join(' · ')}
                  </p>
                )}
              </div>
            </div>

            {order.render_log && (
              <div>
                <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">Render log</h3>
                <pre className="text-[11px] leading-relaxed text-gray-400 bg-black/40 border border-white/5 rounded-lg p-3 overflow-x-auto max-h-80 whitespace-pre-wrap">
                  {order.render_log}
                </pre>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
