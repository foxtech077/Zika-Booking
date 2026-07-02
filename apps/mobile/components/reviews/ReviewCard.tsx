import { memo, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ReviewStars } from "./ReviewStars";
import { ReviewReplyCard } from "./ReviewReplyCard";
import { K } from "../../constants/theme";

export interface ReviewCardProps {
  rating: number;
  title?: string | null;
  body?: string | null;
  createdAt: string;
  // The public listing-reviews API only exposes `guestId`, never a real name —
  // callers that don't have one (traveller-facing screens) simply omit this,
  // and a generic "Guest" label is shown instead of fabricating a name.
  guestName?: string;
  providerReply?: string | null;
  providerRepliedAt?: string | null;
  onReplyPress?: () => void;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export const ReviewCard = memo(function ReviewCard({
  rating,
  title,
  body,
  createdAt,
  guestName,
  providerReply,
  providerRepliedAt,
  onReplyPress,
}: ReviewCardProps) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fade]);

  return (
    <Animated.View style={[s.card, { opacity: fade }]}>
      <View style={s.topRow}>
        <View style={s.avatar}>
          <Ionicons name="person" size={16} color={K.colors.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.guestName}>{guestName ?? "Guest"}</Text>
          <ReviewStars rating={rating} size={12} />
        </View>
        <Text style={s.date}>{fmtDate(createdAt)}</Text>
      </View>

      {title ? <Text style={s.title}>{title}</Text> : null}
      {body ? <Text style={s.body}>{body}</Text> : null}

      {providerReply ? (
        <ReviewReplyCard reply={providerReply} repliedAt={providerRepliedAt} />
      ) : onReplyPress ? (
        <TouchableOpacity style={s.replyBtn} onPress={onReplyPress} activeOpacity={0.8}>
          <Ionicons name="chatbox-ellipses-outline" size={14} color={K.colors.accent} />
          <Text style={s.replyBtnText}>Reply</Text>
        </TouchableOpacity>
      ) : null}
    </Animated.View>
  );
});

const s = StyleSheet.create({
  card: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.card,
    borderWidth: 1,
    borderColor: K.colors.border,
    padding: 16,
    ...K.shadow.xs,
  },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: K.colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  guestName: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textDark, marginBottom: 3 },
  date: { fontSize: 11, color: K.colors.textMuted },
  title: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textDark, marginBottom: 4 },
  body: { fontSize: K.font.sm, color: K.colors.textMid, lineHeight: 20 },
  replyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 10,
    borderWidth: 1,
    borderColor: K.colors.accent + "60",
    borderRadius: K.radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: K.colors.accentDim,
  },
  replyBtnText: { fontSize: 12, fontWeight: "700", color: K.colors.accent },
});
