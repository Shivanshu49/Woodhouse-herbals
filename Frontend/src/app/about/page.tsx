import Image from 'next/image';
import { Leaf, Shield, Sparkles, FlaskConical, Heart, BadgeCheck } from 'lucide-react';

const VALUES = [
  { Icon: BadgeCheck, title: 'FDA Approved', body: 'Manufactured in an FDA-compliant facility under strict quality controls.' },
  { Icon: Shield, title: 'Dermat-tested', body: 'Every formula is dermatologically tested for safety and tolerance.' },
  { Icon: FlaskConical, title: 'Quality Assurance', body: 'Every batch is QA-tested before it leaves our facility.' },
  { Icon: Leaf, title: 'Eminence For Purity', body: 'Plant-first ingredients, no harsh chemicals.' },
  { Icon: Sparkles, title: 'ISO · WHO · GMP', body: 'Globally recognised manufacturing certifications.' },
  { Icon: Heart, title: 'No Animal Testing', body: 'Cruelty-free at every step.' },
];

export const metadata = {
  title: 'About — Wood House Herbals',
  description: 'Discover the philosophy and craft behind Wood House Herbals by VedicGlory Healthcare.',
};

export default function AboutPage() {
  return (
    <article>
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-hero-gradient" />
        <div className="container-wide py-16 sm:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="eyebrow">Our story</span>
            <h1 className="mt-4 text-display-xl text-balance">Where ancient wisdom meets modern skincare.</h1>
            <p className="mt-5 text-lg text-ink-muted max-w-xl text-balance">
              Wood House Herbals is the skincare arm of VedicGlory Healthcare — a young, cheerful Indian company
              dedicated to crafting effective, plant-first products for every skin type.
            </p>
          </div>
          <div className="relative aspect-[4/5] rounded-[2.5rem] overflow-hidden shadow-lift">
            <Image
              src="https://images.unsplash.com/photo-1556228720-da4e85b0aa78?w=1200&q=80&auto=format&fit=crop"
              alt="Herbal ingredients laid out on a wooden tray"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="section container-wide">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          <div>
            <h2 className="text-display-md mb-4">Our philosophy</h2>
            <p className="text-ink leading-relaxed text-balance">
              We believe that nature has the answers to all skin concerns. That’s why we use only the finest herbs and natural ingredients,
              carefully selected for their potency and efficacy. Our products are free from harsh chemicals, artificial fragrances and dyes —
              making them suitable for all skin types.
            </p>
          </div>
          <div className="rounded-3xl bg-sand-100 p-8 border border-forest-900/5">
            <p className="text-xs uppercase tracking-wider text-ink-muted">Headquarters</p>
            <p className="mt-1 font-display text-lg text-forest-900">VedicGlory Healthcare</p>
            <p className="text-sm text-ink-muted mt-2">Simran Sapphire, Plot 364, Sector 34C Kharghar, Navi Mumbai, MAHARASHTRA – 410210</p>
            <p className="mt-4 text-xs uppercase tracking-wider text-ink-muted">Regional office</p>
            <p className="text-sm text-ink-muted mt-1">Suncity, Dixit Nagar, Nagpur, MAHARASHTRA – 440026</p>
          </div>
        </div>
      </section>

      <section className="section bg-cream-200/40">
        <div className="container-wide">
          <h2 className="text-display-md text-center mb-12 text-balance">A standard you can trust.</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {VALUES.map((v) => (
              <div key={v.title} className="rounded-3xl bg-white p-6 border border-forest-900/5 shadow-soft">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-sage-200 text-forest-900">
                  <v.Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg text-forest-900">{v.title}</h3>
                <p className="mt-2 text-sm text-ink-muted">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </article>
  );
}
