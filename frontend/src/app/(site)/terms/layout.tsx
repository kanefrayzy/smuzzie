import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({
  title: 'Terms of Service',
  description:
    'Terms for ordering custom design services and buying customizable video banners from Smuzzie: payments in crypto, delivery, refunds and license.',
  path: '/terms',
});

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
