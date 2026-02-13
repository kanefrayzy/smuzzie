'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LazyGifCard from './LazyGifCard';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { PortfolioItem, Category } from '@/types';
import { ArrowLeft, ChevronLeft, ChevronRight, Expand, Grid3X3, LayoutGrid, Minus, Plus, RotateCcw, Sparkles, X } from 'lucide-react';
import { getImageUrl } from '@/lib/utils';

/* ─── Fullscreen Pan+Zoom Viewer ─── */
const ZOOM_STEPS = [25, 50, 75, 100, 150, 200, 300, 400, 500];
const MIN_ZOOM = 25;
const MAX_ZOOM = 500;

function ZoomViewer({ media, onClose }: { media: { url: string; type: 'image' | 'video' }; onClose: () => void }) {
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTouchDist = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);

  const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

  const zoomIn = useCallback(() => {
    setZoom(prev => {
      const next = ZOOM_STEPS.find(s => s > prev);
      return next ?? MAX_ZOOM;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(prev => {
      const next = [...ZOOM_STEPS].reverse().find(s => s < prev);
      return next ?? MIN_ZOOM;
    });
  }, []);

  const resetView = useCallback(() => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
  }, []);

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomIn(); }
      if (e.key === '-') { e.preventDefault(); zoomOut(); }
      if (e.key === '0') { e.preventDefault(); resetView(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, zoomIn, zoomOut, resetView]);

  // Mouse wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -15 : 15;
      setZoom(prev => clampZoom(prev + delta));
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Mouse drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { ...pan };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({ x: panStart.current.x + dx, y: panStart.current.y + dy });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch: pinch-to-zoom + pan
  const getTouchDist = (touches: React.TouchList) => {
    if (touches.length < 2) return null;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length < 2) return { x: touches[0].clientX, y: touches[0].clientY };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastTouchDist.current = getTouchDist(e.touches);
      lastTouchCenter.current = getTouchCenter(e.touches);
    } else if (e.touches.length === 1) {
      setIsDragging(true);
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStart.current = { ...pan };
    }
  }, [pan]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      // Pinch zoom
      const dist = getTouchDist(e.touches);
      if (dist && lastTouchDist.current) {
        const scale = dist / lastTouchDist.current;
        setZoom(prev => clampZoom(prev * scale));
        lastTouchDist.current = dist;
      }
      // Two-finger pan
      const center = getTouchCenter(e.touches);
      if (lastTouchCenter.current) {
        const dx = center.x - lastTouchCenter.current.x;
        const dy = center.y - lastTouchCenter.current.y;
        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        lastTouchCenter.current = center;
      }
    } else if (e.touches.length === 1 && isDragging) {
      // Single finger pan
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      setPan({ x: panStart.current.x + dx, y: panStart.current.y + dy });
    }
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    lastTouchDist.current = null;
    lastTouchCenter.current = null;
  }, []);

  const scale = zoom / 100;

  return (
    <motion.div
      className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Close / Back button — top left (mobile-friendly) */}
      <motion.button
        onClick={onClose}
        className="fixed top-3 left-3 sm:top-5 sm:left-5 z-[220] flex items-center gap-2 px-4 py-3 sm:px-4 sm:py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-xl border border-white/30 text-white rounded-full transition-all shadow-2xl"
        style={{ touchAction: 'manipulation' }}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
      >
        <ArrowLeft size={20} />
        <span className="text-sm font-medium">Back</span>
      </motion.button>

      {/* Close button — top right */}
      <motion.button
        onClick={onClose}
        className="fixed top-3 right-3 sm:top-5 sm:right-5 z-[220] w-11 h-11 sm:w-11 sm:h-11 flex items-center justify-center bg-white/15 hover:bg-white/25 backdrop-blur-xl border border-white/30 text-white rounded-full transition-all shadow-2xl"
        style={{ touchAction: 'manipulation' }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
      >
        <X size={20} />
      </motion.button>

      {/* Zoomable + pannable area */}
      <div
        ref={containerRef}
        className="absolute inset-0 z-[201] overflow-hidden"
        style={{ cursor: isDragging ? 'grabbing' : zoom > 100 ? 'grab' : 'default', touchAction: 'none' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={(e) => {
          e.preventDefault();
          if (zoom > 100) {
            resetView();
          } else {
            setZoom(200);
            // Pan so that double-click point stays centered
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
              const cx = e.clientX - rect.left - rect.width / 2;
              const cy = e.clientY - rect.top - rect.height / 2;
              setPan({ x: -cx, y: -cy });
            }
          }
        }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
        >
          {media.type === 'video' ? (
            <video
              src={media.url}
              className="max-w-[90vw] max-h-[85vh] object-contain pointer-events-none"
              autoPlay
              muted
              loop
              playsInline
              draggable={false}
            />
          ) : (
            <img
              src={media.url}
              alt="Zoomed view"
              className="max-w-[90vw] max-h-[85vh] object-contain"
              draggable={false}
            />
          )}
        </div>
      </div>

      {/* Bottom zoom controls */}
      <motion.div
        className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-[220] flex items-center gap-3"
        style={{ touchAction: 'manipulation' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ delay: 0.1 }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="w-11 h-11 flex items-center justify-center bg-white/15 hover:bg-red-500/80 backdrop-blur-xl border border-white/20 hover:border-red-400/50 text-white rounded-full transition-all shadow-lg"
        >
          <X size={18} />
        </button>

        {/* Zoom controls */}
        <div className="bg-black/70 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center gap-4">
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className={`text-white transition-opacity ${zoom <= MIN_ZOOM ? 'opacity-30 cursor-not-allowed' : 'opacity-100 hover:opacity-80'}`}
          >
            <Minus size={20} />
          </button>
          <button
            onClick={resetView}
            className="text-white text-sm font-medium min-w-[48px] text-center hover:text-accent-red transition-colors"
          >
            {Math.round(zoom)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className={`text-white transition-opacity ${zoom >= MAX_ZOOM ? 'opacity-30 cursor-not-allowed' : 'opacity-100 hover:opacity-80'}`}
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Reset button */}
        <button
          onClick={resetView}
          className="bg-black/70 backdrop-blur-md border border-white/10 rounded-full p-2.5 text-white hover:bg-white/10 transition-colors"
          title="Reset view"
        >
          <RotateCcw size={16} />
        </button>
      </motion.div>
    </motion.div>
  );
}

interface PortfolioGridProps {
  items: PortfolioItem[];
  categories: Category[];
  initialCategory?: string;
}

const BATCH_SIZE = 20; // Load 20 items per batch
const LOAD_DELAY = 50; // Delay between batches (ms)

export default function PortfolioGrid({ items, categories, initialCategory }: PortfolioGridProps) {
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory || 'all');
  const [filteredItems, setFilteredItems] = useState<PortfolioItem[]>(items);
  const [lightboxItem, setLightboxItem] = useState<PortfolioItem | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number>(-1);
  const [columns, setColumns] = useState<3 | 4>(3);
  const [zoomedMedia, setZoomedMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

  // Batched progressive loading state
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  // Visible items (batched)
  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleCount),
    [filteredItems, visibleCount]
  );
  const hasMore = visibleCount < filteredItems.length;

  // Row-interleaved chunks: for 'all' view, organize items into chunks
  // where each chunk = one category's row of items. Categories alternate
  // in round-robin fashion. Each chunk renders as its own mini-grid so
  // items never mix across categories in the same row, at any screen size.
  const categoryChunks = useMemo(() => {
    if (activeCategory !== 'all') return null;

    const cols = columns;
    const catOrder = new Map(categories.map((c) => [c.id, c.sort_order]));
    const buckets = new Map<number, PortfolioItem[]>();
    visibleItems.forEach((item) => {
      if (!buckets.has(item.category_id)) buckets.set(item.category_id, []);
      buckets.get(item.category_id)!.push(item);
    });

    const sortedCatIds = Array.from(buckets.keys()).sort(
      (a, b) => (catOrder.get(a) ?? 999) - (catOrder.get(b) ?? 999)
    );

    // Build chunks: take `cols` items at a time from each category, round-robin
    const chunks: { catId: number; items: PortfolioItem[] }[] = [];
    const pointers = new Map<number, number>();
    sortedCatIds.forEach((id) => pointers.set(id, 0));

    let realCount = 0;
    const totalItems = visibleItems.length;
    let safety = 0;

    while (realCount < totalItems && safety++ < totalItems + sortedCatIds.length * 50) {
      let addedAny = false;
      for (const catId of sortedCatIds) {
        const bucket = buckets.get(catId)!;
        const ptr = pointers.get(catId)!;
        if (ptr < bucket.length) {
          const rowItems = bucket.slice(ptr, ptr + cols);
          chunks.push({ catId, items: rowItems });
          realCount += rowItems.length;
          pointers.set(catId, ptr + rowItems.length);
          addedAny = true;
        }
      }
      if (!addedAny) break;
    }

    return chunks;
  }, [activeCategory, visibleItems, columns, categories]);

  // Count items per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    items.forEach((item) => {
      if (item.category?.slug) {
        counts[item.category.slug] = (counts[item.category.slug] || 0) + 1;
      }
    });
    return counts;
  }, [items]);

  // Reset visible count when category changes
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
    loadingRef.current = false;
  }, [activeCategory]);

  // Progressive loading observer (load more when scrolling near bottom)
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingRef.current && hasMore) {
          loadingRef.current = true;
          setTimeout(() => {
            setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, filteredItems.length));
            loadingRef.current = false;
          }, LOAD_DELAY);
        }
      },
      { rootMargin: '800px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, filteredItems.length]);

  useEffect(() => {
    if (activeCategory === 'all') {
      setFilteredItems(items);
    } else {
      setFilteredItems(
        items.filter((item) => item.category?.slug === activeCategory)
      );
    }
  }, [activeCategory, items]);

  const openLightbox = useCallback((item: PortfolioItem) => {
    const index = filteredItems.findIndex((i) => i.id === item.id);
    setLightboxItem(item);
    setLightboxIndex(index);
  }, [filteredItems]);

  const closeLightbox = useCallback(() => {
    setLightboxItem(null);
    setLightboxIndex(-1);
    setZoomedMedia(null);
  }, []);

  const openZoom = useCallback((item: PortfolioItem) => {
    const url = getImageUrl(item.gif_url || item.image_url);
    const type = item.file_type === 'video' ? 'video' : 'image';
    setZoomedMedia({ url, type });
  }, []);

  const nextItem = useCallback(() => {
    if (lightboxIndex < filteredItems.length - 1) {
      const next = filteredItems[lightboxIndex + 1];
      setLightboxItem(next);
      setLightboxIndex(lightboxIndex + 1);
    }
  }, [lightboxIndex, filteredItems]);

  const prevItem = useCallback(() => {
    if (lightboxIndex > 0) {
      const prev = filteredItems[lightboxIndex - 1];
      setLightboxItem(prev);
      setLightboxIndex(lightboxIndex - 1);
    }
  }, [lightboxIndex, filteredItems]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (zoomedMedia) {
        if (e.key === 'Escape') setZoomedMedia(null);
        return;
      }
      if (!lightboxItem) {
        if (e.key === 'Escape' && zoomedMedia) setZoomedMedia(null);
        return;
      }
      if (e.key === 'Escape') {
        closeLightbox();
        return;
      }
      if (e.key === 'ArrowRight') nextItem();
      if (e.key === 'ArrowLeft') prevItem();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxItem, zoomedMedia, closeLightbox, nextItem, prevItem]);

  const gridClass = columns === 4
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6';

  return (
    <div>
      {/* Category filters + controls */}
      <ScrollReveal>
        <div className="relative mb-12">
          {/* Main filter row */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setActiveCategory('all')}
              className={`group relative px-5 py-2.5 text-xs font-mono uppercase tracking-[0.15em] font-medium transition-all duration-300 flex items-center gap-2 ${
                activeCategory === 'all'
                  ? 'bg-accent-red text-white'
                  : 'bg-surface/80 border border-white/[0.06] text-gray-400 hover:text-white hover:border-accent-red/20 hover:bg-surface'
              }`}
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)' }}
            >
              <Sparkles size={12} />
              All
              <span className={`text-[10px] px-1.5 py-0.5 font-mono ${
                activeCategory === 'all' ? 'bg-white/20' : 'bg-white/5 text-gray-500'
              }`}>
                {categoryCounts.all || 0}
              </span>
            </button>
            {categories.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => setActiveCategory(cat.slug)}
                className={`group relative px-5 py-2.5 text-xs font-mono uppercase tracking-[0.15em] font-medium transition-all duration-300 flex items-center gap-2 ${
                  activeCategory === cat.slug
                    ? 'bg-accent-red text-white'
                    : 'bg-surface/80 border border-white/[0.06] text-gray-400 hover:text-white hover:border-accent-red/20 hover:bg-surface'
                }`}
                style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)' }}
              >
                {cat.icon && <span className="text-xs">{cat.icon}</span>}
                {cat.name.replace(' Design', '')}
                <span className={`text-[10px] px-1.5 py-0.5 font-mono ${
                  activeCategory === cat.slug ? 'bg-white/20' : 'bg-white/5 text-gray-500'
                }`}>
                  {categoryCounts[cat.slug] || 0}
                </span>
              </button>
            ))}
          </div>

          {/* Grid toggle + count */}
          <div className="flex items-center justify-between mt-6">
            <span className="text-gray-600 text-[10px] font-mono uppercase tracking-wider">
              <span className="text-gray-400 font-medium">{visibleItems.length}</span>
              {hasMore && <span className="text-gray-600"> / {filteredItems.length}</span>}
              {' '}{filteredItems.length === 1 ? 'project' : 'projects'}
            </span>
            <div className="flex items-center gap-1 bg-surface/80 border border-white/[0.06] p-0.5">
              <button
                onClick={() => setColumns(3)}
                className={`p-1.5 transition-all ${columns === 3 ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setColumns(4)}
                className={`p-1.5 transition-all ${columns === 4 ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <Grid3X3 size={14} />
              </button>
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* Portfolio grid */}
      {activeCategory === 'all' && categoryChunks ? (
        <div className={columns === 4 ? 'space-y-5' : 'space-y-6'}>
          {categoryChunks.map((chunk, chunkIdx) => (
            <div key={`chunk-${chunk.catId}-${chunkIdx}`} className={gridClass}>
              {chunk.items.map((item) => (
                <div key={item.id}>
                  <LazyGifCard
                    thumbnailUrl={item.thumbnail_url}
                    gifUrl={item.gif_url}
                    imageUrl={item.image_url}
                    title={item.title}
                    category={item.category?.name}
                    fileType={item.file_type}
                    onClick={() => openLightbox(item)}
                    onExpand={() => openZoom(item)}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className={gridClass}>
          {visibleItems.map((item) => (
            <div key={item.id}>
              <LazyGifCard
                thumbnailUrl={item.thumbnail_url}
                gifUrl={item.gif_url}
                imageUrl={item.image_url}
                title={item.title}
                category={item.category?.name}
                fileType={item.file_type}
                onClick={() => openLightbox(item)}
                onExpand={() => openZoom(item)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Loading sentinel + indicator */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-12">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 text-gray-500 text-xs font-mono uppercase tracking-wider"
          >
            <div className="w-5 h-5 border-2 border-accent-red/30 border-t-accent-red animate-spin rounded-full" />
            Загрузка...
          </motion.div>
        </div>
      )}

      {/* Empty state */}
      {filteredItems.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-24"
        >
          <div className="w-20 h-20 bg-surface border border-white/5 flex items-center justify-center mx-auto mb-5"
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)' }}
          >
            <span className="text-4xl">🎨</span>
          </div>
          <h3 className="text-xl font-semibold text-gray-300 mb-2">No projects found</h3>
          <p className="text-gray-500 text-xs font-mono uppercase tracking-wider">No portfolio items in this category yet.</p>
          <button
            onClick={() => setActiveCategory('all')}
            className="mt-6 px-5 py-2 bg-accent-red/10 text-accent-red text-xs font-mono uppercase tracking-wider hover:bg-accent-red/20 transition-colors"
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)' }}
          >
            View All Projects
          </button>
        </motion.div>
      )}

      {/* Olympus-style modal lightbox */}
      <AnimatePresence>
        {lightboxItem && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeLightbox}
          >
            <motion.div
              className="relative w-full max-w-6xl my-8"
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.97 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              key={lightboxItem.id}
            >
              <div
                className="rounded-2xl overflow-hidden bg-zinc-900/90 border border-white/10 shadow-2xl"
                style={{
                  background: 'linear-gradient(to right bottom, rgba(30, 30, 45, 0.95), rgba(20, 20, 30, 0.95))',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                }}
              >
                {/* Sticky header */}
                <div className="sticky top-0 z-30 bg-black/60 backdrop-blur-md p-6 border-b border-white/10 flex justify-between items-center shadow-md">
                  <div>
                    <h3 className="text-2xl font-bold text-white">{lightboxItem.title}</h3>
                    <p className="text-indigo-300 text-sm">{lightboxItem.category?.name}</p>
                  </div>
                  <button
                    onClick={closeLightbox}
                    className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[calc(85vh-140px)] overflow-y-auto">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left — Media */}
                    <div className="relative">
                      <div className="relative bg-black/30 rounded-xl overflow-hidden shadow-xl border border-white/10 flex items-center justify-center group/media cursor-pointer"
                        onClick={() => openZoom(lightboxItem)}
                      >
                        {lightboxItem.file_type === 'video' ? (
                          <video
                            src={getImageUrl(lightboxItem.gif_url || lightboxItem.image_url)}
                            className="w-full h-auto max-h-[500px] object-contain"
                            autoPlay
                            muted
                            loop
                            playsInline
                          />
                        ) : (
                          <img
                            src={getImageUrl(lightboxItem.gif_url || lightboxItem.image_url)}
                            alt={lightboxItem.title}
                            className="w-full h-auto max-h-[500px] object-contain"
                          />
                        )}
                        {/* Zoom overlay on hover (images + videos) */}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/media:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
                          <div className="bg-black/60 backdrop-blur-md text-white p-3 rounded-full border border-white/20">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Nav arrows on image */}
                      {lightboxIndex > 0 && (
                        <button
                          onClick={prevItem}
                          className="absolute top-1/2 -translate-y-1/2 left-4 hover:bg-black/80 bg-black/60 backdrop-blur-md text-white p-3 rounded-full border border-white/20 transition-all transform hover:scale-110 z-20 shadow-lg"
                        >
                          <ChevronLeft size={20} />
                        </button>
                      )}
                      {lightboxIndex < filteredItems.length - 1 && (
                        <button
                          onClick={nextItem}
                          className="absolute top-1/2 -translate-y-1/2 right-4 hover:bg-black/80 bg-black/60 backdrop-blur-md text-white p-3 rounded-full border border-white/20 transition-all transform hover:scale-110 z-20 shadow-lg"
                        >
                          <ChevronRight size={20} />
                        </button>
                      )}
                    </div>

                    {/* Right — Details */}
                    <div className="space-y-6">
                      {/* Project Details */}
                      <div className="bg-black/30 rounded-xl p-6 border border-white/10">
                        <h4 className="text-xl font-semibold text-white mb-4">Project Details</h4>
                        <p className="text-zinc-300 mb-6">{lightboxItem.description || lightboxItem.category?.name || 'Design Project'}</p>

                        <div className="space-y-3">
                          <h5 className="text-white font-medium">Benefits</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex items-start gap-2 bg-white/5 p-3 rounded-lg">
                              <div className="mt-0.5">
                                <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <div>
                                <h6 className="text-white font-medium">Professional Design</h6>
                                <p className="text-zinc-400 text-sm">High-quality work from industry experts</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2 bg-white/5 p-3 rounded-lg">
                              <div className="mt-0.5">
                                <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <div>
                                <h6 className="text-white font-medium">Quick Turnaround</h6>
                                <p className="text-zinc-400 text-sm">Fast delivery without compromising quality</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2 bg-white/5 p-3 rounded-lg">
                              <div className="mt-0.5">
                                <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <div>
                                <h6 className="text-white font-medium">Unlimited Revisions</h6>
                                <p className="text-zinc-400 text-sm">We work until you&apos;re completely satisfied</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2 bg-white/5 p-3 rounded-lg">
                              <div className="mt-0.5">
                                <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <div>
                                <h6 className="text-white font-medium">Full Rights</h6>
                                <p className="text-zinc-400 text-sm">You own all rights to your designs</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Creator */}
                      <div className="bg-black/30 rounded-xl p-6 border border-white/10">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center shadow-inner">
                            <span className="text-white font-medium text-lg">S</span>
                          </div>
                          <div>
                            <h5 className="text-white font-medium">Smuzzie Design</h5>
                            <p className="text-zinc-400 text-sm">Creative Studio</p>
                          </div>
                        </div>
                      </div>

                      {/* Close button */}
                      <div className="flex gap-4">
                        <button
                          onClick={closeLightbox}
                          className="flex-1 bg-white/10 hover:bg-white/15 text-white px-6 py-3 rounded-lg transition-colors border border-white/10"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sticky bottom pagination */}
                <div className="sticky bottom-0 bg-black/60 backdrop-blur-md border-t border-white/10 p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.2)] z-20">
                  <div className="flex justify-between items-center">
                    <span className="text-white/70 text-sm">
                      Project {lightboxIndex + 1} of {filteredItems.length}
                    </span>
                    <div className="flex items-center gap-1">
                      {filteredItems.slice(
                        Math.max(0, lightboxIndex - 2),
                        Math.min(filteredItems.length, lightboxIndex + 3)
                      ).map((_, i) => {
                        const actualIndex = Math.max(0, lightboxIndex - 2) + i;
                        return (
                          <div
                            key={actualIndex}
                            className={`w-2 h-2 rounded-full transition-colors ${
                              actualIndex === lightboxIndex ? 'bg-indigo-500' : 'bg-white/30'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen pan+zoom viewer */}
      <AnimatePresence>
        {zoomedMedia && (
          <ZoomViewer media={zoomedMedia} onClose={() => setZoomedMedia(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
