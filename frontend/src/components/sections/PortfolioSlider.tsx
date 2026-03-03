'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { publicApi } from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import { PortfolioItem } from '@/types';

/* ─── Slider card — always uses <img> for performance (no <video>) ─── */
function SliderCard({ item }: { item: PortfolioItem }) {
  const isVideo = item.file_type === 'video';

  // Prefer thumbnail that is an actual image (not a video file)
  const isThumbUsable = item.thumbnail_url && !item.thumbnail_url.endsWith('.mp4') && !item.thumbnail_url.endsWith('.webm');
  const thumbSrc = isThumbUsable ? getImageUrl(item.thumbnail_url) : '';
  const imgSrc = thumbSrc || getImageUrl(item.image_url);

  return (
    <Link
      href={`/portfolio?category=${item.category?.slug || ''}`}
      className="group relative flex-shrink-0 w-72 md:w-80 overflow-hidden border border-white/[0.06] hover:border-accent-red/30 transition-all duration-500"
      style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
    >
      <div className="aspect-[4/3] bg-[#0a0a0a] relative overflow-hidden">
        {/* Background gradient so there's never a pure black flash */}
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/40 to-zinc-900/40" />

        {/* Always render <img> — slider is just a preview, no heavy <video> */}
        <img
          src={imgSrc}
          alt={item.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          loading="eager"
          onError={(e) => {
            const el = e.currentTarget as HTMLImageElement;
            if (thumbSrc && el.src !== getImageUrl(item.image_url)) {
              el.src = getImageUrl(item.image_url);
            } else {
              el.style.display = 'none';
            }
          }}
        />

        {/* Video badge */}
        {isVideo && (
          <div className="absolute top-3 right-3 z-[2] px-2 py-0.5 bg-purple-500/90 text-[10px] font-mono font-bold tracking-wider uppercase"
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%)' }}
          >
            VIDEO
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10 backdrop-blur-[6px] opacity-0 group-hover:opacity-100 transition-all duration-300" />
        {/* Category badge */}
        <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-sm text-[10px] font-mono uppercase tracking-wider text-white/70 border border-white/[0.08]"
          style={{ clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)' }}
        >
          {item.category?.icon} {item.category?.name}
        </div>
        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="px-5 py-2 bg-accent-red/80 backdrop-blur text-xs font-bold uppercase tracking-wider text-white rounded-full">
            View Project
          </span>
        </div>
      </div>
      <div className="p-3 bg-white/[0.01] border-t border-white/[0.04]">
        <h3 className="font-semibold text-xs text-gray-300 group-hover:text-accent-red transition-colors truncate">
          {item.title}
        </h3>
      </div>
    </Link>
  );
}

export default function PortfolioSlider() {
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPortfolio() {
      try {
        const res = await publicApi.getPortfolio({ per_page: 25 });
        const data = res.data.data || res.data;
        setPortfolioItems(data);
      } catch (err) {
        console.error('Failed to fetch portfolio:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchPortfolio();
  }, []);

  // Split items into two rows
  const half = Math.ceil(portfolioItems.length / 2);
  const row1Items = portfolioItems.slice(0, half);
  const row2Items = portfolioItems.slice(half);

  // Duplicate for infinite scroll
  const row1Loop = [...row1Items, ...row1Items, ...row1Items];
  const row2Loop = [...row2Items, ...row2Items, ...row2Items];

  const itemWidth = 344; // w-80 = 320px + gap 24px

  if (loading) {
    return (
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-surface-dark" />
        <div className="flex items-center justify-center py-20 relative z-10">
          <div className="w-10 h-10 border-2 border-accent-red/30 border-t-accent-red rounded-full animate-spin" />
        </div>
      </section>
    );
  }

  if (portfolioItems.length === 0) return null;

  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-primary" />
      <div className="absolute inset-0 bg-grid-pattern opacity-100" />

      {/* HUD lines */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-red/10 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-red/10 to-transparent" />

      <div className="relative z-10">
        <ScrollReveal>
          <div className="text-center mb-16 px-4">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-8 bg-accent-red/40" />
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent-red/60">Works</span>
              <div className="h-px w-8 bg-accent-red/40" />
            </div>
            <h2 className="section-heading">
              Our <span className="text-gradient">Portfolio</span>
            </h2>
            <p className="section-subheading">
              Explore our latest works across different design categories
            </p>
          </div>
        </ScrollReveal>

        {/* Row 1 */}
        <div className="mb-4 overflow-hidden">
          <motion.div
            className="flex gap-4 w-max"
            animate={{ x: [0, -(row1Items.length * itemWidth)] }}
            transition={{ duration: row1Items.length * 5, repeat: Infinity, ease: 'linear' }}
          >
            {row1Loop.map((item, index) => (
              <SliderCard key={`row1-${index}`} item={item} />
            ))}
          </motion.div>
        </div>

        {/* Row 2 (reversed) */}
        {row2Items.length > 0 && (
          <div className="overflow-hidden">
            <motion.div
              className="flex gap-4 w-max"
              animate={{ x: [-(row2Items.length * itemWidth), 0] }}
              transition={{ duration: row2Items.length * 6, repeat: Infinity, ease: 'linear' }}
            >
              {row2Loop.map((item, index) => (
                <SliderCard key={`row2-${index}`} item={item} />
              ))}
            </motion.div>
          </div>
        )}

        {/* View all */}
        <ScrollReveal className="text-center mt-12 px-4">
          <Link
            href="/portfolio"
            className="inline-flex items-center gap-2 text-accent-red hover:text-white transition-colors font-mono text-xs uppercase tracking-wider group"
          >
            View Full Portfolio
            <svg className="group-hover:translate-x-1 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}
