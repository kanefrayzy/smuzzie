'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { publicApi } from '@/lib/api';
import { exportParams } from '@/lib/banner-overlay';
import type { PublicBannerTemplate } from '@/types/banners';
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
 * Checkout: email + order button. Payment isn't connected yet, so the order waits for a
 * manual confirmation; the endpoint and the order page are already the final ones.
 */
export default function CheckoutPanel({ template, state }: { template: PublicBannerTemplate; state: EditorState }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setEmail(readEmail()), []);

  const price = Number(template.price);
  const formats = template.outputs.gif.enabled ? 'MP4 + GIF' : 'MP4';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      <button type="submit" disabled={busy} className="btn-primary w-full justify-center text-sm disabled:opacity-60">
        <ShoppingBag size={16} /> {busy ? 'Placing the order…' : 'Place order'}
      </button>
      <p className="text-xs text-gray-500">
        After the payment is confirmed we render your files without the watermark and email you a download link.
      </p>
    </form>
  );
}
