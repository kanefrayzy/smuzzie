'use client';

import React from 'react';
import ScrollReveal from '@/components/ui/ScrollReveal';

export interface LegalSection {
  /** Anchor id, e.g. "cookies" for /privacy#cookies */
  id: string;
  title: string;
  body: React.ReactNode;
}

interface LegalPageProps {
  title: string;
  accent: string;
  updated: string;
  intro?: React.ReactNode;
  sections: LegalSection[];
}

/** Shared shell for the Privacy Policy and Terms of Service. */
export default function LegalPage({ title, accent, updated, intro, sections }: LegalPageProps) {
  return (
    <div className="pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl mb-12">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-red/10 to-accent-red/10" />
          <div className="relative py-16 px-8 text-center">
            <ScrollReveal>
              <h1 className="text-4xl md:text-5xl font-display font-black tracking-tight">
                {title} <span className="text-gradient">{accent}</span>
              </h1>
              <p className="text-gray-400 mt-4">Last updated: {updated}</p>
            </ScrollReveal>
          </div>
        </div>

        {/* Contents */}
        <nav aria-label="On this page" className="mb-8 px-1">
          <ol className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] tracking-wider uppercase">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-gray-500 hover:text-accent-red transition-colors">
                  <span className="text-accent-red/50">{String(i + 1).padStart(2, '0')}</span> {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Content */}
        <ScrollReveal>
          <div className="glass-card p-6 sm:p-8 md:p-12 border border-white/5 space-y-10">
            {intro && <div className="text-gray-300 leading-relaxed text-sm space-y-3">{intro}</div>}

            {sections.map((section, i) => (
              <section key={section.id} id={section.id} className="scroll-mt-28">
                <h2 className="text-xl font-display font-bold text-white mb-3">
                  {i + 1}. {section.title}
                </h2>
                <div className="text-gray-400 leading-relaxed text-sm space-y-3">{section.body}</div>
              </section>
            ))}

            {/* Disclaimer */}
            <div className="mt-12 pt-8 border-t border-accent-red/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px w-6 bg-accent-red/40" />
                <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent-red/60">Disclaimer</span>
                <div className="h-px w-6 bg-accent-red/40" />
              </div>
              <div className="space-y-3 text-gray-400 leading-relaxed text-sm">
                <p>All portfolio content on this website is limited to design work only. Nothing in the portfolio is intended for real use, distribution, or promotion. All designs shown there are visual concepts only.</p>
                <p>Nothing is connected to real cheats, hacks, exploits, or software. No sales, offers, or transactions are made except for graphic design services and design products, such as customizable video banners. We do not encourage cheating, scamming, fraud, or any illegal activity.</p>
                <p>Any names, prices, or features shown in designs are placeholders for artistic and illustrative purposes only. This website does not promote, advertise, or facilitate any real products, tools, or services outside of design or coding.</p>
                <p>By joining or viewing this website, you acknowledge that all portfolio content is purely hypothetical and unrelated to real usage. All designs shown here are purely visual concepts and have no connection to sales, promotion, cheating, scamming, or any real products. They exist only as design work.</p>
                <p className="font-semibold text-white/80">I do not sell anything except design itself.</p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
