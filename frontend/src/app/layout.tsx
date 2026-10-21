import type { Metadata, Viewport } from 'next';
import { Inter, Poppins, JetBrains_Mono } from 'next/font/google';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import './globals.css';

// Self-hosted at build time: no render-blocking request to Google Fonts
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-poppins',
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' });

const DEFAULT_TITLE = 'Smuzzie | Premium Design Services';
const DEFAULT_DESCRIPTION =
  'Professional design services including logos, avatars, 3D designs, and more. 7+ years experience delivering premium creative solutions.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: '/',
    siteName: SITE_NAME,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: { icon: '/favicon.ico' },
};

export const viewport: Viewport = {
  themeColor: '#080808',
  colorScheme: 'dark',
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
    },
    {
      '@type': 'ProfessionalService',
      '@id': `${SITE_URL}/#business`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/images/logo.svg`,
      description: DEFAULT_DESCRIPTION,
      serviceType: ['Logo design', 'Avatar design', '3D design', 'Thread design', 'Signature design', 'Ads design'],
      areaServed: 'Worldwide',
      paymentAccepted: 'Cryptocurrency',
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${poppins.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-primary text-white min-h-screen">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
