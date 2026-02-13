'use client';

import React from 'react';
import Link from 'next/link';
import { Github, Twitter, MessageCircle, Mail, Heart } from 'lucide-react';
import Logo from '@/components/ui/Logo';

const footerLinks = {
  'Quick Links': [
    { label: 'Home', href: '/' },
    { label: 'Portfolio', href: '/portfolio' },
    { label: 'Contact Us', href: '/contact' },
    { label: 'Get Started', href: '/get-started' },
  ],
  'Categories': [
    { label: 'Logo Design', href: '/portfolio?category=logo-design' },
    { label: 'Thread Design', href: '/portfolio?category=thread-design' },
    { label: 'Avatar Design', href: '/portfolio?category=avatar-design' },
    { label: '3D Design', href: '/portfolio?category=3d-design' },
  ],
  'Legal': [
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Privacy Policy', href: '/privacy' },
  ],
};

const socialLinks = [
  { icon: MessageCircle, href: '#', label: 'Discord' },
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Github, href: '#', label: 'GitHub' },
  { icon: Mail, href: '/contact', label: 'Email' },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-white/[0.04] bg-[#060608]">
      {/* Grid pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-100" />

      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-red/20 to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <div className="mb-4">
              <Logo size="md" />
            </div>
            <p className="text-gray-600 text-sm leading-relaxed mb-6 max-w-sm font-light">
              Premium design services with 7+ years of experience. Designs that dominate. Results that speak.
            </p>

            {/* Social icons — angular */}
            <div className="flex items-center gap-2">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  className="w-9 h-9 flex items-center justify-center text-gray-600 hover:text-accent-red border border-white/[0.06] hover:border-accent-red/30 bg-white/[0.01] hover:bg-accent-red/5 transition-all duration-300"
                  style={{ clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)' }}
                  aria-label={social.label}
                >
                  <social.icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent-red/50 mb-4">{title}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-gray-500 hover:text-white text-sm transition-colors duration-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-6 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-700 text-xs flex items-center gap-1 font-mono tracking-wider">
            © {new Date().getFullYear()} SMUZZIE SERVICES
            <Heart size={10} className="text-accent-red/40 fill-accent-red/40" />
          </p>
          <div className="flex items-center gap-6 text-gray-600 text-xs font-mono tracking-wider">
            <Link href="/terms" className="hover:text-gray-300 transition-colors">TERMS</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">PRIVACY</Link>
            <Link href="/contact" className="hover:text-gray-300 transition-colors">CONTACT</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
