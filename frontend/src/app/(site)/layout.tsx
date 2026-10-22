import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CookieConsentLoader from '@/components/consent/CookieConsentLoader';

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      <CookieConsentLoader />
    </>
  );
}
