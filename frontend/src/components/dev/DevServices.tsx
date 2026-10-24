'use client';

import { motion } from 'framer-motion';
import { Globe, LayoutDashboard, ShoppingCart, Rocket, Bot, Gauge } from 'lucide-react';

const SERVICES = [
  {
    icon: Rocket,
    title: 'Landing Pages',
    text: 'One page, one goal. Launch a product, a drop or a stream with a page built to convert.',
    tags: ['Next.js', 'Motion', 'A/B ready'],
  },
  {
    icon: Globe,
    title: 'Brand Websites',
    text: 'Multi-page sites for teams, creators and studios, with a CMS you can edit yourself.',
    tags: ['CMS', 'SEO', 'i18n'],
  },
  {
    icon: ShoppingCart,
    title: 'Online Stores',
    text: 'Merch and digital goods with card or crypto checkout, orders and email receipts.',
    tags: ['Payments', 'Crypto', 'Inventory'],
  },
  {
    icon: LayoutDashboard,
    title: 'Web Apps & Dashboards',
    text: 'Accounts, admin panels, editors, internal tools. Real products, not just pages.',
    tags: ['Auth', 'API', 'Admin'],
  },
  {
    icon: Bot,
    title: 'Bots & Integrations',
    text: 'Discord and Telegram bots, payment webhooks, CRMs, anything with an API.',
    tags: ['Discord', 'Telegram', 'Webhooks'],
  },
  {
    icon: Gauge,
    title: 'Speed & SEO',
    text: 'Make an existing site fast and visible: Core Web Vitals, metadata, structured data.',
    tags: ['Lighthouse', 'Schema', 'Audit'],
  },
];

export default function DevServices() {
  return (
    <section id="services" className="relative py-24 md:py-32 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-14 max-w-2xl">
          <div className="font-mono text-xs tracking-[0.2em] text-accent-red mb-4">{'// services'}</div>
          <h2 className="font-mono font-bold tracking-tight text-3xl md:text-5xl text-white">What we build</h2>
          <p className="mt-5 text-gray-500">
            Everything ships with Smuzzie&apos;s design on top, so it looks as good as it works.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.06] border border-white/[0.06] rounded-2xl overflow-hidden">
          {SERVICES.map((s, i) => (
            <motion.div
              key={s.title}
              className="group relative bg-[#070808] p-7 hover:bg-[#0a0d0c] transition-colors"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: (i % 3) * 0.08 }}
            >
              <div className="flex items-start justify-between">
                <s.icon size={22} className="text-accent-red" />
                <span className="font-mono text-[11px] text-gray-700">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <h3 className="mt-6 font-mono font-bold text-lg text-white">{s.title}</h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">{s.text}</p>
              <div className="mt-5 flex flex-wrap gap-1.5">
                {s.tags.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded border border-white/[0.06] font-mono text-[10px] text-gray-500">
                    {t}
                  </span>
                ))}
              </div>
              <span className="absolute left-0 top-0 h-px w-0 bg-accent-red group-hover:w-full transition-all duration-500" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
