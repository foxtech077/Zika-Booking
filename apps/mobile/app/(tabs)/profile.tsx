import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/auth";
import { useProfileScreenData, useDeleteAccount } from "../../hooks/profile";
import { normalizeTier } from "../../constants/loyaltyTiers";
import { K } from "../../constants/theme";
import { SignInRequired } from "../../components/SignInRequired";
import { ProfileHeader } from "../../components/profile/ProfileHeader";
import { MembershipCard } from "../../components/profile/MembershipCard";
import { SettingsSection } from "../../components/profile/SettingsSection";
import { MenuRow } from "../../components/profile/MenuRow";
import { ProfileSkeleton } from "../../components/profile/ProfileSkeleton";
import { CurrencyPickerModal } from "../../components/CurrencyPickerModal";

export default function ProfileScreen() {
  // Guests can browse and book; this screen is account-only. Returned
  // before any other hook — the tab layout remounts on session change so
  // the hook count never shifts under React.
  const storeUser = useAuthStore((s) => s.user);
  if (!storeUser) {
    return <SignInRequired icon="person-circle-outline" title="Sign in to Kainook" message="Manage your bookings, saved places, rewards and hosting from your account." />;
  }

  const clearAuth = useAuthStore((s) => s.clearAuth);
  const localCurrency = useAuthStore((s) => s.localCurrency);
  const setLocalCurrency = useAuthStore((s) => s.setLocalCurrency);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const { data, isLoading, isError, isFetching, refetch } = useProfileScreenData();

  const logoutMutation = useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSettled: async () => {
      await clearAuth();
      router.replace("/(auth)/login");
    },
  });

  const deleteAccountMutation = useDeleteAccount();

  function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? All your personal data, saved listings, and booking history will be permanently deleted. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () => {
            deleteAccountMutation.mutate(undefined, {
              onSuccess: () => {
                Alert.alert("Account Deleted", "Your account and data have been permanently removed.", [
                  { text: "OK", onPress: () => router.replace("/(auth)/login" as any) },
                ]);
              },
              onError: (err: any) => {
                const msg = err?.response?.data?.error?.message ?? err?.message ?? "Could not delete account. Please try again.";
                Alert.alert("Delete Failed", msg);
              },
            });
          },
        },
      ],
    );
  }

  // Show the store's cached user immediately (avoids a blank screen on first
  // paint) and swap in fresh /auth/me + /auth/profile data once it lands.
  const tier = normalizeTier(data?.currentTier ?? storeUser?.currentTier);
  const points = data?.loyaltyPoints ?? storeUser?.loyaltyPoints ?? 0;
  const firstName = data?.firstName ?? storeUser?.firstName ?? "";
  const lastName = data?.lastName ?? storeUser?.lastName ?? "";
  const email = data?.email ?? storeUser?.email ?? "";
  const photoUrl = data?.photoUrl ?? storeUser?.photoUrl ?? null;

  // Same precedence as the fields above — fresh /auth/me first, cached user as
  // the immediate-paint fallback.
  //
  // Mirrors apps/web/app/traveller/components/TravellerHeader.tsx's canHost /
  // listingsHref / listingsLabel: an approved host switches into the hosting
  // tab bar (web's equivalent is routing into the separate dashboard Shell);
  // anyone else goes to the application first.
  const verified = data?.emailVerified ?? storeUser?.emailVerified ?? false;

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
              verified={verified}
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
              </View>
            )}

            <View style={{ height: 4 }} />

            <SettingsSection title="Account">
              <MenuRow icon="person-outline" label="Personal Information" sublabel="Name & contact details" onPress={() => router.push("/edit-profile" as any)} />
              <MenuRow icon="trash-outline" label={deleteAccountMutation.isPending ? "Deleting Account…" : "Delete Account"} sublabel="Permanently remove your account" onPress={handleDeleteAccount} danger showBorder={false} />
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

            {/* Hosting is applied for, not chosen at signup. An approved host
                switches into the hosting tab bar — a second, sibling Tabs
                navigator at (provider)/ with its own Dashboard/Listings/
                Bookings/Messages/Profile, mirroring how web replaces the
                traveller header with the dashboard Shell. Anyone else goes to
                the application, which shows their current status. Without
                this row both destinations are unreachable — the only route in
                used to be an automatic redirect for provider accounts, which
                no longer exist. */}
            <SettingsSection title="Hosting">
              <MenuRow
                icon="business-outline"
                label="Switch to Hosting"
                sublabel="Manage your listings and bookings"
                onPress={() => router.replace("/(provider)" as any)}
                showBorder={false}
              />
            </SettingsSection>

            <SettingsSection title="Preferences">
              <MenuRow icon="notifications-outline" label="Notifications" sublabel="Push, email & SMS alerts" onPress={() => router.push("/notifications" as any)} />
              <MenuRow icon="cash-outline" label="Currency" sublabel={`Prices shown in ${localCurrency ?? "USD"}`} onPress={() => setCurrencyModalVisible(true)} showBorder={false} />
            </SettingsSection>

            <SettingsSection title="Support & Legal">
              <MenuRow icon="help-circle-outline" label="Help & Support" sublabel="FAQs and guides" onPress={() => router.push("/help" as any)} />
              <MenuRow icon="document-text-outline" label="Terms & Conditions" sublabel="Our terms of use" onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "terms" } } as any)} />
              <MenuRow icon="shield-checkmark-outline" label="Privacy Policy" sublabel="How we handle your data" onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "privacy" } } as any)} showBorder={false} />
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

      <CurrencyPickerModal
        visible={currencyModalVisible}
        selected={localCurrency ?? "USD"}
        onSelect={(code) => {
          void setLocalCurrency(code);
          setCurrencyModalVisible(false);
        }}
        onClose={() => setCurrencyModalVisible(false)}
      />
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
