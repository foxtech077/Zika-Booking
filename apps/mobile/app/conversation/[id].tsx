import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth";
import { useKeyboard } from "../../hooks/useKeyboard";
import { useMessages, useSendMessage, useConversations, useListingBasics } from "../../hooks/messaging";
import { useBooking } from "../../hooks/booking";
import { ListingImage } from "../../components/ListingImage";
import { K } from "../../constants/theme";
import type { Message } from "../../lib/types/messaging";

// Blocks obvious contact-sharing attempts in-app
const CONTACT_PATTERN =
  /(\+?[0-9][\s\-.]?){7,15}[0-9]|[\w.+-]+@[\w-]+\.[a-z]{2,}|wa\.me\/|whatsapp\.com|t\.me\/|telegram\.me/i;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBubbleTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDaySep(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth()    === today.getMonth() &&
    d.getDate()     === today.getDate();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYest =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth()    === yesterday.getMonth() &&
    d.getDate()     === yesterday.getDate();
  if (isToday) return "Today";
  if (isYest)  return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmt(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return iso; }
}

const AVATAR_PALETTE = [
  K.colors.accent, "#7C3AED", "#0891B2", "#D97706", "#059669", "#DC2626",
];
function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]!;
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isOwn,
  showAvatar,
  avatarBg,
  avatarInitials,
}: {
  msg: Message;
  isOwn: boolean;
  showAvatar: boolean;
  avatarBg: string;
  avatarInitials: string;
}) {
  const isRead = msg.readAt !== null;

  return (
    <View style={[b.wrap, isOwn ? b.wrapOwn : b.wrapOther]}>
      {/* Avatar placeholder on left for other party */}
      {!isOwn && (
        <View style={b.avatarSlot}>
          {showAvatar ? (
            <View style={[b.avatar, { backgroundColor: avatarBg }]}>
              <Text style={b.avatarText}>{avatarInitials}</Text>
            </View>
          ) : null}
        </View>
      )}

      <View style={b.bubbleCol}>
        <View style={[b.bubble, isOwn ? b.bubbleOwn : b.bubbleOther]}>
          <Text style={[b.text, isOwn && b.textOwn]}>{msg.body}</Text>
        </View>
        <View style={[b.meta, isOwn && b.metaOwn]}>
          <Text style={b.time}>{formatBubbleTime(msg.createdAt)}</Text>
          {isOwn && (
            <Text style={[b.tick, isRead && b.tickRead]}>
              {isRead ? "✓✓" : "✓"}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const b = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginHorizontal: K.spacing.screen,
    marginVertical: 3,
    maxWidth: "82%",
  },
  wrapOwn:   { alignSelf: "flex-end", flexDirection: "row-reverse" },
  wrapOther: { alignSelf: "flex-start" },

  avatarSlot: { width: 30, flexShrink: 0, marginRight: 8 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: K.radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 10, fontWeight: "800", color: "#fff" },

  bubbleCol: { flex: 1, minWidth: 0 },
  bubble: {
    borderRadius: K.radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOwn:   { backgroundColor: K.colors.darkGreen, borderBottomRightRadius: 4 },
  bubbleOther: {
    backgroundColor: K.colors.bgCard,
    borderWidth: 1,
    borderColor: K.colors.border,
    borderBottomLeftRadius: 4,
  },
  text:    { fontSize: K.font.base, color: K.colors.textDark, lineHeight: 22 },
  textOwn: { color: "#fff" },

  meta:    { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, marginHorizontal: 4 },
  metaOwn: { justifyContent: "flex-end" },
  time:    { fontSize: 10, color: K.colors.textMuted },
  tick:    { fontSize: 11, color: K.colors.textMuted },
  tickRead: { color: K.colors.accent },
});

// ── Booking context card ──────────────────────────────────────────────────────

function BookingCard({ bookingId }: { bookingId: string }) {
  const { data: booking } = useBooking(bookingId);
  if (!booking) return null;

  const statusToken = K.colors[booking.status as keyof typeof K.colors] as any;
  const statusBg   = typeof statusToken === "object" ? statusToken.bg   : K.colors.bgSubtle;
  const statusText = typeof statusToken === "object" ? statusToken.text : K.colors.textMuted;
  const checkIn  = booking.checkIn  ?? booking.pickupDatetime;
  const checkOut = booking.checkOut ?? booking.returnDatetime;

  return (
    <View style={bc.card}>
      <View style={bc.row}>
        <View style={bc.photo}>
          <ListingImage
            uri={booking.listing?.primaryPhotoUrl ?? null}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <View style={bc.info}>
          <View style={bc.nameRow}>
            <Text style={bc.name} numberOfLines={1}>{booking.listing?.title ?? booking.listingTitle}</Text>
            <View style={[bc.badge, { backgroundColor: statusBg }]}>
              <Text style={[bc.badgeText, { color: statusText }]}>
                {booking.status.replace(/_/g, " ").toUpperCase()}
              </Text>
            </View>
          </View>
          {checkIn && checkOut && (
            <Text style={bc.dates}>
              {fmt(checkIn)} — {fmt(checkOut)}
            </Text>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={bc.viewBtn}
        onPress={() => router.push(`/bookings/${booking.id}` as any)}
        activeOpacity={0.8}
      >
        <Text style={bc.viewBtnText}>Quick View Booking</Text>
        <Ionicons name="open-outline" size={13} color={K.colors.textDark} />
      </TouchableOpacity>
    </View>
  );
}

const bc = StyleSheet.create({
  card: {
    backgroundColor: K.colors.bgCard,
    marginHorizontal: K.spacing.screen,
    marginBottom: 8,
    borderRadius: K.radius.lg,
    borderWidth: 1,
    borderColor: K.colors.border,
    padding: 14,
    gap: 12,
    ...K.shadow.xs,
  },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  photo: {
    width: 60,
    height: 60,
    borderRadius: K.radius.md,
    overflow: "hidden",
    backgroundColor: K.colors.bgSubtle,
    flexShrink: 0,
  },
  info: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6, flexWrap: "wrap" },
  name: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark, flex: 1 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: K.radius.full,
  },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  dates: { fontSize: K.font.sm, color: K.colors.textMuted, fontWeight: "500" },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: K.radius.button,
    borderWidth: 1,
    borderColor: K.colors.border,
    backgroundColor: K.colors.bgSubtle,
  },
  viewBtnText: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textDark },
});

// ── Quick replies ─────────────────────────────────────────────────────────────

const QUICK_REPLIES = [
  "Where is the property?",
  "Early check-in available?",
  "Any special offers?",
];

// ── Inactive banner ───────────────────────────────────────────────────────────

function InactiveBanner() {
  return (
    <View style={ib.wrap}>
      <Ionicons name="ban-outline" size={16} color="#92400e" style={{ flexShrink: 0 }} />
      <Text style={ib.text}>
        This listing is no longer available. Messaging has been disabled.
      </Text>
    </View>
  );
}

const ib = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fffbeb",
    borderBottomWidth: 1,
    borderBottomColor: "#fde68a",
    paddingHorizontal: K.spacing.screen,
    paddingVertical: 12,
  },
  text: {
    flex: 1,
    fontSize: K.font.sm,
    color: "#92400e",
    fontWeight: "600",
    lineHeight: 18,
  },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const isKeyboardOpen = useKeyboard();

  // Find conversation from cached list
  const { data: convList } = useConversations();
  const conversation = convList?.conversations.find((c) => c.id === id);

  // Listing details for header — may return isInactive:true on 410
  const { data: listing } = useListingBasics(conversation?.listingId);
  const isInactive = listing?.isInactive ?? false;

  // Party identity
  const isGuest = conversation?.guestId === user?.id;
  const otherPartyId = conversation ? (isGuest ? conversation.providerId : conversation.guestId) : "";
  const participantName = conversation ? (isGuest ? "Host" : "Guest Traveller") : "Conversation";
  const avatarInitials = otherPartyId.slice(0, 2).toUpperCase();
  const avatarBg = avatarColor(otherPartyId || "default");

  // Show booking card only for travellers who have a booking in this conversation
  const showBooking = isGuest && !!conversation?.bookingId;

  // Messages
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useMessages(id);

  const sendMutation = useSendMessage(id ?? "");
  const [draft, setDraft] = useState("");
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<any>>(null);

  const allMessages: Message[] = (data?.pages ?? []).flatMap((p) => p.messages);

  useEffect(() => {
    if (allMessages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [allMessages.length]);

  function doSend(text: string) {
    setDraft("");
    sendMutation.mutate(text, { onError: () => setDraft(text) });
  }

  function handleSend() {
    if (isInactive) return;
    const text = draft.trim();
    if (!text || sendMutation.isPending) return;
    if (CONTACT_PATTERN.test(text)) {
      Alert.alert(
        "Contact Info Detected",
        "For your safety, please keep all communication within Kainook.",
        [
          { text: "Edit Message", style: "cancel" },
          { text: "Send Anyway", style: "destructive", onPress: () => doSend(text) },
        ]
      );
      return;
    }
    doSend(text);
  }

  function handleListingHeaderTap() {
    if (isInactive) {
      Alert.alert("Listing Unavailable", "This listing is no longer available.", [{ text: "OK" }]);
      return;
    }
    if (conversation?.listingId) {
      router.push(`/listing/${conversation.listingId}` as any);
    }
  }

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Build list items with day separators
  type ListItem =
    | { type: "msg"; msg: Message }
    | { type: "day"; label: string; key: string };

  const listItems: ListItem[] = [];
  let lastDay = "";
  for (const msg of allMessages) {
    const day = formatDaySep(msg.createdAt);
    if (day !== lastDay) {
      listItems.push({ type: "day", label: day, key: `day-${msg.id}` });
      lastDay = day;
    }
    listItems.push({ type: "msg", msg });
  }

  // Show avatar only on the last message in a run from the other party
  const avatarVisibleIds = new Set<string>();
  for (let i = 0; i < allMessages.length; i++) {
    const cur  = allMessages[i];
    const next = allMessages[i + 1];
    const isOtherParty = cur && cur.senderId !== user?.id;
    const nextIsOtherParty = next && next.senderId !== user?.id;
    if (isOtherParty && !nextIsOtherParty && cur) {
      avatarVisibleIds.add(cur.id);
    }
  }

  const sendDisabled = isInactive || !draft.trim() || sendMutation.isPending;

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      {/* ── Header ── */}
      <View style={[s.header, isInactive && s.headerInactive]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={isInactive ? K.colors.textMuted : K.colors.textDark} />
        </TouchableOpacity>

        {/* Avatar: listing photo or placeholder */}
        <TouchableOpacity style={s.headerAvatarWrap} onPress={handleListingHeaderTap} activeOpacity={0.8}>
          {isInactive ? (
            <View style={[s.headerAvatar, s.headerAvatarInactive]}>
              <Ionicons name="home-outline" size={18} color={K.colors.textMuted} />
            </View>
          ) : listing?.photoUrl ? (
            <ListingImage uri={listing.photoUrl} style={s.headerAvatar} />
          ) : (
            <View style={[s.headerAvatar, { backgroundColor: avatarBg, alignItems: "center", justifyContent: "center" }]}>
              <Text style={s.headerAvatarText}>{avatarInitials || "??"}</Text>
            </View>
          )}
          {/* Status dot — green when active, grey when inactive */}
          <View style={[s.onlineDot, isInactive && s.onlineDotInactive]} />
        </TouchableOpacity>

        {/* Name + listing */}
        <TouchableOpacity style={s.headerInfo} onPress={handleListingHeaderTap} activeOpacity={0.8}>
          <Text style={[s.headerName, isInactive && s.headerNameInactive]} numberOfLines={1}>
            {participantName}
          </Text>
          {isInactive ? (
            <View style={s.inactivePill}>
              <Text style={s.inactivePillText}>Listing Unavailable</Text>
            </View>
          ) : listing?.name ? (
            <Text style={s.headerSub} numberOfLines={1}>{listing.name}</Text>
          ) : null}
        </TouchableOpacity>

        {/* Actions — hide call when inactive */}
        <View style={s.headerRight}>
          {!isInactive && (
            <TouchableOpacity
              style={s.headerBtn}
              activeOpacity={0.7}
              onPress={() => Alert.alert("Call", "Voice calling is not available in this version.")}
            >
              <Ionicons name="call-outline" size={20} color={K.colors.textDark} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={s.headerBtn}
            activeOpacity={0.7}
            onPress={() =>
              Alert.alert("Options", undefined, [
                { text: "Report Conversation", style: "destructive", onPress: () => {} },
                { text: "Cancel", style: "cancel" },
              ])
            }
          >
            <Ionicons name="ellipsis-vertical" size={20} color={isInactive ? K.colors.textMuted : K.colors.textDark} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Inactive banner ── */}
      {isInactive && <InactiveBanner />}

      {/* ── Booking context card ── */}
      {showBooking && conversation?.bookingId ? (
        <BookingCard bookingId={conversation.bookingId} />
      ) : null}

      {/* ── Messages + compose ── */}
      <KeyboardAvoidingView
        style={s.flex}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : isKeyboardOpen
              ? "height"
              : undefined
        }
        keyboardVerticalOffset={0}
      >
        {isLoading ? (
          <View style={s.centered}>
            <ActivityIndicator color={K.colors.accent} />
          </View>
        ) : isError ? (
          <View style={s.centered}>
            <Ionicons name="warning-outline" size={36} color={K.colors.textMuted} />
            <Text style={s.errorText}>Failed to load messages</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
              <Text style={s.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={listItems}
            keyExtractor={(item) => (item.type === "msg" ? item.msg.id : item.key)}
            renderItem={({ item }) => {
              if (item.type === "day") {
                return (
                  <View style={s.daySep}>
                    <View style={s.daySepLine} />
                    <Text style={s.daySepText}>{item.label}</Text>
                    <View style={s.daySepLine} />
                  </View>
                );
              }
              const isOwn = item.msg.senderId === user?.id;
              return (
                <MessageBubble
                  msg={item.msg}
                  isOwn={isOwn}
                  showAvatar={!isOwn && avatarVisibleIds.has(item.msg.id)}
                  avatarBg={avatarBg}
                  avatarInitials={avatarInitials}
                />
              );
            }}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.3}
            ListHeaderComponent={
              isFetchingNextPage ? (
                <ActivityIndicator color={K.colors.accent} style={{ marginVertical: 12 }} />
              ) : null
            }
            ListEmptyComponent={
              <View style={s.emptyWrap}>
                <View style={s.emptyIcon}>
                  <Ionicons name="chatbubble-outline" size={36} color={K.colors.textMuted} />
                </View>
                <Text style={s.emptyTitle}>
                  {isInactive ? "No messages" : "Start the conversation"}
                </Text>
                <Text style={s.emptySubtitle}>
                  {isInactive
                    ? "This listing is no longer available"
                    : "Send a message to get the ball rolling"}
                </Text>
              </View>
            }
          />
        )}

        {/* Quick replies — hidden when listing is inactive */}
        {!isLoading && !isInactive && allMessages.length === 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.qrScroll}
            contentContainerStyle={s.qrContent}
          >
            {QUICK_REPLIES.map((qr) => (
              <TouchableOpacity
                key={qr}
                style={s.qrChip}
                onPress={() => setDraft(qr)}
                activeOpacity={0.75}
              >
                <Text style={s.qrText}>{qr}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── Compose bar ── */}
        {isInactive ? (
          <View style={s.composeDisabled}>
            <Ionicons name="lock-closed-outline" size={16} color="#9ca3af" />
            <Text style={s.composeDisabledText}>Messaging is disabled for this listing</Text>
          </View>
        ) : (
          <View style={s.compose}>
            <TouchableOpacity style={s.composeIcon} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={28} color={K.colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={s.composeIcon} activeOpacity={0.7}>
              <Ionicons name="camera-outline" size={24} color={K.colors.textMuted} />
            </TouchableOpacity>

            <TextInput
              ref={inputRef}
              style={s.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a message…"
              placeholderTextColor={K.colors.textMuted}
              multiline
              maxLength={1000}
            />

            <TouchableOpacity style={s.composeIcon} activeOpacity={0.7}>
              <Ionicons name="happy-outline" size={24} color={K.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.sendBtn, sendDisabled && s.sendBtnOff]}
              onPress={handleSend}
              disabled={sendDisabled}
              activeOpacity={0.85}
            >
              {sendMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="arrow-up" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Bottom safe area */}
      <SafeAreaView
        edges={["bottom"]}
        style={{ backgroundColor: isInactive ? K.colors.bgSubtle : K.colors.bgCard }}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgApp },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: K.spacing.screen,
    paddingVertical: 10,
    backgroundColor: K.colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
    gap: 10,
    ...K.shadow.xs,
  },
  headerInactive: {
    backgroundColor: K.colors.bgSubtle,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  headerAvatarWrap: { position: "relative" },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: K.radius.full,
    overflow: "hidden",
    backgroundColor: K.colors.bgSubtle,
  },
  headerAvatarInactive: {
    backgroundColor: K.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: { fontSize: 14, fontWeight: "800", color: "#fff" },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: K.radius.full,
    backgroundColor: "#22c55e",
    borderWidth: 2,
    borderColor: K.colors.bgCard,
  },
  onlineDotInactive: {
    backgroundColor: "#9ca3af",
    borderColor: K.colors.bgSubtle,
  },

  headerInfo: { flex: 1, minWidth: 0 },
  headerName: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark },
  headerNameInactive: { color: K.colors.textMuted },
  headerSub: { fontSize: 11, color: K.colors.accent, fontWeight: "600", marginTop: 1 },

  inactivePill: {
    marginTop: 3,
    alignSelf: "flex-start",
    backgroundColor: "#f3f4f6",
    borderRadius: K.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: K.colors.border,
  },
  inactivePillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9ca3af",
    letterSpacing: 0.2,
  },

  headerRight: { flexDirection: "row", gap: 4 },
  headerBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  // Messages
  listContent: { paddingVertical: 12, paddingBottom: 8 },

  daySep: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: K.spacing.screen,
    marginVertical: 14,
    gap: 10,
  },
  daySepLine: { flex: 1, height: 1, backgroundColor: K.colors.border },
  daySepText: { fontSize: 11, color: K.colors.textMuted, fontWeight: "600" },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  errorText: { fontSize: K.font.sm, color: K.colors.textMuted, marginTop: 12, textAlign: "center" },
  retryBtn: {
    marginTop: 16,
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.button,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: K.font.sm },

  emptyWrap: { alignItems: "center", justifyContent: "center", padding: 48, marginTop: 20 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: K.font.lg, fontWeight: "700", color: K.colors.textDark, marginBottom: 8 },
  emptySubtitle: { fontSize: K.font.sm, color: K.colors.textMuted, textAlign: "center", lineHeight: 20 },

  // Quick replies
  qrScroll: { flexGrow: 0, marginBottom: 4 },
  qrContent: { paddingHorizontal: K.spacing.screen, gap: 8, paddingVertical: 4 },
  qrChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.bgTint,
    borderWidth: 1,
    borderColor: K.colors.accentDim,
  },
  qrText: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.accent },

  // Compose (active)
  compose: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: K.colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: K.colors.border,
    gap: 6,
  },
  composeIcon: {
    width: 36,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: K.colors.bgSubtle,
    borderRadius: K.radius.xxl,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: K.font.base,
    color: K.colors.textDark,
    borderWidth: 1,
    borderColor: K.colors.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    ...K.shadow.brand,
  },
  sendBtnOff: { backgroundColor: K.colors.borderStrong, shadowOpacity: 0 },

  // Compose (disabled — inactive listing)
  composeDisabled: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    backgroundColor: K.colors.bgSubtle,
    borderTopWidth: 1,
    borderTopColor: K.colors.border,
  },
  composeDisabledText: {
    fontSize: K.font.sm,
    color: "#9ca3af",
    fontWeight: "600",
  },
});
