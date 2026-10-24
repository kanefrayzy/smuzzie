'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { animate, motion, useInView } from 'framer-motion';
import {
  ChevronsLeftRight,
  Lock,
  MousePointer2,
  Hash,
  Square,
  PenTool,
  Type,
  Hand,
  MessageCircle,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';

// The mock site is laid out at this fixed size and scaled to fit, so the
// design and live layers line up exactly at any width.
const W = 960;
const H = 540;

const DESIGN_RED = '#e63946';
const FIGMA_BLUE = '#0d99ff';
const FIGMA_PURPLE = '#9747ff';
const GRADIENT = 'linear-gradient(90deg,#8b5cf6,#ff7a45)';
const HATCH = 'repeating-linear-gradient(45deg, rgba(255,0,170,0.35) 0 2px, transparent 2px 5px)';

const PRODUCTS = [
  { name: 'Pro Jersey', price: '$59', img: '/images/dev/nova-jersey.webp' },
  { name: 'Team Hoodie', price: '$79', img: '/images/dev/nova-hoodie.webp' },
  { name: 'XL Mousepad', price: '$29', img: '/images/dev/nova-mousepad.webp' },
];

const HANDLE_POSITIONS = ['-top-[4px] -left-[4px]', '-top-[4px] -right-[4px]', '-bottom-[4px] -left-[4px]', '-bottom-[4px] -right-[4px]'];

function Handles() {
  return (
    <>
      {HANDLE_POSITIONS.map((p) => (
        <span key={p} className={`absolute ${p} w-[7px] h-[7px] bg-white border`} style={{ borderColor: FIGMA_BLUE }} />
      ))}
    </>
  );
}

function Cursor({ color, label, path }: { color: string; label: string; path: { x: number[]; y: number[] } }) {
  return (
    <motion.div
      className="absolute left-0 top-0 z-30 pointer-events-none"
      initial={{ x: path.x[0], y: path.y[0] }}
      animate={{ x: path.x, y: path.y }}
      transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path d="M1 1 L1 15 L5 11 L8 17 L10.5 16 L7.5 10 L13 10 Z" fill={color} stroke="white" strokeWidth="1" />
      </svg>
      <span
        className="ml-3 -mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold text-white whitespace-nowrap"
        style={{ background: color }}
      >
        {label}
      </span>
    </motion.div>
  );
}

const FIGMA_TOOLS = [MousePointer2, Hash, Square, PenTool, Type, Hand, MessageCircle];

/** Figma-style editor toolbar */
function FigmaBar() {
  return (
    <div className="relative z-20 h-9 shrink-0 flex items-center px-2 gap-1 bg-[#2c2c2c] border-b border-black/60 text-white/80">
      {FIGMA_TOOLS.map((Icon, i) => (
        <span key={i} className="w-7 h-7 flex items-center justify-center rounded" style={i === 0 ? { background: FIGMA_BLUE } : undefined}>
          <Icon size={13} />
        </span>
      ))}
      <span className="mx-auto text-[11px] text-white/60">
        NOVA Website <span className="text-white/30">/</span> <span className="text-white/90">Home</span>
      </span>
      <span className="flex -space-x-1.5 mr-2">
        <span
          className="w-6 h-6 rounded-full border-2 border-[#2c2c2c] flex items-center justify-center text-[9px] font-bold"
          style={{ background: DESIGN_RED }}
        >
          S
        </span>
        <span className="w-6 h-6 rounded-full border-2 border-[#2c2c2c] bg-amber-500 flex items-center justify-center text-[9px] font-bold text-black">
          C
        </span>
      </span>
      <span className="h-6 px-3 rounded-md flex items-center text-[11px] font-semibold text-white" style={{ background: FIGMA_BLUE }}>
        Share
      </span>
      <span className="ml-2 text-[11px] text-white/50">100%</span>
    </div>
  );
}

/** Browser chrome */
function BrowserBar() {
  return (
    <div className="relative z-20 h-9 shrink-0 flex items-center px-3 gap-3 bg-[#1b1a22] border-b border-white/10">
      <span className="flex gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
      </span>
      <span className="flex items-center gap-2 text-white/40">
        <ChevronLeft size={14} />
        <ChevronRight size={14} />
        <RotateCw size={12} />
      </span>
      <span className="flex-1 max-w-[420px] mx-auto flex items-center gap-1.5 px-3 h-6 rounded-md bg-white/[0.06] text-[11px] text-white/60">
        <Lock size={10} className="text-[#34f596]" /> your-brand.com
      </span>
      <span className="text-[10px] font-mono text-[#34f596]">● 0.6s</span>
    </div>
  );
}

/**
 * A fictional client site (NOVA, an esports team). The "design" variant is the
 * Figma file mid-edit, the "live" variant is the shipped page in a browser.
 * Both share the same layout so the slider lines them up.
 */
function MockSite({ variant }: { variant: 'design' | 'live' }) {
  const d = variant === 'design';

  return (
    <div
      className="relative flex flex-col font-sans select-none overflow-hidden"
      style={{ width: W, height: H, background: 'radial-gradient(ellipse at 78% 38%, #2a1550 0%, #0b0a14 58%)' }}
    >
      {d ? <FigmaBar /> : <BrowserBar />}

      {d && (
        // Layout grid, like Figma's column overlay
        <div className="absolute top-9 bottom-0 left-10 right-10 z-10 grid grid-cols-12 gap-4 pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(255,71,87,0.06)',
                borderLeft: '1px solid rgba(255,71,87,0.12)',
                borderRight: '1px solid rgba(255,71,87,0.12)',
              }}
            />
          ))}
        </div>
      )}

      {/* Nav */}
      <div className="relative h-14 shrink-0 flex items-center justify-between px-10">
        <span className="font-black text-[20px] tracking-[0.25em] text-white">NOVA</span>
        <div className="flex items-center gap-7 text-[13px] text-white/60">
          <span>Teams</span>
          <span>Schedule</span>
          <span>Merch</span>
          <span>News</span>
          <span className="h-9 px-5 flex items-center rounded-full text-[13px] font-semibold text-white" style={{ background: GRADIENT }}>
            Join
          </span>
        </div>
      </div>

      {/* Hero */}
      <div className="relative h-[262px] shrink-0 px-10 pt-6">
        {/* Mascot art */}
        <div className="absolute right-6 -top-6 w-[330px] h-[330px]">
          <Image
            src="/images/dev/nova-mascot.webp"
            unoptimized
            alt=""
            fill
            sizes="660px"
            className="object-cover"
            style={{
              maskImage: 'radial-gradient(circle at 50% 45%, black 45%, transparent 72%)',
              WebkitMaskImage: 'radial-gradient(circle at 50% 45%, black 45%, transparent 72%)',
            }}
          />
          {d ? (
            // Figma comment from the client
            <div className="absolute -left-24 top-16 z-20 flex items-start gap-1.5">
              <span className="w-6 h-6 rounded-full rounded-bl-none bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center shadow-lg">
                C
              </span>
              <span className="max-w-[150px] px-2.5 py-1.5 rounded-lg bg-white text-[10px] leading-snug text-gray-800 shadow-xl">
                <b>Client</b>
                <br />
                Love the fox! Make the visor glow a bit more?
              </span>
            </div>
          ) : (
            // DevTools inspect on the image
            <>
              <span className="absolute inset-[40px] z-10 bg-[#6fa8dc]/25 ring-1 ring-[#6fa8dc]" />
              <span className="absolute left-[40px] top-[12px] z-20 px-2 py-1 rounded bg-white text-[10px] font-mono text-gray-800 shadow-lg whitespace-nowrap">
                <span className="text-[#881280]">img</span>
                <span className="text-[#1a1aa6]">.hero-art</span>
                <span className="text-gray-500"> 250 × 250 · webp 79 KB</span>
              </span>
            </>
          )}
        </div>

        <div className="relative w-[520px]">
          <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.25em] text-[#ff7a45]">
            <span className={`w-2 h-2 rounded-full bg-[#ff7a45] ${d ? '' : 'animate-pulse'}`} />
            SEASON 04 · LIVE NOW
          </div>
          <div className="relative inline-block mt-3">
            <div className="text-[64px] leading-none font-black tracking-tight text-white">Built to win.</div>
            {d && (
              <>
                <span className="absolute -inset-1.5 border z-20" style={{ borderColor: FIGMA_BLUE }} />
                <span className="absolute -inset-1.5 z-20">
                  <Handles />
                </span>
                <span
                  className="absolute left-1/2 -translate-x-1/2 -bottom-7 z-20 px-1.5 py-0.5 rounded text-[10px] font-mono text-white whitespace-nowrap"
                  style={{ background: FIGMA_BLUE }}
                >
                  Inter Black 64 · 432 × 64
                </span>
              </>
            )}
          </div>
          <p className="mt-6 w-[420px] text-[15px] leading-relaxed text-white/60">
            Official home of Nova Esports: rosters, match schedule and the new season merch drop.
          </p>
          <div className="mt-6 flex gap-3">
            <div className="relative">
              {d && (
                <>
                  <span className="absolute -top-5 left-0 z-20 text-[10px] font-medium whitespace-nowrap" style={{ color: FIGMA_PURPLE }}>
                    ◇ Button / Primary
                  </span>
                  {/* Auto layout padding */}
                  <span className="absolute inset-y-0 left-0 w-6 z-20 rounded-l-full" style={{ background: HATCH }} />
                  <span className="absolute inset-y-0 right-0 w-6 z-20 rounded-r-full" style={{ background: HATCH }} />
                  <span className="absolute inset-0 z-20 rounded-full border" style={{ borderColor: FIGMA_PURPLE }} />
                </>
              )}
              <span
                className={`h-11 px-6 flex items-center rounded-full text-[14px] font-semibold text-white ${
                  d ? '' : 'shadow-[0_0_30px_rgba(139,92,246,0.45)]'
                }`}
                style={{ background: GRADIENT }}
              >
                Shop merch
              </span>
            </div>
            <span className="h-11 px-6 flex items-center rounded-full text-[14px] font-semibold border border-white/20 text-white">
              Watch live
            </span>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="relative z-[1] flex-1 grid grid-cols-3 gap-4 px-10 pb-6 pt-4">
        {d && (
          // Spacing redline between hero and cards
          <div className="absolute left-[150px] -top-2 h-6 z-20 flex items-center">
            <span className="w-px h-full" style={{ background: '#f24e1e' }} />
            <span className="ml-1 px-1 rounded text-[10px] font-mono text-white" style={{ background: '#f24e1e' }}>
              24
            </span>
          </div>
        )}
        {PRODUCTS.map((c, i) => {
          const hovered = !d && i === 2;
          return (
            <div
              key={c.name}
              className={`relative flex flex-col rounded-xl overflow-hidden border bg-[#14121d] ${
                hovered ? 'border-[#ff7a45]/60 -translate-y-1 shadow-[0_12px_40px_-8px_rgba(255,122,69,0.5)]' : 'border-white/10'
              }`}
            >
              <div className="relative flex-1">
                <Image src={c.img} alt="" unoptimized fill sizes="300px" className="object-cover" />
                {d && i === 0 && (
                  <span
                    className="absolute left-1.5 top-1.5 z-20 px-1.5 py-0.5 rounded text-[9px] font-mono text-white"
                    style={{ background: FIGMA_BLUE }}
                  >
                    Image fill · 16:9
                  </span>
                )}
              </div>
              <div className="h-10 px-3 flex items-center justify-between text-[13px]">
                <span className="text-white">{c.name}</span>
                <span className="text-[#ffd166] font-semibold">{c.price}</span>
              </div>
            </div>
          );
        })}
      </div>

      {d ? (
        <>
          <Cursor color={DESIGN_RED} label="Smuzzie" path={{ x: [330, 420, 380, 330], y: [150, 120, 205, 150] }} />
          <Cursor color="#f59e0b" label="Client" path={{ x: [610, 560, 640, 610], y: [210, 260, 240, 210] }} />
        </>
      ) : (
        <>
          {/* Visitor hovering the mousepad card */}
          <motion.div
            className="absolute left-0 top-0 z-30 pointer-events-none"
            initial={{ x: 790, y: 470 }}
            animate={{ x: [790, 760, 790], y: [470, 455, 470] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <MousePointer2 size={18} className="text-white fill-white drop-shadow" />
          </motion.div>
          {/* Toast */}
          <motion.div
            className="absolute left-[330px] top-[46px] z-30 flex items-center gap-2 pl-2 pr-3 py-2 rounded-lg bg-[#1b1a22] border border-white/10 shadow-2xl text-[11px] text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0], y: [-6, 0, 0, -6] }}
            transition={{ duration: 5, repeat: Infinity, times: [0, 0.1, 0.75, 0.85], repeatDelay: 1 }}
          >
            <span className="w-5 h-5 rounded-full bg-[#34f596]/20 flex items-center justify-center">
              <Check size={11} className="text-[#34f596]" />
            </span>
            XL Mousepad added to cart
          </motion.div>
        </>
      )}
    </div>
  );
}

export default function DesignToCode() {
  const frameRef = useRef<HTMLDivElement>(null);
  const inView = useInView(frameRef, { once: true, margin: '-120px' });
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState(50);
  const dragging = useRef(false);
  const touched = useRef(false);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // One sweep on first sight so people get that it's draggable
  useEffect(() => {
    if (!inView || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const controls = animate(50, [50, 82, 18, 50], {
      duration: 2.6,
      ease: 'easeInOut',
      delay: 0.3,
      onUpdate: (v) => {
        if (!touched.current) setPos(v);
      },
    });
    return () => controls.stop();
  }, [inView]);

  function moveTo(clientX: number) {
    const r = frameRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }

  return (
    <section className="relative py-24 md:py-32 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="font-mono text-xs tracking-[0.2em] text-accent-red mb-4">{'// design → code'}</div>
          <h2 className="font-mono font-bold tracking-tight text-3xl md:text-5xl text-white">
            From <span style={{ color: DESIGN_RED }}>Figma</span> to <span className="text-accent-red">production</span>.
          </h2>
          <p className="mt-5 text-gray-500 max-w-2xl mx-auto">
            Smuzzie designs it, we build it pixel-perfect. One team from the first sketch to the live site, no handoff
            gaps. Drag the slider.
          </p>
        </div>

        <div
          ref={frameRef}
          className="relative w-full rounded-2xl overflow-hidden border border-white/[0.08] shadow-[0_30px_120px_-30px_rgb(var(--accent)/0.3)] cursor-ew-resize"
          style={{ height: H * scale, touchAction: 'pan-y' }}
          onPointerDown={(e) => {
            dragging.current = true;
            touched.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            moveTo(e.clientX);
          }}
          onPointerMove={(e) => dragging.current && moveTo(e.clientX)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
            <MockSite variant="live" />
          </div>
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ transform: `scale(${scale})`, clipPath: `inset(0 ${100 - pos}% 0 0)` }}
            aria-hidden="true"
          >
            <MockSite variant="design" />
          </div>

          {/* Labels */}
          <span
            className="absolute left-3 bottom-3 px-2.5 py-1 rounded-full font-mono text-[10px] tracking-[0.15em] uppercase text-white backdrop-blur"
            style={{ background: 'rgba(230,57,70,0.25)', boxShadow: 'inset 0 0 0 1px rgba(230,57,70,0.5)', opacity: pos > 12 ? 1 : 0 }}
          >
            Design
          </span>
          <span
            className="absolute right-3 bottom-3 px-2.5 py-1 rounded-full font-mono text-[10px] tracking-[0.15em] uppercase text-white backdrop-blur bg-accent-red/25 ring-1 ring-inset ring-accent-red/50"
            style={{ opacity: pos < 88 ? 1 : 0 }}
          >
            Live
          </span>

          {/* Divider */}
          <div
            role="slider"
            tabIndex={0}
            aria-label="Compare design and live site"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pos)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                touched.current = true;
                setPos((p) => Math.min(100, Math.max(0, p + (e.key === 'ArrowLeft' ? -5 : 5))));
              }
            }}
            className="absolute top-0 bottom-0 w-px bg-white/80 outline-none focus-visible:bg-accent-red"
            style={{ left: `${pos}%` }}
          >
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#0b0b0b] border border-white/70 flex items-center justify-center text-white shadow-[0_0_24px_rgba(0,0,0,0.6)]">
              <ChevronsLeftRight size={16} />
            </span>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          Only need the design?{' '}
          <Link href="/" className="font-semibold hover:underline" style={{ color: DESIGN_RED }}>
            Switch to design mode →
          </Link>
        </p>
      </div>
    </section>
  );
}
