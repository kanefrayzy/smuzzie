'use client';

import React, { useEffect, useState } from 'react';
import { publicApi } from '@/lib/api';
import type { PublicBannerTemplate } from '@/types/banners';
import BannerEditor from '@/components/banners/editor/BannerEditor';
import CheckoutPanel from '@/components/banners/editor/CheckoutPanel';

/**
 * The interactive editor. Gets the template from the server render; only if the server
 * couldn't reach the API does it load the template itself.
 */
export default function BannerTemplateClient({ slug, initial }: { slug: string; initial: PublicBannerTemplate | null }) {
  const [template, setTemplate] = useState<PublicBannerTemplate | null>(initial);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>(initial ? 'ready' : 'loading');

  useEffect(() => {
    if (initial) return;
    publicApi
      .getBannerTemplate(slug)
      .then((res) => {
        setTemplate(res.data);
        setState('ready');
      })
      .catch((err) => setState(err?.response?.status === 404 ? 'missing' : 'error'));
  }, [slug, initial]);

  if (state === 'loading') {
    return (
      <div className="flex justify-center py-24">
        <div className="w-10 h-10 border border-accent-red/30 border-t-accent-red animate-spin" />
      </div>
    );
  }
  if (state === 'missing') return <p className="text-center text-gray-400 py-24">This template doesn&apos;t exist or is no longer available.</p>;
  if (state === 'error' || !template) return <p className="text-center text-gray-400 py-24">Could not load the template. Please try again later.</p>;

  return <BannerEditor template={template} footer={(editorState) => <CheckoutPanel template={template} state={editorState} />} />;
}
