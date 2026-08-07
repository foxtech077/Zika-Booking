import React from "react";
import type { PublicListingDetail } from "@/types";
import ListingCard from "./ListingCard";

interface ListingGridProps {
  listings: PublicListingDetail[];
  onSelect: (id: string) => void;
  loading?: boolean;
  hoveredId?: string | null;
  onHover?: (id: string | null) => void;
  columns?: 2 | 3 | 4;
  isFavourited?: (id: string) => boolean;
  onToggleFavourite?: (id: string) => void;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse flex flex-col gap-0 rounded-3xl overflow-hidden border border-slate-100 bg-white shadow-sm">
      <div className="aspect-[4/3] bg-slate-200 w-full" />
      <div className="p-4 space-y-2.5">
        <div className="h-2.5 bg-slate-200 rounded w-1/4" />
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-200 rounded w-1/2" />
        <div className="border-t border-slate-100 pt-2.5 flex justify-between items-center">
          <div className="space-y-1">
            <div className="h-2 bg-slate-200 rounded w-12" />
            <div className="h-5 bg-slate-200 rounded w-24" />
          </div>
          <div className="h-8 bg-slate-200 rounded-lg w-20" />
        </div>
      </div>
    </div>
  );
}

const GRID_CLASS: Record<number, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

const ListingGrid: React.FC<ListingGridProps> = ({
  listings,
  onSelect,
  loading,
  hoveredId,
  onHover,
  columns = 4,
  isFavourited,
  onToggleFavourite,
}) => {
  if (loading) {
    return (
      <div className={`grid ${GRID_CLASS[columns]} gap-6`}>
        {Array.from({ length: columns * 2 }).map((_, n) => (
          <SkeletonCard key={n} />
        ))}
      </div>
    );
  }

  if (!listings || listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center bg-white border border-slate-100 rounded-3xl shadow-sm">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-5">
          <svg className="w-9 h-9 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">No listings found</h3>
        <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
          Try adjusting your filters, changing your dates, or exploring a different location.
        </p>
      </div>
    );
  }

  return (
    <div className={`grid ${GRID_CLASS[columns]} gap-6`}>
      {listings.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          onSelect={onSelect}
          hoveredId={hoveredId}
          onHover={onHover}
          isFavourited={isFavourited ? isFavourited(listing.id) : undefined}
          onToggleFavourite={onToggleFavourite}
        />
      ))}
    </div>
  );
};
export default ListingGrid;
