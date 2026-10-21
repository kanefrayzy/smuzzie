'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { getItemMedia } from '@/lib/media';
import type { PortfolioItem } from '@/types';
import { Expand, Eye } from 'lucide-react';

interface LazyGifCardProps {
  item: PortfolioItem;
  /** `sizes` attribute for responsive images — how wide the card renders at each breakpoint */
  sizes: string;
  onClick?: () => void;
  onExpand?: () => void;
  eager?: boolean;
}

const CLIP = 'polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%)';
const CLIP_SM = 'polygon(0 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%)';
const CLIP_BTN = 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)';

export default function LazyGifCard({ item, sizes, onClick, onExpand, eager = false }: LazyGifCardProps) {
  const media = getItemMedia(item);
  const isVideo = media.kind === 'video';
  const category = item.category?.name;

  const [loaded, setLoaded] = useState(false); // image / poster ready (hides skeleton)
  const [posterFailed, setPosterFailed] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Reveal animation — fires once
  const { ref: revealRef, inView: revealed } = useInView({
    triggerOnce: true,
    threshold: 0.05,
    rootMargin: '300px',
    skip: eager,
  });
  const isVisible = revealed || eager;

  // Playback visibility — videos only; pauses (and stops downloading) anything off-screen
  const { ref: playRef, inView: onScreen } = useInView({ threshold: 0.3, skip: !isVideo });

  useEffect(() => {
    setIsTouch(window.matchMedia('(hover: none)').matches);
  }, []);

  const hasPoster = isVideo && !!media.poster && !posterFailed;
  const autoplays = isVideo && (media.autoplay || isTouch);

  // Autoplay converted GIFs (and every video on touch screens) only while on screen
  useEffect(() => {
    const video = videoRef.current;
    if (!isVideo || !video) return;
    if (autoplays && onScreen) {
      video.play().catch(() => {});
    } else if (!onScreen) {
      video.pause();
    }
  }, [isVideo, autoplays, onScreen]);

  const handleMouseEnter = useCallback(() => {
    const video = videoRef.current;
    if (isVideo && video && !autoplays) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  }, [isVideo, autoplays]);

  const handleMouseLeave = useCallback(() => {
    if (isVideo && videoRef.current && !autoplays) {
      videoRef.current.pause();
    }
  }, [isVideo, autoplays]);

  // Known dimensions → reserve the exact box up front (no layout jump when media arrives)
  const ratio = media.width && media.height ? `${media.width} / ${media.height}` : undefined;
  const fill = 'absolute inset-0 w-full h-full object-cover';
  const flowClass = (shown: boolean) => (ratio ? fill : `w-full h-auto block ${shown ? '' : 'absolute inset-0 opacity-0'}`);

  return (
    <motion.div
      ref={revealRef}
      className="group relative overflow-hidden bg-surface cursor-pointer transition-all duration-500 hover:-translate-y-1"
      style={{ clipPath: CLIP }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={isVisible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Angular border glow */}
      <div className="absolute -inset-[1px] bg-gradient-to-br from-accent-red/0 via-accent-red/0 to-accent-red/0 group-hover:from-accent-red/60 group-hover:via-accent-red/20 group-hover:to-accent-red-dark/60 transition-all duration-500 z-0"
        style={{ clipPath: CLIP }}
      />

      {/* Card inner */}
      <div className="relative z-10 overflow-hidden bg-surface border border-white/[0.06] group-hover:border-transparent transition-colors duration-500"
        style={{ clipPath: CLIP }}
      >
        {/* Media container — natural aspect ratio for masonry */}
        <div ref={playRef} className="relative overflow-hidden bg-[#0a0a0c]" style={ratio ? { aspectRatio: ratio } : undefined}>
          {/* Skeleton preloader */}
          {!loaded && (
            <div className={`${ratio ? 'absolute inset-0' : 'w-full aspect-[4/3]'} bg-[#0a0a0c] animate-pulse`}>
              <div className="w-full h-full relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent skeleton-shimmer" />
                <div className="absolute bottom-4 left-4 right-4 space-y-2">
                  <div className="h-2 bg-white/[0.04] rounded w-3/4" />
                  <div className="h-2 bg-white/[0.03] rounded w-1/2" />
                </div>
              </div>
            </div>
          )}

          {isVideo ? (
            <>
              {/* Poster — light WebP frame shown until the video actually plays */}
              {hasPoster && (
                <img
                  src={media.poster}
                  alt={item.title}
                  className={ratio
                    ? `${fill} ${videoPlaying ? 'invisible' : ''}`
                    : videoPlaying ? 'hidden' : flowClass(loaded)}
                  loading={eager ? 'eager' : 'lazy'}
                  decoding="async"
                  onLoad={() => setLoaded(true)}
                  onError={() => { setPosterFailed(true); setLoaded(true); }}
                />
              )}
              {/* Video — nothing is downloaded until it's played (hover, or on screen for GIFs / touch) */}
              <video
                ref={videoRef}
                src={media.previewVideo}
                className={`transition-transform duration-700 ease-out group-hover:scale-105 ${
                  ratio
                    ? `${fill} ${videoPlaying || !hasPoster ? 'opacity-100' : 'opacity-0'}`
                    : videoPlaying || !hasPoster ? 'w-full h-auto block' : 'absolute inset-0 w-full h-full opacity-0'
                }`}
                muted
                loop
                playsInline
                preload={hasPoster ? 'none' : 'metadata'}
                onLoadedMetadata={() => { if (!hasPoster) setLoaded(true); }}
                onPlay={() => setVideoPlaying(true)}
                onPause={() => setVideoPlaying(false)}
              />
            </>
          ) : (
            <img
              src={media.src}
              srcSet={media.srcSet}
              sizes={media.srcSet ? sizes : undefined}
              alt={item.title}
              className={`${flowClass(loaded)} transition-transform duration-700 ease-out group-hover:scale-105`}
              loading={eager ? 'eager' : 'lazy'}
              decoding="async"
              onLoad={() => setLoaded(true)}
              onError={() => setLoaded(true)}
            />
          )}

          {/* GIF / video badge — angular */}
          {(item.file_type === 'gif' || item.file_type === 'video') && (
            <div className={`absolute top-3 right-3 px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase z-20 ${
              item.file_type === 'gif' ? 'bg-accent-red/90' : 'bg-purple-500/90'
            }`}
              style={{ clipPath: CLIP_SM }}
            >
              {item.file_type === 'gif' ? 'GIF' : 'MP4'}
            </div>
          )}

          {/* Category badge — solid background: backdrop-blur would re-render on every video frame */}
          {category && (
            <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/75 text-[10px] font-mono uppercase tracking-wider text-white/70 border border-white/[0.08] z-20"
              style={{ clipPath: CLIP_SM }}
            >
              {category}
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 z-10" />

          {/* Hover action buttons — CSS transitions, no per-card observers */}
          <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 z-20">
            <div
              className="w-10 h-10 bg-white/10 border border-white/20 flex items-center justify-center hover:bg-accent-red/60 hover:border-accent-red/40 transition-all duration-200 cursor-pointer scale-50 group-hover:scale-100"
              style={{ clipPath: CLIP_BTN }}
              onClick={(e) => { e.stopPropagation(); onClick?.(); }}
            >
              <Eye size={16} className="text-white" />
            </div>
            <div
              className="w-10 h-10 bg-white/10 border border-white/20 flex items-center justify-center hover:bg-accent-red/60 hover:border-accent-red/40 transition-all duration-200 delay-75 cursor-pointer scale-50 group-hover:scale-100"
              style={{ clipPath: CLIP_BTN }}
              onClick={(e) => { e.stopPropagation(); onExpand?.(); }}
            >
              <Expand size={16} className="text-white" />
            </div>
          </div>

          {/* Bottom gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-surface via-surface/60 to-transparent z-10 pointer-events-none" />
        </div>

        {/* Info bar */}
        <div className="relative px-4 py-3 -mt-2 z-20">
          <h3 className="text-white font-semibold text-sm truncate group-hover:text-accent-red transition-colors duration-300">
            {item.title}
          </h3>
          <div className="flex items-center justify-between mt-1">
            <span className="text-gray-600 text-[10px] font-mono uppercase tracking-wider">{category || 'Design'}</span>
            <span className="text-[10px] text-accent-red/60 font-mono uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-1">
              <Eye size={10} />
              View
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
