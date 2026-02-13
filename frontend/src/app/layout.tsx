import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Smuzzie | Premium Design Services',
  description: 'Professional design services including logos, avatars, 3D designs, and more. 7+ years experience delivering premium creative solutions.',
  keywords: 'design, logo design, 3d design, avatar, signature, thread design, custom design',
  openGraph: {
    title: 'Smuzzie | Premium Design Services',
    description: 'Professional design services including logos, avatars, 3D designs, and more.',
    url: 'https://smuzzie.com',
    siteName: 'Smuzzie',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Smuzzie | Premium Design Services',
    description: 'Professional design services including logos, avatars, 3D designs, and more.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="bg-primary text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
