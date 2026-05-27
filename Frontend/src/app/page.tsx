import { Hero } from '@/components/home/Hero';
import { TrustStrip } from '@/components/home/TrustStrip';
import { Bestsellers } from '@/components/home/Bestsellers';
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
      <TrustStrip />
      <Bestsellers />
      <ShopByConcern />
      <ComboPacks />
      <IngredientStory />
      <NewArrivals />
      <Testimonials />
      <AICta />
    </>
  );
}
