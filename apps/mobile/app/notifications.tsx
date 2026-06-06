import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { K } from "../constants/theme";
import { useAuthStore } from "../store/auth";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, string>;
}

const NOTIF_ICON: Record<string, string> = {
  booking_confirmed: "✅",
  booking_cancelled: "❌",
  new_booking: "🎉",
  payment_received: "💰",
  review_received: "⭐",
  listing_approved: "🏠",
  system: "📢",
};

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(ms / 86_400_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short" });
}

function NotifRow({ item, onPress }: { item: Notification; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.notifRow, !item.isRead && styles.notifRowUnread]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {!item.isRead && <View style={styles.unreadDot} />}
      <View style={styles.notifIcon}>
        <Text style={styles.notifEmoji}>{NOTIF_ICON[item.type] ?? "🔔"}</Text>
      </View>
      <View style={styles.notifContent}>
        <Text style={[styles.notifTitle, !item.isRead && styles.notifTitleBold]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
        <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await api.get<{ data: Notification[] }>("/notifications");
      return res.data.data;
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post("/notifications/mark-all-read", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  function handlePress(item: Notification) {
    if (!item.isRead) markRead.mutate(item.id);
    if (item.data?.bookingId) {
      const isProvider = useAuthStore.getState().user?.userType === "provider";
      const route = isProvider ? `/provider/booking/${item.data.bookingId}` : `/booking/${item.data.bookingId}`;
      router.push(route as any);
    }
    if (item.data?.listingId) router.push(`/listings/${item.data.listingId}` as any);
  }

  const unreadCount = (data ?? []).filter((n) => !n.isRead).length;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          {unreadCount > 0 ? (
            <TouchableOpacity onPress={() => markAllRead.mutate()} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 80 }} />
          )}
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={K.colors.accent} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Could not load notifications</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={K.colors.accent} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🔔</Text>
              <Text style={styles.emptyTitle}>All caught up</Text>
              <Text style={styles.emptySub}>No new notifications</Text>
            </View>
          }
          renderItem={({ item }) => <NotifRow item={item} onPress={() => handlePress(item)} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListFooterComponent={() => <View style={{ height: 32 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgLight },

  header: { backgroundColor: K.colors.darkGreen, paddingBottom: 14 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backBtnText: { fontSize: 28, color: "#fff", fontWeight: "300" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: K.font.xl, fontWeight: "800", color: "#fff" },
  unreadBadge: {
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unreadBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  markAllBtn: { paddingHorizontal: 4, paddingVertical: 6 },
  markAllText: { color: K.colors.accentLight, fontSize: K.font.sm, fontWeight: "600" },

  list: { padding: 16 },

  notifRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.sm,
    position: "relative",
  },
  notifRowUnread: {
    backgroundColor: "#F0FFF8",
    borderColor: "#A7F3D0",
  },
  unreadDot: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: K.colors.accent,
  },
  notifIcon: {
    width: 44,
    height: 44,
    borderRadius: K.radius.md,
    backgroundColor: K.colors.bgLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: K.colors.border,
  },
  notifEmoji: { fontSize: 20 },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: K.font.base, color: K.colors.textDark, marginBottom: 3 },
  notifTitleBold: { fontWeight: "700" },
  notifBody: { fontSize: K.font.sm, color: K.colors.textMuted, lineHeight: 20, marginBottom: 6 },
  notifTime: { fontSize: 11, color: K.colors.textMuted },

  separator: { height: 10 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  errorText: { fontSize: K.font.base, color: K.colors.textMuted },
  retryBtn: {
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.md,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: { color: "#fff", fontWeight: "700" },

  emptyBox: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: K.font.xl, fontWeight: "800", color: K.colors.textDark },
  emptySub: { fontSize: K.font.sm, color: K.colors.textMuted },
});
