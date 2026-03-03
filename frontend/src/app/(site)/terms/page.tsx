'use client';

import React from 'react';
import ScrollReveal from '@/components/ui/ScrollReveal';

export default function TermsPage() {
  return (
    <div className="pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl mb-12">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-red/10 to-accent-red/10" />
          <div className="relative py-16 px-8 text-center">
            <ScrollReveal>
              <h1 className="text-4xl md:text-5xl font-display font-black tracking-tight">
                Terms of <span className="text-gradient">Service</span>
              </h1>
              <p className="text-gray-400 mt-4">Last updated: February 2026</p>
            </ScrollReveal>
          </div>
        </div>

        {/* Content */}
        <ScrollReveal>
          <div className="glass-card p-8 md:p-12 border border-white/5 space-y-8">
            {[
              {
                title: '1. Acceptance of Terms',
                content: 'By accessing and using our design services, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by these terms, please do not use our services.',
              },
              {
                title: '2. Services',
                content: 'Smuzzie provides professional design services including but not limited to logo design, thread design, signature design, avatar design, 3D design, CSS/font design, ads design, and custom design work. All services are subject to availability and our discretion.',
              },
              {
                title: '3. Payment & Pricing',
                content: 'All prices are quoted in advance and must be agreed upon before work begins. We accept cryptocurrency payments including BTC, ETH, LTC, USDT, and SOL. All payments are final once work has commenced unless otherwise agreed.',
              },
              {
                title: '4. Revisions & Modifications',
                content: 'Each project includes a reasonable number of revisions as discussed during the initial consultation. Additional revisions beyond the agreed scope may incur additional charges.',
              },
              {
                title: '5. Intellectual Property',
                content: 'Upon full payment, the client receives full rights to use the completed design work. We retain the right to showcase completed work in our portfolio unless otherwise agreed upon in writing.',
              },
              {
                title: '6. Delivery Timeline',
                content: 'Estimated delivery times are provided at the start of each project. While we strive to meet all deadlines, delays may occur due to complexity, revisions, or unforeseen circumstances.',
              },
              {
                title: '7. Refund Policy',
                content: 'Refunds may be issued at our discretion if work has not yet begun. Once design work has commenced, refunds are generally not available. Partial refunds may be considered on a case-by-case basis.',
              },
              {
                title: '8. Limitation of Liability',
                content: 'Smuzzie shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from the use or inability to use our services.',
              },
              {
                title: '9. Changes to Terms',
                content: 'We reserve the right to update these terms at any time. Continued use of our services after changes constitutes acceptance of the new terms.',
              },
              {
                title: '10. Contact',
                content: 'For questions about these Terms of Service, please contact us at smuzziedesign@gmail.com  or through our Contact page.',
              },
            ].map((section) => (
              <div key={section.title}>
                <h2 className="text-xl font-display font-bold text-white mb-3">{section.title}</h2>
                <p className="text-gray-400 leading-relaxed text-sm">{section.content}</p>
              </div>
            ))}

            {/* Disclaimer */}
            <div className="mt-12 pt-8 border-t border-accent-red/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px w-6 bg-accent-red/40" />
                <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent-red/60">Disclaimer</span>
                <div className="h-px w-6 bg-accent-red/40" />
              </div>
              <div className="space-y-3 text-gray-400 leading-relaxed text-sm">
                <p>All content on this server is limited to design work only. Nothing here is intended for real use, distribution, or promotion. All designs are visual concepts only.</p>
                <p>Nothing is connected to real cheats, hacks, exploits, or software. No sales, offers, or transactions are made except for graphic design services. We do not encourage cheating, scamming, fraud, or any illegal activity.</p>
                <p>Any names, prices, or features shown in designs are placeholders for artistic and illustrative purposes only. This website does not promote, advertise, or facilitate any real products, tools, or services outside of design or coding.</p>
                <p>By joining or viewing this website, you acknowledge that all content is purely hypothetical and unrelated to real usage. All designs shown here are purely visual concepts and have no connection to sales, promotion, cheating, scamming, or any real products. They exist only as design work.</p>
                <p className="font-semibold text-white/80">I do not sell anything except design itself.</p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
