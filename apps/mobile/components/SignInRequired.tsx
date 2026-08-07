import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { K } from "../constants/theme";

/**
 * Shown in place of an account-only screen when nobody is signed in.
 *
 * Browsing and booking are open to guests, so a signed-out visitor can reach
 * these tabs. The account features behind them (trips, messages, saved,
 * rewards, profile) each need a real user record, and their endpoints reject
 * anonymous tokens — so the screen explains why and offers a way in rather than
 * rendering an error or an empty list that looks broken.
 */
export function SignInRequired({
  icon = "person-circle-outline",
  title,
  message,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
}) {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.wrap}>
        <View style={s.iconWrap}>
          <Ionicons name={icon} size={34} color={K.colors.textMuted} />
        </View>
        <Text style={s.title}>{title}</Text>
        <Text style={s.sub}>{message}</Text>

        <TouchableOpacity
          style={s.primaryBtn}
          onPress={() => router.push("/(auth)/login" as any)}
          activeOpacity={0.85}
        >
          <Text style={s.primaryBtnText}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.secondaryBtn}
          onPress={() => router.push("/(auth)/register" as any)}
          activeOpacity={0.85}
        >
          <Text style={s.secondaryBtnText}>Create an account</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: K.colors.bgApp },
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 10 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: K.colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: { fontSize: 18, fontWeight: "700", color: K.colors.textDark, textAlign: "center" },
  sub: { fontSize: 13.5, color: K.colors.textMuted, textAlign: "center", lineHeight: 19, marginBottom: 10 },
  primaryBtn: {
    backgroundColor: K.colors.darkGreen,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 48,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondaryBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  secondaryBtnText: { color: K.colors.darkGreen, fontSize: 14, fontWeight: "600" },
});
