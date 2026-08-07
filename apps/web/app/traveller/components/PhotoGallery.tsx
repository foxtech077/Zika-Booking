"use client";
import React from "react";
import ListingImage from "./ListingImage";
import type { ListingPhoto } from "@/types";

interface PhotoGalleryProps {
  listingId?: string;
  name?: string;
  imageUrl?: string | null;
  photos?: ListingPhoto[];
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ listingId, name = "", imageUrl, photos = [] }) => {
  // Build ordered photo list: primary first, then remaining sorted by position
  const sorted = [...photos].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const primary = imageUrl || sorted[0]?.cdnUrl;
  // Side slots: positions 1-4 from photos array (skip index 0 which is primary)
  const side = sorted.slice(1, 5);

  function SlotImage({ photo, index }: { photo?: ListingPhoto; index: number }) {
    if (photo?.cdnUrl) {
      return (
        <img
          src={photo.cdnUrl}
          alt={`${name} photo ${index + 2}`}
          className="w-full h-full object-cover hover:scale-105 transition duration-500 cursor-pointer"
          onError={(e) => {
            const target = e.currentTarget;
            target.style.display = "none";
            const parent = target.parentElement;
            if (parent) {
              const fb = parent.querySelector(".photo-fallback") as HTMLElement | null;
              if (fb) fb.style.display = "flex";
            }
          }}
        />
      );
    }
    return null;
  }

  function PlaceholderSlot() {
    return (
      <div className="w-full h-full bg-slate-100 flex items-center justify-center">
        <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      </div>
    );
  }

  const slots = [0, 1, 2, 3].map((i) => side[i] ?? null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 h-[400px] md:h-[480px] rounded-2xl overflow-hidden relative group">
      {/* Primary photo — full height left half */}
      <div className="md:col-span-2 h-full overflow-hidden bg-slate-100">
        <ListingImage
          listingId={!primary ? listingId : undefined}
          src={primary ?? undefined}
          alt={name}
          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition duration-500"
          fallbackNode={
            <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
          }
        />
      </div>

      {/* Side column 1 — slots 0 & 1 */}
      <div className="hidden md:grid md:col-span-1 grid-rows-2 gap-2 h-full">
        {[slots[0], slots[1]].map((photo, i) => (
          <div key={i} className="overflow-hidden bg-slate-100 relative">
            {photo ? <SlotImage photo={photo} index={i} /> : <PlaceholderSlot />}
            <div className="photo-fallback hidden absolute inset-0 items-center justify-center bg-slate-100">
              <PlaceholderSlot />
            </div>
          </div>
        ))}
      </div>

      {/* Side column 2 — slots 2 & 3 */}
      <div className="hidden md:grid md:col-span-1 grid-rows-2 gap-2 h-full">
        {[slots[2], slots[3]].map((photo, i) => (
          <div key={i} className="overflow-hidden bg-slate-100 relative">
            {photo ? <SlotImage photo={photo} index={i + 2} /> : <PlaceholderSlot />}
            <div className="photo-fallback hidden absolute inset-0 items-center justify-center bg-slate-100">
              <PlaceholderSlot />
            </div>
          </div>
        ))}
      </div>

      {/* Photo count badge */}
      {photos.length > 1 && (
        <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
          {photos.length} photos
        </div>
      )}
    </div>
  );
};

export default PhotoGallery;
