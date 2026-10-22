'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BannerOverlay, hueFilter, loadFonts } from '@/lib/banner-overlay';
import type { BannerFontFace, BuyerParams, OverlayResult, TemplateConfig } from '@/lib/banner-overlay';
import { getImageUrl } from '@/lib/utils';

interface Props {
  width: number;
  height: number;
  previewUrl: string | null;
  posterUrl?: string | null;
  config: TemplateConfig;
  params: BuyerParams;
  images?: Record<string, string | null | undefined>;
  fonts: BannerFontFace[];
  onResult?: (result: OverlayResult) => void;
  /** Drawn on top of the preview in viewport coordinates (e.g. admin zone handles) */
  children?: React.ReactNode;
  className?: string;
  /** Show the text layer (the admin zone editor can switch it off) */
  showOverlay?: boolean;
}

/**
 * Live banner preview: the watermarked preview video with the CSS hue shift, plus the shared
 * overlay laid out in the template's native resolution and scaled down with a transform, so
 * line breaks are exactly the ones the renderer will produce.
 */
export default function BannerPreview({
  width, height, previewUrl, posterUrl, config, params, images, fonts, onResult, children, className = '', showOverlay = true,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<BannerOverlay | null>(null);
  const [fontsVersion, setFontsVersion] = useState(0);
  const [hue, setHue] = useState(0);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  // One overlay per template resolution
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const overlay = new BannerOverlay(stage, width, height);
    overlayRef.current = overlay;
    return () => {
      overlay.destroy();
      overlayRef.current = null;
    };
  }, [width, height]);

  // Fonts: register the faces, then re-measure once they are usable
  const fontKey = fonts.map((f) => `${f.id}:${f.url}`).join(',');
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    let cancelled = false;
    overlay.setFonts(fonts);
    loadFonts(fonts, (f) => getImageUrl(f.url))
      .then(() => overlay.fontsReady(config))
      .then(() => {
        if (!cancelled) setFontsVersion((v) => v + 1);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontKey, width, height]);

  // Lay out the overlay on every change; it is synchronous and cheap
  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const result = overlay.render({ config, params, images });
    setHue(result.hue);
    onResultRef.current?.(result);
  }, [config, params, images, fontsVersion, width, height]);

  // Fit the native-size stage into the viewport
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const stage = stageRef.current;
    if (!viewport || !stage) return;
    const apply = () => {
      stage.style.transform = `scale(${viewport.clientWidth / width})`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(viewport);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div
      ref={viewportRef}
      className={`relative overflow-hidden bg-black select-none ${className}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {previewUrl && (
        <video
          key={previewUrl}
          src={getImageUrl(previewUrl)}
          poster={posterUrl ? getImageUrl(posterUrl) : undefined}
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: 'fill', filter: hueFilter(hue) }}
          muted
          loop
          autoPlay
          playsInline
          preload="auto"
          aria-hidden="true"
        />
      )}
      <div
        ref={stageRef}
        className="absolute left-0 top-0 pointer-events-none"
        style={{ transformOrigin: '0 0', visibility: showOverlay ? 'visible' : 'hidden' }}
      />
      {children && <div className="absolute inset-0">{children}</div>}
    </div>
  );
}
