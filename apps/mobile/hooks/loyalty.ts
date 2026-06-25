import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { listingApi } from "../lib/listing-api";
import type { LoyaltyProfile, PointsHistoryResponse } from "../lib/types/loyalty";
import type { ApiResponse } from "@zika/types";

export const LOYALTY_QK = {
  profile: ["loyalty", "profile"] as const,
  history: (cursor?: string) => ["loyalty", "history", cursor ?? ""] as const,
  historyInfinite: ["loyalty", "history-infinite"] as const,
};

type MeResponse = {
  user: { currentTier: string; loyaltyPoints: number };
  nextTier: string | null;
  pointsToNextTier: number | null;
};

export function useLoyaltyProfile() {
  return useQuery<LoyaltyProfile>({
    queryKey: LOYALTY_QK.profile,
    queryFn: async () => {
      const res = await api.get<ApiResponse<MeResponse>>("/auth/me");
      if (!res.data.success) throw res.data;
      const { user, nextTier, pointsToNextTier } = (res.data as { success: true; data: MeResponse }).data;
      return {
        currentTier: user.currentTier as LoyaltyProfile["currentTier"],
        loyaltyPoints: user.loyaltyPoints,
        nextTier: (nextTier ?? null) as LoyaltyProfile["nextTier"],
        pointsToNextTier: pointsToNextTier ?? null,
        tierBenefits: [],
      };
    },
    staleTime: 60_000,
  });
}

export function usePointsHistoryInfinite() {
  return useInfiniteQuery<PointsHistoryResponse>({
    queryKey: LOYALTY_QK.historyInfinite,
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam as string | undefined;
      const url = cursor
        ? `/guests/me/points-history?cursor=${encodeURIComponent(cursor)}&limit=20`
        : "/guests/me/points-history?limit=20";
      const res = await listingApi.get<ApiResponse<PointsHistoryResponse>>(url);
      if (!res.data.success) throw res.data;
      return (res.data as { success: true; data: PointsHistoryResponse }).data;
    },
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}
