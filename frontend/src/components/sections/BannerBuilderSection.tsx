'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import ScrollReveal from '@/components/ui/ScrollReveal';
import BannerCard from '@/components/banners/BannerCard';
import { publicApi } from '@/lib/api';
import type { PublicBannerTemplateCard } from '@/types/banners';

/** Homepage teaser for the banner builder: a few templates and a link to the catalog. */
export default function BannerBuilderSection() {
  const [templates, setTemplates] = useState<PublicBannerTemplateCard[]>([]);

  useEffect(() => {
    publicApi
      .getBannerTemplates()
      .then((res) => setTemplates(res.data.slice(0, 3)))
      .catch(() => undefined);
  }, []);

  return (
    <section className="relative py-24 overflow-hidden" aria-labelledby="banner-builder-heading">
      <div className="absolute inset-0 bg-[#060608]" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-red/10 to-transparent" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-8 bg-accent-red/40" />
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent-red/60">Banner builder</span>
              <div className="h-px w-8 bg-accent-red/40" />
            </div>
            <h2 id="banner-builder-heading" className="section-heading">
              Animated banners <span className="text-gradient">in minutes</span>
            </h2>
            <p className="section-subheading">
              Pick a template, add your text, logo and colors, and download MP4 and GIF. No designer needed.
            </p>
          </div>
        </ScrollReveal>

        {templates.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {templates.map((t) => (
              <BannerCard key={t.slug} template={t} />
            ))}
          </div>
        )}

        <div className="flex justify-center">
          <Link href="/banners" className="btn-primary inline-flex items-center gap-2">
            Open the banner builder <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
