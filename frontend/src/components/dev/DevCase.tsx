'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { ArrowUpRight, Lock } from 'lucide-react';

const FEATURES = [
  { k: 'Banner Maker', v: 'In-browser editor; the server renders MP4/GIF/PNG with headless Chromium and ffmpeg' },
  { k: 'Payments', v: 'Crypto checkout per order with automatic confirmation' },
  { k: 'Media', v: 'Every upload turned into WebP and H.264 variants for fast pages' },
  { k: 'Admin', v: 'Portfolio, reviews, templates, orders and fonts in one panel' },
];

const STACK = ['Next.js 14', 'TypeScript', 'Laravel 10', 'MySQL', 'ffmpeg', 'Chromium'];

/** Screenshot of a real page in a minimal browser frame */
function BrowserShot({ src, url, className }: { src: string; url: string; className?: string }) {
  return (
    <div className={`rounded-xl overflow-hidden border border-white/10 bg-[#0d0d0f] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] ${className ?? ''}`}>
      <div className="h-7 flex items-center gap-2 px-3 bg-[#18181b] border-b border-white/[0.06]">
        <span className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-white/15" />
          <span className="w-2 h-2 rounded-full bg-white/15" />
          <span className="w-2 h-2 rounded-full bg-white/15" />
        </span>
        <span className="mx-auto flex items-center gap-1 text-[10px] text-white/40">
          <Lock size={8} /> {url}
        </span>
      </div>
      <div className="relative aspect-[1440/840]">
        <Image src={src} alt="" fill unoptimized sizes="(min-width: 1024px) 560px, 90vw" className="object-cover object-top" />
      </div>
    </div>
  );
}

/** Smuzzie's animated thread cover (5 s loop). Starts loading only when scrolled near. */
function ThreadCover() {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { once: true, margin: '300px' });
  return (
    <div
      ref={ref}
      className="relative h-full aspect-[720/1348] rounded-2xl overflow-hidden border border-white/10 bg-black shadow-[0_30px_80px_-20px_rgba(230,57,70,0.45)]"
    >
      {near ? (
        <video
          src="/images/dev/smuzzie-thread.mp4"
          poster="/images/dev/smuzzie-thread.webp"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-label="Smuzzie thread cover, animated"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <Image src="/images/dev/smuzzie-thread.webp" alt="" fill unoptimized sizes="300px" className="object-cover" />
      )}
    </div>
  );
}

export default function DevCase() {
  return (
    <section className="relative py-24 md:py-32 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1fr_1.15fr] gap-14 items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
        >
          <div className="font-mono text-xs tracking-[0.2em] text-accent-red mb-4">{'// case study'}</div>
          <h2 className="font-mono font-bold tracking-tight text-3xl md:text-4xl text-white">You&apos;re looking at it.</h2>
          <p className="mt-5 text-gray-500 leading-relaxed">
            smuzzie.com is our own build: a portfolio, a banner maker that renders video on the server, crypto payments
            and a full admin panel. Designed and coded by the same team.
          </p>

          <dl className="mt-8 divide-y divide-white/[0.06] border-y border-white/[0.06]">
            {FEATURES.map((f) => (
              <div key={f.k} className="grid sm:grid-cols-[130px_1fr] gap-1 sm:gap-5 py-3.5">
                <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-gray-400 pt-0.5">{f.k}</dt>
                <dd className="text-sm text-gray-500">{f.v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 flex flex-wrap gap-1.5">
            {STACK.map((t) => (
              <span key={t} className="px-2 py-0.5 rounded border border-white/[0.06] font-mono text-[10px] text-gray-500">
                {t}
              </span>
            ))}
          </div>

          <Link href="/banners" className="mt-7 inline-flex items-center gap-1.5 font-mono text-sm text-accent-red hover:underline">
            Try the Banner Maker <ArrowUpRight size={15} />
          </Link>
        </motion.div>

        {/* The banner editor (real screenshot) and Smuzzie's animated thread cover */}
        <div className="relative h-[420px] sm:h-[520px] lg:h-[560px]">
          <div
            className="absolute inset-0 -z-10"
            style={{ background: 'radial-gradient(circle at 60% 50%, rgb(var(--accent) / 0.12), transparent 65%)' }}
          />
          <motion.div
            className="hidden sm:block absolute left-0 top-[22%] w-[80%]"
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <BrowserShot src="/images/dev/case-editor.webp" url="smuzzie.com/banners" className="opacity-80" />
          </motion.div>
          <div className="absolute inset-0 flex justify-center sm:justify-end">
            <motion.div
              className="h-full"
              initial={{ opacity: 0, y: 30, rotate: 0 }}
              whileInView={{ opacity: 1, y: 0, rotate: 2 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ delay: 0.15, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <ThreadCover />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
