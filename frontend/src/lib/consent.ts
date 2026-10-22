// Cookie / storage consent. The site itself only uses essential storage; this records the
// visitor's choice so that anything optional (analytics, if it is ever added) can be gated:
//
//   if (hasAnalyticsConsent()) loadAnalytics();
//   onConsentChange((c) => { if (c?.analytics) loadAnalytics(); });
//
// The choice lives in localStorage and in a first-party cookie (`smz_consent`) so the server
// could read it too. Bump CONSENT_VERSION when the categories change: older choices are then
// ignored and the banner asks again.

import { useEffect, useState } from 'react';

export const CONSENT_VERSION = 1;
export const CONSENT_KEY = 'smz_consent';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

const CHANGE_EVENT = 'smz:consent-change';
const OPEN_EVENT = 'smz:consent-open';

export type ConsentChoice = 'all' | 'essential';

export interface Consent {
  version: number;
  choice: ConsentChoice;
  /** Optional analytics allowed. Essential storage never needs consent. */
  analytics: boolean;
  /** ISO timestamp of when the choice was made. */
  date: string;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function build(choice: ConsentChoice, date: string): Consent {
  return { version: CONSENT_VERSION, choice, analytics: choice === 'all', date };
}

function parseStored(raw: string | null): Consent | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Consent>;
    if (v.version !== CONSENT_VERSION || (v.choice !== 'all' && v.choice !== 'essential')) return null;
    return build(v.choice, typeof v.date === 'string' ? v.date : new Date(0).toISOString());
  } catch {
    return null;
  }
}

// Cookie format: "<version>.<choice>.<unix ms>", e.g. "1.essential.1792656000000"
function cookieValue(c: Consent): string {
  return `${c.version}.${c.choice}.${Date.parse(c.date) || 0}`;
}

function parseCookie(): Consent | null {
  try {
    const match = document.cookie.split('; ').find((p) => p.startsWith(`${CONSENT_KEY}=`));
    if (!match) return null;
    const [version, choice, ts] = decodeURIComponent(match.slice(CONSENT_KEY.length + 1)).split('.');
    if (Number(version) !== CONSENT_VERSION || (choice !== 'all' && choice !== 'essential')) return null;
    return build(choice, new Date(Number(ts) || 0).toISOString());
  } catch {
    return null;
  }
}

/** The stored choice for the current version, or null when the visitor hasn't chosen yet. */
export function getConsent(): Consent | null {
  if (!isBrowser()) return null;
  let stored: Consent | null = null;
  try {
    stored = parseStored(window.localStorage.getItem(CONSENT_KEY));
  } catch {
    /* storage unavailable (private mode, blocked) */
  }
  return stored ?? parseCookie();
}

export function hasAnalyticsConsent(): boolean {
  return getConsent()?.analytics === true;
}

/** Save the choice (localStorage + cookie) and notify listeners in this tab. */
export function setConsent(choice: ConsentChoice): Consent {
  const consent = build(choice, new Date().toISOString());
  if (!isBrowser()) return consent;

  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  } catch {
    /* storage unavailable: the cookie below still remembers the choice */
  }
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie =
      `${CONSENT_KEY}=${encodeURIComponent(cookieValue(consent))}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  } catch {
    /* cookies disabled */
  }

  window.dispatchEvent(new CustomEvent<Consent>(CHANGE_EVENT, { detail: consent }));
  return consent;
}

/**
 * Subscribe to consent changes, including ones made in other tabs. Returns an unsubscribe function.
 */
export function onConsentChange(callback: (consent: Consent | null) => void): () => void {
  if (!isBrowser()) return () => {};
  const onChange = (e: Event) => callback((e as CustomEvent<Consent>).detail ?? getConsent());
  const onStorage = (e: StorageEvent) => {
    if (e.key === CONSENT_KEY) callback(getConsent());
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * Current consent in a client component: `undefined` until mounted (never read during SSR, so
 * no hydration mismatch), then the stored choice or `null`, updated on every change.
 */
export function useConsent(): Consent | null | undefined {
  const [consent, setState] = useState<Consent | null | undefined>(undefined);
  useEffect(() => {
    setState(getConsent());
    return onConsentChange(setState);
  }, []);
  return consent;
}

// "Cookie settings" (Footer) reopens the banner. The banner is loaded lazily, so a request made
// before it has mounted is remembered and picked up on mount.
let openRequested = false;

export function openConsentSettings(): void {
  if (!isBrowser()) return;
  openRequested = true;
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onConsentSettingsOpen(callback: () => void): () => void {
  if (!isBrowser()) return () => {};
  const handler = () => {
    openRequested = false;
    callback();
  };
  window.addEventListener(OPEN_EVENT, handler);
  if (openRequested) handler();
  return () => window.removeEventListener(OPEN_EVENT, handler);
}
