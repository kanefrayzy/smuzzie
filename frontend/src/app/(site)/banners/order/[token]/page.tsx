'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Check, Download, Loader2, AlertTriangle, Clock } from 'lucide-react';
import { publicApi } from '@/lib/api';
import type { BannerOrderStatus, PublicBannerOrder } from '@/types/banners';

const STEPS: { key: string; label: string; done: (s: BannerOrderStatus) => boolean; active: (s: BannerOrderStatus) => boolean }[] = [
  { key: 'placed', label: 'Order placed', done: () => true, active: () => false },
  { key: 'paid', label: 'Payment confirmed', done: (s) => s !== 'pending_payment', active: (s) => s === 'pending_payment' },
  { key: 'render', label: 'Rendering', done: (s) => s === 'ready', active: (s) => s === 'queued' || s === 'rendering' },
  { key: 'ready', label: 'Ready to download', done: (s) => s === 'ready', active: () => false },
];

const MESSAGES: Record<BannerOrderStatus, string> = {
  pending_payment: 'We received your order and are waiting for the payment confirmation. This page updates by itself.',
  queued: 'Payment confirmed. Your banner is in the render queue.',
  rendering: 'Your banner is being rendered right now. It usually takes under a minute.',
  ready: 'Your banner is ready. The links below are personal; we also emailed you this page.',
  failed: 'Something went wrong while rendering. We have been notified and will fix it; you don’t need to order again.',
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function BannerOrderPage() {
  const { token } = useParams<{ token: string }>();
  const [order, setOrder] = useState<PublicBannerOrder | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async () => {
    try {
      const res = await publicApi.getBannerOrder(token);
      setOrder(res.data);
      setState('ok');
      return res.data as PublicBannerOrder;
    } catch (err: any) {
      if (err?.response?.status === 404) setState('missing');
      else setState((s) => (s === 'ok' ? s : 'error'));
      return null;
    }
  }, [token]);

  // Poll until the order is finished; slower while the tab is hidden
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      const o = await load();
      if (stopped || (o && (o.status === 'ready' || o.status === 'failed'))) return;
      timer.current = setTimeout(tick, document.hidden ? 15000 : 4000);
    };
    tick();
    const onVisible = () => {
      if (!document.hidden) {
        clearTimeout(timer.current);
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  return (
    <div className="pt-24 pb-20 relative min-h-screen">
      <div className="absolute inset-0 bg-[#060608]" />
      <div className="absolute inset-0 bg-grid-pattern" />
      <div className="relative max-w-xl mx-auto px-4 sm:px-6 py-14">
        {state === 'loading' && (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border border-accent-red/30 border-t-accent-red animate-spin" />
          </div>
        )}
        {state === 'missing' && <p className="text-center text-gray-400 py-24">Order not found. Please check the link.</p>}
        {state === 'error' && <p className="text-center text-gray-400 py-24">Could not load the order. Please refresh the page.</p>}

        {state === 'ok' && order && (
          <div
            className="border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8"
            style={{ clipPath: 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)' }}
          >
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent-red/70">Banner order</p>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white mt-2">{order.template.name}</h1>
            <p className="text-xs font-mono text-gray-500 mt-2">
              #{order.token.slice(0, 8)} · {formatDate(order.created_at)}
              {order.email ? ` · ${order.email}` : ''}
            </p>

            {/* Steps */}
            <ol className="mt-8 space-y-3" aria-label="Order progress">
              {STEPS.map((step) => {
                const failed = order.status === 'failed' && step.key === 'render';
                const done = step.done(order.status);
                const active = step.active(order.status);
                return (
                  <li key={step.key} className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${
                        failed
                          ? 'border-red-400/50 bg-red-400/10 text-red-300'
                          : done
                            ? 'border-accent-red/50 bg-accent-red/15 text-accent-red'
                            : active
                              ? 'border-white/20 text-white'
                              : 'border-white/[0.08] text-gray-600'
                      }`}
                    >
                      {failed ? <AlertTriangle size={13} /> : done ? <Check size={14} /> : active ? <Loader2 size={13} className="animate-spin" /> : <Clock size={12} />}
                    </span>
                    <span className={`text-sm ${done || active || failed ? 'text-white' : 'text-gray-500'}`}>{step.label}</span>
                  </li>
                );
              })}
            </ol>

            <p className="text-sm text-gray-400 mt-6" role="status" aria-live="polite">
              {order.files_expired
                ? 'The download period for this order has ended. Contact us and we will render the files again.'
                : MESSAGES[order.status]}
            </p>

            {order.downloads && (
              <div className="flex flex-wrap gap-3 mt-6">
                {order.downloads.mp4 && (
                  <a href={order.downloads.mp4} className="btn-primary text-sm" download>
                    <Download size={16} /> Download MP4
                  </a>
                )}
                {order.downloads.gif && (
                  <a
                    href={order.downloads.gif}
                    download
                    className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white border border-white/15 hover:border-accent-red/50 transition-colors"
                  >
                    <Download size={16} /> Download GIF
                  </a>
                )}
              </div>
            )}
            {order.files_expire_at && !order.files_expired && (
              <p className="text-xs text-gray-500 mt-3">Files are kept until {formatDate(order.files_expire_at)}.</p>
            )}

            <div className="mt-8 pt-6 border-t border-white/[0.06] text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-2">
              <span>Bookmark this page: it is the only link to your order.</span>
              {order.template.slug && (
                <Link href={`/banners/${order.template.slug}`} className="text-gray-400 hover:text-white">
                  Make another one →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
