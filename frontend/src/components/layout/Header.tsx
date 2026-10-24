'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import GetStartedButton from '@/components/ui/GetStartedButton';
import ModeSwitch from '@/components/mode/ModeSwitch';
import { modeFromPath } from '@/lib/site-mode';

// First three go left of the mode switch, the rest to the right
const NAV = {
  design: [
    { label: 'Home', href: '/' },
    { label: 'Portfolio', href: '/portfolio' },
    { label: 'Banner Maker', href: '/banners' },
    { label: 'Services', href: '/get-started' },
    { label: 'Contact', href: '/contact' },
  ],
  dev: [
    { label: 'Home', href: '/dev' },
    { label: 'Services', href: '/dev#services' },
    { label: 'Process', href: '/dev#process' },
    { label: 'Stack', href: '/dev#stack' },
    { label: 'Contact', href: '/contact' },
  ],
};

const CTA = {
  design: { href: '/get-started', label: 'Get Started' },
  dev: { href: '/contact', label: 'Start a Project' },
};

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mode = modeFromPath(usePathname());
  const navItems = NAV[mode];
  const cta = CTA[mode];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [mobileOpen]);

  return (
    <>
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-[#060608]/95 backdrop-blur-xl'
            : 'bg-transparent'
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Left — Navigation */}
            <nav className="hidden lg:flex items-center gap-7 flex-1">
              {navItems.slice(0, 3).map((item) => (
                <Link key={item.href} href={item.href} className="nav-link">
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Center — Design / Dev mode switch (the helmet is in it) */}
            <div className="flex-shrink-0 flex items-center justify-center">
              <ModeSwitch />
            </div>

            {/* Right — Navigation + CTA */}
            <div className="hidden lg:flex items-center gap-7 flex-1 justify-end">
              {navItems.slice(3).map((item) => (
                <Link key={item.href} href={item.href} className="nav-link">
                  {item.label}
                </Link>
              ))}
              <GetStartedButton size="sm" href={cta.href} label={cta.label} />
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden relative z-50 p-2 text-white ml-auto"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-[#060608]/98 backdrop-blur-xl lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <nav className="flex flex-col items-center justify-center h-full gap-6">
              {navItems.map((item, index) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                >
                  <Link
                    href={item.href}
                    className="text-lg font-bold uppercase tracking-[0.15em] text-gray-400 hover:text-white transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-4"
              >
                <GetStartedButton size="lg" href={cta.href} label={cta.label} onClick={() => setMobileOpen(false)} />
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
