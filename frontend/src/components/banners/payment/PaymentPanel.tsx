'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Lock, RefreshCw, WifiOff } from 'lucide-react';
import { publicApi } from '@/lib/api';
import type { PaymentMethodsResponse, PublicBannerOrder, PublicBannerPayment } from '@/types/banners';
import CoinPicker from './CoinPicker';
import PaymentDetails from './PaymentDetails';

function errorMessage(err: any): string {
  const status = err?.response?.status;
  if (status === 429) return 'Too many attempts. Please wait a minute and try again.';
  return err?.response?.data?.error || 'Something went wrong. Please try again.';
}

/**
 * Crypto payment on the order page, no redirect: coin/network picker, then the deposit
 * details. The order page polls the order; its `payment` field keeps this up to date and
 * brings the same state back after a reload.
 */
export default function PaymentPanel({
  order, clockOffset, onPayment,
}: {
  order: PublicBannerOrder;
  clockOffset: number;
  /** A payment was chosen or re-quoted: merge it into the order state */
  onPayment: (payment: PublicBannerPayment, serverTime?: string) => void;
}) {
  const payment = order.payment;
  const [picking, setPicking] = useState(!payment);
  const [methods, setMethods] = useState<PaymentMethodsResponse | null>(null);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadMethods = useCallback(async () => {
    setLoadingMethods(true);
    setError('');
    try {
      const res = await publicApi.getPaymentMethods(order.token);
      setMethods(res.data);
    } catch {
      setMethods({ available: false, reason: 'unavailable', methods: [] });
    } finally {
      setLoadingMethods(false);
    }
  }, [order.token]);

  const showPicker = picking || !payment;
  useEffect(() => {
    if (showPicker && !methods && !loadingMethods) loadMethods();
  }, [showPicker, methods, loadingMethods, loadMethods]);

  const choose = async (key: string) => {
    setBusyKey(key);
    setError('');
    try {
      const res = await publicApi.selectPaymentMethod(order.token, key);
      const { server_time: serverTime, ...data } = res.data;
      onPayment(data as PublicBannerPayment, serverTime);
      setPicking(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section className="mt-8 pt-6 border-t border-white/[0.06]" aria-labelledby="payment-title">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 id="payment-title" className="text-lg font-display font-semibold text-white">
          Pay with crypto
        </h2>
        {showPicker && payment && (
          <button
            type="button"
            onClick={() => setPicking(false)}
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60 rounded"
          >
            <ArrowLeft size={14} /> Back to {payment.coin} ({payment.network})
          </button>
        )}
      </div>

      {showPicker ? (
        loadingMethods && !methods ? (
          <div className="flex justify-center py-10" role="status" aria-label="Loading payment methods">
            <div className="w-8 h-8 border border-accent-red/30 border-t-accent-red animate-spin" />
          </div>
        ) : methods && methods.available ? (
          <CoinPicker methods={methods.methods} onPick={choose} busyKey={busyKey} initialCoin={payment?.coin} />
        ) : (
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 text-sm text-gray-300 flex gap-3">
            <WifiOff size={18} className="shrink-0 text-gray-500 mt-0.5" />
            <div className="space-y-3">
              <p>
                {methods?.reason === 'not_configured'
                  ? 'Online payments are not available yet. Your order is saved. Please contact us to pay, or come back to this page later.'
                  : 'Crypto payments are temporarily unavailable. Your order is saved; please try again in a few minutes.'}
              </p>
              {methods?.reason !== 'not_configured' && (
                <button
                  type="button"
                  onClick={loadMethods}
                  className="inline-flex items-center gap-1.5 text-xs text-white border border-white/15 hover:border-accent-red/50 rounded-lg px-3 py-2"
                >
                  <RefreshCw size={13} /> Try again
                </button>
              )}
            </div>
          </div>
        )
      ) : (
        payment && (
          <PaymentDetails
            payment={payment}
            clockOffset={clockOffset}
            onChangeMethod={() => setPicking(true)}
            onRefreshQuote={() => choose(payment.method)}
            refreshing={busyKey === payment.method}
          />
        )
      )}

      {error && (
        <p className="text-sm text-accent-red mt-4" role="alert">
          {error}
        </p>
      )}

      <p className="text-[11px] text-gray-500 mt-5 flex items-center gap-1.5">
        <Lock size={11} /> Processed by WestWallet. We never see your wallet keys.
      </p>
    </section>
  );
}
