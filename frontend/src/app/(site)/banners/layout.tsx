import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/site';

// Catalog metadata. Template pages set their own (banners/[slug]/page.tsx), order pages are noindex.
export const metadata: Metadata = {
  ...pageMetadata({
    title: 'Animated Video Banner Maker — MP4 & GIF Templates',
    description:
      'Create an animated video banner in minutes: pick a template, add your text, logo and brand colors in the browser, pay with crypto and download MP4 and GIF without a watermark.',
    path: '/banners',
  }),
  keywords: [
    'animated banner maker', 'video banner templates', 'banner ad maker', 'animated GIF banner', 'MP4 banner',
    'online banner editor', 'video ad templates', 'crypto payment',
  ],
};

export default function BannersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
