'use client';

import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion';
import GetStartedButton from '@/components/ui/GetStartedButton';
import { SpartanHelmet } from '@/components/ui/Logo';
import Link from 'next/link';
import { Shield, Zap, Clock, MessageCircle, ChevronDown, Palette, Layers, Star, Sparkles } from 'lucide-react';

/* ─── animated counter hook ─────────────────────────────── */
function useAnimatedCounter(target: number, duration = 2, delay = 1.5) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      const controls = animate(count, target, { duration, ease: 'easeOut' });
      return () => controls.stop();
    }, delay * 1000);
    return () => clearTimeout(timer);
  }, [count, target, duration, delay]);

  useEffect(() => {
    const unsubscribe = rounded.on('change', (v) => setDisplay(v));
    return () => unsubscribe();
  }, [rounded]);

  return display;
}

/* ─── stat block ───────────────────────────────────────── */
function AnimatedStat({ value, suffix, label, delay }: { value: number; suffix: string; label: string; delay: number }) {
  const count = useAnimatedCounter(value, 2, delay);
  return (
    <motion.div
      className="text-center group relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6 }}
    >
      <div className="text-2xl sm:text-3xl md:text-4xl font-display font-black text-white tracking-tight group-hover:text-accent-red transition-colors duration-300">
        {count}{suffix}
      </div>
      <div className="text-[10px] sm:text-[11px] text-gray-600 mt-1 uppercase tracking-[0.2em] font-mono">{label}</div>
    </motion.div>
  );
}

/* ─── floating particles ───────────────────────────────── */
function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 40 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 1 + Math.random() * 3,
            height: 1 + Math.random() * 3,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            backgroundColor: i % 5 === 0 ? 'rgba(230,57,70,0.4)' : 'rgba(255,255,255,0.15)',
          }}
          animate={{
            y: [0, -50 - Math.random() * 50, 0],
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: 5 + Math.random() * 6,
            repeat: Infinity,
            delay: Math.random() * 8,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

/* ─── rotating words like Gamerflix ────────────────────── */
const rotatingWords = [
  { text: 'Logos', color: 'from-accent-red to-red-400' },
  { text: 'Avatars', color: 'from-accent-gold to-yellow-400' },
  { text: '3D Art', color: 'from-purple-500 to-violet-400' },
  { text: 'Banners', color: 'from-cyan-500 to-blue-400' },
  { text: 'Signatures', color: 'from-emerald-500 to-green-400' },
  { text: 'Designs', color: 'from-accent-red to-rose-400' },
];

function RotatingText() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % rotatingWords.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="relative inline-block w-full sm:w-auto">
      <AnimatePresence mode="wait">
        <motion.span
          key={rotatingWords[index].text}
          className={`inline-block bg-gradient-to-r ${rotatingWords[index].color} bg-clip-text text-transparent`}
          initial={{ y: 40, opacity: 0, filter: 'blur(8px)', rotateX: -60 }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)', rotateX: 0 }}
          exit={{ y: -40, opacity: 0, filter: 'blur(8px)', rotateX: 60 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ perspective: '400px' }}
        >
          {rotatingWords[index].text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* ─── sci-fi corner bracket ────────────────────────────── */
function CornerBracket({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const rotation = { tl: 'rotate-0', tr: 'rotate-90', bl: '-rotate-90', br: 'rotate-180' };
  return (
    <div className={`absolute ${
      position === 'tl' ? 'top-0 left-0' :
      position === 'tr' ? 'top-0 right-0' :
      position === 'bl' ? 'bottom-0 left-0' :
      'bottom-0 right-0'
    }`}>
      <svg width="40" height="40" viewBox="0 0 40 40" className={`${rotation[position]} text-accent-red/30`}>
        <path d="M0 40 L0 8 L4 4 L12 4" fill="none" stroke="currentColor" strokeWidth="1" />
        <path d="M4 40 L4 12 L8 8 L16 8" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <circle cx="4" cy="4" r="1.5" fill="currentColor" opacity="0.6" />
      </svg>
    </div>
  );
}

/* ─── HUD data line ────────────────────────────────────── */
function HudLine({ side }: { side: 'left' | 'right' }) {
  return (
    <motion.div
      className={`absolute top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-4 ${
        side === 'left' ? 'left-6 xl:left-12 items-start' : 'right-6 xl:right-12 items-end'
      }`}
      initial={{ opacity: 0, x: side === 'left' ? -30 : 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 2, duration: 1 }}
    >
      <div className="w-px h-24 bg-gradient-to-b from-transparent via-accent-red/20 to-transparent" />
      <div className={`font-mono text-[9px] tracking-[0.3em] text-gray-600 ${side === 'right' ? 'text-right' : ''}`}>
        {side === 'left' ? (
          <>
            <div className="text-accent-red/40">SYS.ONLINE</div>
            <div className="mt-1">VER 2.0.26</div>
            <div className="mt-1 text-accent-red/30">■ ■ ■ □ □</div>
          </>
        ) : (
          <>
            <div className="text-accent-red/40">DESIGN.LAB</div>
            <div className="mt-1">STATUS: ACTIVE</div>
            <div className="mt-1 text-accent-red/30">□ □ ■ ■ ■</div>
          </>
        )}
      </div>
      <div className="w-px h-24 bg-gradient-to-b from-transparent via-white/5 to-transparent" />
      <svg width="12" height="12" viewBox="0 0 12 12" className="text-accent-red/20">
        <line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" strokeWidth="0.5" />
        <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="0.5" />
        <circle cx="6" cy="6" r="2" fill="none" stroke="currentColor" strokeWidth="0.5" />
      </svg>
    </motion.div>
  );
}

/* ─── scan line effect ─────────────────────────────────── */
function ScanLine() {
  return (
    <motion.div
      className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-red/10 to-transparent pointer-events-none"
      initial={{ top: '0%' }}
      animate={{ top: ['0%', '100%', '0%'] }}
      transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
    />
  );
}

/* ─── floating service tags (Gamerflix-style) ──────────── */
const floatingTags = [
  { label: 'Logo Design', icon: Sparkles, x: '8%', y: '25%', delay: 1.8 },
  { label: 'Branding', icon: Layers, x: '85%', y: '30%', delay: 2.2 },
  { label: 'Illustrations', icon: Palette, x: '5%', y: '65%', delay: 2.5 },
  { label: '5★ Rated', icon: Star, x: '88%', y: '68%', delay: 2.0 },
];

function FloatingTags() {
  return (
    <>
      {floatingTags.map((tag, i) => (
        <motion.div
          key={tag.label}
          className="absolute hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm"
          style={{ left: tag.x, top: tag.y }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: tag.delay, duration: 0.6 }}
        >
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
            className="flex items-center gap-1.5"
          >
            <tag.icon size={11} className="text-accent-red/60" />
            <span className="font-mono text-[9px] tracking-wider text-gray-500 uppercase">{tag.label}</span>
          </motion.div>
        </motion.div>
      ))}
    </>
  );
}

/* ─── "Available for work" status badge ────────────────── */
function AvailableBadge() {
  return (
    <motion.div
      className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm mb-6"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.6 }}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      <span className="font-mono text-[10px] tracking-[0.2em] text-gray-400 uppercase">Available for Projects</span>
    </motion.div>
  );
}

/* ─── diagonal light streak (Gamerflix-style) ──────────── */
function LightStreaks() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Main diagonal streak */}
      <motion.div
        className="absolute w-[200%] h-[1px]"
        style={{
          top: '35%',
          left: '-50%',
          background: 'linear-gradient(90deg, transparent 0%, rgba(230,57,70,0.08) 30%, rgba(230,57,70,0.15) 50%, rgba(230,57,70,0.08) 70%, transparent 100%)',
          transform: 'rotate(-15deg)',
          transformOrigin: 'center',
        }}
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Secondary thinner streak */}
      <motion.div
        className="absolute w-[200%] h-[1px]"
        style={{
          top: '37%',
          left: '-50%',
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 30%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 70%, transparent 100%)',
          transform: 'rotate(-15deg)',
          transformOrigin: 'center',
        }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
      />
      {/* Bottom accent streak */}
      <motion.div
        className="absolute w-[150%] h-[1px]"
        style={{
          top: '72%',
          left: '-25%',
          background: 'linear-gradient(90deg, transparent 0%, rgba(230,57,70,0.05) 40%, rgba(230,57,70,0.10) 50%, rgba(230,57,70,0.05) 60%, transparent 100%)',
          transform: 'rotate(8deg)',
          transformOrigin: 'center',
        }}
        animate={{ opacity: [0.2, 0.6, 0.2] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   HERO SECTION — Gamerflix-inspired with centered logo
   ═══════════════════════════════════════════════════════════ */
export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* ── Background layers ──────────────────────────── */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[#060608]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />

        {/* Main accent glow behind logo */}
        <div
          className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px]"
          style={{ background: 'radial-gradient(ellipse at center, rgba(230,57,70,0.10) 0%, transparent 60%)' }}
        />

        {/* Secondary ambient glows */}
        <motion.div
          className="absolute -top-[200px] -right-[200px] w-[700px] h-[700px]"
          style={{ background: 'radial-gradient(circle, rgba(230,57,70,0.04) 0%, transparent 60%)' }}
          animate={{ scale: [1, 1.2, 1], x: [0, -30, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-[200px] -left-[200px] w-[600px] h-[600px]"
          style={{ background: 'radial-gradient(circle, rgba(193,18,31,0.04) 0%, transparent 60%)' }}
          animate={{ scale: [1.2, 1, 1.2] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Horizontal accent lines */}
        <div className="absolute top-[20%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-red/[0.06] to-transparent" />
        <div className="absolute top-[80%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-red/[0.04] to-transparent" />

        {/* Vertical accent lines */}
        <div className="absolute top-0 bottom-0 left-[15%] w-px bg-gradient-to-b from-transparent via-white/[0.02] to-transparent" />
        <div className="absolute top-0 bottom-0 right-[15%] w-px bg-gradient-to-b from-transparent via-white/[0.02] to-transparent" />

        {/* Diagonal accents */}
        <div className="absolute top-0 right-0 w-full h-full overflow-hidden opacity-[0.015]">
          <div className="absolute -top-1/2 -right-1/4 w-[200%] h-32 bg-accent-red rotate-[15deg]" />
          <div className="absolute top-1/3 -left-1/4 w-[200%] h-16 bg-white rotate-[-8deg]" />
        </div>

        <Particles />
        <ScanLine />
        <LightStreaks />

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-primary to-transparent" />
      </div>

      {/* ── HUD side elements ──────────────────────────── */}
      <HudLine side="left" />
      <HudLine side="right" />

      {/* ── Floating service tags ──────────────────────── */}
      <FloatingTags />

      {/* ── Corner brackets ────────────────────────────── */}
      <motion.div
        className="absolute inset-8 sm:inset-12 md:inset-16 lg:inset-24 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
      >
        <CornerBracket position="tl" />
        <CornerBracket position="tr" />
        <CornerBracket position="bl" />
        <CornerBracket position="br" />
      </motion.div>

      {/* ── Main content ───────────────────────────────── */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 text-center pt-24 pb-16">

        {/* ── "Available" status badge ─────────────────── */}
        <AvailableBadge />

        {/* ── Centered Logo (mascot) — like Gamerflix character ─── */}
        <motion.div
          className="flex justify-center mb-8"
          initial={{ opacity: 0, scale: 0.3, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 1.2, type: 'spring', stiffness: 120, damping: 15 }}
        >
          <div className="relative">
            {/* Outer glow ring */}
            <motion.div
              className="absolute inset-0 -m-8 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(230,57,70,0.15) 0%, transparent 70%)' }}
              animate={{ scale: [1, 1.15, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Rotating ring with dots */}
            <motion.div
              className="absolute -inset-6 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            >
              <div className="absolute inset-0 border border-accent-red/10 rounded-full" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-accent-red/40 rounded-full" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1 h-1 bg-accent-red/20 rounded-full" />
            </motion.div>
            {/* Pulsing ring */}
            <motion.div
              className="absolute -inset-10 border border-accent-red/5 rounded-full"
              animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Outer dashed ring */}
            <motion.div
              className="absolute -inset-14 border border-dashed border-white/[0.03] rounded-full"
              animate={{ rotate: -360 }}
              transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
            />
            {/* Logo with subtle float */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <SpartanHelmet size={120} />
            </motion.div>
          </div>
        </motion.div>

        {/* ── Brand name ─────────────────────────────── */}
        <motion.div
          className="mb-4"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-black tracking-tight leading-[0.95]">
            <span className="text-white">SmuzZie</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-red to-red-400"> Services</span>
          </h1>
        </motion.div>

        {/* ── Animated rotating word — "We create {Logos/Avatars/3D...}" ── */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <div className="text-xl sm:text-2xl md:text-3xl font-display font-semibold text-gray-300 leading-relaxed" style={{ perspective: '600px' }}>
            We create{' '}
            <RotatingText />
          </div>
          <motion.div
            className="flex items-center justify-center gap-3 mt-4"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
          >
            <div className="h-px w-12 sm:w-20 bg-gradient-to-r from-transparent to-accent-red/30" />
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 bg-accent-red/50" />
              <div className="w-6 h-px bg-accent-red/40" />
              <div className="w-1 h-1 bg-accent-red/50" />
            </div>
            <div className="h-px w-12 sm:w-20 bg-gradient-to-l from-transparent to-accent-red/30" />
          </motion.div>
        </motion.div>

        {/* ── Tagline ─────────────────────────────────── */}
        <motion.p
          initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: 1.1, duration: 0.8 }}
          className="text-gray-500 text-sm sm:text-base md:text-lg max-w-xl mx-auto mb-10 leading-relaxed font-light"
        >
          Premium graphics that make your brand
          <span className="text-white font-medium"> unforgettable</span>.
          <br className="hidden sm:block" />
          <span className="text-gray-600">Fast delivery · Unlimited revisions · No compromises.</span>
        </motion.p>

        {/* ── CTA Buttons ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10"
        >
          <GetStartedButton size="lg" />
          <Link
            href="/portfolio"
            className="group inline-flex items-center gap-2 px-7 py-3 text-sm font-semibold text-gray-400 hover:text-white transition-all duration-300 border border-white/[0.06] hover:border-accent-red/30 bg-white/[0.02] hover:bg-white/[0.04] rounded-full"
          >
            <Shield size={16} className="text-accent-red/60 group-hover:text-accent-red transition-colors" />
            View Our Work
          </Link>
        </motion.div>

        {/* ── Trusted by row (Gamerflix-style) ──────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
          className="flex flex-col items-center gap-3 mb-12"
        >
          <div className="flex items-center -space-x-2">
            {['🎮', '🎨', '🎬', '⚡', '🏆'].map((emoji, i) => (
              <motion.div
                key={i}
                className="w-8 h-8 rounded-full bg-surface border-2 border-[#060608] flex items-center justify-center text-xs"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.6 + i * 0.1 }}
              >
                {emoji}
              </motion.div>
            ))}
            <motion.div
              className="w-8 h-8 rounded-full bg-accent-red/20 border-2 border-[#060608] flex items-center justify-center"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 2.1 }}
            >
              <span className="text-[9px] font-mono text-accent-red font-bold">99+</span>
            </motion.div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={10} className="text-accent-gold fill-accent-gold" />
              ))}
            </div>
            <span className="font-mono text-[10px] tracking-wider text-gray-500 uppercase">Trusted by 500+ clients</span>
          </div>
        </motion.div>

        {/* ── Feature badges strip ─────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.7 }}
          className="flex flex-wrap items-center justify-center gap-3 sm:gap-2 mb-14"
        >
          {[
            { icon: Zap, label: '24H Delivery', color: 'text-accent-gold' },
            { icon: Clock, label: 'Free Revisions', color: 'text-accent-red/60' },
            { icon: MessageCircle, label: '24/7 Support', color: 'text-green-500' },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.04] bg-white/[0.01] hover:border-white/[0.08] transition-colors"
              whileHover={{ scale: 1.05 }}
            >
              <item.icon size={11} className={item.color} />
              <span className="font-mono text-[10px] tracking-wider text-gray-500 uppercase">{item.label}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Stats with tech dividers ─────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.9 }}
          className="relative"
        >
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="h-px flex-1 max-w-[80px] bg-gradient-to-r from-transparent to-white/[0.06]" />
            <div className="font-mono text-[8px] tracking-[0.4em] text-gray-700 uppercase">Statistics</div>
            <div className="h-px flex-1 max-w-[80px] bg-gradient-to-l from-transparent to-white/[0.06]" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 max-w-lg mx-auto">
            <motion.div
              className="text-center group relative"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.1, duration: 0.6 }}
            >
              <div className="text-2xl sm:text-3xl md:text-4xl font-display font-black text-white tracking-tight group-hover:text-accent-red transition-colors duration-300">
                7+
              </div>
              <div className="text-[10px] sm:text-[11px] text-gray-600 mt-1 uppercase tracking-[0.2em] font-mono">Years Exp</div>
            </motion.div>
            <motion.div
              className="text-center group relative"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.3, duration: 0.6 }}
            >
              <div className="text-2xl sm:text-3xl md:text-4xl font-display font-black text-white tracking-tight group-hover:text-accent-red transition-colors duration-300">
                ✦
              </div>
              <div className="text-[10px] sm:text-[11px] text-gray-600 mt-1 uppercase tracking-[0.2em] font-mono">Pro Design</div>
            </motion.div>
            <motion.div
              className="text-center group relative"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.5, duration: 0.6 }}
            >
              <div className="text-2xl sm:text-3xl md:text-4xl font-display font-black text-white tracking-tight group-hover:text-accent-red transition-colors duration-300">
                HQ
              </div>
              <div className="text-[10px] sm:text-[11px] text-gray-600 mt-1 uppercase tracking-[0.2em] font-mono">High Quality</div>
            </motion.div>
            <motion.div
              className="text-center group relative"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.7, duration: 0.6 }}
            >
              <div className="text-2xl sm:text-3xl md:text-4xl font-display font-black text-white tracking-tight group-hover:text-accent-red transition-colors duration-300">
                24/7
              </div>
              <div className="text-[10px] sm:text-[11px] text-gray-600 mt-1 uppercase tracking-[0.2em] font-mono">Support</div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* ── Scroll indicator ───────────────────────────── */}
      <motion.div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.8, duration: 1 }}
      >
        <span className="font-mono text-[8px] tracking-[0.3em] text-gray-700 uppercase">Scroll</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown size={14} className="text-accent-red/40" />
        </motion.div>
      </motion.div>
    </section>
  );
}
