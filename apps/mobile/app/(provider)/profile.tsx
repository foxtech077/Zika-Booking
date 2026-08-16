import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { AppLayout } from "../../components/layout/AppLayout";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth";
import { K } from "../../constants/theme";

// ── Menu Row ──────────────────────────────────────────────────────────────────

function MenuRow({ iconName, iconBg, label, sub, onPress, danger }: {
  iconName: string; iconBg: string; label: string; sub?: string;
  onPress: () => void; danger?: boolean;
}) {
  return (
    <TouchableOpacity style={mr.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[mr.icon, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName as any} size={18} color={danger ? "#dc2626" : K.colors.darkGreen} />
      </View>
      <View style={mr.body}>
        <Text style={[mr.label, danger && mr.labelDanger]}>{label}</Text>
        {sub ? <Text style={mr.sub}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color="#C8CCC9" />
    </TouchableOpacity>
  );
}

const mr = StyleSheet.create({
  row:        { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 14 },
  icon:       { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  body:       { flex: 1 },
  label:      { fontSize: 15, fontWeight: "600", color: K.colors.textDark },
  labelDanger: { color: "#dc2626" },
  sub:        { fontSize: 12, color: K.colors.textMuted, marginTop: 2 },
});

// ── Menu Card + Divider ───────────────────────────────────────────────────────

function MenuCard({ children }: { children: React.ReactNode }) {
  return <View style={mc.card}>{children}</View>;
}

function MenuDivider() {
  return <View style={{ height: 1, backgroundColor: K.colors.border, marginHorizontal: 16 }} />;
}

const mc = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: K.colors.border,
    overflow: "hidden",
    ...K.shadow.sm,
  },
});

function comingSoon(feature: string) {
  Alert.alert(feature, "This feature is coming soon. We're working on it!", [{ text: "Got it" }]);
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const user      = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const initials = ((user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "")).toUpperCase() || "P";

  function handleLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await clearAuth();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  return (
    <AppLayout>
      <ScrollView
        style={{ flex: 1, backgroundColor: "#F5F4F1" }}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile hero */}
        <View style={s.hero}>
          <View style={s.avatar}>
            <Text style={s.avatarInitials}>{initials}</Text>
          </View>
          <Text style={s.userName}>{user?.firstName} {user?.lastName}</Text>
          {user?.businessName ? (
            <Text style={s.businessName}>{user.businessName}</Text>
          ) : null}
          <View style={s.providerBadge}>
            <Ionicons name="shield-checkmark" size={11} color="#34d399" />
            <Text style={s.providerBadgeText}>Verified Provider</Text>
          </View>
        </View>

        {/* Mirrors web's "Back to Kainook" (TopBar.tsx) — the way out of the
            hosting tab bar back to the traveller one. There is no separate
            provider account, so this is a return trip, not a sign-out. */}
        <MenuCard>
          <MenuRow
            iconName="home-outline"
            iconBg="#f0fdf4"
            label="Back to Kainook"
            sub="Switch to travelling"
            onPress={() => router.replace("/(tabs)" as any)}
          />
        </MenuCard>

        <Text style={s.sectionLabel}>LISTINGS</Text>
        <MenuCard>
          <MenuRow iconName="star-outline"     iconBg="#fffbeb" label="My Reviews"    sub="Guest ratings & your replies"    onPress={() => router.push("/(provider)/reviews" as any)} />
          <MenuDivider />
          <MenuRow iconName="calendar-outline" iconBg="#eff6ff" label="Calendar Sync" sub="iCal feeds & integrations"       onPress={() => router.push("/(provider)/channels" as any)} />
        </MenuCard>

        <Text style={s.sectionLabel}>FINANCIAL</Text>
        <MenuCard>
          <MenuRow iconName="card-outline"    iconBg="#f0fdf4" label="Payout Setup"    sub="Bank, mobile money, or Stripe payouts" onPress={() => router.push("/(provider)/stripe-connect" as any)} />
          <MenuDivider />
          <MenuRow iconName="wallet-outline"  iconBg="#f0fdf4" label="Payout History"  sub="Scheduled & processed payouts" onPress={() => router.push("/(provider)/payouts" as any)} />
          <MenuDivider />
          <MenuRow iconName="receipt-outline" iconBg="#fffbeb" label="Tax Information" sub="Tax ID & certificates"         onPress={() => comingSoon("Tax Information")} />
        </MenuCard>

        <Text style={s.sectionLabel}>ACCOUNT</Text>
        <MenuCard>
          <MenuRow iconName="document-text-outline" iconBg="#eff6ff" label="Verification Docs" sub="Upload required documents" onPress={() => comingSoon("Verification Documents")} />
          <MenuDivider />
          <MenuRow iconName="notifications-outline" iconBg="#f5f3ff" label="Notifications"      sub="Push & email preferences"  onPress={() => router.push("/notifications" as any)} />
          <MenuDivider />
          <MenuRow iconName="help-circle-outline"   iconBg="#f0fdf4" label="Help & Support"     sub="FAQs, contact us"          onPress={() => router.push("/help" as any)} />
        </MenuCard>

        <Text style={s.sectionLabel}>LEGAL</Text>
        <MenuCard>
          <MenuRow iconName="document-text-outline"    iconBg="#eff6ff" label="Terms & Conditions" sub="Our terms of use"         onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "terms" } } as any)} />
          <MenuDivider />
          <MenuRow iconName="shield-checkmark-outline" iconBg="#f0fdf4" label="Privacy Policy"     sub="How we handle your data"  onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "privacy" } } as any)} />
        </MenuCard>

        <MenuCard>
          <MenuRow iconName="log-out-outline" iconBg="#fef2f2" label="Sign Out" onPress={handleLogout} danger />
        </MenuCard>

        <Text style={s.versionText}>KAINOOK v2.4.0 · Provider</Text>
      </ScrollView>
    </AppLayout>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  hero: {
    backgroundColor: K.colors.darkGreen,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
    alignItems: "center",
    marginBottom: 4,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: K.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.25)",
    ...K.shadow.md,
  },
  avatarInitials:    { fontSize: 32, fontWeight: "900", color: "#fff" },
  userName:          { fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 3, letterSpacing: -0.3 },
  businessName:      { fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8 },
  providerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  providerBadgeText: { fontSize: 11, color: "#34d399", fontWeight: "700" },

  content:      { padding: 16, paddingBottom: 48, gap: 12 },
  sectionLabel: { fontSize: 10, fontWeight: "800", color: K.colors.textMuted, letterSpacing: 1.0, marginTop: 4, marginBottom: 8 },
  versionText:  { textAlign: "center", fontSize: 11, color: K.colors.textMuted, marginTop: 8 },
});
