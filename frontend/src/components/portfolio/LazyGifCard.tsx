'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { getImageUrl } from '@/lib/utils';
import { Expand, Eye } from 'lucide-react';

interface LazyGifCardProps {
  thumbnailUrl: string;
  gifUrl: string | null;
  imageUrl: string;
  title: string;
  category?: string;
  onClick?: () => void;
  onExpand?: () => void;
  fileType: 'image' | 'gif' | 'video';
}

export default function LazyGifCard({
  thumbnailUrl,
  gifUrl,
  imageUrl,
  title,
  category,
  onClick,
  onExpand,
  fileType,
}: LazyGifCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [gifLoaded, setGifLoaded] = useState(false);
  const [gifCached, setGifCached] = useState(false);
  const gifRef = useRef<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { ref: inViewRef, inView } = useInView({
    triggerOnce: true,
    threshold: 0.05,
    rootMargin: '300px',
  });

  const isGif = fileType === 'gif' && gifUrl;
  const isVideo = fileType === 'video';
  // Use lightweight thumbnail for initial display (not the 25MB gif!)
  // thumbnailUrl is a small jpg for images/gifs, but for videos it may be the mp4 itself
  const thumbSrc = getImageUrl(thumbnailUrl || imageUrl);
  const animatedSrc = getImageUrl(gifUrl || imageUrl);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile/touch device
  useEffect(() => {
    const check = () => setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // On mobile: autoplay video when card scrolls into view
  useEffect(() => {
    if (!isVideo || !isMobile || !videoRef.current) return;
    const video = videoRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [isVideo, isMobile]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (isGif && !gifCached) {
      const img = new Image();
      img.onload = () => {
        setGifLoaded(true);
        setGifCached(true);
      };
      img.src = animatedSrc;
      gifRef.current = img;
    }
    if (isVideo && videoRef.current && !isMobile) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [isGif, isVideo, gifCached, animatedSrc, isMobile]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (isVideo && videoRef.current && !isMobile) {
      videoRef.current.pause();
    }
  }, [isVideo, isMobile]);

  // Touch handlers for video play on tap (fallback for mobile)
  const handleTouchStart = useCallback(() => {
    setIsHovered(true);
    if (isVideo && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
    if (isGif && !gifCached) {
      const img = new Image();
      img.onload = () => {
        setGifLoaded(true);
        setGifCached(true);
      };
      img.src = animatedSrc;
      gifRef.current = img;
    }
  }, [isVideo, isGif, gifCached, animatedSrc]);

  useEffect(() => {
    if (isHovered && gifCached) {
      setGifLoaded(true);
    }
  }, [isHovered, gifCached]);

  return (
    <motion.div
      ref={inViewRef}
      className="group relative overflow-hidden bg-surface cursor-pointer transition-all duration-500 hover:-translate-y-1"
      style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%)' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Angular border glow */}
      <div className="absolute -inset-[1px] bg-gradient-to-br from-accent-red/0 via-accent-red/0 to-accent-red/0 group-hover:from-accent-red/60 group-hover:via-accent-red/20 group-hover:to-accent-red-dark/60 transition-all duration-500 z-0"
        style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%)' }}
      />
      
      {/* Card inner */}
      <div className="relative z-10 overflow-hidden bg-surface border border-white/[0.06] group-hover:border-transparent transition-colors duration-500"
        style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%)' }}
      >
        {/* Image container */}
        <div className="relative overflow-hidden bg-[#0a0a0c]">
          {/* Thumbnail (image or video poster) */}
          {/* Skeleton preloader */}
          {!mediaLoaded && (
            <div className="w-full aspect-square bg-[#0a0a0c] animate-pulse">
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
            <video
              ref={videoRef}
              src={getImageUrl(gifUrl || imageUrl)}
              className={`w-full h-auto block transition-transform duration-700 ease-out group-hover:scale-105 ${!mediaLoaded ? 'absolute inset-0 opacity-0' : 'opacity-100'}`}
              muted
              loop
              playsInline
              preload={isMobile ? 'auto' : 'none'}
              autoPlay={isMobile}
              onLoadedData={() => setMediaLoaded(true)}
            />
          ) : (
            <img
              src={thumbSrc}
              alt={title}
              className={`w-full h-auto block transition-transform duration-700 ease-out group-hover:scale-105 ${!mediaLoaded ? 'absolute inset-0 opacity-0' : 'opacity-100'}`}
              loading="lazy"
              onLoad={() => setMediaLoaded(true)}
            />
          )}

          {/* GIF overlay */}
          {isGif && (
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: gifLoaded ? 1 : 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {gifCached && (
                    <img
                      src={animatedSrc}
                      alt={`${title} animated`}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Loading indicator */}
          {isGif && isHovered && !gifLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="w-6 h-6 border-2 border-accent-red/30 border-t-accent-red animate-spin" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }} />
            </div>
          )}

          {/* GIF badge — angular */}
          {isGif && (
            <div className="absolute top-3 right-3 px-2 py-0.5 bg-accent-red/90 text-[10px] font-mono font-bold tracking-wider uppercase z-20"
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%)' }}
            >
              GIF
            </div>
          )}

          {/* Video badge */}
          {isVideo && (
            <div className="absolute top-3 right-3 px-2 py-0.5 bg-purple-500/90 text-[10px] font-mono font-bold tracking-wider uppercase z-20"
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%)' }}
            >
              MP4
            </div>
          )}

          {/* Category badge — angular */}
          {category && (
            <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-md text-[10px] font-mono uppercase tracking-wider text-white/70 border border-white/[0.08] z-20"
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%)' }}
            >
              {category}
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 z-10" />

          {/* Hover action buttons — angular */}
          <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 z-20">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              whileInView={isHovered ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.2, delay: 0.05 }}
              className="w-10 h-10 bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-accent-red/60 hover:border-accent-red/40 transition-colors cursor-pointer"
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)' }}
              onClick={(e) => { e.stopPropagation(); onClick?.(); }}
            >
              <Eye size={16} className="text-white" />
            </motion.div>
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              whileInView={isHovered ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="w-10 h-10 bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-accent-red/60 hover:border-accent-red/40 transition-colors cursor-pointer"
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)' }}
              onClick={(e) => { e.stopPropagation(); onExpand?.(); }}
            >
              <Expand size={16} className="text-white" />
            </motion.div>
          </div>

          {/* Bottom gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-surface via-surface/60 to-transparent z-10 pointer-events-none" />
        </div>

        {/* Info bar */}
        <div className="relative px-4 py-3 -mt-2 z-20">
          <h3 className="text-white font-semibold text-sm truncate group-hover:text-accent-red transition-colors duration-300">
            {title}
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
