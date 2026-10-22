import type { Metadata } from 'next';

// Order pages are private (reachable by their token link only): never indexed.
export const metadata: Metadata = {
  title: 'Your banner order',
  robots: { index: false, follow: false, nocache: true },
};

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
