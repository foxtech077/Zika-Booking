
import React from 'react';

interface PhotoGalleryProps {
  primaryPhotoUrl?: string;
  photos?: { cdnUrl?: string }[];
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ primaryPhotoUrl, photos }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 h-[400px] md:h-[480px] rounded-2xl overflow-hidden relative group">
      <div className="md:col-span-2 h-full">
        <img
          src={primaryPhotoUrl || 'https://images.unsplash.com/photo-1543968332-f99478b1ebdc?w=1000&q=80'}
          alt="detail"
          className="w-full h-full object-cover hover:scale-105 transition duration-500 cursor-pointer"
        />
      </div>
      <div className="hidden md:grid md:col-span-1 grid-rows-2 gap-2 h-full">
        <img
          src={photos?.[1]?.cdnUrl || 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=600&q=80'}
          alt="view"
          className="w-full h-full object-cover hover:scale-105 transition duration-500 cursor-pointer"
        />
        <img
          src={photos?.[2]?.cdnUrl || 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&q=80'}
          alt="kitchen"
          className="w-full h-full object-cover hover:scale-105 transition duration-500 cursor-pointer"
        />
      </div>
      <div className="hidden md:grid md:col-span-1 grid-rows-2 gap-2 h-full">
        <img
          src={photos?.[3]?.cdnUrl || 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&q=80'}
          alt="bedroom"
          className="w-full h-full object-cover hover:scale-105 transition duration-500 cursor-pointer"
        />
        <img
          src={photos?.[4]?.cdnUrl || 'https://images.unsplash.com/photo-1502672260266-1c1e52509def?w=600&q=80'}
          alt="patio"
          className="w-full h-full object-cover hover:scale-105 transition duration-500 cursor-pointer"
        />
      </div>
      <button className="absolute bottom-4 right-4 bg-white px-4 py-2 rounded-lg border border-slate-900 shadow font-semibold text-sm flex items-center gap-2 hover:bg-slate-50 transition">
        Show all photos
      </button>
    </div>
  );
};

export default PhotoGallery;
