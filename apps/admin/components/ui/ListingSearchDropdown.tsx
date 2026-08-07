"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, MapPin, Loader2, Building2, Hash, X } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { cn } from "@/lib/utils";
import type { Listing } from "@/types/admin";

export interface SelectedListing {
  id: string;
  name: string;
}

interface ListingSearchDropdownProps {
  country: string;
  listingType: string;
  value: SelectedListing | null;
  onChange: (listing: SelectedListing | null) => void;
  error?: string;
  disabled?: boolean;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function ListingSearchDropdown({
  country,
  listingType,
  value,
  onChange,
  error,
  disabled,
}: ListingSearchDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(searchTerm, 300);

  const isMissingPrereqs = !country || !listingType;
  const isDisabled = disabled || isMissingPrereqs;

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const BOOKABLE_STATUSES = new Set(["approved", "active"]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-listing-search", debouncedSearch, country, listingType],
    queryFn: async () => {
      if (!country || !listingType) return [];
      const params = new URLSearchParams({
        q: debouncedSearch,
        category: listingType,
        country: country,
        limit: "50",
      });
      const res = await listingApi.get(`/admin/listings?${params.toString()}`);
      const all = (res.data?.data?.listings ?? res.data?.listings ?? []) as Listing[];
      // Filter client-side: only show bookable listings (approved + active)
      // This matches search.ts and provider.ts convention
      return all.filter((l: any) => BOOKABLE_STATUSES.has(l.status));
    },
    enabled: isOpen && !isMissingPrereqs,
  });

  const handleSelect = (listing: Listing) => {
    onChange({ id: listing.id, name: listing.name ?? "Unnamed Listing" });
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setSearchTerm("");
    setIsOpen(false);
  };

  return (
    <div className="space-y-1 relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-slate-700">
        Listing <span className="text-danger ml-0.5">*</span>
      </label>
      
      <div
        className={cn(
          "relative flex items-center w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors duration-150",
          isDisabled ? "bg-slate-50 cursor-not-allowed border-border" : "cursor-text",
          error ? "border-danger ring-1 ring-danger/25" : "border-border hover:border-slate-400 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25"
        )}
        onClick={() => {
          if (!isDisabled) setIsOpen(true);
        }}
      >
        <Building2 className="h-4 w-4 text-slate-400 flex-shrink-0 mr-2" />
        
        {value ? (
          <div className="flex flex-1 items-center justify-between min-w-0">
            <span className="truncate font-medium text-slate-900">{value.name}</span>
            <button
              type="button"
              onClick={handleClear}
              className="ml-2 p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <input
            type="text"
            className="flex-1 min-w-0 outline-none bg-transparent placeholder:text-slate-400 disabled:cursor-not-allowed"
            placeholder={isMissingPrereqs ? "Select Country and Listing Type first" : "Search listing name or ID..."}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => {
              if (!isDisabled) setIsOpen(true);
            }}
            disabled={isDisabled}
          />
        )}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      {/* Dropdown Menu */}
      {isOpen && !value && !isMissingPrereqs && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-auto overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-4 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm">Searching...</span>
            </div>
          ) : data && data.length > 0 ? (
            <ul className="py-1">
              {data.map((listing) => (
                <li
                  key={listing.id}
                  onClick={() => handleSelect(listing)}
                  className="px-4 py-2 hover:bg-slate-50 cursor-pointer transition-colors border-b border-border/40 last:border-0"
                >
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {listing.name ?? "Unnamed Listing"}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span className="flex items-center font-mono">
                      <Hash className="h-3 w-3 mr-0.5" />
                      {listing.id}
                    </span>
                    {listing.town && (
                      <span className="flex items-center">
                        <MapPin className="h-3 w-3 mr-0.5" />
                        {listing.town}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-sm text-slate-500">
              No bookable listings found for the selected country and type.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// touch
