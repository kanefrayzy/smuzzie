'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { AdminBannerPayment, BannerPaymentStatus } from '@/types/banners';
import CryptoIcon from '@/components/banners/payment/CryptoIcon';

const STATUS: Record<BannerPaymentStatus, { label: string; cls: string }> = {
  awaiting: { label: 'Awaiting', cls: 'bg-white/10 text-gray-300' },
  confirming: { label: 'Confirming', cls: 'bg-sky-400/10 text-sky-300' },
  underpaid: { label: 'Underpaid', cls: 'bg-amber-400/10 text-amber-300' },
  paid: { label: 'Paid', cls: 'bg-emerald-400/10 text-emerald-300' },
  review: { label: 'Needs review', cls: 'bg-red-400/10 text-red-300' },
};

const REVIEW: Record<string, string> = {
  late: 'Arrived after the price lock (late policy: review).',
  late_short: 'Arrived after the price lock and is worth less than the price at the current rate.',
};

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' }) : '—';
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-200 font-mono break-all min-w-0">{children}</dd>
    </>
  );
}

/** Crypto payments of an order (one per coin the buyer opened), with their transactions. */
export default function PaymentInfo({ payments }: { payments: AdminBannerPayment[] }) {
  if (!payments.length) return null;

  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">Crypto payments</h3>
      <div className="space-y-3">
        {payments.map((p) => (
          <div key={p.id} className="rounded-lg border border-white/[0.06] bg-black/20 p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <CryptoIcon name={p.icon} label={p.coin} size={20} />
              <span className="text-sm text-white font-semibold">
                {p.coin} <span className="text-gray-400 font-normal">· {p.network_name}</span>
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS[p.status]?.cls || ''}`}>{STATUS[p.status]?.label || p.status}</span>
              <span className="text-[10px] text-gray-500 ml-auto">{p.provider}</span>
            </div>

            {(p.review_reason || p.overpaid || p.order_already_paid) && (
              <div className="text-xs text-amber-200 bg-amber-400/10 border border-amber-400/20 rounded-md p-2 flex gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span className="space-y-0.5">
                  {p.review_reason && (
                    <span className="block">
                      {REVIEW[p.review_reason] || p.review_reason}
                      {p.late_value_usd !== null && ` Worth $${p.late_value_usd} now.`} Confirm by hand or refund.
                    </span>
                  )}
                  {p.overpaid && <span className="block">Overpaid by {p.overpaid} {p.coin}.</span>}
                  {p.order_already_paid && <span className="block">The order was already paid when this completed: check for a double payment.</span>}
                </span>
              </div>
            )}

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
              <Row label="Expected">
                {p.amount} {p.coin} (${p.amount_usd} at {p.rate})
              </Row>
              <Row label="Received">
                {p.received} {p.coin}
                {Number(p.pending) > 0 ? ` + ${p.pending} pending` : ''}
              </Row>
              <Row label="Address">{p.address}</Row>
              {p.dest_tag && <Row label="Tag / memo">{p.dest_tag}</Row>}
              <Row label="Ticker / label">
                {p.currency} / {p.label}
              </Row>
              <Row label="Quoted">{when(p.quoted_at)}</Row>
              <Row label="Lock until">{when(p.expires_at)}</Row>
              <Row label="Detected">{when(p.detected_at)}</Row>
              <Row label="Paid">{when(p.paid_at)}</Row>
              <Row label="Last sync">{when(p.last_checked_at)}</Row>
            </dl>

            {p.transactions.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] font-mono">
                  <thead>
                    <tr className="text-gray-500 text-left">
                      <th className="font-normal pr-3 py-1">Tx id</th>
                      <th className="font-normal pr-3 py-1">Amount</th>
                      <th className="font-normal pr-3 py-1">Status</th>
                      <th className="font-normal pr-3 py-1">Conf.</th>
                      <th className="font-normal py-1">Hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.transactions.map((t) => (
                      <tr key={t.provider_id} className="text-gray-300 border-t border-white/[0.04] align-top">
                        <td className="pr-3 py-1">{t.provider_id}</td>
                        <td className="pr-3 py-1 whitespace-nowrap">
                          {t.amount} {t.currency}
                        </td>
                        <td className="pr-3 py-1">{t.provider_status || t.status}</td>
                        <td className="pr-3 py-1">{t.confirmations}</td>
                        <td className="py-1 break-all">{t.hash || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
