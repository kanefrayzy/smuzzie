'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Mail, MessageCircle, Send, ExternalLink } from 'lucide-react';
import ScrollReveal from '@/components/ui/ScrollReveal';

const contactMethods = [
  {
    icon: MessageCircle,
    title: 'Discord',
    description: 'Join my Discord server and message me directly',
    label: 'Open Discord',
    href: 'https://discord.com/users/248866988347097089',
    color: 'from-[#5865F2]/20 to-[#5865F2]/5',
    borderColor: 'hover:border-[#5865F2]/30',
    iconColor: 'text-[#5865F2]',
  },
  {
    icon: Send,
    title: 'Telegram',
    description: 'Chat with me instantly on Telegram',
    label: 'Open Telegram',
    href: 'https://t.me/SmuzZie',
    color: 'from-[#26A5E4]/20 to-[#26A5E4]/5',
    borderColor: 'hover:border-[#26A5E4]/30',
    iconColor: 'text-[#26A5E4]',
  },
  {
    icon: Mail,
    title: 'Email',
    description: 'Send me an email for detailed project inquiries',
    label: 'Send Email',
    href: 'mailto:contact@smuzzie.com',
    color: 'from-accent-red/20 to-accent-red/5',
    borderColor: 'hover:border-accent-red/30',
    iconColor: 'text-accent-red',
  },
];

export default function ContactPage() {
  return (
    <div className="pt-24 pb-20 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-[#060608]" />
      <div className="absolute inset-0 bg-grid-pattern opacity-100" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-red/10 to-transparent" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <ScrollReveal>
          <div className="text-center py-16">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-8 bg-accent-red/40" />
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent-red/60">Contact</span>
              <div className="h-px w-8 bg-accent-red/40" />
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-black tracking-tight">
              Get in <span className="text-gradient">Touch</span>
            </h1>
            <p className="text-gray-500 text-base mt-4 max-w-xl mx-auto">
              Ready to start your project? Reach out through any of these channels and let&apos;s chat.
            </p>
          </div>
        </ScrollReveal>

        {/* Contact buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {contactMethods.map((method, index) => (
            <ScrollReveal key={method.title} delay={index * 0.1}>
              <motion.a
                href={method.href}
                target={method.href.startsWith('mailto:') ? undefined : '_blank'}
                rel={method.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                className={`block p-8 border border-white/[0.06] ${method.borderColor} bg-gradient-to-b ${method.color} transition-all duration-300 group cursor-pointer`}
                style={{ clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' }}
                whileHover={{ y: -6, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex flex-col items-center text-center">
                  <div className={`${method.iconColor} mb-4 p-3 bg-white/[0.03] border border-white/[0.06] rounded-lg`}>
                    <method.icon size={28} />
                  </div>
                  <h3 className="text-white font-display font-bold text-lg mb-2">{method.title}</h3>
                  <p className="text-gray-500 text-xs font-mono mb-5 leading-relaxed">{method.description}</p>
                  <div className="flex items-center gap-2 text-white text-sm font-semibold group-hover:gap-3 transition-all duration-300">
                    <span>{method.label}</span>
                    <ExternalLink size={14} className="opacity-60 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </motion.a>
            </ScrollReveal>
          ))}
        </div>

        {/* Bottom note */}
        <ScrollReveal>
          <p className="text-center text-gray-600 text-xs mt-12 font-mono tracking-wider uppercase">
            Average response time · Under 24 hours
          </p>
        </ScrollReveal>
      </div>
    </div>
  );
}
