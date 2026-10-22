import React from 'react';
import Link from 'next/link';
import { Film, Type, Palette, Download, Wallet, Sparkles } from 'lucide-react';
import BannerCard from '@/components/banners/BannerCard';
import BannerFaq, { faqJsonLd } from '@/components/banners/BannerFaq';
import CustomBannerRequest from '@/components/banners/CustomBannerRequest';
import { absoluteMedia, fetchBannerTemplates, jsonLd } from '@/lib/banners-server';
import { SITE_NAME, SITE_URL } from '@/lib/site';

// Server-rendered so crawlers get the template list, prices and FAQ as HTML.
export const revalidate = 300;

const STEPS = [
  { icon: Film, title: 'Pick a template', text: 'Animated banners made by our designers, rendered in high resolution.' },
  { icon: Type, title: 'Make it yours', text: 'Your texts, fonts, colors and logo. Move blocks and add your own layers.' },
  { icon: Wallet, title: 'Pay with crypto', text: 'USDT, USDC, BTC, ETH, TON and more, right on the page. No account needed.' },
  { icon: Download, title: 'Download', text: 'MP4 and GIF (PNG and JPG for still banners) without the watermark, usually in a few minutes.' },
];

const FEATURES = [
  { icon: Sparkles, title: 'What you see is what you get', text: 'The live preview uses the same layout engine as the final render, line breaks included.' },
  { icon: Palette, title: 'Brand colors in one slider', text: 'Shift the whole background to your palette and pick text colors freely.' },
  { icon: Film, title: 'Ready for every platform', text: 'H.264 MP4 with standard colors for ads, websites, social media and marketplaces.' },
];

export default async function BannersCatalogPage() {
  const templates = await fetchBannerTemplates();

  const structured = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${SITE_URL}/banners#page`,
        url: `${SITE_URL}/banners`,
        name: 'Animated video banner templates',
        description: 'Customize animated video banners online and download them as MP4 and GIF.',
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: (templates || []).map((t, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${SITE_URL}/banners/${t.slug}`,
            name: t.name,
            image: absoluteMedia(t.poster_url),
          })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Banner templates', item: `${SITE_URL}/banners` },
        ],
      },
      faqJsonLd(),
    ],
  };

  return (
    <div className="pt-24 pb-20 relative min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
      <div className="absolute inset-0 bg-[#060608]" />
      <div className="absolute inset-0 bg-grid-pattern" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="pt-6 text-xs font-mono uppercase tracking-wider text-gray-600">
          <Link href="/" className="hover:text-gray-300">Home</Link> <span aria-hidden="true">/</span>{' '}
          <span className="text-gray-400">Banners</span>
        </nav>

        <header className="text-center py-12 md:py-14">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px w-8 bg-accent-red/40" />
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent-red/60">Banner builder</span>
            <div className="h-px w-8 bg-accent-red/40" />
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-black tracking-tight">
            Animated video <span className="text-gradient">banner templates</span>
          </h1>
          <p className="text-gray-400 text-base md:text-lg mt-5 max-w-2xl mx-auto">
            Pick a template, put in your texts, logo and colors right in the browser, and download a ready MP4 and GIF in minutes.
          </p>
        </header>

        {templates === null && <p className="text-center text-gray-400 py-20">Could not load templates. Please refresh the page in a minute.</p>}

        {templates && templates.length === 0 && (
          <div className="text-center text-gray-400 py-20">
            <Film size={40} className="mx-auto mb-4 text-accent-red/60" />
            New templates are on the way.
          </div>
        )}

        {templates && templates.length > 0 && (
          <section aria-label="Templates" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((t) => (
              <BannerCard key={t.slug} template={t} />
            ))}
          </section>
        )}

        <CustomBannerRequest />

        <section aria-labelledby="how-it-works" className="mt-24">
          <h2 id="how-it-works" className="text-2xl md:text-3xl font-display font-bold text-white mb-8">
            How it works
          </h2>
          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="glass-card p-5 border border-white/[0.06]">
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-mono text-xs text-accent-red/70">0{i + 1}</span>
                  <s.icon size={18} className="text-accent-red" aria-hidden="true" />
                </div>
                <h3 className="text-white font-semibold mb-1.5">{s.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="why" className="mt-20">
          <h2 id="why" className="text-2xl md:text-3xl font-display font-bold text-white mb-8">
            Why our banner builder
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.015]">
                <f.icon size={18} className="text-accent-red mb-3" aria-hidden="true" />
                <h3 className="text-white font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-6">
            Need something unique? Our studio also designs custom banners, logos and brand graphics:{' '}
            <Link href="/get-started" className="text-accent-red hover:underline">order a custom design</Link> or{' '}
            <Link href="/portfolio" className="text-accent-red hover:underline">see the portfolio</Link>.
          </p>
        </section>

        <BannerFaq className="mt-20" />
      </div>
    </div>
  );
}
