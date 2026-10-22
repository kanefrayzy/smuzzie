'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { ArrowRight, Check, Download, Layers, MousePointer2, Move, Palette, Type, Upload, Wallet } from 'lucide-react';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { publicApi } from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import type { PublicBannerTemplateCard } from '@/types/banners';

// Homepage sales section for the banner builder: copy + features on one side, a live
// "editor" illustration on the other (the real template preview with its hue cycling in sync
// with a slider, a drag frame, and floating cards for the main features).

const FEATURES = [
  { icon: Type, title: 'Your text, your fonts', text: 'Headlines, buttons, captions. Auto-fit keeps every line clean.' },
  { icon: Palette, title: 'Brand colors', text: 'One slider recolors the whole animation. Any text color.' },
  { icon: Upload, title: 'Logo & pictures', text: 'PNG, JPG or WebP. Placed sharp, never stretched.' },
  { icon: Move, title: 'Move, resize, add layers', text: 'Drag blocks where you want them and add your own.' },
  { icon: Download, title: 'MP4 + GIF, no watermark', text: 'Full resolution, ready for ads, sites and socials.' },
  { icon: Wallet, title: 'Pay with crypto', text: 'USDT, BTC, ETH, TON and more. No account needed.' },
];

const CYCLE = 14; // seconds for a full hue turn in the illustration

function formatFrom(templates: PublicBannerTemplateCard[]): string | null {
  const prices = templates.map((t) => Number(t.price)).filter((n) => Number.isFinite(n) && n > 0);
  if (!prices.length) return null;
  const min = Math.min(...prices);
  return `$${Number.isInteger(min) ? min : min.toFixed(2)}`;
}

/* ─── Floating card around the illustration ─── */
function Float({
  className, delay = 0, children,
}: { className: string; delay?: number; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={`absolute z-20 rounded-xl border border-white/10 bg-[#0d0d12]/90 backdrop-blur-md shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)] ${className}`}
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ delay: 0.4 + delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 5 + delay * 2, repeat: Infinity, ease: 'easeInOut', delay }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/* ─── A made-up ad, drawn in code: synthwave sun, perspective grid, glowing orbs ─── */
type HueAnim = { filter: string[] } | undefined;

const SUN_MASK =
  'linear-gradient(180deg,#000 52%,transparent 52%,transparent 56%,#000 56%,#000 64%,transparent 64%,transparent 69%,#000 69%,#000 76%,transparent 76%,transparent 82%,#000 82%)';

const ORBS = [
  { c: 'left-[8%] top-[30%] w-[14%] bg-[#3df5ff] text-[#3df5ff]', d: 0 },
  { c: 'right-[10%] top-[22%] w-[9%] bg-[#ffd23f] text-[#ffd23f]', d: 1.2 },
  { c: 'right-[18%] top-[38%] w-[6%] bg-[#ff4fd8] text-[#ff4fd8]', d: 2.1 },
];

function AdArtwork({ reduce, hueAnim, hueTransition }: { reduce: boolean; hueAnim: HueAnim; hueTransition: object }) {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {/* Background: everything here shifts color with the slider */}
      <motion.div className="absolute inset-0" animate={hueAnim} transition={hueTransition}>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#14052b_0%,#2b0b45_42%,#3a0d3d_58%,#0a0216_100%)]" />
        <div className="absolute left-1/2 top-[13%] -translate-x-1/2 w-[52%] aspect-square rounded-full bg-[#ff3d8b] blur-[40px] opacity-60" />
        <div
          className="absolute left-1/2 top-[13%] -translate-x-1/2 w-[48%] aspect-square rounded-full bg-[linear-gradient(180deg,#ffd23f_0%,#ff7a3d_45%,#ff2d8a_100%)]"
          style={{ WebkitMaskImage: SUN_MASK, maskImage: SUN_MASK }}
        />
        <div className="absolute left-0 right-0 top-[44%] h-[3px] bg-[#ff4fd8] shadow-[0_0_24px_6px_rgba(255,79,216,0.7)]" />
        <svg className="absolute left-0 right-0 bottom-0 w-full h-[56%]" viewBox="0 0 100 56" preserveAspectRatio="none">
          <defs>
            <linearGradient id="bb-floor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ff4fd8" stopOpacity="0.15" />
              <stop offset="1" stopColor="#ff4fd8" stopOpacity="0.75" />
            </linearGradient>
          </defs>
          {Array.from({ length: 13 }).map((_, i) => {
            const x = (i / 12) * 100;
            return <line key={i} x1={50 + (x - 50) * 0.12} y1="0" x2={50 + (x - 50) * 2.4} y2="56" stroke="url(#bb-floor)" strokeWidth="0.35" />;
          })}
          <motion.g animate={reduce ? undefined : { y: [0, 7] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}>
            {Array.from({ length: 9 }).map((_, i) => {
              const y = Math.pow(i / 8, 1.8) * 56;
              return <line key={i} x1="0" y1={y} x2="100" y2={y} stroke="url(#bb-floor)" strokeWidth="0.35" />;
            })}
          </motion.g>
        </svg>
        {ORBS.map((o) => (
          <motion.div
            key={o.c}
            className={`absolute aspect-square rounded-full blur-[2px] opacity-80 ${o.c}`}
            style={{ boxShadow: '0 0 30px 6px currentColor' }}
            animate={reduce ? undefined : { y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: o.d }}
          />
        ))}
      </motion.div>

      {/* Foreground: logo, subtitle and button keep their own colors */}
      <div className="absolute left-1/2 top-[5%] -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-white/25 bg-black/25 backdrop-blur px-3 py-1">
        <span className="w-2.5 h-2.5 rotate-45 bg-white" />
        <span className="text-[10px] font-black tracking-[0.25em] text-white">LOGO</span>
      </div>
      <p className="absolute left-0 right-0 top-[62%] text-center text-[11px] sm:text-xs font-semibold tracking-[0.3em] text-white/85">
        SUMMER SALE · −50%
      </p>
      <motion.div
        className="absolute left-1/2 top-[70%] -translate-x-1/2 rounded-full bg-white px-5 py-2 text-[11px] font-black tracking-wider text-[#2b0b45] shadow-[0_0_30px_rgba(255,255,255,0.35)]"
        animate={reduce ? undefined : { scale: [1, 1.06, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        SHOP NOW
      </motion.div>
    </div>
  );
}

/* ─── The illustration ─── */
function EditorIllustration({ template }: { template: PublicBannerTemplateCard | null }) {
  const reduce = useReducedMotion();
  const hueAnim = reduce ? undefined : { filter: ['hue-rotate(0deg)', 'hue-rotate(360deg)'] };
  const hueTransition = { duration: CYCLE, repeat: Infinity, ease: 'linear' as const };

  return (
    <div className="relative mx-auto w-full max-w-[460px] py-10 px-6 sm:px-10">
      {/* Glow */}
      <div className="absolute inset-10 rounded-full bg-accent-red/20 blur-[90px]" aria-hidden="true" />

      {/* Editor window */}
      <motion.div
        className="relative z-10 rounded-2xl border border-white/10 bg-[#0a0a0e] shadow-[0_40px_120px_-30px_rgba(230,57,70,0.45)] overflow-hidden"
        initial={{ opacity: 0, y: 30, rotate: -1.5 }}
        whileInView={{ opacity: 1, y: 0, rotate: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-1.5 px-3.5 h-9 border-b border-white/[0.06] bg-white/[0.02]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 flex-1 truncate rounded-md bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-mono text-gray-500">
            smuzzie.com/banners
          </span>
        </div>

        <div className="relative overflow-hidden" style={{ aspectRatio: '4 / 5' }}>
          <AdArtwork reduce={!!reduce} hueAnim={hueAnim} hueTransition={hueTransition} />

          {/* Drag frame with handles and a cursor, around the headline */}
          <motion.div
            className="absolute left-[12%] top-[47%] w-[76%] h-[13%] border-2 border-white/90 rounded-sm"
            animate={reduce ? undefined : { x: [0, 8, 8, 0], y: [0, 0, 6, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          >
            <span className="absolute -top-5 left-0 px-1.5 rounded-sm bg-accent-red text-[9px] font-mono leading-4 text-white">Heading</span>
            {['-left-1.5 -top-1.5', '-right-1.5 -top-1.5', '-left-1.5 -bottom-1.5', '-right-1.5 -bottom-1.5'].map((pos) => (
              <span key={pos} className={`absolute ${pos} w-3 h-3 bg-white border-2 border-accent-red rounded-[3px]`} />
            ))}
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
              <span className="relative font-display font-black text-[22px] sm:text-[28px] tracking-tight leading-none bg-gradient-to-b from-white via-white to-pink-200 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(255,61,240,0.55)]">
                YOUR BRAND
              </span>
              {!reduce && (
                <motion.span
                  className="absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/35 to-transparent skew-x-[-20deg]"
                  animate={{ left: ['-30%', '130%'] }}
                  transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2.2, ease: 'easeInOut' }}
                />
              )}
            </div>
            <MousePointer2 size={20} className="absolute -right-4 -bottom-5 text-white fill-white drop-shadow" />
          </motion.div>

          {/* Bottom bar: hue slider synced with the colour cycle */}
          <div className="absolute left-3 right-3 bottom-3 rounded-lg bg-black/60 backdrop-blur px-3 py-2.5">
            <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-gray-400 mb-1.5">
              <span>Background color</span>
              <span className="text-gray-500">drag me</span>
            </div>
            <div className="relative h-1.5 rounded-full bg-[linear-gradient(90deg,#ff2d3d,#ffd400,#22c55e,#06b6d4,#3b82f6,#a855f7,#ff2d3d)]">
              <motion.span
                className="absolute top-1/2 -translate-y-1/2 -ml-2 w-4 h-4 rounded-full bg-white shadow ring-2 ring-black/40"
                animate={reduce ? { left: '35%' } : { left: ['0%', '100%'] }}
                transition={hueTransition}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Floating feature cards */}
      <Float className="left-0 top-16 px-3 py-2.5 hidden sm:block" delay={0}>
        <p className="text-[9px] font-mono uppercase tracking-wider text-gray-500 mb-1.5">Font</p>
        <div className="flex gap-1.5">
          <span className="px-2.5 py-1 rounded-md bg-accent-red/20 border border-accent-red/50 text-white text-xs font-black">Unbounded</span>
          <span className="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/10 text-gray-300 text-xs font-semibold">Manrope</span>
        </div>
      </Float>

      <Float className="right-0 top-1/3 px-3 py-2.5" delay={0.6}>
        <p className="text-[9px] font-mono uppercase tracking-wider text-gray-500 mb-1.5">Text color</p>
        <div className="flex gap-1.5">
          {['#ffffff', '#ff2d3d', '#ffd400', '#1e9bff'].map((c, i) => (
            <span key={c} className={`w-5 h-5 rounded-full ${i === 0 ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0d0d12]' : ''}`} style={{ background: c }} />
          ))}
        </div>
      </Float>

      <Float className="left-0 bottom-24 px-3 py-2.5 hidden sm:block" delay={1.1}>
        <div className="flex items-center gap-2 text-xs text-gray-200">
          <Layers size={14} className="text-accent-red" /> + Add text · + Add image
        </div>
      </Float>

      <Float className="right-2 bottom-2 px-3.5 py-2.5" delay={1.5}>
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <Check size={15} className="text-emerald-400" />
          </span>
          <div>
            <p className="text-xs font-semibold text-white leading-tight">banner.mp4 · banner.gif</p>
            <p className="text-[10px] text-gray-500 font-mono">
              full resolution · ready in minutes
            </p>
          </div>
        </div>
      </Float>
    </div>
  );
}

export default function BannerBuilderSection() {
  const [templates, setTemplates] = useState<PublicBannerTemplateCard[]>([]);

  useEffect(() => {
    publicApi
      .getBannerTemplates()
      .then((res) => setTemplates(res.data))
      .catch(() => undefined);
  }, []);

  const featured = templates[0] ?? null;
  const from = useMemo(() => formatFrom(templates), [templates]);

  return (
    <section className="relative py-24 md:py-32 overflow-hidden" aria-labelledby="banner-builder-heading">
      <div className="absolute inset-0 bg-[#060608]" />
      <div className="absolute inset-0 bg-grid-pattern opacity-60" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-red/20 to-transparent" />
      <div className="absolute -right-40 top-1/4 w-[520px] h-[520px] rounded-full bg-accent-red/[0.07] blur-[120px]" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:grid-rows-[auto_auto] gap-x-16 gap-y-10 lg:gap-y-0 items-center">
        {/* Intro. Phones: intro, illustration, features; desktops: copy left, illustration right */}
        <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
          <ScrollReveal>
            <div className="flex items-center gap-3 mb-6">
              <span className="px-2 py-0.5 rounded-full bg-accent-red/15 border border-accent-red/30 text-[10px] font-mono uppercase tracking-[0.2em] text-accent-red">New</span>
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent-red/60">Banner builder</span>
            </div>
            <h2 id="banner-builder-heading" className="section-heading">
              Your brand in motion. <span className="text-gradient">In two minutes.</span>
            </h2>
            <p className="text-gray-400 text-base md:text-lg mt-5 max-w-xl leading-relaxed">
              Pick an animated template made by our designers, drop in your logo, text and colors, and download a
              studio-quality MP4 and GIF. No designer, no After Effects, no waiting.
            </p>
          </ScrollReveal>
        </div>

        {/* Illustration */}
        <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <EditorIllustration template={featured} />
        </div>

        {/* Features and call to action */}
        <div className="lg:col-start-1 lg:row-start-2 lg:self-start">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 lg:mt-10">
            {FEATURES.map((f, i) => (
              <ScrollReveal key={f.title} delay={i * 0.05}>
                <div className="flex gap-3.5">
                  <span className="shrink-0 w-10 h-10 rounded-xl bg-accent-red/10 border border-accent-red/20 flex items-center justify-center">
                    <f.icon size={18} className="text-accent-red" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-white font-semibold text-sm">{f.title}</span>
                    <span className="block text-gray-500 text-sm leading-relaxed mt-0.5">{f.text}</span>
                  </span>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4 mt-11">
              <Link href={featured ? `/banners/${featured.slug}` : '/banners'} className="btn-primary">
                Create your banner <ArrowRight size={16} />
              </Link>
              <Link href="/banners" className="text-sm text-gray-300 hover:text-white inline-flex items-center gap-1.5">
                Browse templates <ArrowRight size={14} />
              </Link>
              {from && (
                <span className="text-sm text-gray-500">
                  from <span className="text-white font-display font-bold text-xl">{from}</span>
                </span>
              )}
            </div>
            <p className="mt-6 text-[11px] font-mono uppercase tracking-wider text-gray-600">
              Live preview = final file · Commercial use · Ready in minutes
            </p>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
