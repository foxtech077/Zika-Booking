// Example: components/Header.tsx
"use client";

import { useState, useEffect } from "react";
// … rest of the component

import React from 'react';
import { addFavourite, removeFavourite, fetchFavourites } from '@/lib/listing-api';
import { addRecentlyViewed } from '@/lib/listing-api';
import type { PublicListingDetail } from '@/types';

interface ListingCardProps {
  listing: PublicListingDetail;
  onSelect: (id: string) => void;
}

export const ListingCard: React.FC<ListingCardProps> = ({ listing, onSelect }) => {
  const [isFav, setIsFav] = React.useState(false);

  // Check if this listing is in favourites on mount
  React.useEffect(() => {
    fetchFavourites().then(res => {
      const favIds = res.data?.map((fav: any) => fav.listingId) || [];
      setIsFav(favIds.includes(listing.id));
    }).catch(() => {});
  }, [listing.id]);

  const toggleFavourite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (isFav) {
        await removeFavourite(listing.id);
      } else {
        await addFavourite(listing.id);
      }
      setIsFav(!isFav);
    } catch (err) {
      console.error('Favourite error', err);
    }
  };

  const handleSelect = () => {
    addRecentlyViewed(listing.id).catch(() => {});
    onSelect(listing.id);
  };

  return (
    <div
      className="relative rounded-xl overflow-hidden bg-white shadow-sm transition hover:shadow-md cursor-pointer"
      onClick={handleSelect}
    >
      {/* Favourite button */}
      <button
        onClick={toggleFavourite}
        className="absolute top-2 right-2 text-xl"
        aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
      >
        {isFav ? '♥' : '♡'}
      </button>
      <div className="aspect-[4/3] w-full">
        <img
          src={listing.primaryPhotoUrl || listing.photos?.[0]?.cdnUrl}
          alt={listing.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-3 space-y-2">
        <h3 className="font-medium text-slate-900 line-clamp-1">{listing.name}</h3>
        <p className="text-sm text-slate-600 line-clamp-2">{listing.description}</p>
        <div className="flex items-center justify-between text-sm font-medium text-slate-900">
          <span>{listing.pricePerNight} {listing.currency}</span>
          <span>{listing.category === 'car' ? `${listing.seats || 4} seats` : `${listing.maxGuests || 10} guests`}</span>
        </div>
      </div>
    </div>
  );
};
export default ListingCard;
