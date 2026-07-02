import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listingApi } from "../lib/listing-api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, string>;
}

export interface NotifUnreadCount { count: number; }

// The backend returns { unreadCount } (see GET /notifications/unread-count),
// not { count } — this maps the real field to the shape the rest of the app uses.
interface RawNotifUnreadCount { unreadCount: number; }

// ── Query keys ────────────────────────────────────────────────────────────────

export const NOTIF_QK = {
  all:         ["notifications"] as const,
  unreadCount: ["notifications", "unread-count"] as const,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useNotifications() {
  return useQuery<AppNotification[]>({
    queryKey: NOTIF_QK.all,
    queryFn: async () => {
      const res = await listingApi.get<{ data: any }>("/notifications");
      const raw = res.data?.data;
      // Handle both flat array and paginated/wrapped object responses
      if (Array.isArray(raw)) return raw as AppNotification[];
      if (Array.isArray(raw?.notifications)) return raw.notifications as AppNotification[];
      if (Array.isArray(raw?.items))         return raw.items as AppNotification[];
      if (Array.isArray(raw?.data))          return raw.data as AppNotification[];
      return [];
    },
    staleTime: 30_000,
  });
}

export function useUnreadNotificationCount() {
  return useQuery<NotifUnreadCount>({
    queryKey: NOTIF_QK.unreadCount,
    queryFn: async () => {
      const res = await listingApi.get<{ data: RawNotifUnreadCount }>("/notifications/unread-count");
      return { count: res.data.data.unreadCount };
    },
    staleTime:       60_000,
    refetchInterval: 60_000,
    retry: false,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await listingApi.patch(`/notifications/${id}/read`);
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: NOTIF_QK.all });
      const prev = qc.getQueryData<AppNotification[]>(NOTIF_QK.all);
      qc.setQueryData<AppNotification[]>(NOTIF_QK.all, (old) =>
        (old ?? []).map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(NOTIF_QK.all, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: NOTIF_QK.all });
      void qc.invalidateQueries({ queryKey: NOTIF_QK.unreadCount });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await listingApi.patch("/notifications/read-all");
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: NOTIF_QK.all });
      const prev = qc.getQueryData<AppNotification[]>(NOTIF_QK.all);
      qc.setQueryData<AppNotification[]>(NOTIF_QK.all, (old) =>
        (old ?? []).map((n) => ({ ...n, isRead: true }))
      );
      qc.setQueryData<NotifUnreadCount>(NOTIF_QK.unreadCount, { count: 0 });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(NOTIF_QK.all, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: NOTIF_QK.all });
      void qc.invalidateQueries({ queryKey: NOTIF_QK.unreadCount });
    },
  });
}

// Device registration hooks — ready for use once expo-notifications is installed.
// Call useRegisterDevice().mutate({ token, platform }) after login.
// Call useUnregisterDevice().mutate() on logout.

export function useRegisterDevice() {
  return useMutation({
    mutationFn: async ({ token, platform }: { token: string; platform: "ios" | "android" }) => {
      await listingApi.post("/notifications/register-device", { token, platform });
    },
  });
}

export function useUnregisterDevice() {
  return useMutation({
    mutationFn: async () => {
      await listingApi.delete("/notifications/register-device");
    },
  });
}
