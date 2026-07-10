'use client';

import Image from 'next/image';
import { BadgeCheck, KeyRound, Phone, ShieldQuestion } from 'lucide-react';
import { AccountShell } from '@/components/account/AccountShell';
import { EditProfileForm } from '@/components/account/EditProfileForm';
import { AddressBook } from '@/components/account/AddressBook';

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.02.15 3.5 2.7.24.02c2.2-2 3.5-5 3.5-8.6" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2a7.2 7.2 0 0 1-6.8-5l-.14.01-3.7 2.8-.05.13A12 12 0 0 0 12 24" />
      <path fill="#FBBC05" d="M5.2 14.4a7.4 7.4 0 0 1-.4-2.4c0-.8.1-1.6.4-2.4l-.01-.16-3.7-2.9-.12.06a12 12 0 0 0 0 10.8l3.9-3" />
      <path fill="#EB4335" d="M12 4.6c2.3 0 3.9 1 4.8 1.9l3.5-3.4C18 1.2 15.2 0 12 0A12 12 0 0 0 1.3 6.6l3.8 3A7.2 7.2 0 0 1 12 4.6" />
    </svg>
  );
}

export default function AccountPage() {
  return (
    <AccountShell title="profile.">
      {(profile) => (
        <div className="space-y-8">
          {/* Identity card */}
          <section className="rounded-3xl bg-white border border-navy-900/8 p-6 sm:p-8">
            <div className="flex items-center gap-5">
              {profile.avatarUrl ? (
                <Image
                  src={profile.avatarUrl}
                  alt=""
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-teal text-white font-display font-bold text-2xl">
                  {profile.fullName.trim().charAt(0).toUpperCase() || 'W'}
                </span>
              )}
              <div className="min-w-0">
                <h2 className="font-display font-bold text-2xl text-brand-forest truncate">
                  {profile.fullName}
                </h2>
                <p className="font-inter text-sm text-ink-muted truncate">
                  {profile.email ?? 'No email added yet'}
                  {profile.email && profile.emailVerified ? (
                    <span className="ml-2 inline-flex items-center gap-1 text-brand-700 font-semibold">
                      <BadgeCheck className="h-3.5 w-3.5" /> verified
                    </span>
                  ) : null}
                </p>
                <p className="font-inter text-sm text-ink-muted">
                  {profile.phone ? `+91 ${profile.phone.replace(/^\+91/, '')}` : 'No phone added yet'}
                </p>
              </div>
            </div>

            {/* Sign-in methods */}
            <div className="mt-5 flex flex-wrap gap-2">
              {profile.phone ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-100 px-3 py-1.5 font-inter text-xs font-semibold text-brand-800">
                  <Phone className="h-3.5 w-3.5" /> Phone OTP
                </span>
              ) : null}
              {profile.hasGoogle ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 font-inter text-xs font-semibold text-navy-900 border border-navy-900/10">
                  <GoogleG /> Google linked
                </span>
              ) : null}
              {profile.hasPassword ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 font-inter text-xs font-semibold text-navy-900 border border-navy-900/10">
                  <KeyRound className="h-3.5 w-3.5" /> Password set
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 font-inter text-xs font-semibold text-ink-muted border border-navy-900/10">
                  <ShieldQuestion className="h-3.5 w-3.5" /> No password, signs in with OTP{profile.hasGoogle ? ' / Google' : ''}
                </span>
              )}
            </div>
          </section>

          {/* Details */}
          <section className="rounded-3xl bg-white border border-navy-900/8 p-6 sm:p-8">
            <h3 className="font-display font-semibold text-lg text-brand-forest mb-5">Your details</h3>
            <EditProfileForm profile={profile} />
          </section>

          {/* Addresses */}
          <section className="rounded-3xl bg-white border border-navy-900/8 p-6 sm:p-8">
            <h3 className="font-display font-semibold text-lg text-brand-forest mb-5">Saved addresses</h3>
            <AddressBook addresses={profile.addresses} />
          </section>
        </div>
      )}
    </AccountShell>
  );
}
