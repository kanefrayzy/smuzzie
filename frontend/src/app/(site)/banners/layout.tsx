import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/site';

// Hidden section until payments exist: reachable by direct link only, not indexed,
// not in the sitemap, no links from the header/footer.
export const metadata: Metadata = {
  ...pageMetadata({
    title: 'Video Banner Builder',
    description: 'Customize an animated video banner: your texts, logo and colors, ready as MP4 and GIF.',
    path: '/banners',
  }),
  robots: { index: false, follow: false },
};

export default function BannersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
