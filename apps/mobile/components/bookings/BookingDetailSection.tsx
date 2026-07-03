import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { K } from "../../constants/theme";

/** Generic card-with-title wrapper — presentational only, replaces the old ad hoc SectionCard. */
export function BookingDetailSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  children: React.ReactNode;
}) {
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={s.cardIcon}>
          <Feather name={icon} size={13} color={K.colors.accent} />
        </View>
        <Text style={s.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

/** Label/value row used inside detail sections. */
export function BookingDetailRow({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, green && s.rowValueGreen]}>{value}</Text>
    </View>
  );
}

export interface TimelineEvent {
  label: string;
  date?: string;
  done: boolean;
}

function fmtFull(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Vertical timeline with a connecting line — same event data/derivation the screen already computes. */
export function BookingTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <View>
      {events.map((ev, i) => (
        <View key={ev.label} style={s.tlItem}>
          <View style={s.tlLeft}>
            <View style={[s.tlDot, ev.done && s.tlDotDone]} />
            {i < events.length - 1 && <View style={[s.tlLine, ev.done && s.tlLineDone]} />}
          </View>
          <View style={s.tlRight}>
            <Text style={[s.tlLabel, ev.done && s.tlLabelDone]}>{ev.label}</Text>
            <Text style={s.tlDate}>{ev.date ? fmtFull(ev.date) : "Pending"}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: K.colors.bgCard, borderRadius: K.radius.xl,
    borderWidth: 1, borderColor: K.colors.border,
    padding: 16, marginHorizontal: 16, marginTop: 12,
    ...K.shadow.sm,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  cardIcon: {
    width: 26, height: 26, borderRadius: K.radius.sm,
    backgroundColor: K.colors.bgTint, alignItems: "center", justifyContent: "center",
  },
  cardTitle: { fontSize: 10, fontWeight: "800", color: K.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8 },

  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: K.colors.border,
  },
  rowLabel: { fontSize: K.font.sm, color: K.colors.textMuted, flex: 1 },
  rowValue: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textDark, textAlign: "right" },
  rowValueGreen: { color: K.colors.darkGreen, fontWeight: "800" },

  tlItem: { flexDirection: "row", gap: 12, minHeight: 52 },
  tlLeft: { alignItems: "center", width: 16 },
  tlDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: K.colors.border, borderWidth: 2, borderColor: K.colors.border, marginTop: 2,
  },
  tlDotDone: { backgroundColor: K.colors.accent, borderColor: K.colors.accent },
  tlLine: { flex: 1, width: 2, backgroundColor: K.colors.border, marginVertical: 2 },
  tlLineDone: { backgroundColor: K.colors.accent },
  tlRight: { flex: 1, paddingBottom: 12 },
  tlLabel: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textMuted },
  tlLabelDone: { color: K.colors.textDark },
  tlDate: { fontSize: 11, color: K.colors.textMuted, marginTop: 2 },
});
