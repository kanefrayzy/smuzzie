'use client';

import HeroSection from '@/components/sections/HeroSection';
import PortfolioSlider from '@/components/sections/PortfolioSlider';
import WhyChooseUs from '@/components/sections/WhyChooseUs';
import BannerBuilderSection from '@/components/sections/BannerBuilderSection';
import ReviewsSection from '@/components/sections/ReviewsSection';
import CryptoSection from '@/components/sections/CryptoSection';
import CTAFooterSection from '@/components/sections/CTAFooterSection';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <PortfolioSlider />
      <WhyChooseUs />
      <BannerBuilderSection />
      <ReviewsSection />
      <CryptoSection />
      <CTAFooterSection />
    </>
  );
}
