'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';
import {
  getConsent,
  onConsentSettingsOpen,
  setConsent,
  type Consent,
  type ConsentChoice,
} from '@/lib/consent';

const CLIP = 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)';
const BTN_CLIP = 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)';

/**
 * First-visit consent card. Client-only (loaded with ssr:false by CookieConsentLoader), shown
 * after the page has settled so it never competes with the page's own content for LCP. Not
 * modal: no focus trap, no overlay, the page stays usable.
 */
export default function CookieConsent() {
  const [mounted, setMounted] = useState(false); // in the DOM
  const [visible, setVisible] = useState(false); // transitioned in
  const [current, setCurrent] = useState<Consent | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const reopenedRef = useRef(false);

  const show = useCallback((reopened: boolean) => {
    reopenedRef.current = reopened;
    setCurrent(getConsent());
    setMounted(true);
  }, []);

  // First visit: wait until the browser is idle, then slide in
  useEffect(() => {
    if (getConsent()) return;
    let idle: number | undefined;
    const timer = window.setTimeout(() => {
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
        .requestIdleCallback;
      if (ric) idle = ric(() => show(false), { timeout: 2000 });
      else show(false);
    }, 800);
    return () => {
      window.clearTimeout(timer);
      const cic = (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (idle !== undefined && cic) cic(idle);
    };
  }, [show]);

  // "Cookie settings" in the footer
  useEffect(
    () =>
      onConsentSettingsOpen(() => {
        const active = document.activeElement;
        returnFocusRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
        show(true);
      }),
    [show]
  );

  // Two frames so the initial (hidden) styles are painted before the transition starts
  useEffect(() => {
    if (!mounted) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setVisible(true));
    });
    if (reopenedRef.current) headingRef.current?.focus({ preventScroll: true });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [mounted]);

  const choose = (choice: ConsentChoice) => {
    setConsent(choice);
    setVisible(false);
    window.setTimeout(() => setMounted(false), 250);
    if (reopenedRef.current && returnFocusRef.current?.isConnected) {
      returnFocusRef.current.focus({ preventScroll: true });
    }
  };

  if (!mounted) return null;

  return (
    <section
      role="region"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-text"
      className={`fixed z-30 inset-x-4 sm:inset-x-auto sm:right-6 sm:w-[25rem] transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none motion-reduce:transform-none ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div
        className="relative bg-[#0b0b0d]/95 backdrop-blur-xl border border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        style={{ clipPath: CLIP }}
      >
        <div className="absolute top-0 left-3 right-0 h-px bg-gradient-to-r from-accent-red/60 via-accent-red/20 to-transparent" />

        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-2.5 mb-2.5">
            <span className="w-7 h-7 flex items-center justify-center text-accent-red bg-accent-red/10 border border-accent-red/20" style={{ clipPath: BTN_CLIP }}>
              <Cookie size={14} aria-hidden="true" />
            </span>
            <h2
              id="cookie-consent-title"
              ref={headingRef}
              tabIndex={-1}
              className="font-display font-bold text-white text-[15px] tracking-tight outline-none"
            >
              Your privacy
            </h2>
            <span className="ml-auto font-mono text-[9px] tracking-[0.25em] uppercase text-accent-red/50">Cookies</span>
          </div>

          <p id="cookie-consent-text" className="text-gray-400 text-[13px] leading-relaxed">
            We only use essential storage to run this site, like keeping your banner draft and this choice. No
            tracking, no ads. If we ever add analytics, it will run only if you accept.{' '}
            <Link
              href="/privacy#cookies"
              className="text-gray-200 underline decoration-accent-red/50 underline-offset-2 hover:text-white hover:decoration-accent-red transition-colors"
            >
              Privacy Policy
            </Link>
          </p>

          {current && (
            <p className="mt-2 text-[11px] font-mono tracking-wide text-gray-600">
              Current choice: {current.choice === 'all' ? 'Accept all' : 'Essential only'}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => choose('essential')}
              className="flex-1 px-3 py-2.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-gray-300 border border-white/10 hover:border-accent-red/40 hover:bg-accent-red/5 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-red"
              style={{ clipPath: BTN_CLIP }}
            >
              Essential only
            </button>
            <button
              type="button"
              onClick={() => choose('all')}
              className="flex-1 px-3 py-2.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-accent-red to-accent-red-dark hover:shadow-[0_0_24px_rgba(230,57,70,0.35)] transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              style={{ clipPath: BTN_CLIP }}
            >
              Accept all
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
