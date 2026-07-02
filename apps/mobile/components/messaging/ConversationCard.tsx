import { memo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ListingImage } from "../ListingImage";
import { K } from "../../constants/theme";
import type { ConversationSummary } from "../../lib/types/messaging";
import type { ListingBasics } from "../../hooks/messaging";

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatConvTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "NOW";
  if (diffMins < 60) return `${diffMins}M AGO`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}H AGO`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "YESTERDAY";
  if (diffDays < 7) return `${diffDays}D AGO`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase();
}

const AVATAR_PALETTE = [
  K.colors.accent, "#7C3AED", "#0891B2", "#D97706", "#059669", "#DC2626",
];

export function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]!;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function ConversationCardSkeleton() {
  return (
    <View style={s.card}>
      <View style={[s.photo, { backgroundColor: K.colors.border }]} />
      <View style={s.content}>
        <View style={sk.row}>
          <View style={sk.titleLine} />
          <View style={sk.timeLine} />
        </View>
        <View style={sk.partyLine} />
        <View style={sk.previewLine} />
      </View>
    </View>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface Props {
  item: ConversationSummary;
  currentUserId: string;
  listing?: ListingBasics | null;
  isLoadingListing?: boolean;
}

function ConversationCard({ item, currentUserId, listing, isLoadingListing }: Props) {
  const isInactive = listing?.isInactive ?? false;
  const isGuest = item.guestId === currentUserId;
  const otherPartyId = isGuest ? item.providerId : item.guestId;
  const partyLabel = isGuest ? "Host" : "Guest Traveller";
  const initials = otherPartyId.slice(0, 2).toUpperCase();
  const avatarBg = avatarColor(otherPartyId);

  const title = isInactive
    ? "Listing Unavailable"
    : (listing?.name ?? (item.listingId ? `Listing #${item.listingId.slice(0, 8)}` : "Conversation"));
  const preview = item.lastMessage?.body ?? null;
  const time = item.lastMessage?.createdAt
    ? formatConvTime(item.lastMessage.createdAt)
    : formatConvTime(item.updatedAt);

  // Heuristic: last message from the other party = likely unread
  const hasUnread = !isInactive && !!(item.lastMessage && item.lastMessage.senderId !== currentUserId);

  if (isLoadingListing) return <ConversationCardSkeleton />;

  function handlePress() {
    if (isInactive) {
      Alert.alert(
        "Listing Unavailable",
        "This listing is no longer available.",
        [{ text: "OK" }]
      );
      return;
    }
    router.push(`/conversation/${item.id}` as any);
  }

  return (
    <TouchableOpacity
      style={[s.card, isInactive && s.cardInactive]}
      onPress={handlePress}
      activeOpacity={0.75}
    >
      {/* Listing photo */}
      <View style={s.photoWrap}>
        <View style={[s.photo, isInactive && s.photoInactive]}>
          {isInactive ? (
            <View style={s.unavailablePhoto}>
              <Ionicons name="home-outline" size={26} color={K.colors.textMuted} />
            </View>
          ) : (
            <ListingImage uri={listing?.photoUrl ?? null} style={StyleSheet.absoluteFill} />
          )}
        </View>

        {isInactive ? (
          <View style={s.inactiveBadge}>
            <Text style={s.inactiveBadgeText}>OFF</Text>
          </View>
        ) : (
          <View style={[s.badge, { backgroundColor: avatarBg }]}>
            <Text style={s.badgeText}>{initials}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={s.content}>
        <View style={s.row}>
          <Text
            style={[s.title, hasUnread && s.titleBold, isInactive && s.titleInactive]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text style={[s.time, hasUnread && s.timeAccent, isInactive && s.timeInactive]}>
            {time}
          </Text>
        </View>

        <Text style={[s.party, isInactive && s.partyInactive]} numberOfLines={1}>
          {isInactive ? "No longer available" : partyLabel}
        </Text>

        <View style={s.row}>
          <Text
            style={[s.preview, hasUnread && s.previewBold, isInactive && s.previewInactive]}
            numberOfLines={1}
          >
            {preview ?? "No messages yet"}
          </Text>
          {hasUnread && <View style={s.unreadDot} />}
          {isInactive && (
            <View style={s.unavailablePill}>
              <Text style={s.unavailablePillText}>Unavailable</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default memo(ConversationCard);

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.lg,
    padding: 14,
    gap: 14,
    ...K.shadow.sm,
  },
  cardInactive: {
    backgroundColor: K.colors.bgSubtle,
    opacity: 0.75,
  },

  photoWrap: {
    width: 76,
    height: 76,
    flexShrink: 0,
    position: "relative",
  },
  photo: {
    width: 76,
    height: 76,
    borderRadius: K.radius.md,
    overflow: "hidden",
    backgroundColor: K.colors.bgSubtle,
  },
  photoInactive: {
    backgroundColor: K.colors.border,
  },
  unavailablePhoto: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: K.colors.bgSubtle,
  },

  badge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 26,
    height: 26,
    borderRadius: K.radius.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: K.colors.bgCard,
  },
  badgeText: { fontSize: 9, fontWeight: "800", color: "#fff" },

  inactiveBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 26,
    height: 26,
    borderRadius: K.radius.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: K.colors.bgCard,
    backgroundColor: "#9ca3af",
  },
  inactiveBadgeText: { fontSize: 7, fontWeight: "800", color: "#fff", letterSpacing: 0.2 },

  content: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },

  title: { fontSize: K.font.base, fontWeight: "600", color: K.colors.textDark, flex: 1, marginRight: 6 },
  titleBold: { fontWeight: "800" },
  titleInactive: { color: K.colors.textMuted, fontWeight: "600" },

  time: { fontSize: 9, fontWeight: "600", color: K.colors.textMuted, letterSpacing: 0.4 },
  timeAccent: { color: K.colors.accent },
  timeInactive: { color: K.colors.border },

  party: { fontSize: K.font.sm, color: K.colors.textMuted, fontWeight: "500", marginBottom: 5 },
  partyInactive: { color: K.colors.border },

  preview: { fontSize: K.font.sm, color: K.colors.textMuted, flex: 1, marginRight: 8 },
  previewBold: { color: K.colors.textMid, fontWeight: "600" },
  previewInactive: { color: K.colors.border },

  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: K.colors.accent },

  unavailablePill: {
    backgroundColor: "#f3f4f6",
    borderRadius: K.radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: K.colors.border,
  },
  unavailablePillText: { fontSize: 9, fontWeight: "700", color: "#9ca3af", letterSpacing: 0.3 },
});

const sk = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  titleLine: { height: 14, width: "55%", backgroundColor: K.colors.border, borderRadius: 4 },
  timeLine: { height: 10, width: 36, backgroundColor: K.colors.border, borderRadius: 4 },
  partyLine: { height: 11, width: "30%", backgroundColor: K.colors.border, borderRadius: 4, marginBottom: 8 },
  previewLine: { height: 12, width: "78%", backgroundColor: K.colors.border, borderRadius: 4 },
});
