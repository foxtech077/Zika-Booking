"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchUnreadNotificationCount } from "@/services/traveller";
import { useAuthStore } from "@/stores/auth";

// Shared query key — used by both the header bell badge and the notifications
// page, so marking notifications read anywhere refetches the same cached count
// (no full page reload needed to keep the badge in sync).
export const NOTIFICATION_BADGE_QK = ["traveller-notification-unread-count"] as const;

export function useNotificationBadge() {
  const { isAuthenticated } = useAuthStore();
  return useQuery({
    queryKey: NOTIFICATION_BADGE_QK,
    queryFn: fetchUnreadNotificationCount,
    refetchInterval: 30_000,
    staleTime: 15_000,
    enabled: isAuthenticated,
  });
}
