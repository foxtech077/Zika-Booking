import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/auth";
import { K } from "../../constants/theme";
import type { ApiResponse } from "@zika/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  businessName?: string;
  country?: string;
  phone?: string;
  bio?: string;
}

type Tab = "profile" | "security" | "account";

// ── Field Component ───────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, keyboard, multiline, maxLength, upper }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboard?: any;
  multiline?: boolean;
  maxLength?: number;
  upper?: boolean;
}) {
  return (
    <View style={f.wrap}>
      <Text style={f.label}>{label}</Text>
      <TextInput
        style={[f.input, multiline && f.textArea]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#B0B8B4"
        autoCapitalize={upper ? "characters" : "none"}
        keyboardType={keyboard ?? "default"}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        maxLength={maxLength}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
}

const f = StyleSheet.create({
  wrap:     { marginBottom: 16 },
  label:    { fontSize: 12, fontWeight: "700", color: K.colors.textMid, marginBottom: 7, letterSpacing: 0.3 },
  input: {
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: K.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: K.colors.textDark,
  },
  textArea: { height: 84, paddingTop: 12 },
});

// ── Primary Button ────────────────────────────────────────────────────────────

function PrimaryBtn({ label, onPress, loading }: {
  label: string; onPress: () => void; loading?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[pb.btn, loading && pb.disabled]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading
        ? <ActivityIndicator color="#fff" size="small" />
        : <Text style={pb.label}>{label}</Text>}
    </TouchableOpacity>
  );
}

const pb = StyleSheet.create({
  btn:      { backgroundColor: K.colors.darkGreen, borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center", marginTop: 8 },
  disabled: { opacity: 0.55 },
  label:    { color: "#fff", fontSize: 15, fontWeight: "700" },
});

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
  row:   { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 14 },
  icon:  { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  body:  { flex: 1 },
  label: { fontSize: 15, fontWeight: "600", color: K.colors.textDark },
  labelDanger: { color: "#dc2626" },
  sub:   { fontSize: 12, color: K.colors.textMuted, marginTop: 2 },
});

// ── Section Card ──────────────────────────────────────────────────────────────

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

// ── Profile Tab ───────────────────────────────────────────────────────────────

function ProfileTab({ user }: { user: any }) {
  const qc         = useQueryClient();
  const updateUser = useAuthStore((s) => s.setAuth);
  const storedUser = useAuthStore((s) => s.user);
  const storedToken= useAuthStore((s) => s.accessToken);

  const [form, setForm] = useState<ProfileData>({
    firstName:    user?.firstName    ?? "",
    lastName:     user?.lastName     ?? "",
    email:        user?.email        ?? "",
    businessName: user?.businessName ?? "",
    country:      user?.country      ?? "",
    phone:        user?.phone        ?? "",
    bio:          user?.bio          ?? "",
  });

  const set = (k: keyof ProfileData) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch<ApiResponse<{ user: any }>>("/auth/profile", {
        firstName:    form.firstName,
        lastName:     form.lastName,
        businessName: form.businessName,
        country:      form.country,
        phone:        form.phone,
        bio:          form.bio,
      });
      if (!res.data.success) throw res.data;
      return res.data.data.user;
    },
    onSuccess: async (updated) => {
      if (storedUser && storedToken) {
        await updateUser({ ...storedUser, ...updated }, storedToken);
      }
      qc.invalidateQueries({ queryKey: ["providerDashboard"] });
      Alert.alert("Saved", "Profile updated successfully.");
    },
    onError: () => Alert.alert("Error", "Could not save profile. Please try again."),
  });

  return (
    <ScrollView contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
      <View style={s.formCard}>
        <Text style={s.formCardTitle}>Personal Info</Text>
        <View style={s.formRow}>
          <View style={{ flex: 1 }}>
            <Field label="First Name" value={form.firstName} onChange={set("firstName")} placeholder="Ada" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Last Name" value={form.lastName} onChange={set("lastName")} placeholder="Okafor" />
          </View>
        </View>
        <Field label="Business Name" value={form.businessName ?? ""} onChange={set("businessName")} placeholder="Serena Hotels Ltd." />
        <View style={s.formRow}>
          <View style={{ width: 72 }}>
            <Field label="Country" value={form.country ?? ""} onChange={set("country")} placeholder="KE" upper maxLength={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Phone" value={form.phone ?? ""} onChange={set("phone")} placeholder="+254 700 000 000" keyboard="phone-pad" />
          </View>
        </View>
        <Field label="Bio" value={form.bio ?? ""} onChange={set("bio")} placeholder="Tell guests about yourself…" multiline />
      </View>

      <PrimaryBtn
        label="Save Changes"
        onPress={() => mutation.mutate()}
        loading={mutation.isPending}
      />
    </ScrollView>
  );
}

// ── Security Tab ──────────────────────────────────────────────────────────────

function SecurityTab() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const set = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      if (form.newPassword !== form.confirmPassword) throw new Error("Passwords don't match");
      const res = await api.post<ApiResponse<unknown>>("/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword:     form.newPassword,
      });
      if (!res.data.success) throw res.data;
    },
    onSuccess: () => {
      Alert.alert("Done", "Password updated successfully.");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    },
    onError: (e: any) => Alert.alert("Error", e.message ?? "Could not update password."),
  });

  return (
    <ScrollView contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
      <View style={s.infoBox}>
        <Ionicons name="lock-closed-outline" size={15} color="#2563eb" />
        <Text style={s.infoBoxText}>
          Use a strong password with at least 8 characters, including numbers and symbols.
        </Text>
      </View>

      <View style={s.formCard}>
        <Text style={s.formCardTitle}>Change Password</Text>
        {[
          { label: "Current Password",     key: "currentPassword"  as const },
          { label: "New Password",         key: "newPassword"      as const },
          { label: "Confirm New Password", key: "confirmPassword"  as const },
        ].map((field) => (
          <View key={field.key} style={f.wrap}>
            <Text style={f.label}>{field.label}</Text>
            <TextInput
              style={f.input}
              value={form[field.key]}
              onChangeText={set(field.key)}
              placeholder="••••••••"
              placeholderTextColor="#B0B8B4"
              secureTextEntry
            />
          </View>
        ))}
      </View>

      <PrimaryBtn
        label="Update Password"
        onPress={() => mutation.mutate()}
        loading={mutation.isPending}
      />
    </ScrollView>
  );
}

// ── Account Tab ───────────────────────────────────────────────────────────────

function comingSoon(feature: string) {
  Alert.alert(feature, "This feature is coming soon. We're working on it!", [{ text: "Got it" }]);
}

function AccountTab() {
  const clearAuth = useAuthStore((s) => s.clearAuth);

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
    <ScrollView contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
      {/* Property Management */}
      <Text style={s.sectionLabel}>LISTINGS</Text>
      <MenuCard>
        <MenuRow iconName="star-outline"    iconBg="#fffbeb" label="My Reviews"      sub="Guest ratings & your replies"   onPress={() => router.push("/(provider)/reviews" as any)} />
        <MenuDivider />
        <MenuRow iconName="calendar-outline" iconBg="#eff6ff" label="Calendar Sync"   sub="iCal feeds & integrations"      onPress={() => router.push("/(provider)/channels" as any)} />
      </MenuCard>

      {/* Financial */}
      <Text style={s.sectionLabel}>FINANCIAL</Text>
      <MenuCard>
        <MenuRow iconName="card-outline"          iconBg="#f0fdf4" label="Payout Setup"        sub="Connect Stripe for payouts"   onPress={() => router.push("/(provider)/stripe-connect" as any)} />
        <MenuDivider />
        <MenuRow iconName="wallet-outline"         iconBg="#f0fdf4" label="Payout History"      sub="Scheduled & processed payouts" onPress={() => router.push("/(provider)/payouts" as any)} />
        <MenuDivider />
        <MenuRow iconName="receipt-outline"        iconBg="#fffbeb" label="Tax Information"     sub="Tax ID & certificates"        onPress={() => comingSoon("Tax Information")} />
      </MenuCard>

      {/* Account */}
      <Text style={s.sectionLabel}>ACCOUNT</Text>
      <MenuCard>
        <MenuRow iconName="document-text-outline"  iconBg="#eff6ff" label="Verification Docs"  sub="Upload required documents"    onPress={() => comingSoon("Verification Documents")} />
        <MenuDivider />
        <MenuRow iconName="notifications-outline"  iconBg="#f5f3ff" label="Notifications"       sub="Push & email preferences"    onPress={() => router.push("/notifications" as any)} />
        <MenuDivider />
        <MenuRow iconName="help-circle-outline"    iconBg="#f0fdf4" label="Help & Support"      sub="FAQs, contact us"             onPress={() => comingSoon("Help & Support")} />
      </MenuCard>

      {/* Danger zone */}
      <MenuCard>
        <MenuRow iconName="log-out-outline" iconBg="#fef2f2" label="Sign Out" onPress={handleLogout} danger />
      </MenuCard>

      <Text style={s.versionText}>KAINOOK v2.4.0 · Provider</Text>
    </ScrollView>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>("profile");

  const initials = ((user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "")).toUpperCase() || "P";

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "profile",  label: "Profile",  icon: "person-outline" },
    { key: "security", label: "Security", icon: "lock-closed-outline" },
    { key: "account",  label: "Account",  icon: "settings-outline" },
  ];

  return (
    <View style={s.container}>
      {/* Header */}
      <SafeAreaView edges={["top"]} style={s.header}>
        {/* Avatar + name */}
        <View style={s.avatarSection}>
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

        {/* Tab switcher */}
        <View style={s.tabRow}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={t.icon as any}
                size={14}
                color={tab === t.key ? K.colors.darkGreen : "rgba(255,255,255,0.65)"}
              />
              <Text style={[s.tabBtnText, tab === t.key && s.tabBtnTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {tab === "profile"  && <ProfileTab user={user} />}
      {tab === "security" && <SecurityTab />}
      {tab === "account"  && <AccountTab />}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F4F1" },

  header: {
    backgroundColor: K.colors.darkGreen,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  // Avatar section
  avatarSection: { alignItems: "center", paddingTop: 8, paddingBottom: 20 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: K.colors.accent,
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.25)",
    ...K.shadow.md,
  },
  avatarInitials: { fontSize: 32, fontWeight: "900", color: "#fff" },
  userName:       { fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 3, letterSpacing: -0.3 },
  businessName:   { fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8 },
  providerBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
  },
  providerBadgeText: { fontSize: 11, color: "#34d399", fontWeight: "700" },

  // Tab switcher
  tabRow: { flexDirection: "row", gap: 8 },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  tabBtnActive:     { backgroundColor: "#fff" },
  tabBtnText:       { fontSize: 12, color: "rgba(255,255,255,0.70)", fontWeight: "600" },
  tabBtnTextActive: { color: K.colors.darkGreen },

  // Scroll content
  tabContent: { padding: 16, paddingBottom: 48, gap: 12 },

  // Form card
  formCard:      { backgroundColor: "#fff", borderRadius: 18, padding: 18, borderWidth: 1, borderColor: K.colors.border, ...K.shadow.sm },
  formCardTitle: { fontSize: 15, fontWeight: "800", color: K.colors.textDark, marginBottom: 16, letterSpacing: -0.2 },
  formRow:       { flexDirection: "row", gap: 10 },

  // Info box
  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "#eff6ff",
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#bfdbfe",
  },
  infoBoxText: { flex: 1, fontSize: 13, color: "#1d4ed8", lineHeight: 18 },

  // Section labels
  sectionLabel: {
    fontSize: 10, fontWeight: "800", color: K.colors.textMuted,
    letterSpacing: 1.0, marginTop: 4, marginBottom: 8,
  },

  // Version
  versionText: { textAlign: "center", fontSize: 11, color: K.colors.textMuted, marginTop: 8 },
});
