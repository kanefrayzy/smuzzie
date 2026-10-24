'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';

type Token = [text: string, className: string];

const C = {
  comment: 'text-gray-600',
  keyword: 'text-accent-red',
  string: 'text-amber-300',
  prop: 'text-sky-300',
  fn: 'text-violet-300',
  punct: 'text-gray-400',
  plain: 'text-gray-200',
};

const CODE: Token[][] = [
  [['// smuzzie.config.ts', C.comment]],
  [['import', C.keyword], [' { ', C.punct], ['defineProject', C.fn], [' } ', C.punct], ['from', C.keyword], [" 'smuzzie'", C.string]],
  [],
  [['export default ', C.keyword], ['defineProject', C.fn], ['({', C.punct]],
  [['  design', C.prop], [':  ', C.punct], ["'smuzzie'", C.string], [',  ', C.punct], ['// brand, UI, motion', C.comment]],
  [['  stack', C.prop], [':   ', C.punct], ['[', C.punct], ["'next'", C.string], [', ', C.punct], ["'laravel'", C.string], ['],', C.punct]],
  [['  seo', C.prop], [':     ', C.punct], ['true', C.keyword], [',', C.punct]],
  [['  speed', C.prop], [':   ', C.punct], ["'instant'", C.string], [',', C.punct]],
  [['  handoff', C.prop], [': ', C.punct], ['false', C.keyword], [',   ', C.punct], ['// one team, no gaps', C.comment]],
  [['})', C.punct]],
];

// Characters per line, counting the newline
const LINE_LEN = CODE.map((line) => line.reduce((m, [t]) => m + t.length, 0) + 1);
const TOTAL = LINE_LEN.reduce((a, b) => a + b, 0);

const OUTPUT = ['design approved', 'build passed · 0 errors', 'live → your-brand.com'];

/** Editor window that types out a project config, then "ships" it. */
export default function CodeWindow() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const [typed, setTyped] = useState(0);
  const done = typed >= TOTAL;

  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTyped(TOTAL);
      return;
    }
    const id = setInterval(() => {
      setTyped((n) => {
        if (n >= TOTAL) {
          clearInterval(id);
          return n;
        }
        return n + 2;
      });
    }, 22);
    return () => clearInterval(id);
  }, [inView]);

  // Line the caret is on: the first one not fully typed yet
  let caretLine = CODE.length - 1;
  for (let li = 0, sum = 0; li < CODE.length; li++) {
    sum += LINE_LEN[li];
    if (typed < sum) {
      caretLine = li;
      break;
    }
  }
  let left = typed;

  return (
    <div
      ref={ref}
      className="relative w-full rounded-xl border border-white/[0.08] bg-[#050807]/70 backdrop-blur-xl shadow-[0_0_80px_-20px_rgb(var(--accent)/0.35)] overflow-hidden text-left"
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 h-9 border-b border-white/[0.06] bg-white/[0.02]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 font-mono text-[10px] tracking-wider text-gray-500">smuzzie.config.ts</span>
      </div>

      {/* Code */}
      <pre className="px-4 sm:px-5 py-4 font-mono text-[11px] sm:text-[13px] leading-[1.75] overflow-x-auto">
        {CODE.map((line, li) => {
          const parts = line.map(([text, cls], ti) => {
            const n = Math.max(0, Math.min(text.length, left));
            left -= n;
            return n > 0 ? (
              <span key={ti} className={cls}>
                {text.slice(0, n)}
              </span>
            ) : null;
          });
          left = Math.max(0, left - 1); // newline
          return (
            <div key={li} className="flex">
              <span className="w-6 sm:w-8 shrink-0 select-none text-gray-700">{li + 1}</span>
              <span className="whitespace-pre">
                {parts}
                {inView && !done && li === caretLine && (
                  <span className="inline-block w-[7px] h-[1.1em] -mb-[0.2em] bg-accent-red animate-pulse" />
                )}
                {line.length === 0 && ' '}
              </span>
            </div>
          );
        })}
      </pre>

      {/* Terminal */}
      <div className="border-t border-white/[0.06] bg-black/40 px-4 sm:px-5 py-3 font-mono text-[11px] sm:text-[12px] leading-relaxed min-h-[92px]">
        <div className="text-gray-500">
          <span className="text-accent-red">$</span> smuzzie ship
        </div>
        {done &&
          OUTPUT.map((line, i) => (
            <motion.div
              key={line}
              className="text-gray-300"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + i * 0.35 }}
            >
              <span className="text-accent-red">✓</span> {line}
            </motion.div>
          ))}
      </div>
    </div>
  );
}
