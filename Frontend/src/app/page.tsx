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

// Section order per the July 2026 client feedback round — category bar first
// (offer strip + navbar live in the root layout above), trust badges relocated
// below the concern/combo block, Trending Now directly after New Arrivals.
export default function HomePage() {
  return (
    <>
      <CategoryBar />
      <Hero />
      <BestSellerCarousel />
      <ShopByConcern />
      <ComboPacks />
      <TrustStrip />
      <IngredientStory />
      <NewArrivals />
      <ReelsSection />
      <Testimonials />
      <AICta />
    </>
  );
}
