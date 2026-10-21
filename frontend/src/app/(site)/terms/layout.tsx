import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({
  title: 'Terms of Service',
  description:
    'Terms and conditions for ordering design services from Smuzzie.',
  path: '/terms',
});

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
