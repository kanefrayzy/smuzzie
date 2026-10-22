'use client';

import dynamic from 'next/dynamic';

// Separate chunk, never rendered on the server: no hydration mismatch and nothing in the
// server HTML that could affect SEO or LCP.
const CookieConsent = dynamic(() => import('./CookieConsent'), { ssr: false });

export default function CookieConsentLoader() {
  return <CookieConsent />;
}
