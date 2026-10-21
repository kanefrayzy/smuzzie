import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({
  title: 'Portfolio — Logos, Avatars, 3D & Custom Designs',
  description:
    'Browse the Smuzzie portfolio: logo design, avatars, 3D art, thread and signature designs, ads and custom graphics. Hundreds of finished projects.',
  path: '/portfolio',
});

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
