import { useState, useRef, useEffect, useMemo, useCallback, memo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Animated,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type AppNotification,
} from "../hooks/notifications";
import { K } from "../constants/theme";
import { useReadableWidth } from "../lib/responsive";

// ── Category helpers ──────────────────────────────────────────────────────────

type Category = "booking" | "message" | "promotion" | "payment" | "reminder" | "loyalty" | "system";

function getCategory(type: string): Category {
  const t = type.toLowerCase();
  if (t.includes("booking") || t === "new_booking" || t.includes("checkin") || t.includes("checkout") || t === "review_received" || t === "listing_approved") return "booking";
  if (t.includes("message") || t.includes("chat") || t.includes("conversation")) return "message";
  if (t.includes("promotion") || t.includes("promo") || t.includes("sale") || t.includes("offer") || t.includes("deal")) return "promotion";
  if (t.includes("payment") || t.includes("refund") || t === "payment_received") return "payment";
  if (t.includes("reminder") || t.includes("upcoming")) return "reminder";
  if (t.includes("loyalty") || t.includes("reward") || t.includes("point") || t.includes("tier")) return "loyalty";
  return "system";
}

const CATEGORY_CFG: Record<Category, { icon: string; color: string; bg: string }> = {
  booking:   { icon: "calendar-sharp",    color: "#16a34a", bg: "#f0fdf4" },
  message:   { icon: "chatbubble-sharp",  color: "#2563eb", bg: "#eff6ff" },
  promotion: { icon: "flame-sharp",       color: "#ea580c", bg: "#fff7ed" },
  payment:   { icon: "card-sharp",        color: "#7c3aed", bg: "#f5f3ff" },
  reminder:  { icon: "time-sharp",        color: "#0891b2", bg: "#ecfeff" },
  loyalty:   { icon: "trophy-sharp",      color: "#d97706", bg: "#fffbeb" },
  system:    { icon: "information-circle",color: "#64748b", bg: "#f1f5f9" },
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(ms / 86_400_000);
  if (m < 1)  return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d === 1) return "Yesterday";
  if (d < 7)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ── Shimmer skeleton ──────────────────────────────────────────────────────────

function useShimmer() {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4,  duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return opacity;
}

function NotificationSkeleton() {
  const opacity = useShimmer();
  return (
    <View style={s.listContent}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Animated.View key={i} style={[sk.card, { opacity }]}>
          <View style={sk.icon} />
          <View style={sk.body}>
            <View style={sk.line1} />
            <View style={sk.line2} />
            <View style={sk.line3} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

// ── Notification card ─────────────────────────────────────────────────────────

interface CardProps {
  item: AppNotification;
  onPress: (item: AppNotification) => void;
}

const NotificationCard = memo(function NotificationCard({ item, onPress }: CardProps) {
  const cat = getCategory(item.type);
  const cfg = CATEGORY_CFG[cat];

  return (
    <TouchableOpacity
      style={c.card}
      onPress={() => onPress(item)}
      activeOpacity={0.78}
    >
      <View style={c.accentBar} />

      <View style={[c.iconWrap, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon as any} size={22} color={cfg.color} />
      </View>

      <View style={c.content}>
        <View style={c.topRow}>
          <Text style={c.title} numberOfLines={1}>{item.title}</Text>
          <Text style={c.time}>{timeAgo(item.createdAt)}</Text>
        </View>
        <Text style={c.body} numberOfLines={2}>{item.body}</Text>
      </View>

      <View style={c.dot} />
    </TouchableOpacity>
  );
});

// ── Animated dismiss wrapper ──────────────────────────────────────────────────

interface AnimatedCardProps {
  item: AppNotification;
  isDismissing: boolean;
  onAnimationComplete: (id: string) => void;
  onPress: (item: AppNotification) => void;
}

function AnimatedNotificationCard({ item, isDismissing, onAnimationComplete, onPress }: AnimatedCardProps) {
  const opacity    = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isDismissing) return;
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 0,  duration: 280, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -8, duration: 280, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onAnimationComplete(item.id);
    });
  }, [isDismissing]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <NotificationCard item={item} onPress={onPress} />
    </Animated.View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={s.emptyWrap}>
      <View style={s.emptyIcon}>
        <Ionicons name="checkmark-done-outline" size={44} color={K.colors.textMuted} />
      </View>
      <Text style={s.emptyTitle}>You're all caught up!</Text>
      <Text style={s.emptySubtitle}>
        We'll notify you about bookings, messages, promotions and important updates.
      </Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  // Tablet: keep this list at a readable width instead of letting rows
  // stretch edge to edge. No-op on phones.
  const readable = useReadableWidth();

  const { data, isLoading, isError, refetch, isRefetching } = useNotifications();
  const markRead    = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Local read-state overlay — reflects changes instantly without waiting for re-fetch
  const [localReadIds, setLocalReadIds]     = useState<Set<string>>(new Set());
  const [allLocallyRead, setAllLocallyRead] = useState(false);
  // IDs currently playing their fade-out animation
  const [dismissingIds, setDismissingIds]   = useState<Set<string>>(new Set());

  // When background re-fetch resolves, API data is authoritative — clear local overrides
  const prevDataRef = useRef(data);
  useEffect(() => {
    if (data && data !== prevDataRef.current) {
      prevDataRef.current = data;
      setLocalReadIds(new Set());
      setAllLocallyRead(false);
      // Keep dismissingIds so in-flight animations finish
    }
  }, [data]);

  // Merge local read state into API data
  const notifications = useMemo(() => {
    const raw = Array.isArray(data) ? data : [];
    return raw.map((n) => ({
      ...n,
      isRead: allLocallyRead || localReadIds.has(n.id) || n.isRead,
    }));
  }, [data, localReadIds, allLocallyRead]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  // List shows only unread items + those mid-animation (so the fade-out can complete)
  const visible = useMemo(
    () => notifications.filter((n) => !n.isRead || dismissingIds.has(n.id)),
    [notifications, dismissingIds]
  );

  const handleDismissComplete = useCallback((id: string) => {
    setDismissingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handlePress = useCallback((item: AppNotification) => {
    // Always animate out and mark read on tap
    setLocalReadIds((prev) => new Set(prev).add(item.id));
    setDismissingIds((prev) => new Set(prev).add(item.id));
    if (!item.isRead) markRead.mutate(item.id);

    const { bookingId, conversationId, listingId } = item.data ?? {};
    if (bookingId) {
      // Which view to open is a property of the notification, not of the
      // account: a user can be both guest and host. Only sales_escalation is
      // addressed to the host (fired at booking.providerId); every other
      // booking notification is addressed to the guest.
      const isHostNotification = item.type === "sales_escalation";
      router.push((isHostNotification ? `/provider/booking/${bookingId}` : `/booking/${bookingId}`) as any);
    } else if (conversationId) {
      router.push(`/conversation/${conversationId}` as any);
    } else if (listingId) {
      router.push(`/listing/${listingId}` as any);
    }
  }, [markRead]);

  function handleMarkAllRead() {
    setAllLocallyRead(true);
    setDismissingIds(new Set());
    markAllRead.mutate();
  }

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={K.colors.textDark} />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={s.countBadge}>
              <Text style={s.countBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        {unreadCount > 0 ? (
          <TouchableOpacity
            style={s.markAllBtn}
            onPress={handleMarkAllRead}
            disabled={markAllRead.isPending}
            activeOpacity={0.7}
          >
            <Text style={s.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {/* ── Content ── */}
      {isLoading ? (
        <NotificationSkeleton />
      ) : isError ? (
        <View style={s.emptyWrap}>
          <View style={s.emptyIcon}>
            <Ionicons name="cloud-offline-outline" size={44} color={K.colors.textMuted} />
          </View>
          <Text style={s.emptyTitle}>Could not load notifications</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()} activeOpacity={0.8}>
            <Text style={s.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <AnimatedNotificationCard
              item={item}
              isDismissing={dismissingIds.has(item.id)}
              onAnimationComplete={handleDismissComplete}
              onPress={handlePress}
            />
          )}
          contentContainerStyle={[s.listContent, readable]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListFooterComponent={<View style={{ height: 32 }} />}
          ListEmptyComponent={<EmptyState />}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={K.colors.accent}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgApp },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: K.spacing.screen,
    paddingVertical: 12,
    backgroundColor: K.colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
    gap: 10,
    ...K.shadow.xs,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: {
    fontSize: K.font.xl,
    fontWeight: "800",
    color: K.colors.textDark,
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.full,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  markAllBtn: { paddingHorizontal: 8, paddingVertical: 6, minWidth: 80, alignItems: "flex-end" },
  markAllText: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.accent },

  listContent: { padding: K.spacing.screen },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    paddingTop: 80,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: K.font.xl,
    fontWeight: "800",
    color: K.colors.textDark,
    marginBottom: 10,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: K.font.base,
    color: K.colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.button,
    paddingHorizontal: 32,
    paddingVertical: 13,
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: K.font.base },
});

const c = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EDFFF5",
    borderRadius: K.radius.lg,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    overflow: "hidden",
    position: "relative",
    ...K.shadow.xs,
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: K.colors.accent,
    borderTopLeftRadius: K.radius.lg,
    borderBottomLeftRadius: K.radius.lg,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: K.radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  content: { flex: 1 },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  title: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark, flex: 1, lineHeight: 20 },
  time: { fontSize: 10, color: K.colors.textMuted, fontWeight: "600", marginTop: 2, flexShrink: 0 },
  body: { fontSize: K.font.sm, color: K.colors.textMid, lineHeight: 19 },
  dot: {
    width: 9,
    height: 9,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.accent,
    marginTop: 4,
    flexShrink: 0,
  },
});

const sk = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.lg,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: K.colors.border,
    marginBottom: 8,
  },
  icon: { width: 46, height: 46, borderRadius: K.radius.md, backgroundColor: K.colors.border, flexShrink: 0 },
  body: { flex: 1, gap: 8 },
  line1: { height: 14, width: "60%", backgroundColor: K.colors.border, borderRadius: 4 },
  line2: { height: 11, width: "85%", backgroundColor: K.colors.border, borderRadius: 4 },
  line3: { height: 11, width: "40%", backgroundColor: K.colors.border, borderRadius: 4 },
});
