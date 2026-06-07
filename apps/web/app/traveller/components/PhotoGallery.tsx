"use client";
import React from "react";
import ListingImage from "./ListingImage";

interface PhotoGalleryProps {
  listingId?: string;
  name?: string;
  imageUrl?: string | null;
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ listingId, name = "", imageUrl }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 h-[400px] md:h-[480px] rounded-2xl overflow-hidden relative group">
      {/* Primary photo */}
      <div className="md:col-span-2 h-full overflow-hidden bg-slate-100">
        <ListingImage
          listingId={listingId}
          src={imageUrl || undefined}
          alt={name}
          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition duration-500"
          fallbackNode={
            <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
          }
        />
      </div>

      {/* Since S3 URLs are not accessible and /listings/{id}/public only returns one imageUrl, we show fallback Unsplash images for the rest of the layout to maintain the gallery aesthetic without breaking S3. */}
      <div className="hidden md:grid md:col-span-1 grid-rows-2 gap-2 h-full">
        {[1, 2].map((i) => (
          <div key={i} className="overflow-hidden bg-slate-100">
            <img src={`https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&q=80&sig=${i}`} alt={`${name} ${i}`} className="w-full h-full object-cover hover:scale-105 transition duration-500 cursor-pointer" />
          </div>
        ))}
      </div>
      <div className="hidden md:grid md:col-span-1 grid-rows-2 gap-2 h-full">
        {[3, 4].map((i) => (
          <div key={i} className="overflow-hidden bg-slate-100">
            <img src={`https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&q=80&sig=${i+2}`} alt={`${name} ${i+2}`} className="w-full h-full object-cover hover:scale-105 transition duration-500 cursor-pointer" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default PhotoGallery;
