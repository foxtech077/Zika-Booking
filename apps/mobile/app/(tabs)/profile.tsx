import {
  View,
  Text,
  Alert,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/auth";
import { K } from "../../constants/theme";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tier = "bronze" | "silver" | "gold" | "diamond";

const TIER_COLORS: Record<Tier, string> = {
  bronze:  "#cd7f32",
  silver:  "#9ca3af",
  gold:    K.colors.gold,
  diamond: "#38bdf8",
};

const TIER_ICON: Record<Tier, string> = {
  bronze:  "shield-outline",
  silver:  "shield-half-outline",
  gold:    "shield",
  diamond: "diamond-outline",
};

function normalizeTier(tier: string | undefined): Tier {
  const t = (tier ?? "bronze").toLowerCase();
  if (t === "silver" || t === "gold" || t === "diamond") return t as Tier;
  return "bronze";
}

// ── Menu Item ─────────────────────────────────────────────────────────────────

function MenuItem({
  iconName,
  label,
  sublabel,
  onPress,
  danger,
  showBorder = true,
}: {
  iconName: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
  showBorder?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[s.menuItem, showBorder && s.menuItemBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[s.menuIconCircle, danger && s.menuIconCircleDanger]}>
        <Ionicons
          name={iconName as any}
          size={18}
          color={danger ? K.colors.error : K.colors.darkGreen}
        />
      </View>
      <View style={s.menuText}>
        <Text style={[s.menuLabel, danger && s.menuLabelDanger]}>{label}</Text>
        {sublabel ? <Text style={s.menuSublabel}>{sublabel}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={K.colors.textMuted} />
    </TouchableOpacity>
  );
}

// ── Menu Group ────────────────────────────────────────────────────────────────

function MenuGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={s.menuGroup}>
      {title ? <Text style={s.menuGroupTitle}>{title}</Text> : null}
      <View style={s.menuCard}>{children}</View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, clearAuth } = useAuthStore();

  const logoutMutation = useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSettled:  async () => {
      await clearAuth();
      router.replace("/(auth)/login");
    },
  });

  const logoutAllMutation = useMutation({
    mutationFn: () => api.post("/auth/logout-all"),
    onSettled:  async () => {
      await clearAuth();
      router.replace("/(auth)/login");
    },
  });

  const tier     = normalizeTier((user as any)?.currentTier);
  const points   = (user as any)?.loyaltyPoints ?? 0;
  const tierColor = TIER_COLORS[tier];
  const initial  = (user?.firstName?.[0] ?? "?").toUpperCase();

  function confirmLogoutAll() {
    Alert.alert(
      "Sign out everywhere?",
      "All your sessions on all devices will be ended.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out all", style: "destructive", onPress: () => logoutAllMutation.mutate() },
      ]
    );
  }

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Profile Header ── */}
        <View style={s.profileHeader}>
          {/* Avatar */}
          <View style={[s.avatar, { borderColor: tierColor }]}>
            <Text style={s.avatarText}>{initial}</Text>
          </View>

          {/* Name + email */}
          <Text style={s.displayName}>
            {user?.firstName ?? ""} {user?.lastName ?? ""}
          </Text>
          <Text style={s.displayEmail}>{user?.email}</Text>

          {/* Tier badge */}
          <View style={[s.tierBadge, { backgroundColor: tierColor + "20", borderColor: tierColor + "50" }]}>
            <Ionicons name={TIER_ICON[tier] as any} size={13} color={tierColor} />
            <Text style={[s.tierLabel, { color: tierColor }]}>
              {tier.toUpperCase()} · {points.toLocaleString()} pts
            </Text>
          </View>

          {/* Edit profile button */}
          <TouchableOpacity
            style={s.editBtn}
            onPress={() => router.push("/edit-profile" as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="pencil-outline" size={14} color={K.colors.darkGreen} />
            <Text style={s.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* ── Quick Stats ── */}
        <View style={s.statsRow}>
          <TouchableOpacity style={s.statCell} onPress={() => router.push("/(tabs)/bookings" as any)} activeOpacity={0.75}>
            <Ionicons name="airplane-outline" size={20} color={K.colors.darkGreen} />
            <Text style={s.statLabel}>Trips</Text>
            <Ionicons name="chevron-forward" size={12} color={K.colors.textMuted} />
          </TouchableOpacity>
          <View style={s.statDivider} />
          <TouchableOpacity style={s.statCell} onPress={() => router.push("/(tabs)/saved" as any)} activeOpacity={0.75}>
            <Ionicons name="bookmark-outline" size={20} color={K.colors.darkGreen} />
            <Text style={s.statLabel}>Saved</Text>
            <Ionicons name="chevron-forward" size={12} color={K.colors.textMuted} />
          </TouchableOpacity>
          <View style={s.statDivider} />
          <TouchableOpacity style={s.statCell} onPress={() => router.push("/(tabs)/loyalty" as any)} activeOpacity={0.75}>
            <Ionicons name="star-outline" size={20} color={K.colors.darkGreen} />
            <Text style={s.statLabel}>Rewards</Text>
            <Ionicons name="chevron-forward" size={12} color={K.colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── Account Menu ── */}
        <MenuGroup title="Account">
          <MenuItem
            iconName="person-outline"
            label="Edit Profile"
            sublabel="Name, phone, bio"
            onPress={() => router.push("/edit-profile" as any)}
          />
          <MenuItem
            iconName="card-outline"
            label="Payment Methods"
            sublabel="Cards & mobile money"
            onPress={() => router.push("/payment-methods/index" as any)}
          />
          <MenuItem
            iconName="pricetag-outline"
            label="Voucher Wallet"
            sublabel="Promo codes & discounts"
            onPress={() => router.push("/voucher-wallet" as any)}
          />
          <MenuItem
            iconName="star-outline"
            label="My Reviews"
            sublabel="Reviews you've written"
            onPress={() => router.push("/my-reviews" as any)}
          />
          <MenuItem
            iconName="lock-closed-outline"
            label="Change Password"
            sublabel="Update your security"
            onPress={() => router.push("/reset-password" as any)}
            showBorder={false}
          />
        </MenuGroup>

        {/* ── Preferences Menu ── */}
        <MenuGroup title="Preferences">
          <MenuItem
            iconName="notifications-outline"
            label="Notifications"
            sublabel="Push, email & SMS alerts"
            onPress={() => router.push("/notifications" as any)}
          />
          <MenuItem
            iconName="globe-outline"
            label="Currency & Language"
            sublabel="Localise your experience"
            onPress={() =>
              Alert.alert("Coming Soon", "Currency and language settings are coming soon.", [{ text: "OK" }])
            }
            showBorder={false}
          />
        </MenuGroup>

        {/* ── Support Menu ── */}
        <MenuGroup title="Support">
          <MenuItem
            iconName="help-circle-outline"
            label="Help Center"
            sublabel="FAQs and guides"
            onPress={() => router.push("/help" as any)}
          />
          <MenuItem
            iconName="chatbubble-outline"
            label="Contact Us"
            sublabel="Get in touch with our team"
            onPress={() =>
              Alert.alert("Coming Soon", "In-app support messaging is coming soon.", [{ text: "OK" }])
            }
          />
          <MenuItem
            iconName="information-circle-outline"
            label="About Kainook"
            sublabel="Version 2.4.0"
            onPress={() =>
              Alert.alert("Kainook", "Version 2.4.0\nBuilt with love for African travellers.", [{ text: "OK" }])
            }
            showBorder={false}
          />
        </MenuGroup>

        {/* ── Legal Menu ── */}
        <MenuGroup title="Legal">
          <MenuItem
            iconName="document-text-outline"
            label="Terms & Conditions"
            sublabel="Our terms of use"
            onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "terms" } } as any)}
          />
          <MenuItem
            iconName="shield-checkmark-outline"
            label="Privacy Policy"
            sublabel="How we handle your data"
            onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "privacy" } } as any)}
            showBorder={false}
          />
        </MenuGroup>

        {/* ── Sign Out ── */}
        <MenuGroup>
          <MenuItem
            iconName="log-out-outline"
            label={logoutMutation.isPending ? "Signing out…" : "Sign Out"}
            onPress={() => logoutMutation.mutate()}
            danger
          />
          <MenuItem
            iconName="phone-portrait-outline"
            label={logoutAllMutation.isPending ? "Signing out…" : "Sign Out All Devices"}
            onPress={confirmLogoutAll}
            danger
            showBorder={false}
          />
        </MenuGroup>

        <Text style={s.versionText}>KAINOOK v2.4.0 · Traveller</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgApp },
  scroll:    { paddingBottom: 60 },

  // Profile header
  profileHeader: {
    backgroundColor: K.colors.bgCard,
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: K.spacing.screen,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
    marginBottom: 16,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.darkGreen,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    marginBottom: 14,
    ...K.shadow.brand,
  },
  avatarText:   { fontSize: 34, fontWeight: "800", color: "#fff" },
  displayName:  { fontSize: K.font.xxl, fontWeight: "800", color: K.colors.textDark, letterSpacing: -0.3, marginBottom: 4 },
  displayEmail: { fontSize: K.font.sm, color: K.colors.textMuted, marginBottom: 12 },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: K.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  tierLabel: { fontSize: 12, fontWeight: "700" },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: K.colors.darkGreen,
    borderRadius: K.radius.full,
    paddingVertical: 9,
    paddingHorizontal: 20,
  },
  editBtnText: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.darkGreen },

  // Quick stats
  statsRow: {
    flexDirection: "row",
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    marginHorizontal: K.spacing.screen,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: K.colors.border,
    overflow: "hidden",
    ...K.shadow.xs,
  },
  statCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 16,
  },
  statLabel: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textMid },
  statDivider: { width: 1, backgroundColor: K.colors.border, marginVertical: 12 },

  // Menu groups
  menuGroup: {
    marginHorizontal: K.spacing.screen,
    marginBottom: 20,
  },
  menuGroupTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: K.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  menuCard: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    borderWidth: 1,
    borderColor: K.colors.border,
    overflow: "hidden",
    ...K.shadow.xs,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 14,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
  },
  menuIconCircle: {
    width: 38,
    height: 38,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.bgTint,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconCircleDanger: { backgroundColor: "#FEE2E2" },
  menuText:       { flex: 1 },
  menuLabel:      { fontSize: K.font.base, fontWeight: "600", color: K.colors.textDark },
  menuLabelDanger: { color: K.colors.error },
  menuSublabel:   { fontSize: 12, color: K.colors.textMuted, marginTop: 2 },

  versionText: {
    textAlign: "center",
    fontSize: 11,
    color: K.colors.textMuted,
    marginTop: 8,
    marginBottom: 20,
  },
});
