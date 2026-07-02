import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ReviewStars } from "./ReviewStars";
import { K } from "../../constants/theme";

const REPLY_MAX = 2000;

export interface ReplyTargetReview {
  id: string;
  rating: number;
  body?: string | null;
  guestName?: string;
}

interface Props {
  review: ReplyTargetReview | null;
  visible: boolean;
  onClose: () => void;
  onSubmit: (reviewId: string, reply: string) => void;
  isSubmitting: boolean;
}

// Bottom-sheet-style modal a provider uses to reply to a guest review.
// Submits via POST /reviews/:id/reply with body `{ reply }`.
export function ProviderReplyModal({ review, visible, onClose, onSubmit, isSubmitting }: Props) {
  const [reply, setReply] = useState("");

  if (!review) return null;

  function handleSubmit() {
    if (!reply.trim()) {
      Alert.alert("Empty Reply", "Please write a reply before submitting.");
      return;
    }
    onSubmit(review!.id, reply.trim());
  }

  function handleClose() {
    setReply("");
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Reply to Review</Text>
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color={K.colors.textMid} />
              </TouchableOpacity>
            </View>

            <View style={s.reviewCtx}>
              <ReviewStars rating={review.rating} size={14} />
              {review.body ? <Text style={s.reviewBody} numberOfLines={3}>"{review.body}"</Text> : null}
              <Text style={s.reviewMeta}>— {review.guestName ?? "Guest"}</Text>
            </View>

            <Text style={s.inputLabel}>Your Response ({reply.length}/{REPLY_MAX})</Text>
            <TextInput
              style={s.input}
              value={reply}
              onChangeText={(t) => setReply(t.slice(0, REPLY_MAX))}
              placeholder="Thank the guest, address their feedback, or share something helpful for future guests…"
              placeholderTextColor={K.colors.textMuted}
              multiline
              numberOfLines={5}
              maxLength={REPLY_MAX}
              textAlignVertical="top"
              autoFocus
            />

            <TouchableOpacity
              style={[s.submitBtn, (!reply.trim() || isSubmitting) && s.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!reply.trim() || isSubmitting}
            >
              {isSubmitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.submitBtnText}>Post Reply</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: K.colors.bgCard,
    borderTopLeftRadius: K.radius.modal,
    borderTopRightRadius: K.radius.modal,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: K.colors.textDark },
  reviewCtx: {
    backgroundColor: K.colors.bgSubtle,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: K.colors.border,
    gap: 6,
  },
  reviewBody: { fontSize: 13, color: K.colors.textMid, fontStyle: "italic", lineHeight: 18 },
  reviewMeta: { fontSize: 11, color: K.colors.textMuted, fontWeight: "600" },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: K.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: K.colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: K.colors.textDark,
    backgroundColor: K.colors.bgSubtle,
    minHeight: 120,
    marginBottom: 16,
  },
  submitBtn: { backgroundColor: K.colors.darkGreen, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
