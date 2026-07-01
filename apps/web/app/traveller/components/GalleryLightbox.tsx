"use client";
import React, { useEffect, useRef, useState } from "react";
import type { ListingPhoto } from "@/types";

interface GalleryLightboxProps {
  photos: ListingPhoto[];
  initialIndex?: number;
  name?: string;
  onClose: () => void;
}

export default function GalleryLightbox({ photos, initialIndex = 0, name = "", onClose }: GalleryLightboxProps) {
  const [current, setCurrent] = useState(Math.min(initialIndex, Math.max(photos.length - 1, 0)));
  const touchStartX = useRef<number | null>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  const sorted = [...photos].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const total = sorted.length;

  function prev() { setCurrent((c) => (c - 1 + total) % total); }
  function next() { setCurrent((c) => (c + 1) % total); }
  function goTo(i: number) { setCurrent(i); }

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [total]);

  // Scroll active thumbnail into view
  useEffect(() => {
    const strip = thumbRef.current;
    if (!strip) return;
    const thumb = strip.children[current] as HTMLElement | undefined;
    if (thumb) thumb.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [current]);

  if (total === 0) return null;
  const photo = sorted[current];

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0">
        <p className="text-white/70 text-sm font-semibold tracking-wide">
          {name && <span className="text-white mr-2">{name}</span>}
          Photo {current + 1} of {total}
        </p>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition"
          aria-label="Close gallery"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Main image area */}
      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden px-14"
        onTouchStart={(e) => {
          const t = e.touches.item(0);
          if (t) touchStartX.current = t.clientX;
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return;
          const t = e.changedTouches.item(0);
          const diff = touchStartX.current - (t ? t.clientX : touchStartX.current);
          if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
          touchStartX.current = null;
        }}
      >
        {total > 1 && (
          <button
            onClick={prev}
            className="absolute left-3 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition shrink-0"
            aria-label="Previous photo"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {photo?.cdnUrl && (
          <img
            key={current}
            src={photo.cdnUrl}
            alt={`${name} — photo ${current + 1}`}
            className="max-h-full max-w-full object-contain rounded-lg"
            draggable={false}
          />
        )}

        {total > 1 && (
          <button
            onClick={next}
            className="absolute right-3 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition shrink-0"
            aria-label="Next photo"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      {total > 1 && (
        <div className="shrink-0 py-3 px-4 overflow-x-auto scrollbar-hide" ref={thumbRef}>
          <div className="flex gap-2 w-max mx-auto">
            {sorted.map((p, i) => (
              <button
                key={p.id ?? i}
                onClick={() => goTo(i)}
                className={`w-16 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all duration-200 ${
                  i === current
                    ? "border-white opacity-100 scale-105"
                    : "border-transparent opacity-45 hover:opacity-75"
                }`}
                aria-label={`View photo ${i + 1}`}
              >
                <img src={p.cdnUrl} alt="" className="w-full h-full object-cover" draggable={false} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
