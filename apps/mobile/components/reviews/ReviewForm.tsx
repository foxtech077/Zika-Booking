import { View, Text, TextInput, StyleSheet } from "react-native";
import { ReviewStars } from "./ReviewStars";
import { K } from "../../constants/theme";

const TITLE_MAX = 100;
const BODY_MAX = 2000;

const RATING_HINT = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

interface Props {
  rating: number;
  onRatingChange: (r: number) => void;
  title: string;
  onTitleChange: (t: string) => void;
  body: string;
  onBodyChange: (b: string) => void;
}

export function ReviewForm({ rating, onRatingChange, title, onTitleChange, body, onBodyChange }: Props) {
  return (
    <View style={{ gap: 20 }}>
      <View>
        <Text style={s.label}>Overall Rating *</Text>
        <ReviewStars rating={rating} onChange={onRatingChange} size={38} gap={8} />
        {rating > 0 ? <Text style={s.ratingHint}>{RATING_HINT[rating]}</Text> : null}
      </View>

      <View>
        <Text style={s.label}>Review Title ({title.length}/{TITLE_MAX})</Text>
        <TextInput
          style={s.input}
          value={title}
          onChangeText={(t) => onTitleChange(t.slice(0, TITLE_MAX))}
          placeholder="Summarize your experience (optional)"
          placeholderTextColor={K.colors.textMuted}
          maxLength={TITLE_MAX}
        />
      </View>

      <View>
        <Text style={s.label}>Review Description ({body.length}/{BODY_MAX})</Text>
        <TextInput
          style={[s.input, s.textArea]}
          value={body}
          onChangeText={(t) => onBodyChange(t.slice(0, BODY_MAX))}
          placeholder="Tell others about your experience (optional)"
          placeholderTextColor={K.colors.textMuted}
          multiline
          numberOfLines={6}
          maxLength={BODY_MAX}
          textAlignVertical="top"
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textMid, marginBottom: 10 },
  ratingHint: { fontSize: K.font.sm, color: K.colors.textMuted, marginTop: 8, fontWeight: "500" },
  input: {
    borderWidth: 1,
    borderColor: K.colors.border,
    borderRadius: K.radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: K.font.sm,
    color: K.colors.textDark,
    backgroundColor: K.colors.bgCard,
  },
  textArea: { minHeight: 130 },
});
