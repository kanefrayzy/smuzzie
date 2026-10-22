'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { publicApi } from '@/lib/api';
import type { PublicBannerTemplate } from '@/types/banners';
import BannerEditor from '@/components/banners/editor/BannerEditor';

export default function BannerEditorPage() {
  const { slug } = useParams<{ slug: string }>();
  const [template, setTemplate] = useState<PublicBannerTemplate | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');

  useEffect(() => {
    publicApi
      .getBannerTemplate(slug)
      .then((res) => {
        setTemplate(res.data);
        setState('ready');
      })
      .catch((err) => setState(err?.response?.status === 404 ? 'missing' : 'error'));
  }, [slug]);

  return (
    <div className="pt-24 pb-20 relative min-h-screen">
      <div className="absolute inset-0 bg-[#060608]" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/banners" className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-gray-500 hover:text-white my-6">
          <ArrowLeft size={14} /> All templates
        </Link>

        {state === 'loading' && (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border border-accent-red/30 border-t-accent-red animate-spin" />
          </div>
        )}
        {state === 'missing' && <p className="text-center text-gray-400 py-24">This template doesn&apos;t exist or is no longer available.</p>}
        {state === 'error' && <p className="text-center text-gray-400 py-24">Could not load the template. Please try again later.</p>}
        {state === 'ready' && template && <BannerEditor template={template} />}
      </div>
    </div>
  );
}
