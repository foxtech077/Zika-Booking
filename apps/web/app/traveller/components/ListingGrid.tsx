// Example: components/Header.tsx
"use client";

import { useState, useEffect } from "react";
// … rest of the component

import React from 'react';
import ListingCard from './ListingCard';
import type { PublicListingDetail } from '@/types';

interface ListingGridProps {
  listings: PublicListingDetail[];
  onSelect: (id: string) => void;
}

const ListingGrid: React.FC<ListingGridProps> = ({ listings, onSelect }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} onSelect={onSelect} />
      ))}
    </div>
  );
};
export default ListingGrid;

