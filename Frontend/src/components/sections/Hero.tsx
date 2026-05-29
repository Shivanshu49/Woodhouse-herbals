import Image from 'next/image';
import Link from 'next/link';

export function Hero() {
  return (
    <section
      aria-label="Hero"
      className="relative w-full bg-brand-mint overflow-hidden min-h-[85vh] md:min-h-[75vh]"
    >
      <div className="mx-auto max-w-7xl px-6 md:px-10 h-full">
        <div className="flex flex-col md:flex-row items-stretch md:items-center min-h-[85vh] md:min-h-[75vh] gap-8 md:gap-4">
          <div className="md:w-[55%] flex flex-col justify-center py-12 md:py-0 z-10">
            <h1 className="font-display font-medium text-white text-4xl sm:text-5xl md:text-6xl leading-[1.05] tracking-tight max-w-2xl">
              Nature&apos;s Power for Radiant Skin
            </h1>
            <p className="mt-6 font-display italic font-normal text-white/95 text-lg md:text-xl max-w-xl leading-relaxed">
              Herbal skincare crafted with ancient wisdom and modern science
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/shop"
                className="inline-flex items-center justify-center rounded-full bg-white text-brand-forest font-inter font-semibold px-8 py-3 transition-transform duration-200 hover:scale-105 shadow-sm"
              >
                Shop Now
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center justify-center rounded-full border border-white/90 text-white font-inter font-semibold px-8 py-3 transition-colors duration-200 hover:bg-white/10"
              >
                Explore Us
              </Link>
            </div>
          </div>
          <div className="relative md:w-[45%] flex-1 min-h-[320px] md:min-h-0 md:self-stretch">
            <div className="absolute inset-0 md:-right-10 lg:-right-16">
              <Image
                src="/hero/hero-models.png"
                alt="Wood House Herbals lifestyle photography — model holding a Woodhouse skincare product"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 45vw"
                className="object-cover object-center rounded-3xl md:rounded-l-[3rem] md:rounded-r-none"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
