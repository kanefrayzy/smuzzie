import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({
  title: 'Web Development',
  description:
    'Websites, online stores and web apps designed by Smuzzie and built by the same team. Fast, SEO-ready, from first sketch to launch.',
  path: '/dev',
});

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return children;
}
