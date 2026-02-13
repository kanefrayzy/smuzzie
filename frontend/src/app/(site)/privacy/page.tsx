'use client';

import React from 'react';
import ScrollReveal from '@/components/ui/ScrollReveal';

export default function PrivacyPage() {
  return (
    <div className="pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl mb-12">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-red/10 to-accent-red/10" />
          <div className="relative py-16 px-8 text-center">
            <ScrollReveal>
              <h1 className="text-4xl md:text-5xl font-display font-black tracking-tight">
                Privacy <span className="text-gradient">Policy</span>
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
                title: '1. Information We Collect',
                content: 'We collect information you provide directly, including your name, email address, and project details when you use our contact form or engage our services. We do not collect unnecessary personal information.',
              },
              {
                title: '2. How We Use Your Information',
                content: 'Your information is used solely to provide our design services, communicate with you about projects, process payments, and improve our services. We do not sell or share your personal information with third parties for marketing purposes.',
              },
              {
                title: '3. Data Storage & Security',
                content: 'We implement industry-standard security measures to protect your data. Project files and personal information are stored securely and accessed only by authorized team members working on your project.',
              },
              {
                title: '4. Cookies & Analytics',
                content: 'Our website may use cookies for basic functionality and analytics. These help us understand how visitors use our site and improve the user experience. You can disable cookies in your browser settings.',
              },
              {
                title: '5. Third-Party Services',
                content: 'We may use third-party services for payment processing. These services have their own privacy policies governing the use of your information.',
              },
              {
                title: '6. Data Retention',
                content: 'We retain project files and communication records for a reasonable period after project completion. You may request deletion of your personal data at any time by contacting us.',
              },
              {
                title: '7. Your Rights',
                content: 'You have the right to access, correct, or delete your personal information. You may also opt out of any communications from us at any time.',
              },
              {
                title: '8. Children\'s Privacy',
                content: 'Our services are not directed to individuals under 13 years of age. We do not knowingly collect personal information from children.',
              },
              {
                title: '9. Changes to This Policy',
                content: 'We may update this privacy policy from time to time. We will notify you of any significant changes by posting the new policy on our website.',
              },
              {
                title: '10. Contact Us',
                content: 'If you have questions about this privacy policy or your personal data, please contact us at contact@smuzzie.com.',
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
