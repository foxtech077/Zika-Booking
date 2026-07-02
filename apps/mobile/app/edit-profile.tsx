import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth";
import type { ApiResponse } from "@zika/types";

interface ProfileForm {
  firstName: string;
  lastName: string;
  phone: string;
  bio: string;
}

export default function EditProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);

  const [form, setForm] = useState<ProfileForm>({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    phone: (user as any)?.phone ?? "",
    bio: (user as any)?.bio ?? "",
  });

  const set = (key: keyof ProfileForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch<ApiResponse<{ user: any }>>("/auth/profile", {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        bio: form.bio.trim() || undefined,
      });
      if (!res.data.success) throw new Error("Update failed");
      return res.data.data.user;
    },
    onSuccess: async (updated) => {
      if (user && accessToken) {
        await setAuth({ ...user, ...updated }, accessToken);
      }
      Alert.alert("Profile Updated", "Your changes have been saved.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.error?.message ??
        err?.message ??
        "Could not save your profile. Please try again.";
      Alert.alert("Update Failed", message);
    },
  });

  const isValid = form.firstName.trim().length > 0 && form.lastName.trim().length > 0;

  return (
    <SafeAreaView style={s.safeArea} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Edit Profile</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar placeholder */}
          <View style={s.avatarWrap}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {(form.firstName[0] ?? user?.firstName?.[0] ?? "?").toUpperCase()}
              </Text>
            </View>
            <Text style={s.avatarHint}>
              {user?.email}
            </Text>
          </View>

          {/* Form */}
          <View style={s.card}>
            <Field
              label="First Name *"
              value={form.firstName}
              onChangeText={set("firstName")}
              placeholder="Ada"
              autoCapitalize="words"
            />
            <Field
              label="Last Name *"
              value={form.lastName}
              onChangeText={set("lastName")}
              placeholder="Okafor"
              autoCapitalize="words"
            />
            <Field
              label="Phone Number"
              value={form.phone}
              onChangeText={set("phone")}
              placeholder="+254 700 000 000"
              keyboardType="phone-pad"
            />
            <Field
              label="Bio"
              value={form.bio}
              onChangeText={set("bio")}
              placeholder="Tell hosts a little about yourself…"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[s.saveBtn, (!isValid || mutation.isPending) && s.saveBtnDisabled]}
            onPress={() => mutation.mutate()}
            disabled={!isValid || mutation.isPending}
            activeOpacity={0.85}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()} disabled={mutation.isPending}>
            <Text style={s.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
  keyboardType,
  multiline,
  numberOfLines,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "phone-pad" | "email-address";
  multiline?: boolean;
  numberOfLines?: number;
}) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.fieldInput, multiline && s.fieldTextarea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        autoCapitalize={autoCapitalize ?? "none"}
        keyboardType={keyboardType ?? "default"}
        multiline={multiline}
        numberOfLines={numberOfLines}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F9FAFB" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },

  scroll: { padding: 16, paddingBottom: 40 },

  avatarWrap: { alignItems: "center", marginBottom: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#024622",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarText: { fontSize: 34, fontWeight: "800", color: "#fff" },
  avatarHint: { fontSize: 13, color: "#6B7280" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 20,
  },

  fieldWrap: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#F9FAFB",
  },
  fieldTextarea: { minHeight: 80 },

  saveBtn: {
    backgroundColor: "#024622",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 12,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  cancelBtn: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelBtnText: { color: "#374151", fontWeight: "600", fontSize: 15 },
});
