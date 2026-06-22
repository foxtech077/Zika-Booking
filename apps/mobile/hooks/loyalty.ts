import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { LoyaltyProfile, PointsHistoryResponse } from "../lib/types/loyalty";
import type { ApiResponse } from "@zika/types";

export const LOYALTY_QK = {
  profile: ["loyalty", "profile"] as const,
  history: (cursor?: string) => ["loyalty", "history", cursor ?? ""] as const,
  historyInfinite: ["loyalty", "history-infinite"] as const,
};

export function useLoyaltyProfile() {
  return useQuery<LoyaltyProfile>({
    queryKey: LOYALTY_QK.profile,
    queryFn: async () => {
      const res = await api.get<ApiResponse<LoyaltyProfile>>("/guests/me/loyalty");
      if (!res.data.success) throw res.data;
      return (res.data as { success: true; data: LoyaltyProfile }).data;
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
      const res = await api.get<ApiResponse<PointsHistoryResponse>>(url);
      if (!res.data.success) throw res.data;
      return (res.data as { success: true; data: PointsHistoryResponse }).data;
    },
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}
