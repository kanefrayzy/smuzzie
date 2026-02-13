'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ScrollReveal from '@/components/ui/ScrollReveal';
import {
  Sparkles, Zap, Shield, Clock, Star, ChevronRight, ChevronDown, ChevronUp,
  Check, Send, Palette, User, Box, PenTool, Megaphone, Target, Type, Layers,
  ArrowRight, MessageCircle, Mail, ExternalLink
} from 'lucide-react';

/* ─── service data ──────────────────────────────────────── */
const services = [
  { id: 'logo',      icon: Palette,    name: 'Logo Design',    desc: 'Brand identity & logos',    popular: true },
  { id: 'thread',    icon: Layers,     name: 'Thread Design',  desc: 'Forum thread banners',      popular: false },
  { id: 'avatar',    icon: User,       name: 'Avatar Design',  desc: 'Profile pictures & icons',  popular: true },
  { id: '3d',        icon: Box,        name: '3D Design',      desc: '3D renders & mockups',       popular: false },
  { id: 'signature', icon: PenTool,    name: 'Signature',      desc: 'Custom signatures',          popular: false },
  { id: 'ads',       icon: Megaphone,  name: 'Ads Design',     desc: 'Advertising banners',        popular: false },
  { id: 'custom',    icon: Target,     name: 'Custom Design',  desc: 'Any custom project',         popular: true },
  { id: 'css',       icon: Type,       name: 'CSS / Font',     desc: 'CSS & font styling',         popular: false },
];

const faqs = [
  { q: 'How long does a project take?', a: 'Most projects are completed within 24-72 hours depending on complexity. Rush orders are available for urgent needs.' },
  { q: 'What if I\'m not satisfied?', a: 'We offer unlimited revisions until you\'re 100% happy. Your satisfaction is guaranteed or your money back.' },
  { q: 'How do I communicate with the designer?', a: 'You can reach us via Discord, Telegram, or Email. We\'re available 24/7 to discuss your project.' },
  { q: 'What file formats do I receive?', a: 'You\'ll receive your design in all major formats: PNG, JPG, SVG, PSD, and AI. Source files are always included.' },
];

const contactChannels = [
  {
    icon: MessageCircle,
    title: 'Discord',
    description: 'Message me directly on Discord',
    label: 'Open Discord',
    href: 'https://discord.com/users/248866988347097089',
    color: 'from-[#5865F2]/20 to-[#5865F2]/5',
    borderColor: 'hover:border-[#5865F2]/40',
    iconColor: 'text-[#5865F2]',
    glowColor: 'rgba(88,101,242,0.3)',
  },
  {
    icon: Send,
    title: 'Telegram',
    description: 'Chat with me on Telegram',
    label: 'Open Telegram',
    href: 'https://t.me/SmuzZie',
    color: 'from-[#26A5E4]/20 to-[#26A5E4]/5',
    borderColor: 'hover:border-[#26A5E4]/40',
    iconColor: 'text-[#26A5E4]',
    glowColor: 'rgba(38,165,228,0.3)',
  },
  {
    icon: Mail,
    title: 'Email',
    description: 'Send a detailed email',
    label: 'Send Email',
    href: 'mailto:contact@smuzzie.com',
    color: 'from-accent-red/20 to-accent-red/5',
    borderColor: 'hover:border-accent-red/40',
    iconColor: 'text-accent-red',
    glowColor: 'rgba(230,57,70,0.3)',
  },
];

/* ─── floating particles ────────────────────────────────── */
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-[2px] h-[2px] rounded-full bg-white/20"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: 4 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

/* ─── animated background orbs ──────────────────────────── */
function BackgroundOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <motion.div
        className="absolute -top-[300px] -left-[200px] w-[600px] h-[600px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(230,57,70,0.08) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.2, 1], x: [0, 50, 0], y: [0, 30, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-[200px] -right-[200px] w-[500px] h-[500px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(230,57,70,0.06) 0%, transparent 70%)' }}
        animate={{ scale: [1.2, 1, 1.2], x: [0, -40, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.04) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

/* ─── faq accordion ─────────────────────────────────────── */
function FAQItem({ q, a, delay }: { q: string; a: string; delay: number }) {
  const [open, setOpen] = useState(false);
  return (
    <ScrollReveal delay={delay}>
      <div
        className={`border rounded-xl transition-all duration-300 overflow-hidden ${
          open ? 'border-accent-red/30 bg-white/[0.02]' : 'border-white/5 bg-transparent hover:border-white/10'
        }`}
      >
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between p-5 text-left"
        >
          <span className="text-white font-semibold text-sm pr-4">{q}</span>
          {open ? (
            <ChevronUp size={18} className="text-accent-red flex-shrink-0" />
          ) : (
            <ChevronDown size={18} className="text-white/30 flex-shrink-0" />
          )}
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <p className="px-5 pb-5 text-gray-400 text-sm leading-relaxed">{a}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ScrollReveal>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */
export default function GetStartedPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [showContact, setShowContact] = useState(false);

  const toggleService = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleContinue = () => {
    setShowContact(true);
    setTimeout(() => {
      document.getElementById('contact-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const selectedNames = selected.map(id => services.find(s => s.id === id)?.name).filter(Boolean).join(', ');

  return (
    <div className="min-h-screen relative">
      <BackgroundOrbs />
      <FloatingParticles />

      {/* grid overlay */}
      <div className="fixed inset-0 bg-grid-pattern opacity-30 pointer-events-none z-0" />

      <div className="relative z-10 pt-32 pb-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* ─── Hero ─── */}
          <div className="text-center mb-16">
            <ScrollReveal>
              <motion.div
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-accent-red/30 bg-accent-red/5 text-accent-red text-xs font-semibold tracking-wider uppercase mb-8"
                animate={{ boxShadow: ['0 0 15px rgba(230,57,70,0.1)', '0 0 30px rgba(230,57,70,0.2)', '0 0 15px rgba(230,57,70,0.1)'] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Sparkles size={14} className="animate-sparkle" />
                Start Your Project
              </motion.div>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-black tracking-tight leading-[1.05]">
                Let&apos;s Build Something
                <br />
                <span className="text-gradient">Legendary</span>
              </h1>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <p className="text-gray-400 text-base sm:text-lg mt-6 max-w-xl mx-auto leading-relaxed">
                Select what you need, then reach out directly — let&apos;s discuss your vision and get started right away.
              </p>
            </ScrollReveal>
          </div>

          {/* ─── Service Selection ─── */}
          <ScrollReveal delay={0.3}>
            <div className="text-center mb-8">
              <h2 className="text-xl sm:text-2xl font-display font-bold text-white">
                What do you need?
              </h2>
              <p className="text-gray-500 text-sm mt-2">Select one or more services, then contact me</p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {services.map((service, i) => {
              const isSelected = selected.includes(service.id);
              const Icon = service.icon;
              return (
                <ScrollReveal key={service.id} delay={i * 0.05}>
                  <motion.button
                    onClick={() => toggleService(service.id)}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    className={`relative w-full p-5 sm:p-6 rounded-2xl border-2 text-left transition-all duration-300 group overflow-hidden ${
                      isSelected
                        ? 'border-accent-red bg-accent-red/5 shadow-[0_0_30px_rgba(230,57,70,0.15)]'
                        : 'border-white/[0.06] bg-white/[0.015] hover:border-white/10 hover:bg-white/[0.03]'
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        className="absolute inset-0 rounded-2xl"
                        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(230,57,70,0.08) 0%, transparent 70%)' }}
                        layoutId={`glow-${service.id}`}
                      />
                    )}

                    {service.popular && (
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-accent-red/10 text-accent-red border border-accent-red/20">
                        Hot
                      </div>
                    )}

                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="absolute top-2 left-2 w-5 h-5 rounded-full bg-accent-red flex items-center justify-center"
                        >
                          <Check size={12} className="text-white" />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="relative z-10">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors duration-300 ${
                          isSelected
                            ? 'bg-accent-red/15 text-accent-red'
                            : 'bg-white/5 text-white/40 group-hover:text-white/60'
                        }`}
                      >
                        <Icon size={20} />
                      </div>
                      <h3 className={`font-semibold text-sm mb-1 transition-colors ${
                        isSelected ? 'text-white' : 'text-white/80 group-hover:text-white'
                      }`}>
                        {service.name}
                      </h3>
                      <p className="text-gray-500 text-xs">{service.desc}</p>
                    </div>
                  </motion.button>
                </ScrollReveal>
              );
            })}
          </div>

          {/* selected count + continue */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-500">
              {selected.length > 0 ? (
                <span>
                  <span className="text-accent-red font-bold">{selected.length}</span> service{selected.length > 1 ? 's' : ''} selected
                </span>
              ) : (
                'Select services to get started'
              )}
            </div>
            <motion.button
              onClick={handleContinue}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`btn-primary px-8 ${selected.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
              disabled={selected.length === 0}
            >
              Contact Me
              <ArrowRight size={16} />
            </motion.button>
          </div>

          {/* ─── Contact Channels (shown after selecting services) ─── */}
          <AnimatePresence>
            {showContact && selected.length > 0 && (
              <motion.div
                id="contact-section"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="mt-16"
              >
                {/* selected summary */}
                <div className="text-center mb-8">
                  <h2 className="text-xl sm:text-2xl font-display font-bold text-white mb-3">
                    Reach out & let&apos;s <span className="text-gradient">discuss</span>
                  </h2>
                  <p className="text-gray-500 text-sm max-w-lg mx-auto">
                    You selected: <span className="text-white/80 font-medium">{selectedNames}</span>.
                    <br />Pick your preferred way to chat — I&apos;ll reply within minutes.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                  {contactChannels.map((channel, index) => (
                    <ScrollReveal key={channel.title} delay={index * 0.1}>
                      <motion.a
                        href={channel.href}
                        target={channel.href.startsWith('mailto:') ? undefined : '_blank'}
                        rel={channel.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                        className={`block p-8 rounded-2xl border-2 border-white/[0.06] ${channel.borderColor} bg-gradient-to-b ${channel.color} transition-all duration-300 group cursor-pointer`}
                        whileHover={{ y: -6, scale: 1.02, boxShadow: `0 20px 40px ${channel.glowColor}` }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex flex-col items-center text-center">
                          <div className={`${channel.iconColor} mb-4 p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl`}>
                            <channel.icon size={28} />
                          </div>
                          <h3 className="text-white font-display font-bold text-lg mb-2">{channel.title}</h3>
                          <p className="text-gray-500 text-xs font-mono mb-5 leading-relaxed">{channel.description}</p>
                          <div className="flex items-center gap-2 text-white text-sm font-semibold group-hover:gap-3 transition-all duration-300">
                            <span>{channel.label}</span>
                            <ExternalLink size={14} className="opacity-60 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </motion.a>
                    </ScrollReveal>
                  ))}
                </div>

                <ScrollReveal>
                  <p className="text-center text-gray-600 text-xs mt-8 font-mono tracking-wider uppercase">
                    Average response time · Under 24 hours
                  </p>
                </ScrollReveal>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Trust Strip ─── */}
          <ScrollReveal delay={0.2}>
            <div className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { icon: Zap,    label: 'Fast Delivery',     value: '24-72h' },
                { icon: Shield, label: 'Guaranteed',        value: '100%' },
                { icon: Star,   label: 'Client Rating',     value: '5.0 ★' },
                { icon: Clock,  label: 'Support',           value: '24/7' },
              ].map((stat) => (
                <motion.div
                  key={stat.label}
                  className="text-center p-5 rounded-2xl border border-white/[0.04] bg-white/[0.01] hover:border-white/[0.08] transition-all duration-300 group"
                  whileHover={{ y: -3 }}
                >
                  <stat.icon
                    size={18}
                    className="mx-auto text-accent-red/60 group-hover:text-accent-red transition-colors mb-2"
                  />
                  <div className="text-white font-bold text-lg font-display">{stat.value}</div>
                  <div className="text-gray-500 text-[11px] mt-1 uppercase tracking-wider font-medium">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </ScrollReveal>

          {/* ─── FAQ ─── */}
          <div className="mt-20">
            <ScrollReveal>
              <div className="text-center mb-10">
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-white">
                  Frequently Asked <span className="text-gradient">Questions</span>
                </h2>
              </div>
            </ScrollReveal>

            <div className="max-w-2xl mx-auto space-y-3">
              {faqs.map((faq, i) => (
                <FAQItem key={i} q={faq.q} a={faq.a} delay={i * 0.05} />
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
