'use client';

import React from 'react';
import { motion } from 'framer-motion';
import GetStartedButton from '@/components/ui/GetStartedButton';
import { SpartanHelmet } from '@/components/ui/Logo';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { Shield, Zap, Star, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function CTAFooterSection() {
  return (
    <section className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-primary" />
      <div className="absolute inset-0 bg-grid-pattern opacity-100" />

      {/* Red glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-red/[0.04] rounded-full blur-[200px]" />

      {/* Diagonal accent lines */}
      <div className="absolute inset-0 overflow-hidden opacity-[0.02]">
        <div className="absolute top-1/4 -left-1/4 w-[200%] h-px bg-gradient-to-r from-transparent via-accent-red to-transparent rotate-[15deg]" />
        <div className="absolute top-2/3 -left-1/4 w-[200%] h-px bg-gradient-to-r from-transparent via-accent-red to-transparent rotate-[-10deg]" />
      </div>

      {/* HUD lines */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-red/10 to-transparent" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <ScrollReveal>
          {/* Logo */}
          <motion.div
            className="flex justify-center mb-8"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="relative">
              <div className="absolute inset-0 -m-6 bg-accent-red/[0.08] rounded-full blur-[30px]" />
              <SpartanHelmet size={56} />
            </div>
          </motion.div>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-black tracking-tight leading-tight mb-6">
            Ready to Stand Out
            <br />
            <span className="text-gradient">From the Crowd?</span>
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <p className="text-gray-500 text-base md:text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
            Stop blending in. Get a design that turns heads, builds trust, and
            makes your audience <span className="text-white font-semibold">remember you</span>.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <GetStartedButton size="lg" />
            <Link href="/portfolio" className="btn-outline">
              See Examples
              <ArrowRight size={16} />
            </Link>
          </div>
        </ScrollReveal>

        {/* Trust badges */}
        <ScrollReveal delay={0.2}>
          <div className="flex flex-wrap items-center justify-center gap-6 text-[11px] text-gray-600 font-mono uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Shield size={12} className="text-accent-red/60" /> Guaranteed
            </span>
            <span className="text-accent-red/20">│</span>
            <span className="flex items-center gap-1.5">
              <Zap size={12} className="text-accent-gold/60" /> 24h Delivery
            </span>
            <span className="text-accent-red/20">│</span>
            <span className="flex items-center gap-1.5">
              <Star size={12} className="text-accent-gold/60 fill-accent-gold/60" /> 5-Star
            </span>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
