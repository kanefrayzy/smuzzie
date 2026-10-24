'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { STAGE_MASK } from './hero3d/mask';

// three.js + the model (~1 MB) load only on the client, after the page settles
const ModelHelmet = dynamic(() => import('./hero3d/ModelHelmet'), { ssr: false });

function canRun3d() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (nav.connection?.saveData) return false;
  if ((nav.hardwareConcurrency ?? 8) < 4 || (nav.deviceMemory ?? 8) < 4) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Hero visual: the static helmet render first (fast, and the fallback on weak
 * devices), then the interactive 3D model fades in over it once it is ready.
 */
export default function HeroHelmet() {
  const [load3d, setLoad3d] = useState(false);
  const [ready, setReady] = useState(false);
  const [touched, setTouched] = useState(false);
  const [hint, setHint] = useState('↻ drag to rotate');

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) setHint('↻ swipe to spin');
    if (!canRun3d()) return;
    const start = () => setLoad3d(true);
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(start, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(start, 600);
    return () => clearTimeout(id);
  }, []);

  return (
    <>
      <Image
        src="/images/dev/hero-helmet.webp"
        unoptimized
        alt=""
        fill
        priority
        sizes="520px"
        className="object-cover transition-opacity duration-1000"
        style={{ ...STAGE_MASK, objectPosition: '50% 45%', opacity: ready ? 0 : 1 }}
      />
      {load3d && (
        <div
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: ready ? 1 : 0 }}
          onPointerDown={() => setTouched(true)}
        >
          <ModelHelmet onReady={() => setReady(true)} />
        </div>
      )}
      {ready && (
        <span
          className={`pointer-events-none absolute right-2 lg:right-6 top-2 lg:top-6 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 transition-opacity duration-700 ${
            touched ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {hint}
        </span>
      )}
    </>
  );
}
