import React from 'react';
import { ChevronDown } from 'lucide-react';

// Shared FAQ for the banner builder pages (also emitted as FAQPage JSON-LD). Server component.

export const BANNER_FAQ: { q: string; a: string }[] = [
  {
    q: 'What do I get after paying?',
    a: 'An MP4 video in the template’s full resolution and, for most templates, an animated GIF, both without the watermark you see in the preview. Still (non-animated) templates come as PNG and JPG. The download links appear on your order page and are emailed to you.',
  },
  {
    q: 'How long does it take?',
    a: 'Usually a few minutes. Rendering starts as soon as the payment is confirmed on the blockchain, and the order page updates by itself.',
  },
  {
    q: 'What can I change in a template?',
    a: 'Texts, fonts, colors, the background hue and your logo. Many templates also let you move and resize blocks and add your own texts and pictures on top. The preview shows exactly what the final file will look like.',
  },
  {
    q: 'How do I pay?',
    a: 'With cryptocurrency, right on the order page: USDT and USDC on several networks, BTC, ETH, TON, SOL, LTC and more. You pick a coin and network, send the shown amount to the address or scan the QR code. No account or card needed.',
  },
  {
    q: 'Can I use the banner for ads and commercial projects?',
    a: 'Yes. The banner you buy is yours to use in your own advertising, websites, social media and marketplaces. You only need the rights to the texts and logos you put in.',
  },
  {
    q: 'Which formats and sizes are available?',
    a: 'Each template lists its exact size and duration. Files are H.264 MP4 with standard colors for every player and platform, plus a lightweight GIF when the template offers it.',
  },
  {
    q: 'What if something goes wrong?',
    a: 'If the render fails or the file is defective, we render it again or refund you. Write to us through the contact page with your order link.',
  },
];

export default function BannerFaq({ className = '' }: { className?: string }) {
  return (
    <section className={className} aria-labelledby="banner-faq">
      <h2 id="banner-faq" className="text-2xl md:text-3xl font-display font-bold text-white mb-6">
        Frequently asked questions
      </h2>
      <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
        {BANNER_FAQ.map((item) => (
          <details key={item.q} className="group py-4">
            <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-white font-medium [&::-webkit-details-marker]:hidden">
              {item.q}
              <ChevronDown size={16} className="shrink-0 text-gray-500 transition-transform group-open:rotate-180" />
            </summary>
            <p className="text-sm text-gray-400 leading-relaxed mt-3 max-w-3xl">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function faqJsonLd() {
  return {
    '@type': 'FAQPage',
    mainEntity: BANNER_FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}
