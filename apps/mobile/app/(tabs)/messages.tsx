import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth";
import { useConversations } from "../../hooks/messaging";
import { K } from "../../constants/theme";
import type { ConversationSummary } from "../../lib/types/messaging";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function getInitial(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// ── Conversation Row ──────────────────────────────────────────────────────────

function ConversationRow({
  item,
  currentUserId,
}: {
  item: ConversationSummary;
  currentUserId: string;
}) {
  const other = item.participants.find((p) => p.id !== currentUserId);
  const name = other
    ? `${other.firstName} ${other.lastName}`
    : "Unknown";
  const initials = other ? getInitial(other.firstName, other.lastName) : "?";
  const preview = item.lastMessage?.body ?? "No messages yet";
  const time = item.lastMessage?.createdAt
    ? formatTime(item.lastMessage.createdAt)
    : formatTime(item.updatedAt);
  const isUnread = item.unreadCount > 0;

  return (
    <TouchableOpacity
      style={s.row}
      onPress={() => router.push(`/conversation/${item.id}` as any)}
      activeOpacity={0.75}
    >
      {/* Avatar */}
      <View style={s.avatar}>
        <Text style={s.avatarText}>{initials}</Text>
        {isUnread && <View style={s.avatarDot} />}
      </View>

      {/* Content */}
      <View style={s.rowContent}>
        <View style={s.rowTop}>
          <Text style={[s.name, isUnread && s.nameUnread]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={s.time}>{time}</Text>
        </View>
        {item.listingTitle ? (
          <Text style={s.listingTitle} numberOfLines={1}>
            {item.listingTitle}
          </Text>
        ) : null}
        <View style={s.rowBottom}>
          <Text
            style={[s.preview, isUnread && s.previewUnread]}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {isUnread && (
            <View style={s.badge}>
              <Text style={s.badgeText}>
                {item.unreadCount > 99 ? "99+" : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError, refetch, isFetching } = useConversations();

  const conversations = data?.conversations ?? [];

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Messages</Text>
      </View>

      {isLoading ? (
        <View style={s.centered}>
          <ActivityIndicator color={K.colors.accent} size="large" />
        </View>
      ) : isError ? (
        <View style={s.centered}>
          <Ionicons name="warning-outline" size={40} color={K.colors.textMuted} />
          <Text style={s.errorText}>Failed to load messages</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : conversations.length === 0 ? (
        <View style={s.centered}>
          <View style={s.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={48} color={K.colors.textMuted} />
          </View>
          <Text style={s.emptyTitle}>No conversations yet</Text>
          <Text style={s.emptySubtitle}>
            Message a host or provider from a listing or booking page
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationRow item={item} currentUserId={user?.id ?? ""} />
          )}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={K.colors.accent}
            />
          }
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgApp },

  header: {
    paddingHorizontal: K.spacing.screen,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: K.colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
  },
  headerTitle: {
    fontSize: K.font.xxl,
    fontWeight: "800",
    color: K.colors.textDark,
    letterSpacing: -0.4,
  },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },

  errorText: {
    fontSize: K.font.base,
    color: K.colors.textMuted,
    marginTop: 12,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.button,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: K.font.base },

  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: K.font.lg,
    fontWeight: "700",
    color: K.colors.textDark,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: K.font.sm,
    color: K.colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },

  listContent: { paddingVertical: 8 },
  separator:   { height: 1, backgroundColor: K.colors.border, marginLeft: 80 },

  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: K.spacing.screen,
    paddingVertical: 14,
    backgroundColor: K.colors.bgCard,
    gap: 14,
  },

  // Avatar
  avatar: {
    width: 52,
    height: 52,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarText: { fontSize: 18, fontWeight: "800", color: "#fff" },
  avatarDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.error,
    borderWidth: 2,
    borderColor: K.colors.bgCard,
  },

  // Row content
  rowContent: { flex: 1 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  name:        { fontSize: K.font.base, fontWeight: "600", color: K.colors.textDark, flex: 1, marginRight: 8 },
  nameUnread:  { fontWeight: "800" },
  time:        { fontSize: 11, color: K.colors.textMuted },
  listingTitle: { fontSize: 11, color: K.colors.accent, fontWeight: "600", marginBottom: 3 },
  rowBottom:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  preview:     { fontSize: K.font.sm, color: K.colors.textMuted, flex: 1, marginRight: 8 },
  previewUnread: { color: K.colors.textMid, fontWeight: "500" },
  badge: {
    backgroundColor: K.colors.error,
    borderRadius: K.radius.full,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
