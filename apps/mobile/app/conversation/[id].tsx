import { useState, useRef, useCallback } from "react";
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
} from "react-native";

// Detects phone numbers, email addresses, and WhatsApp/external contact links.
// Does NOT block send — shows a safety warning and lets the user proceed.
const CONTACT_PATTERN =
  /(\+?[0-9][\s\-.]?){7,15}[0-9]|[\w.+-]+@[\w-]+\.[a-z]{2,}|wa\.me\/|whatsapp\.com|t\.me\/|telegram\.me/i;
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth";
import { useMessages, useSendMessage, useConversations } from "../../hooks/messaging";
import { K } from "../../constants/theme";
import type { Message } from "../../lib/types/messaging";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBubbleTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDaySeparator(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, isOwn }: { msg: Message; isOwn: boolean }) {
  return (
    <View style={[b.wrap, isOwn ? b.wrapOwn : b.wrapOther]}>
      <View style={[b.bubble, isOwn ? b.bubbleOwn : b.bubbleOther]}>
        <Text style={[b.text, isOwn && b.textOwn]}>{msg.body}</Text>
      </View>
      <Text style={[b.time, isOwn && b.timeOwn]}>{formatBubbleTime(msg.createdAt)}</Text>
    </View>
  );
}

const b = StyleSheet.create({
  wrap:       { marginHorizontal: K.spacing.screen, marginVertical: 3, maxWidth: "78%" },
  wrapOwn:    { alignSelf: "flex-end" },
  wrapOther:  { alignSelf: "flex-start" },
  bubble: {
    borderRadius: K.radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOwn:   { backgroundColor: K.colors.accent },
  bubbleOther: { backgroundColor: K.colors.bgCard, borderWidth: 1, borderColor: K.colors.border },
  text:        { fontSize: K.font.base, color: K.colors.textDark, lineHeight: 22 },
  textOwn:     { color: "#fff" },
  time:        { fontSize: 10, color: K.colors.textMuted, marginTop: 4, marginHorizontal: 4 },
  timeOwn:     { textAlign: "right" },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);

  const { data: convList } = useConversations();
  const conversation = convList?.conversations.find((c) => c.id === id);

  const other = conversation?.participants.find((p) => p.id !== user?.id);
  const participantName = other
    ? `${other.firstName} ${other.lastName}`
    : "Conversation";

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

  const allMessages: Message[] = (data?.pages ?? [])
    .flatMap((page) => page.messages)
    .reverse();

  function doSend(text: string) {
    setDraft("");
    sendMutation.mutate(text, { onError: () => setDraft(text) });
  }

  function handleSend() {
    const text = draft.trim();
    if (!text || sendMutation.isPending) return;

    if (CONTACT_PATTERN.test(text)) {
      Alert.alert(
        "Contact Info Detected",
        "Your message may contain a phone number, email address, or external link. For your safety and security, please keep all communication within Kainook.",
        [
          { text: "Edit Message", style: "cancel" },
          { text: "Send Anyway", style: "destructive", onPress: () => doSend(text) },
        ]
      );
      return;
    }

    doSend(text);
  }

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Build items with day separators
  type ListItem =
    | { type: "msg"; msg: Message }
    | { type: "day"; label: string; key: string };

  const listItems: ListItem[] = [];
  let lastDay = "";
  for (const msg of allMessages) {
    const day = formatDaySeparator(msg.createdAt);
    if (day !== lastDay) {
      listItems.push({ type: "day", label: day, key: `day-${msg.id}` });
      lastDay = day;
    }
    listItems.push({ type: "msg", msg });
  }

  return (
    <SafeAreaView style={s.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={K.colors.textDark} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerName} numberOfLines={1}>{participantName}</Text>
          {conversation?.listingTitle ? (
            <Text style={s.headerSub} numberOfLines={1}>
              {conversation.listingTitle}
            </Text>
          ) : null}
        </View>
      </View>

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
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
            data={listItems}
            keyExtractor={(item) =>
              item.type === "msg" ? item.msg.id : item.key
            }
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
              return (
                <MessageBubble
                  msg={item.msg}
                  isOwn={item.msg.senderId === user?.id}
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
                <Ionicons name="chatbubble-outline" size={36} color={K.colors.textMuted} />
                <Text style={s.emptyText}>No messages yet. Say hello!</Text>
              </View>
            }
          />
        )}

        {/* Compose bar */}
        <View style={s.compose}>
          <TextInput
            ref={inputRef}
            style={s.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message…"
            placeholderTextColor={K.colors.textMuted}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[s.sendBtn, (!draft.trim() || sendMutation.isPending) && s.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!draft.trim() || sendMutation.isPending}
            activeOpacity={0.8}
          >
            {sendMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgApp },
  flex:      { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: K.spacing.screen,
    paddingVertical: 12,
    backgroundColor: K.colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
    gap: 12,
    ...K.shadow.xs,
  },
  backBtn:     { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1 },
  headerName:  { fontSize: K.font.lg, fontWeight: "700", color: K.colors.textDark },
  headerSub:   { fontSize: 11, color: K.colors.accent, fontWeight: "600", marginTop: 2 },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  errorText: { fontSize: K.font.sm, color: K.colors.textMuted, marginTop: 10, textAlign: "center" },
  retryBtn:  { marginTop: 14, backgroundColor: K.colors.accent, borderRadius: K.radius.button, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: "#fff", fontWeight: "700", fontSize: K.font.sm },

  listContent: { paddingVertical: 12 },

  daySep: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: K.spacing.screen,
    marginVertical: 12,
    gap: 10,
  },
  daySepLine: { flex: 1, height: 1, backgroundColor: K.colors.border },
  daySepText: { fontSize: 11, color: K.colors.textMuted, fontWeight: "600" },

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, marginTop: 60 },
  emptyText: { fontSize: K.font.sm, color: K.colors.textMuted, marginTop: 10, textAlign: "center" },

  // Compose bar
  compose: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: K.spacing.screen,
    paddingVertical: 10,
    paddingBottom: 12,
    backgroundColor: K.colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: K.colors.border,
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: K.colors.bgSubtle,
    borderRadius: K.radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: K.font.base,
    color: K.colors.textDark,
    borderWidth: 1,
    borderColor: K.colors.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    ...K.shadow.brand,
  },
  sendBtnDisabled: { backgroundColor: K.colors.borderStrong, shadowOpacity: 0 },
});
