'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, AlertTriangle, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '@/lib/api';
import { formatFileSize, getApiError } from '@/lib/utils';
import type { AdminBannerOrderDetails, AdminBannerTemplate } from '@/types/banners';
import OrderStatusBadge from './OrderStatusBadge';

/**
 * "Test render": renders the template with its default texts and a sample logo through the
 * real pipeline (queue -> Chromium -> ffmpeg) and shows the result here.
 */
export default function TestRenderPanel({ template }: { template: AdminBannerTemplate }) {
  const [order, setOrder] = useState<AdminBannerOrderDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const poll = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async () => {
    try {
      const res = await adminApi.getLatestTestRender(template.id);
      setOrder(res.data || null);
    } catch {
      /* the panel just stays empty */
    }
  }, [template.id]);

  useEffect(() => {
    load();
    return () => clearTimeout(poll.current);
  }, [load]);

  useEffect(() => {
    clearTimeout(poll.current);
    if (order && (order.status === 'queued' || order.status === 'rendering')) {
      poll.current = setTimeout(load, 2500);
    }
  }, [order, load]);

  const start = async () => {
    setBusy(true);
    try {
      const res = await adminApi.testRenderBannerTemplate(template.id);
      setOrder(res.data);
    } catch (err) {
      toast.error(getApiError(err, 'Could not start the test render'));
    } finally {
      setBusy(false);
    }
  };

  const running = order?.status === 'queued' || order?.status === 'rendering';
  const disabled = busy || running || !template.has_media || template.config.zones.length === 0;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={start} disabled={disabled} className="btn-primary text-sm disabled:opacity-50">
          <Play size={14} /> {running ? 'Rendering…' : 'Test render'}
        </button>
        {order && <OrderStatusBadge status={order.status} />}
        {order?.created_at && (
          <span className="text-xs text-gray-500">{new Date(order.created_at).toLocaleString()}</span>
        )}
        {order?.result?.timings && (
          <span className="text-xs text-gray-500 font-mono">
            {Object.entries(order.result.timings).map(([k, v]) => `${k.replace('_ms', '')} ${(Number(v) / 1000).toFixed(1)}s`).join(' · ')}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Saved zones with their default texts and a sample logo, rendered exactly like a real order. Save the zones first.
      </p>

      {order?.status === 'failed' && order.error && (
        <div className="mt-4 text-sm text-red-300 bg-red-400/10 border border-red-400/20 rounded-lg p-3">
          <div className="flex gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span className="break-words min-w-0">{order.error}</span>
          </div>
          {order.render_log && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-red-200/80">Render log</summary>
              <pre className="mt-2 text-[11px] text-gray-400 whitespace-pre-wrap max-h-64 overflow-auto">{order.render_log}</pre>
            </details>
          )}
        </div>
      )}

      {order?.downloads?.mp4 && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4 items-start">
          <video
            key={order.downloads.mp4}
            src={order.downloads.mp4}
            controls
            autoPlay
            muted
            loop
            playsInline
            className="w-full max-h-[70vh] object-contain rounded-lg bg-black"
          />
          <div className="flex md:flex-col gap-2 text-sm">
            <a href={order.downloads.mp4} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center gap-1.5">
              <Download size={14} /> MP4 {order.result?.mp4_size ? formatFileSize(order.result.mp4_size) : ''}
            </a>
            {order.downloads.gif && (
              <a href={order.downloads.gif} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center gap-1.5">
                <Download size={14} /> GIF {order.result?.gif_size ? formatFileSize(order.result.gif_size) : ''}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
