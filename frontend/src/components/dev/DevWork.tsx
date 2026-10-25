'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Languages, Lock, Maximize2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';

// Client projects are shown without names or links: the cards describe the
// type of project only.
type Work = {
  key: string;
  title: string;
  kind: string;
  text: string;
  tags: string[];
  /** Spans two columns on wide screens */
  wide?: boolean;
  /** The screenshot is a translation of a Russian-only site */
  translated?: boolean;
  /** One file for the card and the viewer, shown no wider than this (px) */
  single?: number;
};

// Full-page screenshots in public/images/dev/work (1440px viewport, 960px wide WebP)
const WORKS: Work[] = [
  {
    key: 'pixera',
    title: 'AI image & video platform',
    kind: 'Web app · 7 languages',
    text: 'AI generation with a creator community: gallery, profiles, trends and a blog.',
    tags: ['Web app', 'AI', 'i18n'],
    wide: true,
  },
  {
    key: 'vorq',
    title: 'Electric motorcycle brand',
    kind: 'Product launch site',
    text: 'Bold launch page for an electric bike: specs, tech breakdown, model lineup and a test-ride form.',
    tags: ['Landing page', 'Product', 'Lead form'],
    single: 745,
  },
  {
    key: 'bueno',
    title: 'Exotic car rental',
    kind: 'Local business · New York',
    text: 'Availability check, booking requests and pages for every occasion.',
    tags: ['Next.js', 'Booking', 'Local SEO'],
  },
  {
    key: 'sereva',
    title: 'Boutique cliffside hotel',
    kind: 'Hospitality · Mediterranean',
    text: 'Quiet luxury: availability search, suites, experiences, dining and guest stories.',
    tags: ['Hotel site', 'Booking', 'Editorial'],
    single: 727,
  },
  {
    key: 'npkbsv',
    title: 'Helicopter manufacturer',
    kind: 'Aviation engineering',
    text: 'Coaxial helicopters and composite parts, with an engineering brief form and file upload.',
    tags: ['Next.js', 'B2B', 'Lead form'],
    translated: true,
  },
  {
    key: 'tumbo',
    title: "Kids' toy store",
    kind: 'E-commerce',
    text: 'Playful storefront with shopping by age and interest, bestsellers, reviews and a newsletter.',
    tags: ['E-commerce', 'Catalog', 'Cart'],
    single: 758,
  },
  {
    key: 'realchat',
    title: 'AI companion chat',
    kind: 'Consumer AI',
    text: 'Character catalog, personalities with memory, photos in chat and custom characters.',
    tags: ['Web app', 'AI chat', 'Image generation'],
    wide: true,
  },
  {
    key: 'exact',
    title: 'Furniture delivery service',
    kind: 'Logistics · UK',
    text: 'Instant quote from two postcodes, item picker, coverage map, reviews and a blog.',
    tags: ['Instant quote', 'Service', 'Blog'],
    wide: true,
    single: 853,
  },
  {
    key: 'linden',
    title: 'Dental practice',
    kind: 'Healthcare · Germany',
    text: 'Treatments, team, first-visit steps, FAQ and an appointment request form.',
    tags: ['Clinic site', 'Appointments', 'Local SEO'],
    single: 743,
  },
  {
    key: 'blesk',
    title: 'Dry cleaning service',
    kind: 'Local service',
    text: 'Step-by-step order request and a customer account with order tracking.',
    tags: ['Next.js', 'Customer account', 'Forms'],
    translated: true,
  },
  {
    key: 'nikstudio',
    title: 'Creative agency',
    kind: 'Agency for industrial brands',
    text: 'Project showcase, services, media and client testimonials.',
    tags: ['Next.js', 'Portfolio', 'Motion'],
    translated: true,
  },
  {
    key: 'milo',
    title: 'Baby stroller store',
    kind: 'E-commerce · Almaty',
    text: 'Strollers and car seats by category, product finder guides, a comparison table and showroom visits.',
    tags: ['E-commerce', 'Product finder', 'Comparison'],
    single: 724,
  },
  {
    key: 'tasha',
    title: 'Mountain cabin rentals',
    kind: 'Hospitality · Almaty',
    text: 'Three private cabins with date search, experiences, directions, reviews and FAQ.',
    tags: ['Booking', 'Hospitality', 'Travel'],
    single: 758,
  },
  {
    key: 'briarey',
    title: 'Industrial equipment store',
    kind: 'B2B e-commerce',
    text: 'Smoke-exhaust systems manufacturer: product catalog, cart, equipment calculator and news.',
    tags: ['Next.js', 'Catalog', 'Calculator'],
    wide: true,
    translated: true,
  },
];

const img = (w: Work) => `/images/dev/work/${w.key}.webp`;
// 1280px version for the full-page viewer
const imgFull = (w: Work) => (w.single ? img(w) : `/images/dev/work/${w.key}-full.webp`);

function BrowserBar() {
  return (
    <div className="h-8 shrink-0 flex items-center gap-2 px-3 bg-[#141716] border-b border-white/[0.06]">
      <span className="flex gap-1">
        <span className="w-2 h-2 rounded-full bg-white/15" />
        <span className="w-2 h-2 rounded-full bg-white/15" />
        <span className="w-2 h-2 rounded-full bg-white/15" />
      </span>
      <span className="mx-auto flex items-center gap-1 px-3 h-5 rounded bg-white/[0.04] text-[10px] text-white/30">
        <Lock size={8} className="shrink-0" /> client project
      </span>
    </div>
  );
}

function WorkCard({ w, i, onOpen }: { w: Work; i: number; onOpen: () => void }) {
  return (
    <motion.article
      className={`group ${w.wide ? 'lg:col-span-2' : ''}`}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay: (i % 3) * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`View the full page: ${w.title}`}
        className="block w-full text-left rounded-xl overflow-hidden border border-white/[0.08] bg-[#0b0d0c] transition-all duration-500 group-hover:border-accent-red/40 group-hover:shadow-[0_20px_60px_-20px_rgb(var(--accent)/0.35)]"
      >
        <BrowserBar />
        <div className="relative h-[340px] sm:h-[380px] overflow-hidden">
          {/* The page scrolls top to bottom on hover */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img(w)}
            alt={`${w.title}, full page`}
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
        <h3 className="font-mono font-bold text-lg text-white">{w.title}</h3>
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
            Client names are kept private. Several of these sites are in Russian; their screenshots were translated
            into English for this portfolio.
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
                <div className="font-mono font-bold text-white truncate">{open.title}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-500">
                  {open.kind}
                  {open.translated && ' · translated from Russian'}
                </div>
              </div>
            </div>
            <div className="max-h-[80vh] overflow-y-auto overscroll-contain">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgFull(open)}
                alt={`${open.title}, full page`}
                className="block w-full h-auto mx-auto"
                style={open.single ? { maxWidth: open.single } : undefined}
              />
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
