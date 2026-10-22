'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Clock, Loader2, RefreshCw } from 'lucide-react';
import type { PublicBannerPayment } from '@/types/banners';
import CryptoIcon from './CryptoIcon';
import CopyField from './CopyField';
import QrCode from './QrCode';

/** Seconds left in the price lock, ticking; `offset` corrects the browser clock to the server's. */
function useSecondsLeft(expiresAt: string | null, offset: number): number | null {
  const calc = () => (expiresAt ? Math.max(0, Math.floor((Date.parse(expiresAt) - (Date.now() + offset)) / 1000)) : null);
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    if (!expiresAt) return;
    const t = setInterval(() => setLeft(calc()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- calc only reads these two
  }, [expiresAt, offset]);
  return left;
}

function mmss(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function StatusLine({ payment }: { payment: PublicBannerPayment }) {
  const box = 'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm';
  switch (payment.status) {
    case 'paid':
      return (
        <div className={`${box} border-emerald-400/30 bg-emerald-400/10 text-emerald-200`}>
          <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          <span>Payment confirmed. Your banner is going to the render queue.</span>
        </div>
      );
    case 'confirming':
      return (
        <div className={`${box} border-sky-400/30 bg-sky-400/10 text-sky-100`}>
          <Loader2 size={16} className="shrink-0 mt-0.5 animate-spin" />
          <span>
            Payment detected{Number(payment.pending) > 0 ? ` (${payment.pending} ${payment.coin})` : ''}. Waiting for network
            confirmations{payment.confirmations > 0 ? `: ${payment.confirmations} so far` : ''}. This can take a few minutes.
          </span>
        </div>
      );
    case 'underpaid':
      return (
        <div className={`${box} border-amber-400/30 bg-amber-400/10 text-amber-100`}>
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            We received {payment.received} of {payment.amount} {payment.coin}. Send the remaining{' '}
            <strong className="font-mono">{payment.remaining} {payment.coin}</strong> to the same address.
          </span>
        </div>
      );
    case 'review':
      return (
        <div className={`${box} border-amber-400/30 bg-amber-400/10 text-amber-100`}>
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            Your payment arrived after the price lock ended and is now worth less than the price. We will check it by hand and
            contact you by email. Please don&apos;t send more.
          </span>
        </div>
      );
    default:
      return (
        <div className={`${box} border-white/[0.08] bg-white/[0.02] text-gray-300`}>
          <span className="relative flex h-2.5 w-2.5 mt-1.5 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent-red opacity-60 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-red" />
          </span>
          <span>Waiting for your payment. This page updates by itself as soon as it arrives.</span>
        </div>
      );
  }
}

/**
 * Deposit details for the chosen coin. Everything to type is copyable; the QR holds the
 * address only (wallets disagree on payment URIs for tokens).
 */
export default function PaymentDetails({
  payment, clockOffset, onChangeMethod, onRefreshQuote, refreshing,
}: {
  payment: PublicBannerPayment;
  clockOffset: number;
  onChangeMethod: () => void;
  onRefreshQuote: () => void;
  refreshing: boolean;
}) {
  const left = useSecondsLeft(payment.status === 'awaiting' ? payment.expires_at : null, clockOffset);
  const expired = payment.expired || (payment.status === 'awaiting' && left === 0);
  const open = payment.status === 'awaiting' || payment.status === 'underpaid' || payment.status === 'confirming';
  const sendAmount = payment.status === 'underpaid' ? payment.remaining : payment.amount;
  const network = `${payment.coin} on ${payment.network_name}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="relative shrink-0">
          <CryptoIcon name={payment.icon} label={payment.coin} size={40} />
          {payment.network_icon && (
            <span className="absolute -bottom-1 -right-1 rounded-full ring-2 ring-[#0b0b0d]">
              <CryptoIcon name={payment.network_icon} kind="network" label={payment.network} size={18} />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-white font-semibold leading-tight">
            {payment.coin_name} <span className="text-gray-400 font-normal">({payment.coin})</span>
          </p>
          <p className="text-xs text-gray-500">Network: {payment.network_name} · ${payment.amount_usd}</p>
        </div>
        {payment.status !== 'paid' && (
          <button
            type="button"
            onClick={onChangeMethod}
            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-white/[0.08] text-xs text-gray-300 hover:text-white hover:border-white/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
          >
            <ArrowLeftRight size={14} /> Change
          </button>
        )}
      </div>

      <div role="status" aria-live="polite">
        {/* After the lock ends the footer asks for a new quote instead */}
        {!expired && <StatusLine payment={payment} />}
      </div>

      {open && !expired && (
        <>
          <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
            {/* Phones: what to type first (the wallet is usually on the same phone), QR below */}
            <div className="flex-1 min-w-0 space-y-4">
              <CopyField label={payment.status === 'underpaid' ? 'Amount still to send' : 'Amount to send'} value={sendAmount} suffix={payment.coin} large />
              <CopyField label={`${payment.coin} address (${payment.network_name})`} value={payment.address} />
              {payment.dest_tag && <CopyField label="Destination tag / memo (required)" value={payment.dest_tag} highlight />}
            </div>
            <div className="self-center sm:self-start">
              <QrCode value={payment.address} label={`QR code of the ${payment.coin} address`} size={168} />
            </div>
          </div>

          <ul className="text-xs text-gray-400 space-y-1.5 list-disc pl-4 marker:text-accent-red/70">
            <li>
              Send only <strong className="text-gray-200">{network}</strong> to this address. Other coins or networks will be lost.
            </li>
            {payment.dest_tag && (
              <li className="text-amber-200">Enter the destination tag / memo exactly, or the payment cannot be matched to your order.</li>
            )}
            <li>
              The amount that arrives must be at least {sendAmount} {payment.coin}. If your exchange takes a withdrawal fee from it,
              add the fee on top.
            </li>
          </ul>
        </>
      )}

      {payment.status === 'awaiting' && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
          {expired ? (
            <>
              <p className="text-sm text-gray-300 flex items-center gap-2">
                <Clock size={14} className="text-amber-300" /> The price lock has ended. Get a fresh quote before paying.
              </p>
              <button type="button" onClick={onRefreshQuote} disabled={refreshing} className="btn-primary text-sm disabled:opacity-60">
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'Updating…' : 'Get a new quote'}
              </button>
            </>
          ) : (
            left !== null && (
              <p className="text-xs text-gray-400 flex items-center gap-2">
                <Clock size={13} />
                <span>
                  Price locked for <span className="font-mono tabular-nums text-white" aria-hidden="true">{mmss(left)}</span>
                  <span className="sr-only">{Math.ceil(left / 60)} more minutes</span>
                </span>
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
