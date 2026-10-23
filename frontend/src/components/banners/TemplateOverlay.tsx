'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BannerOverlay, defaultParams, loadFonts } from '@/lib/banner-overlay';
import type { BannerFontFace, TemplateConfig } from '@/lib/banner-overlay';
import { getImageUrl } from '@/lib/utils';
import { zoneImageUrl } from '@/lib/banner-formats';

/**
 * A template's default texts and images, drawn over a poster or video it is placed on (catalog
 * cards). Same layout module as the editor, scaled down from the native size, so the card shows
 * what the editor opens with.
 */
export default function TemplateOverlay({
  width, height, config, fonts,
}: {
  width: number;
  height: number;
  config: TemplateConfig;
  fonts: BannerFontFace[];
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [overlay, setOverlay] = useState<BannerOverlay | null>(null);
  const [ready, setReady] = useState(false);

  const params = useMemo(() => defaultParams(config), [config]);
  const images = useMemo(() => {
    const out: Record<string, string> = {};
    for (const z of config.zones) if (z.type === 'image' && z.style.image) out[z.key] = zoneImageUrl(z.style.image);
    return out;
  }, [config]);

  useLayoutEffect(() => {
    if (!stageRef.current) return;
    const o = new BannerOverlay(stageRef.current, width, height);
    setOverlay(o);
    return () => o.destroy();
  }, [width, height]);

  // Lay out once the fonts are in (measuring with a fallback font would break lines wrongly)
  useEffect(() => {
    if (!overlay) return;
    let cancelled = false;
    overlay.setFonts(fonts);
    loadFonts(fonts, (f) => getImageUrl(f.url))
      .then(() => overlay.fontsReady(config))
      .then(() => {
        if (cancelled) return;
        overlay.render({ config, params, images });
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [overlay, fonts, config, params, images]);

  // Fit the native-size stage into the card
  useLayoutEffect(() => {
    const box = boxRef.current;
    const stage = stageRef.current;
    if (!box || !stage) return;
    const apply = () => {
      stage.style.transform = `scale(${box.clientWidth / width})`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(box);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div ref={boxRef} className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div
        ref={stageRef}
        className="absolute left-0 top-0 transition-opacity duration-300"
        style={{ transformOrigin: '0 0', opacity: ready ? 1 : 0 }}
      />
    </div>
  );
}
