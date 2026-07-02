"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { fetchFavourites, addFavourite, removeFavourite } from "@/services/traveller";
import { useAuthStore } from "@/stores/auth";

interface FavouritesHook {
  isFavourited: (listingId: string) => boolean;
  toggleFavourite: (listingId: string) => Promise<"ok" | "auth_required">;
  loading: boolean;
  favouriteIds: Set<string>;
}

export function useFavourites(): FavouritesHook {
  const { isAuthenticated } = useAuthStore();
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  async function loadFavourites() {
    setLoading(true);
    try {
      const res = await fetchFavourites();
      setFavouriteIds(new Set(res.favourites.map((f) => f.listingId)));
    } catch {
      // leave favourites empty — heart icons just show as unfavourited
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated && !fetchedRef.current) {
      fetchedRef.current = true;
      loadFavourites();
    }
    if (!isAuthenticated) {
      fetchedRef.current = false;
      setFavouriteIds(new Set());
    }
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const isFavourited = useCallback(
    (listingId: string) => favouriteIds.has(listingId),
    [favouriteIds]
  );

  const toggleFavourite = useCallback(
    async (listingId: string): Promise<"ok" | "auth_required"> => {
      if (!isAuthenticated) return "auth_required";

      const wasFavourited = favouriteIds.has(listingId);

      // Optimistic update
      setFavouriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavourited) next.delete(listingId);
        else next.add(listingId);
        return next;
      });

      try {
        if (wasFavourited) await removeFavourite(listingId);
        else await addFavourite(listingId);
        return "ok";
      } catch {
        // Rollback optimistic update
        setFavouriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavourited) next.add(listingId);
          else next.delete(listingId);
          return next;
        });
        return "ok";
      }
    },
    [isAuthenticated, favouriteIds]
  );

  return { isFavourited, toggleFavourite, loading, favouriteIds };
}
