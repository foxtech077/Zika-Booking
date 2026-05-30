import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../store/auth";
import { K } from "../constants/theme";
import { router } from "expo-router";

const { width } = Dimensions.get("window");

export default function PendingApprovalScreen() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const user = useAuthStore((s) => s.user);

  const handleSignOut = async () => {
    await clearAuth();
    router.replace("/(auth)/login");
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
          <Text style={styles.iconEmoji}>⏳</Text>
        </View>

        {/* Message */}
        <Text style={styles.title}>Application Pending</Text>
        <Text style={styles.subtitle}>
          Welcome, <Text style={styles.highlight}>{user?.firstName ?? "Partner"}</Text>! Your partner account application is currently undergoing active review by our administration team.
        </Text>

        {/* Information box */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What happens next?</Text>
          <Text style={styles.infoText}>
            • Verification typically takes 24-48 business hours.{"\n"}
            • We will verify your business license, address, and listing information.{"\n"}
            • You'll receive a push notification and email confirmation once your account is activated.
          </Text>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <Text style={styles.signOutBtnText}>Sign Out of Account</Text>
        </TouchableOpacity>
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
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
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
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: K.radius.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 20,
    marginBottom: 44,
  },
  infoTitle: {
    fontSize: K.font.sm,
    fontWeight: "700",
    color: K.colors.accentLight,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  infoText: {
    fontSize: K.font.sm,
    color: K.colors.textLightMuted,
    lineHeight: 20,
  },
  signOutBtn: {
    width: width - 56,
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
