'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, Languages, Lock, Maximize2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';

type Work = {
  key: string;
  name: string;
  url: string;
  domain: string;
  kind: string;
  text: string;
  tags: string[];
  /** The screenshot is a translation of a Russian-only site */
  translated?: boolean;
};

// Full-page screenshots in public/images/dev/work (1440px viewport, 960px wide WebP)
const WORKS: Work[] = [
  {
    key: 'pixera',
    name: 'Pixera',
    url: 'https://pixera.net/en/',
    domain: 'pixera.net',
    kind: 'AI platform',
    text: 'AI image and video generation with a creator community: gallery, profiles, trends and a blog.',
    tags: ['Web app', 'AI', '7 languages'],
  },
  {
    key: 'briarey',
    name: 'Briarey',
    url: 'https://xn--b1affkdfqgb0alh5d9bg.xn--p1ai/',
    domain: 'бриарей.рф',
    kind: 'Industrial e-commerce',
    text: 'Manufacturer of smoke-exhaust systems: product catalog, cart, equipment calculator, news.',
    tags: ['Next.js', 'Catalog', 'Calculator'],
    translated: true,
  },
  {
    key: 'bueno',
    name: 'Bueno Exotics',
    url: 'https://buenoexoticsny.com/',
    domain: 'buenoexoticsny.com',
    kind: 'Car rental · New York',
    text: 'Exotic car rental on Long Island: availability check, booking requests, occasion pages.',
    tags: ['Next.js', 'Booking', 'Local SEO'],
  },
  {
    key: 'npkbsv',
    name: 'NPK BSV',
    url: 'https://npk-bsv.ru/',
    domain: 'npk-bsv.ru',
    kind: 'Aviation engineering',
    text: 'Coaxial helicopters and composite parts: product pages and an engineering brief form with file upload.',
    tags: ['Next.js', 'B2B', 'Lead form'],
    translated: true,
  },
  {
    key: 'blesk',
    name: 'Blesk',
    url: 'https://bleskvip.ru/',
    domain: 'bleskvip.ru',
    kind: 'Local service',
    text: 'Dry cleaning chain: step-by-step order request, customer account with order tracking.',
    tags: ['Next.js', 'Customer account', 'Forms'],
    translated: true,
  },
  {
    key: 'nikstudio',
    name: 'Nik Studio',
    url: 'https://nikstudio.pro/',
    domain: 'nikstudio.pro',
    kind: 'Creative agency',
    text: 'Studio for industrial brands: project showcase, services, media and client testimonials.',
    tags: ['Next.js', 'Portfolio', 'Motion'],
    translated: true,
  },
];

const img = (w: Work) => `/images/dev/work/${w.key}.webp`;
// 1280px version for the full-page viewer
const imgFull = (w: Work) => `/images/dev/work/${w.key}-full.webp`;

function BrowserBar({ domain }: { domain: string }) {
  return (
    <div className="h-8 shrink-0 flex items-center gap-2 px-3 bg-[#141716] border-b border-white/[0.06]">
      <span className="flex gap-1">
        <span className="w-2 h-2 rounded-full bg-white/15" />
        <span className="w-2 h-2 rounded-full bg-white/15" />
        <span className="w-2 h-2 rounded-full bg-white/15" />
      </span>
      <span className="mx-auto flex items-center gap-1 px-3 h-5 rounded bg-white/[0.04] text-[10px] text-white/40 truncate max-w-[70%]">
        <Lock size={8} className="shrink-0" /> {domain}
      </span>
    </div>
  );
}

function WorkCard({ w, i, onOpen }: { w: Work; i: number; onOpen: () => void }) {
  return (
    <motion.article
      className="group"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay: (i % 3) * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`View the full ${w.name} page`}
        className="block w-full text-left rounded-xl overflow-hidden border border-white/[0.08] bg-[#0b0d0c] transition-all duration-500 group-hover:border-accent-red/40 group-hover:shadow-[0_20px_60px_-20px_rgb(var(--accent)/0.35)]"
      >
        <BrowserBar domain={w.domain} />
        <div className="relative h-[340px] sm:h-[380px] overflow-hidden">
          {/* The page scrolls top to bottom on hover */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img(w)}
            alt={`${w.name} website, full page`}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover object-top transition-[object-position] ease-in-out duration-[700ms] [@media(hover:hover)]:group-hover:object-bottom [@media(hover:hover)]:group-hover:duration-[7000ms]"
          />
          <span className="absolute right-3 bottom-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur font-mono text-[10px] uppercase tracking-[0.15em] text-white/80 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity">
            <Maximize2 size={10} /> Full page
          </span>
        </div>
      </button>

      <div className="mt-4 px-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-mono font-bold text-lg text-white">{w.name}</h3>
          <a
            href={w.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1 font-mono text-[11px] text-gray-500 hover:text-accent-red transition-colors"
          >
            Live site <ArrowUpRight size={12} />
          </a>
        </div>
        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-accent-red/80">{w.kind}</div>
        <p className="mt-2 text-sm text-gray-500 leading-relaxed">{w.text}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {w.tags.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded border border-white/[0.06] font-mono text-[10px] text-gray-500">
              {t}
            </span>
          ))}
          {w.translated && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] text-gray-600"
              title="The site is in Russian; this screenshot was translated for the portfolio"
            >
              <Languages size={10} /> Original in Russian
            </span>
          )}
        </div>
      </div>
    </motion.article>
  );
}

export default function DevWork() {
  const [open, setOpen] = useState<Work | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <section id="work" className="relative py-24 md:py-32 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <div className="font-mono text-xs tracking-[0.2em] text-accent-red mb-4">{'// selected work'}</div>
            <h2 className="font-mono font-bold tracking-tight text-3xl md:text-5xl text-white">Shipped and live.</h2>
            <p className="mt-5 text-gray-500">
              Real sites for real clients, from AI platforms to industrial manufacturers. Open any project to see the
              full page.
            </p>
          </div>
          <p className="md:max-w-xs font-mono text-[11px] leading-relaxed text-gray-600">
            Several of these sites are in Russian. Their screenshots were translated into English for this portfolio;
            the live links open the originals.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
          {WORKS.map((w, i) => (
            <WorkCard key={w.key} w={w} i={i} onOpen={() => setOpen(w)} />
          ))}
        </div>
      </div>

      <Modal isOpen={!!open} onClose={() => setOpen(null)} maxWidth="max-w-5xl">
        {open && (
          <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0b0d0c] mt-12 sm:mt-0">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06]">
              <div className="min-w-0">
                <div className="font-mono font-bold text-white truncate">{open.name}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-500">
                  {open.kind}
                  {open.translated && ' · translated from Russian'}
                </div>
              </div>
              <a
                href={open.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 px-3 h-8 rounded-full border border-accent-red/40 font-mono text-[11px] text-accent-red hover:bg-accent-red/10 transition-colors"
              >
                Visit {open.domain} <ArrowUpRight size={12} />
              </a>
            </div>
            <div className="max-h-[80vh] overflow-y-auto overscroll-contain">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgFull(open)} alt={`${open.name} website, full page`} className="block w-full h-auto" />
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
