import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../store/auth";
import { K } from "../constants/theme";
import { router } from "expo-router";

const { width } = Dimensions.get("window");

export default function SuspendedScreen() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const user = useAuthStore((s) => s.user);

  const handleSignOut = async () => {
    await clearAuth();
    router.replace("/(auth)/login");
  };

  const handleContactSupport = () => {
    Linking.openURL("mailto:support@kainook.com?subject=Account%20Inquiry%20-%20" + user?.email).catch(() => null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Brand Header */}
        <View style={styles.brandRow}>
          <View style={styles.logoContainer}>
            <Image
              source={require("../assets/logo.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Dynamic decorative element */}
        <View style={styles.iconCircle}>
          <Text style={styles.iconEmoji}>⚠️</Text>
        </View>

        {/* Message */}
        <Text style={styles.title}>Account Restricted</Text>
        <Text style={styles.subtitle}>
          The partner profile associated with <Text style={styles.highlight}>{user?.email}</Text> has been suspended or restricted.
        </Text>

        {/* Information box */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Why am I seeing this?</Text>
          <Text style={styles.infoText}>
            This status is usually applied due to verification anomalies, compliance audits, or repeated violations of Kainook's hosting policies.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.btnColumn}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleContactSupport} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Contact Partner Support</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
            <Text style={styles.signOutBtnText}>Sign Out of Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: K.colors.darkGreen,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  brandRow: {
    position: "absolute",
    top: 32,
    left: 24,
  },
  logoContainer: {
    width: 90,
    height: 90,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  logoImage: { width: 82, height: 82 },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  iconEmoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: K.font.base,
    color: K.colors.textLightMuted,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 12,
    marginBottom: 36,
  },
  highlight: {
    color: "#fff",
    fontWeight: "700",
  },
  infoCard: {
    width: "100%",
    backgroundColor: "rgba(239,68,68,0.06)",
    borderRadius: K.radius.xl,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.15)",
    padding: 20,
    marginBottom: 44,
  },
  infoTitle: {
    fontSize: K.font.sm,
    fontWeight: "700",
    color: "#FCA5A5",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  infoText: {
    fontSize: K.font.sm,
    color: K.colors.textLightMuted,
    lineHeight: 20,
  },
  btnColumn: {
    width: "100%",
    gap: 12,
  },
  primaryBtn: {
    width: "100%",
    height: 52,
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: K.font.base,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  signOutBtn: {
    width: "100%",
    height: 52,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: K.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutBtnText: {
    color: "#fff",
    fontSize: K.font.base,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
