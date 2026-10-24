'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { MODE_COLOR } from '@/lib/site-mode';

const RED = MODE_COLOR.design;
const GREEN = MODE_COLOR.dev;

const PACKAGES = [
  {
    name: 'Design',
    tagline: 'Graphics and UI by Smuzzie',
    color: RED,
    points: ['Logos, banners, avatars', 'Website and app UI in Figma', 'Brand kits and motion'],
    href: '/',
    cta: 'Design mode',
  },
  {
    name: 'Design + Dev',
    tagline: 'From idea to a live site',
    featured: true,
    points: ['Everything in Design and Dev', 'One brief, one deadline', 'No handoff gaps between teams', 'Support after launch'],
    href: '/contact',
    cta: 'Start a project',
  },
  {
    name: 'Dev',
    tagline: 'Build from your design',
    color: GREEN,
    points: ['Sites, stores and web apps', 'From Figma, or from scratch', 'SEO, speed, analytics'],
    href: '/contact',
    cta: 'Get a quote',
  },
];

export default function DevPackages() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <div className="font-mono text-xs tracking-[0.2em] text-accent-red mb-4">{'// packages'}</div>
          <h2 className="font-mono font-bold tracking-tight text-3xl md:text-5xl text-white">
            <span style={{ color: RED }}>Design</span> + <span style={{ color: GREEN }}>Code</span>. One team.
          </h2>
          <p className="mt-5 text-gray-500 max-w-xl mx-auto">Take one side, or the full package.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 items-stretch">
          {PACKAGES.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl p-[1px] ${p.featured ? 'md:-my-4' : ''}`}
              style={{
                background: p.featured
                  ? `linear-gradient(135deg, ${RED}, ${GREEN})`
                  : 'rgba(255,255,255,0.07)',
              }}
            >
              <div className="h-full rounded-2xl bg-[#070808] p-7 flex flex-col">
                {p.featured && (
                  <span
                    className="self-start mb-4 px-2.5 py-1 rounded-full font-mono text-[10px] uppercase tracking-[0.15em] text-white"
                    style={{ background: `linear-gradient(90deg, ${RED}55, ${GREEN}55)` }}
                  >
                    Full package
                  </span>
                )}
                <h3
                  className="font-mono font-bold text-2xl"
                  style={
                    p.featured
                      ? { backgroundImage: `linear-gradient(90deg, ${RED}, ${GREEN})`, WebkitBackgroundClip: 'text', color: 'transparent' }
                      : { color: p.color }
                  }
                >
                  {p.name}
                </h3>
                <p className="mt-1 text-sm text-gray-500">{p.tagline}</p>
                <ul className="mt-6 space-y-2.5 flex-1">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex gap-2.5 text-sm text-gray-300">
                      <Check size={16} className="shrink-0 mt-0.5" style={{ color: p.color ?? GREEN }} />
                      {pt}
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.href}
                  className="mt-8 inline-flex justify-center items-center h-11 rounded-full font-mono text-xs font-bold uppercase tracking-[0.15em] transition-transform hover:scale-[1.03]"
                  style={
                    p.featured
                      ? { background: `linear-gradient(90deg, ${RED}, ${GREEN})`, color: '#050505' }
                      : { boxShadow: `inset 0 0 0 1px ${p.color}66`, color: p.color }
                  }
                >
                  {p.cta}
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
