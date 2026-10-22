import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check } from 'lucide-react';
import BannerTemplateClient from '@/components/banners/BannerTemplateClient';
import BannerFaq from '@/components/banners/BannerFaq';
import { absoluteMedia, fetchBannerTemplate, formatPrice, formatsLabel, jsonLd } from '@/lib/banners-server';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { FORMAT_LABEL, isImageTemplate, templateFormats } from '@/lib/banner-formats';
import type { PublicBannerTemplate } from '@/types/banners';

export const revalidate = 300;

type Props = { params: { slug: string } };

function describe(t: PublicBannerTemplate): string {
  const [first, ...rest] = templateFormats(t).map((f) => FORMAT_LABEL[f]);
  return (
    t.description?.trim() ||
    `Customize the ${t.name} ${isImageTemplate(t) ? '' : 'animated '}banner online: your text, logo and colors. ` +
      `Download ${first} ${t.width}×${t.height}${rest.length ? ` and ${rest.join(' and ')}` : ''} without a watermark for ${formatPrice(t.price, t.currency)}.`
  );
}

/** What the buyer can change in this template, in plain words. */
function customizations(t: PublicBannerTemplate): string[] {
  const zones = t.config?.zones || [];
  const texts = zones.filter((z) => z.type === 'text' && z.controls.text.enabled).length;
  const logos = zones.filter((z) => z.type === 'image' && z.controls.upload.enabled).length;
  const out: string[] = [];
  if (texts) out.push(`${texts} editable text${texts > 1 ? 's' : ''}`);
  if (logos) out.push(logos > 1 ? `${logos} logo or image slots` : 'Your logo');
  if (zones.some((z) => z.type === 'text' && (z.controls.color.enabled))) out.push('Text colors');
  if (zones.some((z) => z.type === 'text' && z.controls.font?.enabled && z.controls.font.options.length > 1)) out.push('Font choice');
  if (t.config?.hue?.enabled) out.push('Background color shift');
  if (zones.some((z) => z.controls.position?.enabled)) out.push('Move and resize blocks');
  if (t.config?.custom?.enabled) out.push('Add your own texts and pictures');
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await fetchBannerTemplate(params.slug);
  const path = `/banners/${params.slug}`;
  if (t === 'missing') return { title: 'Template not found', robots: { index: false } };
  if (!t) return { title: 'Animated banner template', alternates: { canonical: path } };

  const still = isImageTemplate(t);
  const title = `${t.name} — ${still ? 'Banner' : 'Animated Banner'} Template`;
  const description = describe(t);
  const poster = absoluteMedia(t.poster_url);
  const images = poster ? [{ url: poster, width: t.width, height: t.height, alt: `${t.name} ${still ? '' : 'animated '}banner` }] : undefined;
  return {
    // absolute: the catalog layout's own title would otherwise drop the " | Smuzzie" template
    title: { absolute: `${title} | ${SITE_NAME}` },
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url: path,
      siteName: SITE_NAME,
      type: 'website',
      images,
      videos: t.preview_url && !still ? [{ url: absoluteMedia(t.preview_url)!, width: 720, type: 'video/mp4' }] : undefined,
    },
    twitter: { card: 'summary_large_image', title: `${title} | ${SITE_NAME}`, description, images: poster ? [poster] : undefined },
  };
}

export default async function BannerTemplatePage({ params }: Props) {
  const t = await fetchBannerTemplate(params.slug);
  if (t === 'missing') notFound();

  const url = `${SITE_URL}/banners/${params.slug}`;
  const structured = t && {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${url}#product`,
        name: `${t.name} ${isImageTemplate(t) ? '' : 'animated '}banner`,
        description: describe(t),
        image: absoluteMedia(t.poster_url),
        url,
        sku: t.slug,
        brand: { '@type': 'Brand', name: SITE_NAME },
        category: isImageTemplate(t) ? 'Banner template' : 'Animated video banner template',
        offers: {
          '@type': 'Offer',
          url,
          price: Number(t.price).toFixed(2),
          priceCurrency: t.currency,
          availability: 'https://schema.org/InStock',
          seller: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Banner templates', item: `${SITE_URL}/banners` },
          { '@type': 'ListItem', position: 3, name: t.name, item: url },
        ],
      },
    ],
  };

  return (
    <div className="pt-24 pb-20 relative min-h-screen">
      {structured && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />}
      <div className="absolute inset-0 bg-[#060608]" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/banners" className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-gray-500 hover:text-white my-6">
          <ArrowLeft size={14} /> All templates
        </Link>

        <BannerTemplateClient slug={params.slug} initial={t || null} />

        {t && (
          <div className="mt-24 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-10">
            <section aria-labelledby="about-template">
              <h2 id="about-template" className="text-2xl md:text-3xl font-display font-bold text-white mb-4">
                About the {t.name} banner
              </h2>
              <p className="text-gray-400 leading-relaxed max-w-3xl">{describe(t)}</p>
              {customizations(t).length > 0 && (
                <>
                  <h3 className="text-white font-semibold mt-8 mb-3">What you can customize</h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl">
                    {customizations(t).map((c) => (
                      <li key={c} className="flex items-center gap-2 text-sm text-gray-300">
                        <Check size={14} className="text-accent-red shrink-0" aria-hidden="true" /> {c}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
            <aside aria-label="Specifications" className="glass-card p-5 border border-white/[0.06] h-fit">
              <h3 className="text-white font-semibold mb-4">Specifications</h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
                <dt className="text-gray-500">Formats</dt>
                <dd className="text-gray-200">{formatsLabel(t)}</dd>
                <dt className="text-gray-500">Resolution</dt>
                <dd className="text-gray-200">{t.width}×{t.height} px</dd>
                {!isImageTemplate(t) && t.duration ? (
                  <>
                    <dt className="text-gray-500">Duration</dt>
                    <dd className="text-gray-200">{t.duration} s{t.fps ? ` · ${Math.round(t.fps)} fps` : ''}</dd>
                  </>
                ) : (
                  <>
                    <dt className="text-gray-500">Type</dt>
                    <dd className="text-gray-200">Still image</dd>
                  </>
                )}
                <dt className="text-gray-500">Watermark</dt>
                <dd className="text-gray-200">Only in the preview</dd>
                <dt className="text-gray-500">Price</dt>
                <dd className="text-white font-semibold">{formatPrice(t.price, t.currency)}</dd>
                <dt className="text-gray-500">Payment</dt>
                <dd className="text-gray-200">USDT, USDC, BTC, ETH, TON and more</dd>
              </dl>
            </aside>
          </div>
        )}

        <BannerFaq className="mt-20" />
      </div>
    </div>
  );
}
