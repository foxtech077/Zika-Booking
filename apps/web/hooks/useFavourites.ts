"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { listingApi } from "@/lib/listing-api";
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

  async function fetchFavourites() {
    setLoading(true);
    try {
      const res = await listingApi.get<any>("/guests/me/favourites");
      if (res.data.success) {
        const raw = res.data.data ?? [];
        const favourites: any[] = Array.isArray(raw) ? raw : (raw?.favourites ?? []);
        console.log("[Favourites] Raw response:", raw);
        console.log("[Favourites] Parsed favourites:", favourites);
        const favouriteIdsList = favourites
          .map((item: any) => (item.listingId ?? item.id) as string)
          .filter(Boolean);
        console.log("[Favourites] Favourite IDs:", favouriteIdsList);
        const ids = new Set<string>(favouriteIdsList);
        setFavouriteIds(ids);
        console.log("[Favourites] Fetched | Count:", ids.size);
      }
    } catch (err: any) {
      console.error(
        "[Favourites] Fetch failed:",
        err?.response?.data?.error?.message ?? err?.message
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchFavourites();
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
      if (!isAuthenticated) {
        console.log("[Favourites] Auth required | Listing ID:", listingId);
        return "auth_required";
      }

      const wasFavourited = favouriteIds.has(listingId);
      const newCount = wasFavourited
        ? favouriteIds.size - 1
        : favouriteIds.size + 1;

      // Optimistic update
      setFavouriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavourited) next.delete(listingId);
        else next.add(listingId);
        return next;
      });

      try {
        if (wasFavourited) {
          await listingApi.delete(`/guests/me/favourites/${listingId}`);
          console.log(
            "[Favourites] Listing ID:", listingId,
            "| Action: remove | API status: success | Current favourites count:", newCount
          );
        } else {
          console.log("[Favourites] Saving:", listingId);
          const saveRes = await listingApi.post("/guests/me/favourites", { listingId });
          console.log("[Favourites] Save response:", saveRes.data);
          console.log(
            "[Favourites] Listing ID:", listingId,
            "| Action: add | API status: success | Current favourites count:", newCount
          );
        }
        return "ok";
      } catch (err: any) {
        const errMsg =
          err?.response?.data?.error?.message ?? err?.message ?? "Unknown error";
        console.error(
          "[Favourites] Listing ID:", listingId,
          "| Action:", wasFavourited ? "remove" : "add",
          "| API status: failed |", errMsg
        );

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
