'use client';

import { useEffect, useState } from 'react';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/{}[]=+*#$%&';

/**
 * Text that "decrypts": random glyphs resolve into the text left to right,
 * on mount and whenever `text` changes. Renders the plain text on the server.
 */
export default function ScrambleText({
  text,
  duration = 800,
  delay = 0,
  className,
}: {
  text: string;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(text);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(text);
      return;
    }
    let frame = 0;
    let lastSwap = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start) / duration));
      // Swapping glyphs every frame is too flickery; ~20 times a second reads well
      if (now - lastSwap > 50 || progress === 1) {
        lastSwap = now;
        const revealed = Math.floor(progress * text.length);
        let out = '';
        for (let i = 0; i < text.length; i++) {
          const c = text[i];
          out += i < revealed || c === ' ' ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
        setShown(out);
      }
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, duration, delay]);

  return <span className={className}>{shown}</span>;
}
