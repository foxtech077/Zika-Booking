"use client";
import React from "react";
import { imgUrl } from "@/lib/image-url";

interface PhotoGalleryProps {
  primaryPhotoUrl?: string | null;
  photos?: { id?: string; cdnUrl?: string }[];
  name?: string;
}

function ImgSlot({
  src,
  alt,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  className: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const proxied = imgUrl(src);

  if (!proxied || failed) {
    return (
      <div className={`${className} bg-slate-100 flex items-center justify-center text-slate-300`}>
        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={proxied}
      alt={alt}
      className={`${className} object-cover hover:scale-105 transition duration-500 cursor-pointer`}
      onError={() => setFailed(true)}
    />
  );
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ primaryPhotoUrl, photos = [], name = "" }) => {
  const getPhoto = (index: number) => photos?.[index]?.cdnUrl ?? null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 h-[400px] md:h-[480px] rounded-2xl overflow-hidden relative group">
      {/* Primary photo */}
      <div className="md:col-span-2 h-full overflow-hidden">
        <ImgSlot
          src={primaryPhotoUrl || getPhoto(0)}
          alt={name}
          className="w-full h-full"
        />
      </div>

      {/* Photos 1–2 */}
      <div className="hidden md:grid md:col-span-1 grid-rows-2 gap-2 h-full">
        {[1, 2].map((i) => (
          <div key={i} className="overflow-hidden">
            <ImgSlot src={getPhoto(i)} alt={`${name} ${i + 1}`} className="w-full h-full" />
          </div>
        ))}
      </div>

      {/* Photos 3–4 */}
      <div className="hidden md:grid md:col-span-1 grid-rows-2 gap-2 h-full">
        {[3, 4].map((i) => (
          <div key={i} className="overflow-hidden">
            <ImgSlot src={getPhoto(i)} alt={`${name} ${i + 1}`} className="w-full h-full" />
          </div>
        ))}
      </div>

      {photos.length > 5 && (
        <button className="absolute bottom-4 right-4 bg-white px-4 py-2 rounded-lg border border-slate-900 shadow font-semibold text-sm flex items-center gap-2 hover:bg-slate-50 transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          Show all {photos.length} photos
        </button>
      )}
    </div>
  );
};

export default PhotoGallery;
