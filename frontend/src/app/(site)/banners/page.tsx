'use client';

import React, { useEffect, useState } from 'react';
import { publicApi } from '@/lib/api';
import type { PublicBannerTemplateCard } from '@/types/banners';
import BannerCard from '@/components/banners/BannerCard';
import { Film } from 'lucide-react';

export default function BannersCatalogPage() {
  const [templates, setTemplates] = useState<PublicBannerTemplateCard[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    publicApi
      .getBannerTemplates()
      .then((res) => setTemplates(res.data))
      .catch(() => setError(true));
  }, []);

  return (
    <div className="pt-24 pb-20 relative min-h-screen">
      <div className="absolute inset-0 bg-[#060608]" />
      <div className="absolute inset-0 bg-grid-pattern" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center py-14">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px w-8 bg-accent-red/40" />
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent-red/60">Banner builder</span>
            <div className="h-px w-8 bg-accent-red/40" />
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-black tracking-tight">
            Animated <span className="text-gradient">banners</span>
          </h1>
          <p className="text-gray-500 text-base md:text-lg mt-5 max-w-2xl mx-auto">
            Pick a template, put in your texts, logo and colors, and get a ready MP4 and GIF.
          </p>
        </div>

        {templates === null && !error && (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border border-accent-red/30 border-t-accent-red animate-spin" />
          </div>
        )}

        {error && <p className="text-center text-gray-400 py-20">Could not load templates. Please try again later.</p>}

        {templates && templates.length === 0 && (
          <div className="text-center text-gray-400 py-20">
            <Film size={40} className="mx-auto mb-4 text-accent-red/60" />
            No templates yet.
          </div>
        )}

        {templates && templates.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((t) => (
              <BannerCard key={t.slug} template={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
