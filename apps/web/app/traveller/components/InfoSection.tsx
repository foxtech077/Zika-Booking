"use client";
import React from 'react';

interface InfoSectionProps {
  listing: any; // replace with your Listing type if available
}

const InfoSection: React.FC<InfoSectionProps> = ({ listing }) => {
  return (
    <div className="lg:col-span-12 space-y-4">
      {/* Header Section */}
      <h1 className="text-4xl font-serif font-bold text-slate-900 leading-tight">
        {listing.name}
      </h1>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
          <span className="flex items-center gap-1">
            <span className="text-[#0B1E3F]">⭐</span> {listing.starRating || '4.8'} · {listing.reviewsCount || 124} reviews
          </span>
          <span className="text-slate-400">•</span>
          <span className="underline cursor-pointer hover:text-slate-900">
            {listing.address}, {listing.town}, {listing.country}
          </span>
        </div>
      </div>

      {/* Highlights */}
      <div className="space-y-6 pb-6 border-b border-slate-200">
        <div className="flex gap-4">
          <svg className="w-6 h-6 text-slate-800 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <div>
            <h3 className="font-semibold text-slate-900">
              {listing.category === 'car' ? 'Premium Fleet' : 'Elena is a Superhost'}
            </h3>
            <p className="text-slate-500 text-sm mt-0.5">
              {listing.category === 'car'
                ? 'Top-rated vehicles with excellent condition.'
                : 'Superhosts are experienced, highly-rated hosts who are committed to providing great stays for guests.'}
            </p>
          </div>
        </div>
        {/* Add more highlight items similarly if needed */}
      </div>

      {/* Description */}
      <div className="pb-6 border-b border-slate-200 space-y-4">
        <p className="text-slate-600 leading-relaxed">{listing.description}</p>
        <p className="text-slate-600 leading-relaxed">
          The {listing.category === 'car' ? 'vehicle' : 'villa'} features locally sourced materials, custom-made finishes by artisans, and a curated collection of contemporary design. It's designed for those who seek silence, space, and a deep connection with the landscape.
        </p>
        <button className="font-semibold underline flex items-center gap-1 hover:text-slate-500 transition">
          Show more
          <svg className="w-4 h-4 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Amenities */}
      <div className="pb-6 border-b border-slate-200">
        <h2 className="text-2xl font-semibold mb-6">What this place offers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
          {listing.category === 'car' ? (
            <>
              <div className="flex items-center gap-4 text-slate-700 pb-2">
                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <span>GPS Navigation</span>
              </div>
              <div className="flex items-center gap-4 text-slate-700 pb-2">
                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Bluetooth & Apple CarPlay</span>
              </div>
              <div className="flex items-center gap-4 text-slate-700 pb-2">
                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                </svg>
                <span>Heated Leather Seats</span>
              </div>
              <div className="flex items-center gap-4 text-slate-700 pb-2">
                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Comprehensive Insurance</span>
              </div>
              <div className="flex items-center gap-4 text-slate-700 pb-2">
                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                <span>Unlimited Mileage</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-4 text-slate-700 pb-2">
                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                </svg>
                <span>Infinity private pool</span>
              </div>
              {/* Add more villa amenities here if needed */}
            </>
          )}
        </div>
      </div>

      {/* Calendar Placeholder */}
      <div className="pb-6 border-b border-slate-200">
        <h2 className="text-2xl font-semibold mb-2">
          {listing.category === 'car' ? `2 days in ${listing.town}` : `7 nights in ${listing.town}`}
        </h2>
        <p className="text-sm text-slate-500 mb-6">Oct 12, 2026 - Oct 19, 2026</p>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 flex items-center justify-center min-h-[200px] text-slate-400 font-mono text-sm tracking-widest uppercase relative">
          <div className="absolute top-4 left-6 text-xs text-slate-400">CALENDAR UI VISUAL REPRESENTATION</div>
          Calendar UI goes here
        </div>
      </div>

      {/* Reviews Section */}
      <div className="pb-6 border-b border-slate-200">
        <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
          <span className="text-slate-900">⭐</span> 4.98 · 124 reviews
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Sample static review – you can map over real reviews if available */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80" alt="Reviewer" className="w-12 h-12 rounded-full object-cover" />
              <div>
                <h4 className="font-semibold text-slate-900">Melissa</h4>
                <p className="text-xs text-slate-500">London, United Kingdom · October 2025</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Absolute perfection. The views are even better than the photos. Elena was an incredible host, arranging a private chef for our anniversary dinner on the terrace. The minimalist design of the villa creates such a calming atmosphere. Will definitely be returning.
            </p>
          </div>
          {/* Add second review */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&q=80" alt="Reviewer" className="w-12 h-12 rounded-full object-cover" />
              <div>
                <h4 className="font-semibold text-slate-900">Sarah</h4>
                <p className="text-xs text-slate-500">New York, USA · September 2025</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              A truly transformative stay. Every detail in the villa has been thoughtfully considered. The internet was fast enough for my video calls, allowing me to work while staring at the caldera. Pure bliss.
            </p>
          </div>
        </div>
        <button className="mt-8 font-semibold border border-slate-900 rounded-lg px-6 py-3 hover:bg-slate-50 transition">
          Show all 124 reviews
        </button>
      </div>

      {/* Map / Location Section */}
      <div className="pb-6">
        <h2 className="text-2xl font-semibold mb-4">Where you'll be</h2>
        <p className="text-slate-600 mb-6">
          {listing.town}, {listing.country}
        </p>
        <div className="w-full h-[400px] bg-[#e5e3df] rounded-2xl relative overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=%2710%27 height=%2710%27 viewBox=%270 0 20 20%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cg fill=%27000000%27 fill-opacity=%270.2%27 fill-rule=%27evenodd%27%3E%3Cpath d=%27M0 0h1v20H0zM0 0h20v1H0z%27/%3E%3C/g%3E%3C/svg%3E")' }} />
          <div className="relative z-10 flex flex-col items-center">
            <div className="bg-transparent text-slate-900 p-3 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <div className="mt-1 text-sm font-bold text-slate-900">{listing.name}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfoSection;
