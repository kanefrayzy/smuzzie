'use client';

import React, { useState } from 'react';
import { Check, Loader2, Mail, MessageCircle, Send, Sparkles } from 'lucide-react';
import { publicApi } from '@/lib/api';

// "Didn't find the right template?" block for the banner catalog: a custom banner offer,
// direct contacts and a short request form (POST /contact: stored, emailed to us, auto-reply).

const CONTACTS = [
  { icon: Send, label: 'Telegram', value: '@SmuzZie', href: 'https://t.me/SmuzZie', color: 'text-[#26A5E4]' },
  { icon: MessageCircle, label: 'Discord', value: 'Message us', href: 'https://discord.com/users/248866988347097089', color: 'text-[#5865F2]' },
  { icon: Mail, label: 'Email', value: 'smuzziedesign@gmail.com', href: 'mailto:smuzziedesign@gmail.com', color: 'text-accent-red' },
];

const POINTS = ['Animation designed for your brand', 'Any size: stories, feeds, web ads, streams', 'MP4, GIF or WebM, ready to publish'];

const input =
  'w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-accent-red/50 transition-colors';

export default function CustomBannerRequest() {
  const [form, setForm] = useState({ name: '', email: '', size: '', message: '', website: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setError('Please enter a valid email so we can reply.');
      return;
    }
    // Honeypot: bots fill every field; pretend it worked
    if (form.website) {
      setState('sent');
      return;
    }
    setState('sending');
    try {
      const details = form.size.trim() ? `Size / platform: ${form.size.trim()}\n\n` : '';
      await publicApi.submitContact({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: 'Custom banner request',
        message: `${details}${form.message.trim()}`,
      });
      setState('sent');
    } catch (err: any) {
      setState('idle');
      if (err?.response?.status === 429) setError('Too many requests. Please try again in a minute or write to us directly.');
      else if (err?.response?.status === 422) setError('Please fill in your name, email and a short description.');
      else setError('Could not send the request. Please try again or write to us directly.');
    }
  };

  return (
    <section aria-labelledby="custom-banner" className="mt-24 relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[linear-gradient(135deg,rgba(230,57,70,0.10),rgba(255,255,255,0.01)_45%)]">
      <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-accent-red/10 blur-[90px]" aria-hidden="true" />
      <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-10 p-6 sm:p-10">
        {/* Offer and contacts */}
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.25em] text-accent-red/80">
            <Sparkles size={12} /> Custom banner
          </span>
          <h2 id="custom-banner" className="text-2xl md:text-4xl font-display font-bold text-white mt-3">
            Didn&apos;t find the right template?
          </h2>
          <p className="text-gray-400 mt-4 leading-relaxed max-w-lg">
            Our designers will create an animated banner from scratch for your brand, campaign or stream. Tell us what you
            need and we&apos;ll reply with an idea, price and timing, usually within a day.
          </p>
          <ul className="mt-6 space-y-2.5">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-2.5 text-sm text-gray-300">
                <Check size={15} className="text-accent-red shrink-0" aria-hidden="true" /> {p}
              </li>
            ))}
          </ul>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {CONTACTS.map((c) => (
              <a
                key={c.label}
                href={c.href}
                target={c.href.startsWith('mailto:') ? undefined : '_blank'}
                rel={c.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                className={`flex items-center gap-3 rounded-xl border ${c.label === 'Email' ? 'sm:col-span-2' : ''} border-white/[0.07] bg-white/[0.02] px-3.5 py-3 hover:border-white/20 transition-colors min-w-0`}
              >
                <c.icon size={18} className={`${c.color} shrink-0`} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-[10px] font-mono uppercase tracking-wider text-gray-500">{c.label}</span>
                  <span className="block text-sm text-white truncate">{c.value}</span>
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* Request form */}
        <div className="rounded-xl border border-white/[0.07] bg-[#08080b]/80 p-5 sm:p-6">
          {state === 'sent' ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-10" role="status">
              <span className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mb-4">
                <Check size={22} className="text-emerald-400" />
              </span>
              <h3 className="text-white font-semibold text-lg">Request sent</h3>
              <p className="text-sm text-gray-400 mt-2 max-w-xs">
                Thanks! We&apos;ll reply to {form.email.trim()} within 1–2 business days. A copy of your message is in your inbox.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3.5" noValidate>
              <h3 className="text-white font-semibold">Request a custom banner</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="block">
                  <span className="block text-xs text-gray-400 mb-1.5">Your name</span>
                  <input className={input} value={form.name} onChange={set('name')} required maxLength={255} autoComplete="name" placeholder="Alex" />
                </label>
                <label className="block">
                  <span className="block text-xs text-gray-400 mb-1.5">Email</span>
                  <input className={input} type="email" value={form.email} onChange={set('email')} required maxLength={255} autoComplete="email" placeholder="you@example.com" />
                </label>
              </div>
              <label className="block">
                <span className="block text-xs text-gray-400 mb-1.5">Size or platform <span className="text-gray-600">(optional)</span></span>
                <input className={input} value={form.size} onChange={set('size')} maxLength={120} placeholder="e.g. 1080×1920 Instagram story, Twitch overlay" />
              </label>
              <label className="block">
                <span className="block text-xs text-gray-400 mb-1.5">What do you need?</span>
                <textarea
                  className={`${input} resize-none`}
                  rows={4}
                  value={form.message}
                  onChange={set('message')}
                  required
                  maxLength={4500}
                  placeholder="Your brand, the message, colors, examples you like, deadline…"
                />
              </label>
              {/* Honeypot, hidden from people */}
              <input type="text" name="website" value={form.website} onChange={set('website')} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              {error && (
                <p className="text-xs text-accent-red" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" disabled={state === 'sending' || !form.name.trim() || !form.message.trim()} className="btn-primary w-full justify-center disabled:opacity-50 disabled:hover:scale-100">
                {state === 'sending' ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
                {state === 'sending' ? 'Sending…' : 'Send request'}
              </button>
              <p className="text-[11px] text-gray-600 text-center">
                We only use your email to reply. See our <a href="/privacy" className="underline hover:text-gray-400">Privacy Policy</a>.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
