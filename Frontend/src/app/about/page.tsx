import Image from 'next/image';
import { Leaf, Shield, Sparkles, FlaskConical, Heart, BadgeCheck } from 'lucide-react';

const VALUES = [
  { Icon: BadgeCheck,   title: 'FDA Approved',         body: 'Manufactured in an FDA-compliant facility under strict quality controls.' },
  { Icon: Shield,       title: 'Dermat-tested',        body: 'Every formula is dermatologically tested for safety and tolerance.' },
  { Icon: FlaskConical, title: 'Quality Assurance',    body: 'Every batch is QA-tested before it leaves our facility.' },
  { Icon: Leaf,         title: 'Plant-first',          body: 'Real botanicals, no harsh chemicals — kind to skin and planet.' },
  { Icon: Sparkles,     title: 'ISO · WHO · GMP',      body: 'Globally recognised manufacturing certifications.' },
  { Icon: Heart,        title: 'No Animal Testing',    body: 'Cruelty-free at every step of formulation and packaging.' },
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
            <h1 className="mt-4 text-display-xl text-balance">
              Where ancient wisdom meets <span className="italic font-light text-brand-600">modern skincare.</span>
            </h1>
            <p className="mt-5 text-lg text-ink-muted max-w-xl text-balance leading-relaxed">
              Wood House Herbals is the skincare arm of VedicGlory Healthcare — a young, cheerful Indian company
              dedicated to crafting effective, plant-first products for every skin type.
            </p>
          </div>
          <div className="relative aspect-[4/5] rounded-[2.5rem] overflow-hidden shadow-lift ring-1 ring-navy-900/5">
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
            <p className="text-navy-900/85 leading-relaxed text-balance">
              We believe that nature has the answers to all skin concerns. That's why we use only the finest herbs and natural ingredients,
              carefully selected for their potency and efficacy. Our products are free from harsh chemicals, artificial fragrances and dyes —
              making them suitable for all skin types.
            </p>
          </div>
          <div className="rounded-[2rem] bg-brand-500/8 p-8 border border-brand-500/20">
            <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-brand-700">Headquarters</p>
            <p className="mt-1 font-display text-lg font-semibold text-navy-900">VedicGlory Healthcare</p>
            <p className="text-sm text-ink-muted mt-2 leading-relaxed">Simran Sapphire, Plot 364, Sector 34C Kharghar, Navi Mumbai, MAHARASHTRA – 410210</p>
            <p className="mt-4 text-[11px] uppercase tracking-[0.18em] font-bold text-brand-700">Regional office</p>
            <p className="text-sm text-ink-muted mt-1 leading-relaxed">Suncity, Dixit Nagar, Nagpur, MAHARASHTRA – 440026</p>
          </div>
        </div>
      </section>

      <section className="section bg-blush-100/30">
        <div className="container-wide">
          <h2 className="text-display-md text-center mb-12 text-balance">
            A standard you can <span className="italic font-light text-brand-600">trust.</span>
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {VALUES.map((v) => (
              <div key={v.title} className="rounded-3xl bg-white p-7 border border-navy-900/5 shadow-soft hover:shadow-lift transition-shadow">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/15 text-brand-700">
                  <v.Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-navy-900">{v.title}</h3>
                <p className="mt-2 text-sm text-ink-muted leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </article>
  );
}
