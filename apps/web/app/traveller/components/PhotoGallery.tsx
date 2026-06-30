"use client";
import React from "react";
import ListingImage from "./ListingImage";
import type { ListingPhoto } from "@/types";

interface PhotoGalleryProps {
  listingId?: string;
  name?: string;
  imageUrl?: string | null;
  photos?: ListingPhoto[];
  onPhotoClick?: (index: number) => void;
  onShowAll?: () => void;
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  listingId, name = "", imageUrl, photos = [], onPhotoClick, onShowAll,
}) => {
  const sorted = [...photos].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const primary = imageUrl || sorted[0]?.cdnUrl;
  const side = sorted.slice(1, 5);
  const slots = [0, 1, 2, 3].map((i) => side[i] ?? null);

  function SidePhoto({ photo, globalIndex }: { photo?: ListingPhoto | null; globalIndex: number }) {
    if (photo?.cdnUrl) {
      return (
        <img
          src={photo.cdnUrl}
          alt={`${name} photo ${globalIndex + 1}`}
          className="w-full h-full object-cover transition duration-300 hover:brightness-90 cursor-pointer"
          onClick={() => onPhotoClick?.(globalIndex)}
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      );
    }
    return (
      <div className="w-full h-full bg-slate-100 flex items-center justify-center">
        <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 h-[420px] md:h-[520px] rounded-2xl overflow-hidden relative group">
      {/* Primary photo — left half, full height */}
      <div
        className="md:col-span-2 h-full overflow-hidden bg-slate-100 cursor-pointer"
        onClick={() => onPhotoClick?.(0)}
      >
        <ListingImage
          listingId={!primary ? listingId : undefined}
          src={primary ?? undefined}
          alt={name}
          className="w-full h-full object-cover transition duration-300 hover:brightness-90"
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
            <SidePhoto photo={photo} globalIndex={i + 1} />
          </div>
        ))}
      </div>

      {/* Side column 2 — slots 2 & 3 */}
      <div className="hidden md:grid md:col-span-1 grid-rows-2 gap-2 h-full">
        {[slots[2], slots[3]].map((photo, i) => (
          <div key={i} className="overflow-hidden bg-slate-100 relative">
            <SidePhoto photo={photo} globalIndex={i + 3} />
          </div>
        ))}
      </div>

      {/* "Show all photos" button */}
      <button
        onClick={onShowAll ?? (() => onPhotoClick?.(0))}
        className="absolute bottom-4 right-4 flex items-center gap-2 bg-white/95 backdrop-blur-sm text-slate-800 text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg hover:bg-white transition border border-slate-100"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
        Show all photos
      </button>
    </div>
  );
};

export default PhotoGallery;
