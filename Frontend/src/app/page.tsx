import { Hero } from '@/components/sections/Hero';
import { BestSellerCarousel } from '@/components/sections/BestSellerCarousel';
import { TrustStrip } from '@/components/home/TrustStrip';
import { ShopByConcern } from '@/components/home/ShopByConcern';
import { ComboPacks } from '@/components/home/ComboPacks';
import { IngredientStory } from '@/components/home/IngredientStory';
import { NewArrivals } from '@/components/home/NewArrivals';
import { Testimonials } from '@/components/home/Testimonials';
import { AICta } from '@/components/home/AICta';

export default function HomePage() {
  return (
    <>
      <Hero />
      <BestSellerCarousel />
      <TrustStrip />
      <ShopByConcern />
      <ComboPacks />
      <IngredientStory />
      <NewArrivals />
      <Testimonials />
      <AICta />
    </>
  );
}
