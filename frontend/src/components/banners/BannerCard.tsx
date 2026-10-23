'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useInView } from 'react-intersection-observer';
import { getImageUrl } from '@/lib/utils';
import type { PublicBannerTemplateCard } from '@/types/banners';
import { formatList, isImageTemplate, templateFormats } from '@/lib/banner-formats';
import { hueFilter } from '@/lib/banner-overlay';
import { Play } from 'lucide-react';
import TemplateOverlay from './TemplateOverlay';

/**
 * Catalog card: poster by default, the preview video plays on hover (or while on screen on touch
 * devices). Image templates just show the poster. The template's default texts and images are
 * drawn on top, as the editor shows them.
 */
export default function BannerCard({ template }: { template: PublicBannerTemplateCard }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const { ref, inView } = useInView({ threshold: 0.5 });

  useEffect(() => {
    setIsTouch(window.matchMedia('(hover: none)').matches);
  }, []);

  const still = isImageTemplate(template);
  const playing = !still && (isTouch ? inView : active);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.play().catch(() => undefined);
    } else {
      v.pause();
    }
  }, [playing]);

  const formats = formatList(templateFormats(template));
  // Same background tint as the editor starts with
  const tint = template.config?.hue.enabled ? hueFilter(template.config.hue.default) : 'none';

  return (
    <Link
      ref={ref}
      href={`/banners/${template.slug}`}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      className="group block border border-white/[0.06] hover:border-accent-red/30 bg-white/[0.01] transition-colors"
      style={{ clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' }}
    >
      <div className="relative bg-black overflow-hidden" style={{ aspectRatio: `${template.width} / ${template.height}` }}>
        {template.poster_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getImageUrl(template.poster_url)}
            alt=""
            loading="lazy"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${playing ? 'opacity-0' : 'opacity-100'}`}
            style={{ filter: tint }}
          />
        )}
        {!still && (
          <>
            <video
              ref={videoRef}
              src={getImageUrl(template.preview_url)}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: tint }}
              muted
              loop
              playsInline
              preload="none"
              aria-hidden="true"
            />
          </>
        )}
        {template.config && template.fonts && (
          <TemplateOverlay width={template.width} height={template.height} config={template.config} fonts={template.fonts} />
        )}
        {!still && (
          <>
            <span
              className={`absolute bottom-3 right-3 w-9 h-9 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-white/80 transition-opacity ${
                playing ? 'opacity-0' : 'opacity-100'
              }`}
            >
              <Play size={14} />
            </span>
          </>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-white font-semibold group-hover:text-accent-red transition-colors truncate">{template.name}</h2>
          <span className="text-white font-display font-bold shrink-0">
            {Number(template.price) > 0 ? `$${Number(template.price).toFixed(0)}` : ''}
          </span>
        </div>
        <p className="text-gray-500 text-xs font-mono mt-1">
          {template.width}×{template.height} · {still || !template.duration ? '' : `${template.duration} s · `}{formats}
        </p>
      </div>
    </Link>
  );
}
