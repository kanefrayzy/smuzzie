'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';

const DESIGN_RED = '#e63946';

const STEPS = [
  { cmd: 'brief', out: 'goals, pages, references and deadline locked in', time: 'day 1' },
  { cmd: 'design', out: 'Smuzzie designs the UI, brand assets and motion', time: 'week 1', design: true },
  { cmd: 'build', out: 'we code it: responsive, fast, with an admin you can use', time: 'week 2–3' },
  { cmd: 'ship', out: 'launch, SEO, analytics, then support as you grow', time: 'launch' },
];

export default function DevProcess() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section id="process" className="relative py-24 md:py-32 scroll-mt-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="font-mono text-xs tracking-[0.2em] text-accent-red mb-4">{'// process'}</div>
          <h2 className="font-mono font-bold tracking-tight text-3xl md:text-5xl text-white">One brief. One team.</h2>
          <p className="mt-5 text-gray-500 max-w-xl mx-auto">
            Design and development in one flow, so the site you launch is the one you approved.
          </p>
        </div>

        <div ref={ref} className="rounded-xl border border-white/[0.08] bg-[#060707] overflow-hidden">
          <div className="flex items-center gap-2 px-4 h-9 border-b border-white/[0.06]">
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="ml-3 font-mono text-[10px] tracking-wider text-gray-600">~/your-project</span>
          </div>
          <div className="p-5 sm:p-7 font-mono text-[12px] sm:text-sm space-y-5">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.cmd}
                initial={{ opacity: 0, x: -10 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: i * 0.45, duration: 0.4 }}
                className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1"
              >
                <span className="text-gray-700">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <span className="text-accent-red">$</span>{' '}
                  <span className="text-white">smuzzie {s.cmd}</span>
                  {s.design && (
                    <Link
                      href="/"
                      className="ml-2 align-middle px-2 py-0.5 rounded text-[9px] tracking-[0.15em] uppercase"
                      style={{ color: DESIGN_RED, background: 'rgba(230,57,70,0.12)', boxShadow: 'inset 0 0 0 1px rgba(230,57,70,0.4)' }}
                    >
                      design mode
                    </Link>
                  )}
                  <motion.div
                    className="mt-1 text-gray-500"
                    initial={{ opacity: 0 }}
                    animate={inView ? { opacity: 1 } : {}}
                    transition={{ delay: i * 0.45 + 0.25 }}
                  >
                    <span style={{ color: s.design ? DESIGN_RED : undefined }} className={s.design ? '' : 'text-accent-red'}>
                      ✓
                    </span>{' '}
                    {s.out}
                  </motion.div>
                </div>
                <span className="hidden sm:block text-gray-700 text-[11px] uppercase tracking-wider">{s.time}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
