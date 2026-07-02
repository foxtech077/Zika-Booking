import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/auth";
import { useProfileScreenData } from "../../hooks/profile";
import { normalizeTier } from "../../constants/loyaltyTiers";
import { K } from "../../constants/theme";
import { ProfileHeader } from "../../components/profile/ProfileHeader";
import { MembershipCard } from "../../components/profile/MembershipCard";
import { ProfileStats, type StatItem } from "../../components/profile/ProfileStats";
import { SettingsSection } from "../../components/profile/SettingsSection";
import { MenuRow } from "../../components/profile/MenuRow";
import { ProfileSkeleton } from "../../components/profile/ProfileSkeleton";

export default function ProfileScreen() {
  const storeUser = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { data, isLoading, isError, isFetching, refetch } = useProfileScreenData();

  const logoutMutation = useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSettled: async () => {
      await clearAuth();
      router.replace("/(auth)/login");
    },
  });

  // Show the store's cached user immediately (avoids a blank screen on first
  // paint) and swap in fresh /auth/me + /auth/profile data once it lands.
  const tier = normalizeTier(data?.currentTier ?? storeUser?.currentTier);
  const points = data?.loyaltyPoints ?? storeUser?.loyaltyPoints ?? 0;
  const firstName = data?.firstName ?? storeUser?.firstName ?? "";
  const lastName = data?.lastName ?? storeUser?.lastName ?? "";
  const email = data?.email ?? storeUser?.email ?? "";
  const photoUrl = data?.photoUrl ?? storeUser?.photoUrl ?? null;
  const verified = data?.emailVerified ?? storeUser?.emailVerified ?? false;

  const stats: StatItem[] = [
    { key: "trips", icon: "airplane-outline", label: "Trips", onPress: () => router.push("/(tabs)/bookings" as any) },
    { key: "saved", icon: "bookmark-outline", label: "Saved", onPress: () => router.push("/(tabs)/saved" as any) },
    { key: "rewards", icon: "star-outline", label: "Rewards", onPress: () => router.push("/(tabs)/loyalty" as any) },
  ];

  const showSkeleton = isLoading && !storeUser;

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={K.colors.accent} />}
      >
        {showSkeleton ? (
          <ProfileSkeleton />
        ) : (
          <>
            <ProfileHeader
              photoUrl={photoUrl}
              firstName={firstName}
              lastName={lastName}
              email={email}
              tier={tier}
              roleLabel="Traveller"
              verified={verified}
              onEditPress={() => router.push("/edit-profile" as any)}
            />

            {isError && !storeUser ? (
              <View style={s.errorCard}>
                <Ionicons name="cloud-offline-outline" size={32} color={K.colors.textMuted} />
                <Text style={s.errorText}>Could not load your profile.</Text>
              </View>
            ) : (
              <View style={{ gap: 16, marginBottom: 4 }}>
                <MembershipCard
                  tier={tier}
                  points={points}
                  nextTier={data?.nextTier ?? null}
                  pointsToNextTier={data?.pointsToNextTier ?? null}
                />
                <ProfileStats items={stats} />
              </View>
            )}

            <View style={{ height: 4 }} />

            <SettingsSection title="Account">
              <MenuRow icon="person-outline" label="Personal Information" sublabel="Name & contact details" onPress={() => router.push("/edit-profile" as any)} showBorder={false} />
            </SettingsSection>

            <SettingsSection title="Membership & Rewards">
              <MenuRow icon="star-outline" label="Membership & Rewards" sublabel={`${tier.charAt(0).toUpperCase() + tier.slice(1)} tier · ${points.toLocaleString()} pts`} onPress={() => router.push("/(tabs)/loyalty" as any)} />
              <MenuRow icon="pricetag-outline" label="Voucher Wallet" sublabel="Promo codes & discounts" onPress={() => router.push("/voucher-wallet" as any)} />
              <MenuRow icon="chatbox-ellipses-outline" label="My Reviews" sublabel="Reviews you've written" onPress={() => router.push("/my-reviews" as any)} showBorder={false} />
            </SettingsSection>

            <SettingsSection title="Saved Listings & Trips">
              <MenuRow icon="airplane-outline" label="Trips" sublabel="Upcoming & past bookings" onPress={() => router.push("/(tabs)/bookings" as any)} />
              <MenuRow icon="bookmark-outline" label="Saved Listings" sublabel="Places you've bookmarked" onPress={() => router.push("/(tabs)/saved" as any)} showBorder={false} />
            </SettingsSection>

            <SettingsSection title="Preferences">
              <MenuRow icon="notifications-outline" label="Notifications" sublabel="Push, email & SMS alerts" onPress={() => router.push("/notifications" as any)} showBorder={false} />
            </SettingsSection>

            <SettingsSection title="Support & Legal">
              <MenuRow icon="help-circle-outline" label="Help & Support" sublabel="FAQs and guides" onPress={() => router.push("/help" as any)} />
              <MenuRow icon="document-text-outline" label="Terms & Conditions" sublabel="Our terms of use" onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "terms" } } as any)} showBorder={false} />
            </SettingsSection>

            <SettingsSection>
              <MenuRow
                icon="log-out-outline"
                label={logoutMutation.isPending ? "Signing out…" : "Sign Out"}
                onPress={() => logoutMutation.mutate()}
                danger
                showBorder={false}
              />
            </SettingsSection>

            <Text style={s.versionText}>KAINOOK v2.4.0 · Traveller</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgApp },
  scroll: { paddingBottom: 60 },
  errorCard: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    padding: 24,
    marginHorizontal: K.spacing.screen,
    marginBottom: 16,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: K.colors.border,
  },
  errorText: { fontSize: K.font.sm, color: K.colors.textMuted },
  versionText: {
    textAlign: "center",
    fontSize: 11,
    color: K.colors.textMuted,
    marginTop: 8,
    marginBottom: 20,
  },
});
