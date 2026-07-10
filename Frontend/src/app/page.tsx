import { CategoryBar } from '@/components/home/CategoryBar';
import { Hero } from '@/components/sections/Hero';
import { BestSellerCarousel } from '@/components/sections/BestSellerCarousel';
import { ShopByConcern } from '@/components/home/ShopByConcern';
import { ComboPacks } from '@/components/home/ComboPacks';
import { TrustStrip } from '@/components/home/TrustStrip';
import { IngredientStory } from '@/components/home/IngredientStory';
import { NewArrivals } from '@/components/home/NewArrivals';
import { ReelsSection } from '@/components/sections/ReelsSection';
import { Testimonials } from '@/components/home/Testimonials';
import { AICta } from '@/components/home/AICta';
import { ConnectUs } from '@/components/home/ConnectUs';

// Section order per the July 2026 client feedback rounds — category bar first
// (offer strip + navbar live in the root layout above), skin-quiz CTA directly
// above Trending Now, trust badges directly after Loved by Millions.
export default function HomePage() {
  return (
    <>
      <CategoryBar />
      <Hero />
      <BestSellerCarousel />
      <ShopByConcern />
      <ComboPacks />
      <IngredientStory />
      <NewArrivals />
      <AICta />
      <ReelsSection />
      <Testimonials />
      <TrustStrip />
      <ConnectUs />
    </>
  );
}
