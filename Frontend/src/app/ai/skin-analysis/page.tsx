'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { productSummaries } from '@/data/products';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Chip } from '@/components/ui/Chip';

const STEPS = ['Skin type', 'Concerns', 'Routine', 'Your ritual'] as const;

const SKIN_TYPES = [
  { value: 'oily', label: 'Oily' },
  { value: 'dry', label: 'Dry' },
  { value: 'combination', label: 'Combination' },
  { value: 'sensitive', label: 'Sensitive' },
  { value: 'normal', label: 'Normal' },
];

const CONCERNS = [
  { value: 'acne', label: 'Acne & breakouts' },
  { value: 'pigmentation', label: 'Pigmentation' },
  { value: 'tan', label: 'Tan' },
  { value: 'dry-skin', label: 'Dryness' },
  { value: 'dullness', label: 'Dullness' },
  { value: 'aging', label: 'Fine lines' },
  { value: 'hair-fall', label: 'Hair fall' },
  { value: 'dandruff', label: 'Dandruff' },
];

const ROUTINE = [
  { value: 'minimal', label: 'Keep it minimal' },
  { value: 'complete', label: 'A complete ritual' },
  { value: 'targeted', label: 'Targeted treatment' },
];

export default function SkinAnalysisPage() {
  const [step, setStep] = useState(0);
  const [skinType, setSkinType] = useState<string | null>(null);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [routine, setRoutine] = useState<string | null>(null);

  const recommendations = productSummaries
    .filter((p) => concerns.length === 0 || p.concerns.some((c) => concerns.includes(c)))
    .filter((p) => !skinType || p.skinTypes.includes('all') || p.skinTypes.includes(skinType as never))
    .slice(0, routine === 'minimal' ? 2 : routine === 'targeted' ? 3 : 4);

  function next() {
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }
  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  function toggleConcern(value: string) {
    setConcerns((c) => (c.includes(value) ? c.filter((x) => x !== value) : [...c, value]));
  }

  return (
    <section className="container-wide py-10 sm:py-14">
      <div className="max-w-3xl mx-auto">
        <span className="eyebrow">AI ritual builder</span>
        <h1 className="mt-3 text-display-lg text-balance">Find your perfect ritual in 60 seconds.</h1>
        <p className="mt-3 text-ink-muted max-w-xl text-balance">
          A few quick questions and our AI matches you with herbal products tailored to your skin or hair.
        </p>

        <ol className="mt-8 flex items-center gap-2 text-sm">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={cn(
                'flex-1 flex items-center gap-2 rounded-full px-3 py-2 transition-colors',
                i <= step ? 'bg-navy-900 text-cream' : 'bg-cream-200 text-ink-muted',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold',
                  i < step ? 'bg-brand-300 text-navy-900' : i === step ? 'bg-cream text-navy-900' : 'bg-white/40',
                )}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="truncate text-xs sm:text-sm">{label}</span>
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-3xl bg-white border border-navy-900/5 shadow-soft p-6 sm:p-8">
          {step === 0 && (
            <>
              <h2 className="font-display text-2xl text-navy-900">What is your skin type?</h2>
              <p className="text-ink-muted mt-1">Pick the option that feels most like you.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {SKIN_TYPES.map((t) => (
                  <Chip key={t.value} active={skinType === t.value} onClick={() => setSkinType(t.value)}>
                    {t.label}
                  </Chip>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="font-display text-2xl text-navy-900">What are your top concerns?</h2>
              <p className="text-ink-muted mt-1">Choose up to 3 — we’ll prioritise them.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {CONCERNS.map((c) => (
                  <Chip
                    key={c.value}
                    active={concerns.includes(c.value)}
                    onClick={() => toggleConcern(c.value)}
                  >
                    {c.label}
                  </Chip>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-display text-2xl text-navy-900">How much routine do you want?</h2>
              <p className="text-ink-muted mt-1">We’ll keep it as light or thorough as you like.</p>
              <div className="mt-5 grid sm:grid-cols-3 gap-3">
                {ROUTINE.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setRoutine(r.value)}
                    className={cn(
                      'rounded-2xl border p-4 text-left transition-colors',
                      routine === r.value
                        ? 'border-navy-900 bg-cream-200/80'
                        : 'border-navy-900/10 hover:border-navy-900/30',
                    )}
                  >
                    <p className="font-medium text-navy-900">{r.label}</p>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-brand-600" />
                <h2 className="font-display text-2xl text-navy-900">Your personalised ritual</h2>
              </div>
              <p className="text-ink-muted mt-1 text-balance">
                Based on your {skinType ?? 'skin'} skin and concerns
                {concerns.length ? ` (${concerns.length} selected)` : ''}, here are the products we’d start with.
              </p>
              <ul className="mt-6 grid sm:grid-cols-2 gap-3">
                {recommendations.map((p) => (
                  <li key={p.id} className="flex gap-3 rounded-2xl bg-cream-200/60 p-3 border border-navy-900/5">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white">
                      <Image src={p.thumbnail.url} alt={p.thumbnail.alt} fill sizes="80px" className="object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-navy-900 line-clamp-2">{p.name}</p>
                      <p className="text-xs text-ink-muted mt-0.5">{formatPrice(p.price)}</p>
                      <Link
                        href={`/shop/${p.slug}`}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-navy-900 hover:text-brand-700"
                      >
                        View product <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={back}
              disabled={step === 0}
              className="text-sm text-ink-muted hover:text-navy-900 disabled:opacity-50"
            >
              ← Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={next}
                disabled={(step === 0 && !skinType) || (step === 1 && concerns.length === 0) || (step === 2 && !routine)}
                className="inline-flex items-center gap-2 rounded-full bg-navy-900 text-cream px-6 py-2.5 text-sm font-medium hover:bg-navy-800 disabled:opacity-50"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 rounded-full bg-navy-900 text-cream px-6 py-2.5 text-sm font-medium hover:bg-navy-800"
              >
                Browse full shop
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>

        <p className="mt-6 text-xs text-ink-muted text-center">
          We never store your answers without consent. Recommendations are for guidance and not a substitute for medical advice.
        </p>
      </div>
    </section>
  );
}
