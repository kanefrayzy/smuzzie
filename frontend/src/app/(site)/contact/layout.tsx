import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({
  title: 'Contact Us',
  description:
    'Get in touch with Smuzzie to start your design project. Reach us via Discord, Telegram or email — we reply within minutes.',
  path: '/contact',
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
