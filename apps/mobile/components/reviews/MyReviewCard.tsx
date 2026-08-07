import { memo } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ReviewStars } from "./ReviewStars";
import { ReviewReplyCard } from "./ReviewReplyCard";
import { K } from "../../constants/theme";

interface Props {
  photoUrl?: string | null;
  listingName: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  createdAt: string;
  providerReply?: string | null;
  providerRepliedAt?: string | null;
  onPress: () => void;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export const MyReviewCard = memo(function MyReviewCard({
  photoUrl,
  listingName,
  rating,
  title,
  body,
  createdAt,
  providerReply,
  providerRepliedAt,
  onPress,
}: Props) {
  return (
    <View style={s.card}>
      <TouchableOpacity style={s.listingRow} onPress={onPress} activeOpacity={0.75}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={s.thumb} />
        ) : (
          <View style={[s.thumb, s.thumbFallback]}>
            <Ionicons name="image-outline" size={18} color={K.colors.textMuted} />
          </View>
        )}
        <View style={s.listingText}>
          <Text style={s.listingName} numberOfLines={1}>{listingName}</Text>
          <Text style={s.date}>{fmtDate(createdAt)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={K.colors.textMuted} />
      </TouchableOpacity>

      <View style={s.body}>
        <ReviewStars rating={rating} size={14} />
        {title ? <Text style={s.title}>{title}</Text> : null}
        {body ? <Text style={s.comment}>{body}</Text> : <Text style={s.noComment}>No written review</Text>}
        {providerReply ? <ReviewReplyCard reply={providerReply} repliedAt={providerRepliedAt} /> : null}
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  card: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.card,
    borderWidth: 1,
    borderColor: K.colors.border,
    overflow: "hidden",
    ...K.shadow.xs,
  },
  listingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
    gap: 10,
  },
  thumb: { width: 44, height: 44, borderRadius: K.radius.md },
  thumbFallback: { backgroundColor: K.colors.bgSubtle, alignItems: "center", justifyContent: "center" },
  listingText: { flex: 1 },
  listingName: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark },
  date: { fontSize: 11, color: K.colors.textMuted, marginTop: 2 },

  body: { padding: 14, gap: 8 },
  title: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textDark },
  comment: { fontSize: K.font.sm, color: K.colors.textMid, lineHeight: 20 },
  noComment: { fontSize: K.font.sm, color: K.colors.textMuted, fontStyle: "italic" },
});
