import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({
  title: 'Get Started — Order a Custom Design',
  description:
    'Start your project with Smuzzie: logos, avatars, 3D, thread and custom designs. Fast delivery, unlimited revisions, crypto payments accepted.',
  path: '/get-started',
});

export default function GetStartedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
