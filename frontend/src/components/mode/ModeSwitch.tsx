'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MODE_COLOR, MODE_HOME, modeFromPath, type SiteMode } from '@/lib/site-mode';

type ViewTransition = { ready: Promise<void>; finished: Promise<void> };
type DocumentWithVT = Document & {
  startViewTransition?: (update: () => Promise<void> | void) => ViewTransition;
};

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * DESIGN ⇄ DEV toggle in the header. Switching navigates between / and /dev;
 * where the View Transitions API exists, the new page is revealed by a circle
 * growing from the toggle.
 */
export default function ModeSwitch({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const mode = modeFromPath(pathname);
  // Moves the pill right away, before the navigation finishes
  const [pending, setPending] = useState<SiteMode | null>(null);
  const shown = pending ?? mode;
  const finishTransition = useRef<(() => void) | null>(null);

  // The new route has rendered: let the view transition take its snapshot
  useIsomorphicLayoutEffect(() => {
    setPending(null);
    finishTransition.current?.();
    finishTransition.current = null;
  }, [pathname]);

  useEffect(() => {
    router.prefetch(MODE_HOME[mode === 'dev' ? 'design' : 'dev']);
  }, [router, mode]);

  function switchTo(target: SiteMode, origin: HTMLElement, clientX: number, clientY: number) {
    if (target === mode || pending) return;
    const href = MODE_HOME[target];
    setPending(target);

    const doc = document as DocumentWithVT;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!doc.startViewTransition || reduceMotion) {
      router.push(href);
      return;
    }

    // Keyboard clicks have no pointer position: start from the control's center
    let x = clientX;
    let y = clientY;
    if (!x && !y) {
      const r = origin.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }

    const transition = doc.startViewTransition(
      () =>
        new Promise<void>((resolve) => {
          finishTransition.current = resolve;
          router.push(href);
          // Never hold the page frozen if the navigation stalls
          setTimeout(resolve, 2500);
        }),
    );

    transition.ready
      .then(() => {
        const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 750, easing: 'cubic-bezier(0.7, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
        );
      })
      .catch(() => {});
  }

  const onPick = (target: SiteMode) => (e: React.MouseEvent<HTMLButtonElement>) =>
    switchTo(target, e.currentTarget, e.clientX, e.clientY);
  const onToggle = (e: React.MouseEvent<HTMLButtonElement>) =>
    switchTo(mode === 'dev' ? 'design' : 'dev', e.currentTarget, e.clientX, e.clientY);

  const label = compact ? 'text-[9px] px-2.5' : 'text-[10px] px-3.5';

  return (
    <div
      role="group"
      aria-label="Site mode"
      className="relative flex items-center h-9 p-1 rounded-full border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm"
    >
      {(['design', 'dev'] as const).map((m, i) => (
        <React.Fragment key={m}>
          {i === 1 && (
            <button
              type="button"
              onClick={onToggle}
              aria-label={mode === 'dev' ? 'Switch to design mode' : 'Switch to development mode'}
              className="relative z-10 mx-1 flex h-7 w-7 items-center justify-center"
            >
              <motion.span
                className="block"
                animate={{ rotateY: shown === 'dev' ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                style={{
                  filter:
                    shown === 'dev'
                      ? 'hue-rotate(150deg) saturate(1.3) drop-shadow(0 0 8px rgba(52,245,150,0.5))'
                      : 'drop-shadow(0 0 8px rgba(230,57,70,0.5))',
                  transition: 'filter 0.5s ease',
                }}
              >
                <Image src="/images/logo.svg" alt="" width={16} height={27} priority />
              </motion.span>
            </button>
          )}
          <button
            type="button"
            onClick={onPick(m)}
            aria-pressed={shown === m}
            className={`relative z-10 h-7 rounded-full font-mono font-bold uppercase tracking-[0.2em] transition-colors duration-300 ${label} ${
              shown === m ? 'text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {shown === m && (
              <motion.span
                layoutId="mode-pill"
                className="absolute inset-0 -z-10 rounded-full"
                style={{
                  background: `${MODE_COLOR[m]}26`,
                  boxShadow: `inset 0 0 0 1px ${MODE_COLOR[m]}66, 0 0 18px ${MODE_COLOR[m]}33`,
                }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            {m === 'design' ? 'Design' : 'Dev'}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
