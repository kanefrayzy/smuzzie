'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, WifiOff } from 'lucide-react';
import { publicApi } from '@/lib/api';
import { exportParams } from '@/lib/banner-overlay';
import type { PaymentAvailability, PublicBannerTemplate } from '@/types/banners';
import { formatList, templateFormats } from '@/lib/banner-formats';
import type { EditorState } from './BannerEditor';
import { fieldInput } from './ui';

const EMAIL_KEY = 'banner-checkout-email';

function readEmail(): string {
  try {
    return window.localStorage.getItem(EMAIL_KEY) || '';
  } catch {
    return '';
  }
}

function rememberEmail(email: string): void {
  try {
    window.localStorage.setItem(EMAIL_KEY, email);
  } catch {
    /* storage unavailable */
  }
}

/** Turn the server's field paths ("params.zones.title.text") into a message the buyer understands. */
function describeErrors(errors: Record<string, string[]>, template: PublicBannerTemplate): string {
  const [path, messages] = Object.entries(errors)[0] || [];
  if (!path) return 'Please check your banner and try again.';
  const zoneKey = /^(?:params\.zones|images)\.([a-z0-9_]+)/.exec(path)?.[1];
  const zone = zoneKey ? template.config.zones.find((z) => z.key === zoneKey) : undefined;
  if (path === 'email') return 'Please enter a valid email address.';
  return zone ? `${zone.label}: ${messages[0]}` : messages[0];
}

/**
 * Checkout: email + order button. The order is created here; the buyer then pays in crypto
 * on the order page (/banners/order/<token>), which also resumes the payment after a reload.
 * Without a configured gateway (and without BANNERS_AUTO_APPROVE) ordering is switched off.
 */
export default function CheckoutPanel({ template, state }: { template: PublicBannerTemplate; state: EditorState }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [availability, setAvailability] = useState<PaymentAvailability | null>(null);

  useEffect(() => setEmail(readEmail()), []);
  useEffect(() => {
    let cancelled = false;
    publicApi
      .getPaymentAvailability()
      .then((res) => !cancelled && setAvailability(res.data))
      // Can't tell: let the order through, the order page explains if paying is impossible
      .catch(() => !cancelled && setAvailability(null));
    return () => {
      cancelled = true;
    };
  }, []);

  const autoApprove = !!availability?.auto_approve;
  const unavailable = !!availability && !availability.payments_available && !autoApprove;

  const price = Number(template.price);
  const formats = formatList(templateFormats(template));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (unavailable) return;
    setError('');
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Please enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      const data = new FormData();
      data.append('template', template.slug);
      data.append('email', value);
      data.append('params', JSON.stringify(exportParams(template.config, state.params)));
      for (const [key, img] of Object.entries(state.images)) {
        const blob = await (await fetch(img.dataUrl)).blob();
        data.append(`images[${key}]`, blob, img.name);
      }
      const res = await publicApi.createBannerOrder(data);
      rememberEmail(value);
      router.push(`/banners/order/${res.data.token}`);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429) setError('Too many orders from your network. Please try again a bit later.');
      else if (status === 422 && err.response.data?.errors) setError(describeErrors(err.response.data.errors, template));
      else setError('Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="border border-white/[0.08] bg-white/[0.02] rounded-lg p-4 space-y-3" noValidate>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-gray-500 font-mono">
          {formats} · {template.width}×{template.height}
        </span>
        {price > 0 && <span className="text-xl font-display font-bold text-white">${price.toFixed(price % 1 ? 2 : 0)}</span>}
      </div>
      <label className="block">
        <span className="block text-xs text-gray-400 mb-1.5">Email for the download link</span>
        <input
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={fieldInput}
          maxLength={254}
          required
        />
      </label>
      {error && (
        <p className="text-sm text-accent-red" role="alert">
          {error}
        </p>
      )}
      {unavailable && (
        <p className="text-sm text-gray-300 flex gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3" role="status">
          <WifiOff size={16} className="shrink-0 mt-0.5 text-gray-500" />
          <span>Payments are unavailable right now, so ordering is paused. Your design is saved in this browser; please come back later.</span>
        </p>
      )}
      <button
        type="submit"
        disabled={busy || unavailable}
        className="btn-primary w-full justify-center text-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <ShoppingBag size={16} /> {busy ? 'Placing the order…' : autoApprove ? 'Place order' : 'Continue to payment'}
      </button>
      <p className="text-xs text-gray-500">
        {autoApprove
          ? 'Test mode: orders skip payment and go straight to the render.'
          : 'Next you pay in crypto (USDT, USDC, BTC, ETH and more) right on the order page. After the payment is confirmed we render your files without the watermark and email you a download link.'}
      </p>
    </form>
  );
}
