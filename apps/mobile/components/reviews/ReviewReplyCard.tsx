import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { K } from "../../constants/theme";

interface Props {
  reply: string;
  repliedAt?: string | null;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function ReviewReplyCard({ reply, repliedAt }: Props) {
  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Ionicons name="return-down-forward-outline" size={14} color={K.colors.accent} />
        <Text style={s.label}>Host Reply</Text>
        {repliedAt ? <Text style={s.date}>{fmtDate(repliedAt)}</Text> : null}
      </View>
      <Text style={s.body}>{reply}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    marginTop: 10,
    backgroundColor: K.colors.accentDim,
    borderRadius: K.radius.md,
    borderWidth: 1,
    borderColor: K.colors.accent + "30",
    padding: 12,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  label: { fontSize: 12, fontWeight: "700", color: K.colors.accent, flex: 1 },
  date: { fontSize: 11, color: K.colors.textMuted },
  body: { fontSize: K.font.sm, color: K.colors.textMid, lineHeight: 20 },
});
