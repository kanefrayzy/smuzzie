'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Terminal } from 'lucide-react';
import ScrambleText from '@/components/mode/ScrambleText';
import CodeWindow from './CodeWindow';
import HeroHelmet from './HeroHelmet';

const WORDS = ['Websites', 'Web Apps', 'Landing Pages', 'Online Stores', 'Dashboards'];

function RotatingWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % WORDS.length), 2600);
    return () => clearInterval(id);
  }, []);
  return <ScrambleText text={WORDS[i]} duration={600} className="text-accent-red" />;
}

const STATS = [
  { value: '1', label: 'Team for design + code' },
  { value: '<1s', label: 'Load time target' },
  { value: 'SEO', label: 'Built in' },
  { value: '24/7', label: 'Support' },
];

export default function DevHero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#030504]" />
      <div
        className="absolute top-1/2 right-[5%] w-[900px] h-[900px] -translate-y-1/2 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgb(var(--accent) / 0.10) 0%, transparent 60%)' }}
      />
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-primary to-transparent" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 lg:pt-28 pb-16 lg:pb-32 grid lg:grid-cols-[1.05fr_1fr] lg:gap-10 items-center">
        {/* Text. On phones it goes under the helmet, centered */}
        <div className="order-2 lg:order-none relative z-10 -mt-12 sm:-mt-16 lg:mt-0 text-center lg:text-left">
          <motion.div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-accent-red/20 bg-accent-red/[0.04] mb-5 lg:mb-7"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Terminal size={12} className="text-accent-red" />
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-gray-400">
              <ScrambleText text="Accepting new builds" delay={200} />
            </span>
          </motion.div>

          <h1 className="font-mono font-bold tracking-tight leading-[1] text-5xl sm:text-6xl lg:text-7xl">
            <ScrambleText text="SmuzZie" duration={700} className="text-white" />
            <span className="block mt-2 text-gray-600">
              {'<'}
              <ScrambleText text="Dev" duration={700} delay={250} className="text-accent-red" />
              {' />'}
            </span>
          </h1>

          <p className="mt-5 lg:mt-7 font-mono text-xl sm:text-2xl text-gray-300">
            We build <RotatingWord />
          </p>

          <motion.p
            className="mt-4 lg:mt-5 max-w-lg mx-auto lg:mx-0 text-gray-500 leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Designed by Smuzzie, engineered to ship. Fast, SEO-ready sites and web apps from one team, so nothing
            gets lost between the mockup and production.
          </motion.p>

          <motion.div
            className="mt-7 lg:mt-9 flex flex-col sm:flex-row sm:justify-center lg:justify-start gap-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Link href="/contact" className="btn-primary justify-center">
              Start a Project <ArrowRight size={16} />
            </Link>
            <Link href="/dev#process" className="btn-outline justify-center font-mono">
              $ how --we-work
            </Link>
          </motion.div>

          <motion.div
            className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-xl mx-auto lg:mx-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
          >
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="font-mono font-bold text-2xl sm:text-3xl text-white">{s.value}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-gray-600">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Visual: the Smuzzie helmet (render, then interactive 3D), code window over its lower half.
            On phones the wrapper dissolves (display: contents): helmet first, then the text, then the code. */}
        <div className="contents lg:block lg:relative">
          <motion.div
            className="order-1 lg:order-none relative w-[min(82vw,340px)] sm:w-[420px] lg:w-full max-w-[520px] mx-auto lg:mr-0 aspect-square lg:aspect-[4/5]"
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <HeroHelmet />
          </motion.div>

          <motion.div
            className="order-3 lg:order-none relative mt-14 lg:mt-0 lg:absolute lg:-left-28 lg:top-[57%] w-full lg:w-[440px] text-left"
            initial={{ opacity: 0, y: 30, rotateX: 8 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: 0.3, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            style={{ perspective: 1000 }}
          >
            <CodeWindow />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
