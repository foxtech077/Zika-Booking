import { View, Text, StyleSheet } from "react-native";
import { K } from "../../constants/theme";

interface Props {
  title?: string;
  children: React.ReactNode;
}

export function SettingsSection({ title, children }: Props) {
  return (
    <View style={s.wrap}>
      {title ? <Text style={s.title}>{title}</Text> : null}
      <View style={s.card}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: K.spacing.screen, marginBottom: 20 },
  title: {
    fontSize: 11,
    fontWeight: "700",
    color: K.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    borderWidth: 1,
    borderColor: K.colors.border,
    overflow: "hidden",
    ...K.shadow.xs,
  },
});
