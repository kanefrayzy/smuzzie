'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import type { AdminBannerOrder, BannerOrderStatus } from '@/types/banners';
import { Search, ShoppingBag, ChevronLeft, ChevronRight, FlaskConical } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import OrderStatusBadge, { ORDER_STATUS_LABELS } from '@/components/admin/banners/OrderStatusBadge';
import OrderDetails from '@/components/admin/banners/OrderDetails';

const TABS: (BannerOrderStatus | 'all')[] = ['all', 'pending_payment', 'queued', 'rendering', 'ready', 'failed'];

interface Page {
  data: AdminBannerOrder[];
  current_page: number;
  last_page: number;
  total: number;
}

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

export default function AdminBannerOrdersPage() {
  const [tab, setTab] = useState<BannerOrderStatus | 'all'>('all');
  const [includeTests, setIncludeTests] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [openId, setOpenId] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchOrders = useCallback(async () => {
    try {
      const res = await adminApi.getBannerOrders({
        status: tab === 'all' ? undefined : tab,
        include_tests: includeTests ? 1 : undefined,
        search: query || undefined,
        page,
      });
      setData(res.data.orders);
      setCounts(res.data.counts || {});
    } catch (err) {
      toast.error(getApiError(err, 'Failed to load orders'));
    }
  }, [tab, includeTests, query, page]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Keep the list fresh while something is being rendered
  useEffect(() => {
    clearTimeout(pollRef.current);
    if (data?.data.some((o) => o.status === 'queued' || o.status === 'rendering')) {
      pollRef.current = setTimeout(fetchOrders, 5000);
    }
    return () => clearTimeout(pollRef.current);
  }, [data, fetchOrders]);

  const total = Object.values(counts).reduce((a, b) => a + Number(b), 0);

  return (
    <div>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid rgba(255,255,255,0.05)' } }} />

      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-white">Banner orders</h1>
        <p className="text-gray-500 text-sm mt-1">Payments aren&apos;t connected yet: confirm the payment by hand to start the render.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              tab === t ? 'border-accent-red/50 bg-accent-red/10 text-white' : 'border-white/5 text-gray-400 hover:text-white'
            }`}
          >
            {t === 'all' ? 'All' : ORDER_STATUS_LABELS[t]}
            <span className="ml-1.5 text-gray-500">{t === 'all' ? total : counts[t] || 0}</span>
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-xs text-gray-400 ml-2">
          <input type="checkbox" checked={includeTests} onChange={(e) => setIncludeTests(e.target.checked)} />
          Test renders
        </label>
        <form
          className="ml-auto relative"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(search.trim());
          }}
        >
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Email or order #"
            className="bg-surface border border-white/5 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-red/50 w-56"
          />
        </form>
      </div>

      <div className="glass-card border border-white/5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-white/5">
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Template</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((o) => (
              <tr key={o.id} onClick={() => setOpenId(o.id)} className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer">
                <td className="px-4 py-3 font-mono text-xs text-gray-300">
                  #{o.token.slice(0, 8)}
                  {o.is_test && <FlaskConical size={12} className="inline ml-1.5 text-sky-300" aria-label="Test render" />}
                </td>
                <td className="px-4 py-3 text-white">{o.template.name}</td>
                <td className="px-4 py-3 text-gray-300">{o.email || '—'}</td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={o.status} />
                  {o.result_purged_at && <span className="ml-1.5 text-[10px] text-gray-500">files removed</span>}
                </td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{when(o.created_at)}</td>
                <td className="px-4 py-3 text-right text-gray-300 font-mono">
                  {o.amount} {o.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.data.length === 0 && (
          <div className="text-center py-14 text-gray-400">
            <ShoppingBag size={36} className="mx-auto mb-3 text-accent-red/60" />
            No orders here.
          </div>
        )}
        {!data && (
          <div className="flex justify-center py-14">
            <div className="w-8 h-8 border-2 border-accent-red/30 border-t-accent-red rounded-full animate-spin" />
          </div>
        )}
      </div>

      {data && data.last_page > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4 text-sm text-gray-400">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-2 disabled:opacity-30" aria-label="Previous page">
            <ChevronLeft size={16} />
          </button>
          {data.current_page} / {data.last_page}
          <button disabled={page >= data.last_page} onClick={() => setPage(page + 1)} className="p-2 disabled:opacity-30" aria-label="Next page">
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {openId !== null && (
        <OrderDetails
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={fetchOrders}
        />
      )}
    </div>
  );
}
