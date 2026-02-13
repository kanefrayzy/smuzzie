'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCcw, MessageCircle, Crown, Target, CheckCircle2, Clock, Palette } from 'lucide-react';
import ScrollReveal from '@/components/ui/ScrollReveal';

const features = [
  {
    icon: Crown,
    title: 'Premium Quality',
    description: 'Every design is handcrafted with pixel-perfect precision. No templates, no shortcuts — only original work.',
    color: 'text-accent-red',
    borderHover: 'hover:border-accent-red/30',
    highlights: ['100% Original', 'Pixel-Perfect', 'Hand-Crafted'],
  },
  {
    icon: Target,
    title: 'Tailored To You',
    description: 'Every project starts with your vision. We craft unique concepts that match your brand identity perfectly.',
    color: 'text-accent-gold',
    borderHover: 'hover:border-accent-gold/30',
    highlights: ['Custom Concepts', 'Brand Identity', 'Unique Style'],
  },
  {
    icon: RefreshCcw,
    title: 'Unlimited Revisions',
    description: 'Not 100% happy? We revise until you love it. Your satisfaction is all that matters.',
    color: 'text-green-500',
    borderHover: 'hover:border-green-500/30',
    highlights: ['Free Revisions', 'No Extra Cost', '100% Satisfaction'],
  },
  {
    icon: MessageCircle,
    title: '24/7 Support',
    description: 'Reach us anytime via Discord, Telegram, or email. We respond within minutes.',
    color: 'text-blue-500',
    borderHover: 'hover:border-blue-500/30',
    highlights: ['Discord', 'Telegram', 'Email'],
  },
];

const stats = [
  { value: '500+', label: 'Projects', icon: Target },
  { value: '100%', label: 'Satisfaction', icon: CheckCircle2 },
  { value: '8+', label: 'Categories', icon: Palette },
  { value: '7+', label: 'Years Exp', icon: Clock },
];

export default function WhyChooseUs() {
  const [activeCard, setActiveCard] = useState<number | null>(null);

  return (
    <section className="relative py-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#060608]" />
      <div className="absolute inset-0 bg-grid-pattern opacity-100" />

      {/* Red glow accents */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-accent-red/[0.03] rounded-full blur-[150px]" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent-red/[0.02] rounded-full blur-[150px]" />

      {/* Horizontal HUD lines */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-red/10 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-red/10 to-transparent" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <ScrollReveal>
          <div className="text-center mb-20">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-8 bg-accent-red/40" />
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent-red/60">Why Us</span>
              <div className="h-px w-8 bg-accent-red/40" />
            </div>
            <h2 className="section-heading">
              Why Clients <span className="text-gradient">Choose Us</span>
            </h2>
            <p className="section-subheading">
              We don&apos;t just design — we deliver results that grow your brand
            </p>
          </div>
        </ScrollReveal>

        {/* Feature cards — 2x2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5 mb-16">
          {features.map((feature, index) => (
            <ScrollReveal key={feature.title} delay={index * 0.1}>
              <motion.div
                className={`relative p-7 lg:p-8 h-full border border-white/[0.06] ${feature.borderHover} bg-white/[0.01] transition-all duration-500 group cursor-default overflow-hidden`}
                style={{ clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' }}
                whileHover={{ y: -3 }}
                onMouseEnter={() => setActiveCard(index)}
                onMouseLeave={() => setActiveCard(null)}
              >
                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-accent-red/20" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-accent-red/20" />

                {/* Hover glow */}
                <motion.div
                  className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-accent-red/5 blur-[80px] pointer-events-none"
                  animate={{ opacity: activeCard === index ? 0.8 : 0 }}
                  transition={{ duration: 0.4 }}
                />

                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-start gap-5 mb-5">
                    <div className={`w-12 h-12 flex items-center justify-center border border-white/[0.08] bg-white/[0.02] flex-shrink-0 ${feature.color}`}
                      style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                    >
                      <feature.icon size={22} />
                    </div>
                    <div>
                      <h3 className="text-lg font-display font-bold text-white mb-1.5">{feature.title}</h3>
                      <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-white/[0.04]">
                    {feature.highlights.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider border border-white/[0.06] bg-white/[0.02] text-gray-400"
                      >
                        <CheckCircle2 size={9} className="text-green-500/60" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>

        {/* Stats bar — angular */}
        <ScrollReveal delay={0.2}>
          <div className="relative border border-white/[0.06] bg-white/[0.01] p-8 lg:p-10"
            style={{ clipPath: 'polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)' }}
          >
            {/* Top accent line */}
            <div className="absolute top-0 left-[16px] right-0 h-px bg-gradient-to-r from-accent-red/30 via-transparent to-transparent" />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  className="text-center group"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 * index }}
                >
                  <stat.icon size={16} className="text-accent-red/60 mx-auto mb-2" />
                  <div className="text-2xl lg:text-3xl font-display font-black text-white group-hover:text-accent-red transition-colors">
                    {stat.value}
                  </div>
                  <div className="text-[10px] text-gray-600 mt-1 uppercase tracking-[0.2em] font-mono">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
