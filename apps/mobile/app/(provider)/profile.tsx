import { useState } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/auth";
import { K } from "../../constants/theme";
import type { ApiResponse } from "@zika/types";

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

function MenuItem({
  icon, label, sublabel, onPress, danger,
}: { icon: string; label: string; sublabel?: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <Text style={styles.menuEmoji}>{icon}</Text>
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
        {sublabel ? <Text style={styles.menuSublabel}>{sublabel}</Text> : null}
      </View>
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

function ProfileTab({ user }: { user: any }) {
  const qc = useQueryClient();
  const updateUser = useAuthStore((s) => s.setAuth);
  const storedUser = useAuthStore((s) => s.user);
  const storedToken = useAuthStore((s) => s.accessToken);

  const [form, setForm] = useState<ProfileData>({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    businessName: user?.businessName ?? "",
    country: user?.country ?? "",
    phone: user?.phone ?? "",
    bio: user?.bio ?? "",
  });

  const set = (k: keyof ProfileData) => (v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch<ApiResponse<{ user: any }>>("/auth/profile", {
        firstName: form.firstName,
        lastName: form.lastName,
        businessName: form.businessName,
        country: form.country,
        phone: form.phone,
        bio: form.bio,
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
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.avatarBlock}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(form.firstName[0] ?? "?").toUpperCase()}
          </Text>
        </View>
        <Text style={styles.avatarName}>{form.firstName} {form.lastName}</Text>
        <Text style={styles.avatarEmail}>{form.email}</Text>
      </View>

      <View style={styles.formCard}>
        {[
          { label: "First Name", key: "firstName" as const, placeholder: "Ada" },
          { label: "Last Name", key: "lastName" as const, placeholder: "Okafor" },
          { label: "Business Name", key: "businessName" as const, placeholder: "Serena Hotels Ltd." },
          { label: "Country Code", key: "country" as const, placeholder: "KE", upper: true, maxLength: 2 },
          { label: "Phone", key: "phone" as const, placeholder: "+254 700 000 000", keyboard: "phone-pad" as const },
          { label: "Bio", key: "bio" as const, placeholder: "Tell guests about yourself…", multiline: true },
        ].map((f) => (
          <View key={f.key} style={styles.formField}>
            <Text style={styles.fieldLabel}>{f.label}</Text>
            <TextInput
              style={[styles.fieldInput, f.multiline && styles.fieldTextarea]}
              value={form[f.key]}
              onChangeText={set(f.key)}
              placeholder={f.placeholder}
              placeholderTextColor={K.colors.textMuted}
              autoCapitalize={f.upper ? "characters" : "none"}
              maxLength={f.maxLength}
              keyboardType={f.keyboard ?? "default"}
              multiline={f.multiline}
              numberOfLines={f.multiline ? 3 : 1}
            />
          </View>
        ))}

        <TouchableOpacity
          style={[styles.saveBtn, mutation.isPending && styles.btnDisabled]}
          onPress={() => mutation.mutate()}
          disabled={mutation.isPending}
          activeOpacity={0.85}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function SecurityTab() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const set = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      if (form.newPassword !== form.confirmPassword) throw new Error("Passwords don't match");
      const res = await api.post<ApiResponse<unknown>>("/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
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
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.formCard}>
        {[
          { label: "Current Password", key: "currentPassword" as const },
          { label: "New Password", key: "newPassword" as const },
          { label: "Confirm New Password", key: "confirmPassword" as const },
        ].map((f) => (
          <View key={f.key} style={styles.formField}>
            <Text style={styles.fieldLabel}>{f.label}</Text>
            <TextInput
              style={styles.fieldInput}
              value={form[f.key]}
              onChangeText={set(f.key)}
              placeholder="••••••••"
              placeholderTextColor={K.colors.textMuted}
              secureTextEntry
            />
          </View>
        ))}

        <TouchableOpacity
          style={[styles.saveBtn, mutation.isPending && styles.btnDisabled]}
          onPress={() => mutation.mutate()}
          disabled={mutation.isPending}
          activeOpacity={0.85}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Update Password</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function comingSoon(feature: string) {
  Alert.alert(
    feature,
    "This feature is not yet available. We're working on it — check back soon.",
    [{ text: "OK" }]
  );
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
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.menuCard}>
        <MenuItem
          icon="⭐"
          label="My Reviews"
          sublabel="Guest ratings & your replies"
          onPress={() => router.push("/(provider)/reviews" as any)}
        />
        <MenuItem
          icon="📋"
          label="Verification Documents"
          sublabel="Upload required docs"
          onPress={() => comingSoon("Verification Documents")}
        />
        <MenuItem
          icon="🏦"
          label="Bank Details"
          sublabel="Payout bank account"
          onPress={() => comingSoon("Bank Details")}
        />
        <MenuItem
          icon="💳"
          label="Tax Information"
          sublabel="Tax ID & certificates"
          onPress={() => comingSoon("Tax Information")}
        />
        <MenuItem
          icon="🔔"
          label="Notifications"
          sublabel="Push, email preferences"
          onPress={() => router.push("/notifications" as any)}
        />
        <MenuItem
          icon="🌐"
          label="Channel Manager"
          sublabel="iCal sync & integrations"
          onPress={() => router.push("/(provider)/channels" as any)}
        />
        <MenuItem
          icon="❓"
          label="Help & Support"
          sublabel="FAQs, contact us"
          onPress={() => comingSoon("Help & Support")}
        />
      </View>

      <View style={[styles.menuCard, { marginTop: 16 }]}>
        <MenuItem icon="🚪" label="Sign Out" onPress={handleLogout} danger />
      </View>

      <Text style={styles.versionText}>KAINOOK v2.4.0 · Provider Network</Text>
    </ScrollView>
  );
}

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>("profile");

  const TABS: { key: Tab; label: string }[] = [
    { key: "profile", label: "Profile" },
    { key: "security", label: "Security" },
    { key: "account", label: "Account" },
  ];

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerTop}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        <View style={styles.tabRow}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBtnText, tab === t.key && styles.tabBtnTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {tab === "profile" && <ProfileTab user={user} />}
      {tab === "security" && <SecurityTab />}
      {tab === "account" && <AccountTab />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgLight },

  header: {
    backgroundColor: K.colors.darkGreen,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  logo: { width: 32, height: 32, borderRadius: 8 },
  headerTitle: { fontSize: K.font.xl, fontWeight: "800", color: "#fff" },

  tabRow: { flexDirection: "row", gap: 8 },
  tabBtn: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.glassBg,
    borderWidth: 1,
    borderColor: K.colors.glassBorder,
  },
  tabBtnActive: { backgroundColor: K.colors.accent, borderColor: K.colors.accent },
  tabBtnText: { fontSize: K.font.sm, color: K.colors.textLightMuted, fontWeight: "600" },
  tabBtnTextActive: { color: "#fff" },

  tabContent: { padding: 16, paddingBottom: 40 },

  avatarBlock: { alignItems: "center", marginBottom: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: K.colors.darkGreen,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    ...K.shadow.md,
  },
  avatarText: { fontSize: 36, fontWeight: "900", color: "#fff" },
  avatarName: { fontSize: K.font.xl, fontWeight: "800", color: K.colors.textDark },
  avatarEmail: { fontSize: K.font.sm, color: K.colors.textMuted, marginTop: 4 },

  formCard: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  formField: { marginBottom: 16 },
  fieldLabel: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textMid, marginBottom: 8 },
  fieldInput: {
    backgroundColor: K.colors.bgLight,
    borderWidth: 1,
    borderColor: K.colors.border,
    borderRadius: K.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: K.font.base,
    color: K.colors.textDark,
  },
  fieldTextarea: { height: 80, textAlignVertical: "top" },

  saveBtn: {
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.md,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.55 },
  saveBtnText: { color: "#fff", fontSize: K.font.base, fontWeight: "700" },

  menuCard: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    borderWidth: 1,
    borderColor: K.colors.border,
    overflow: "hidden",
    ...K.shadow.sm,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
    gap: 14,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: K.radius.sm,
    backgroundColor: K.colors.bgLight,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconDanger: { backgroundColor: "#FEE2E2" },
  menuEmoji: { fontSize: 18 },
  menuText: { flex: 1 },
  menuLabel: { fontSize: K.font.base, fontWeight: "600", color: K.colors.textDark },
  menuLabelDanger: { color: K.colors.error },
  menuSublabel: { fontSize: K.font.sm, color: K.colors.textMuted, marginTop: 2 },
  menuArrow: { fontSize: 22, color: K.colors.textMuted, fontWeight: "300" },

  versionText: { textAlign: "center", fontSize: 11, color: K.colors.textMuted, marginTop: 24 },
});
