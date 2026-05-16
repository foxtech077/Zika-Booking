import { View, Text, Alert, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/auth";
import { Button } from "../../components/ui/Button";

// ── Loyalty helpers ───────────────────────────────────────────────────────────

type Tier = "bronze" | "silver" | "gold" | "diamond";

const TIER_COLORS: Record<Tier, string> = {
  bronze: "#cd7f32",
  silver: "#c0c0c0",
  gold: "#ffd700",
  diamond: "#b9f2ff",
};

const TIER_NEXT_THRESHOLD: Record<Tier, number | null> = {
  bronze: 1000,
  silver: 5000,
  gold: 15000,
  diamond: null,
};

function normalizeTier(tier: string | undefined): Tier {
  const t = (tier ?? "bronze").toLowerCase();
  if (t === "silver" || t === "gold" || t === "diamond") return t as Tier;
  return "bronze";
}

function progressToNextTier(points: number, tier: Tier): { pct: number; ptsNeeded: number | null; nextTierLabel: string | null } {
  const currentFloor: Record<Tier, number> = { bronze: 0, silver: 1000, gold: 5000, diamond: 15000 };
  const nextThreshold = TIER_NEXT_THRESHOLD[tier];
  if (nextThreshold === null) return { pct: 1, ptsNeeded: null, nextTierLabel: null };

  const tierLabels: Record<Tier, string> = { bronze: "Silver", silver: "Gold", gold: "Diamond", diamond: "" };
  const floor = currentFloor[tier];
  const span = nextThreshold - floor;
  const progress = Math.max(0, Math.min(points - floor, span));
  const pct = span > 0 ? progress / span : 0;
  const ptsNeeded = Math.max(0, nextThreshold - points);

  return { pct, ptsNeeded, nextTierLabel: tierLabels[tier] };
}

// ── Loyalty Card ──────────────────────────────────────────────────────────────

function LoyaltyCard({ points, tier }: { points: number; tier: Tier }) {
  const color = TIER_COLORS[tier];
  const { pct, ptsNeeded, nextTierLabel } = progressToNextTier(points, tier);
  const tierLabel = tier.toUpperCase();

  return (
    <View style={[styles.loyaltyCard, { borderColor: color }]}>
      <View style={styles.loyaltyHeader}>
        <View style={[styles.tierBadge, { backgroundColor: color }]}>
          <Text style={styles.tierBadgeText}>{tierLabel} TIER</Text>
        </View>
        <Text style={styles.loyaltyPoints}>
          {points.toLocaleString()} pts
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: color }]} />
      </View>

      <Text style={styles.loyaltyFooter}>
        {ptsNeeded !== null && nextTierLabel
          ? `${ptsNeeded.toLocaleString()} pts to ${nextTierLabel}`
          : "Max tier reached"}
      </Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, clearAuth } = useAuthStore();

  const logoutMutation = useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSettled: async () => {
      await clearAuth();
      router.replace("/(auth)/login");
    },
  });

  const logoutAllMutation = useMutation({
    mutationFn: () => api.post("/auth/logout-all"),
    onSettled: async () => {
      await clearAuth();
      router.replace("/(auth)/login");
    },
  });

  const tier = normalizeTier((user as any)?.currentTier);
  const points = (user as any)?.loyaltyPoints ?? 0;

  return (
    <View style={styles.container}>
      <Text style={styles.name}>
        {user?.firstName} {user?.lastName}
      </Text>
      <Text style={styles.email}>{user?.email}</Text>
      <Text style={styles.meta}>{user?.userType} · {tier} tier</Text>

      <LoyaltyCard points={points} tier={tier} />

      <Button
        title="Sign Out"
        variant="secondary"
        onPress={() => logoutMutation.mutate()}
        loading={logoutMutation.isPending}
      />
      <View style={styles.logoutAllWrapper}>
        <Button
          title="Sign out of all devices"
          variant="ghost"
          onPress={() =>
            Alert.alert(
              "Sign out everywhere?",
              "All your sessions on all devices will be ended.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Sign out all", style: "destructive", onPress: () => logoutAllMutation.mutate() },
              ]
            )
          }
          loading={logoutAllMutation.isPending}
        />
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  name: { fontSize: 24, fontWeight: "800", color: "#111827", marginBottom: 4 },
  email: { fontSize: 15, color: "#6b7280", marginBottom: 4 },
  meta: { fontSize: 13, color: "#9ca3af", marginBottom: 24, textTransform: "capitalize" },

  // Loyalty card
  loyaltyCard: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 28,
    backgroundColor: "#fafafa",
  },
  loyaltyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  tierBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: 0.5,
  },
  loyaltyPoints: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  progressTrack: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
    minWidth: 4,
  },
  loyaltyFooter: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },

  logoutAllWrapper: { marginTop: 12 },
});
