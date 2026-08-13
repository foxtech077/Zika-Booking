"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ListingImage from "./ListingImage";
import type { ListingPhoto } from "@/types";

interface PhotoGalleryProps {
  listingId?: string;
  name?: string;
  imageUrl?: string | null;
  photos?: ListingPhoto[];
}

function PlaceholderArt({ size = "w-6 h-6" }: { size?: string }) {
  return (
    <svg className={`${size} text-slate-300`} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}

/** Grid tile that degrades to a placeholder when its own URL fails to load. */
function Tile({ url, alt, onOpen }: { url: string; alt: string; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="w-full h-full bg-slate-100 flex items-center justify-center">
        <PlaceholderArt />
      </div>
    );
  }
  return (
    <button type="button" onClick={onOpen} className="group/tile w-full h-full block overflow-hidden relative" aria-label={alt}>
      <img
        src={url}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover transition-transform duration-[600ms] ease-out group-hover/tile:scale-[1.04]"
      />
      <span className="absolute inset-0 bg-slate-900/0 group-hover/tile:bg-slate-900/10 transition-colors duration-300" />
    </button>
  );
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ listingId, name = "", imageUrl, photos = [] }) => {
  // One ordered list of URLs drives the grid, the mobile carousel and the
  // lightbox, so an index means the same photo in all three.
  const urls = useMemo(() => {
    const list = [...photos]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((p) => p.cdnUrl)
      .filter(Boolean);
    if (imageUrl && !list.includes(imageUrl)) list.unshift(imageUrl);
    return list;
  }, [photos, imageUrl]);

  const total = urls.length;
  /** Indexed read narrowed to string — every call site is already bounded by `total`. */
  const at = useCallback((i: number) => urls[i] ?? "", [urls]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [slide, setSlide] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);

  const step = useCallback(
    (delta: number) => setOpenIdx((i) => (i === null ? i : (i + delta + total) % total)),
    [total],
  );

  // Arrow keys and Escape while the lightbox is open, plus a scroll lock so the
  // page behind it doesn't move under the overlay.
  useEffect(() => {
    if (openIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIdx(null);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openIdx, step]);

  // Which slide the mobile carousel is on, derived from scroll position rather
  // than tracked on tap, so native swipe momentum keeps the dots in sync.
  function onTrackScroll() {
    const el = trackRef.current;
    if (!el) return;
    setSlide(Math.round(el.scrollLeft / el.clientWidth));
  }

  function scrollToSlide(i: number) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  if (total === 0) {
    return (
      <div className="h-[300px] md:h-[480px] rounded-2xl overflow-hidden bg-slate-100">
        <ListingImage
          listingId={listingId}
          alt={name}
          className="w-full h-full object-cover"
          fallbackNode={
            <div className="w-full h-full flex items-center justify-center">
              <PlaceholderArt size="w-10 h-10" />
            </div>
          }
        />
      </div>
    );
  }

  // Track counts chosen so the hero's row-span always equals the number of
  // tiles beside it — otherwise the last cell of the side column sits empty,
  // which is what left a hole at four photos (3 tiles in a 2×2 side grid).
  const layout =
    total === 1 ? { grid: "grid-cols-1 grid-rows-1", hero: "col-span-1 row-span-1", count: 0 }
      : total === 2 ? { grid: "grid-cols-2 grid-rows-1", hero: "col-span-1 row-span-1", count: 1 }
        : total === 3 ? { grid: "grid-cols-3 grid-rows-2", hero: "col-span-2 row-span-2", count: 2 }
          : total === 4 ? { grid: "grid-cols-3 grid-rows-3", hero: "col-span-2 row-span-3", count: 3 }
            : { grid: "grid-cols-4 grid-rows-2", hero: "col-span-2 row-span-2", count: 4 };
  const tiles = urls.slice(1, layout.count + 1);
  const hiddenCount = total - 1 - tiles.length;

  return (
    <>
      {/* ── Mobile: swipeable carousel ───────────────────────────────────── */}
      <div className="md:hidden relative rounded-2xl overflow-hidden">
        <div
          ref={trackRef}
          onScroll={onTrackScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth h-[300px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {urls.map((url, i) => (
            <div key={i} className="snap-center shrink-0 w-full h-full bg-slate-100">
              <Tile url={url} alt={`${name} photo ${i + 1}`} onOpen={() => setOpenIdx(i)} />
            </div>
          ))}
        </div>

        {total > 1 && (
          <>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {urls.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => scrollToSlide(i)}
                  aria-label={`Go to photo ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === slide ? "w-4 bg-white" : "w-1.5 bg-white/60"}`}
                />
              ))}
            </div>
            <div className="absolute top-3 right-3 bg-black/60 text-white text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
              {slide + 1} / {total}
            </div>
          </>
        )}
      </div>

      {/* ── Desktop: mosaic grid, every tile opens the lightbox ──────────── */}
      <div className={`hidden md:grid ${layout.grid} gap-1.5 h-[420px] lg:h-[520px] rounded-2xl overflow-hidden relative`}>
        <div className={`${layout.hero} overflow-hidden bg-slate-100`}>
          <Tile url={at(0)} alt={`${name} photo 1`} onOpen={() => setOpenIdx(0)} />
        </div>

        {tiles.map((url, i) => (
          <div key={i} className="overflow-hidden bg-slate-100 relative">
            <Tile url={url} alt={`${name} photo ${i + 2}`} onOpen={() => setOpenIdx(i + 1)} />
            {/* Remaining photos are surfaced on the last tile rather than as an
                extra cell, so the mosaic keeps its exact track count. */}
            {hiddenCount > 0 && i === tiles.length - 1 && (
              <button
                type="button"
                onClick={() => setOpenIdx(i + 2)}
                className="absolute inset-0 bg-slate-900/45 hover:bg-slate-900/55 text-white text-lg font-semibold tracking-tight transition"
              >
                +{hiddenCount}
              </button>
            )}
          </div>
        ))}

        {total > 1 && (
          <button
            type="button"
            onClick={() => setOpenIdx(0)}
            className="absolute bottom-4 right-4 bg-white/95 hover:bg-white text-slate-900 text-[13px] font-semibold px-4 py-2.5 rounded-xl shadow-[0_2px_12px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/5 flex items-center gap-2 transition hover:shadow-[0_4px_18px_rgba(15,23,42,0.24)]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h6v6H4V6zm10 0h6v6h-6V6zM4 16h6v4H4v-4zm10 0h6v4h-6v-4z" />
            </svg>
            Show all {total} photos
          </button>
        )}
      </div>

      {/* ── Lightbox ─────────────────────────────────────────────────────── */}
      {openIdx !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${name} photos`}
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
          onClick={() => setOpenIdx(null)}
        >
          <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
            <span className="text-sm font-semibold tabular-nums">{openIdx + 1} / {total}</span>
            <button
              type="button"
              onClick={() => setOpenIdx(null)}
              aria-label="Close photo viewer"
              className="p-2 rounded-full hover:bg-white/10 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div
            className="flex-1 min-h-0 flex items-center justify-center px-2 pb-4 relative"
            // Stop the backdrop handler from firing when interacting with the
            // image itself — only the surrounding black area closes the viewer.
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => { touchStartX.current = e.touches[0]?.clientX ?? null; }}
            onTouchEnd={(e) => {
              const endX = e.changedTouches[0]?.clientX;
              const startX = touchStartX.current;
              touchStartX.current = null;
              if (startX === null || endX === undefined) return;
              const dx = endX - startX;
              if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
            }}
          >
            {total > 1 && (
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous photo"
                className="absolute left-2 md:left-6 z-10 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
              >
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            <img
              src={at(openIdx)}
              alt={`${name} photo ${openIdx + 1}`}
              className="max-h-full max-w-full object-contain select-none"
            />

            {total > 1 && (
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next photo"
                className="absolute right-2 md:right-6 z-10 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
              >
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>

          {total > 1 && (
            <div
              className="shrink-0 flex gap-2 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {urls.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setOpenIdx(i)}
                  aria-label={`View photo ${i + 1}`}
                  className={`shrink-0 w-16 h-12 rounded-md overflow-hidden border-2 transition ${i === openIdx ? "border-white" : "border-transparent opacity-60 hover:opacity-100"}`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default PhotoGallery;
