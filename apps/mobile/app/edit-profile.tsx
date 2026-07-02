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
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../store/auth";
import { useUpdateProfile, useProfilePhoto, type UpdateProfilePayload } from "../hooks/profile";
import { ProfileAvatar } from "../components/profile/ProfileAvatar";
import { normalizeTier } from "../constants/loyaltyTiers";
import { K } from "../constants/theme";

export default function EditProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isProvider = user?.userType === "provider";
  // Triggers a fetch here too (if the cached photo is stale/missing) rather
  // than relying solely on the Profile tab having already populated it.
  const { data: freshPhotoUrl } = useProfilePhoto();

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [businessName, setBusinessName] = useState(user?.businessName ?? "");

  const mutation = useUpdateProfile();

  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim();
  const trimmedBusiness = businessName.trim();
  const isValid = trimmedFirst.length > 0 && trimmedLast.length > 0;

  const hasChanges =
    trimmedFirst !== (user?.firstName ?? "") ||
    trimmedLast !== (user?.lastName ?? "") ||
    (isProvider && trimmedBusiness !== (user?.businessName ?? ""));

  function handleSave() {
    // Only send fields that actually changed.
    const patch: UpdateProfilePayload = {};
    if (trimmedFirst !== (user?.firstName ?? "")) patch.firstName = trimmedFirst;
    if (trimmedLast !== (user?.lastName ?? "")) patch.lastName = trimmedLast;
    if (isProvider && trimmedBusiness !== (user?.businessName ?? "")) patch.businessName = trimmedBusiness || null;

    if (Object.keys(patch).length === 0) {
      router.back();
      return;
    }

    mutation.mutate(patch, {
      onSuccess: () => {
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
  }

  return (
    <SafeAreaView style={s.safeArea} edges={["bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={K.colors.textDark} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Edit Profile</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.avatarWrap}>
            <ProfileAvatar
              photoUrl={freshPhotoUrl ?? user?.photoUrl}
              firstName={firstName}
              lastName={lastName}
              tier={normalizeTier(user?.currentTier)}
              size={84}
            />
            <Text style={s.avatarHint}>{user?.email}</Text>
          </View>

          <View style={s.card}>
            <Field label="First Name *" value={firstName} onChangeText={setFirstName} placeholder="Ada" autoCapitalize="words" />
            <Field label="Last Name *" value={lastName} onChangeText={setLastName} placeholder="Okafor" autoCapitalize="words" />
            {isProvider && (
              <Field
                label="Business Name"
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="Ada's Getaways"
                autoCapitalize="words"
              />
            )}
          </View>

          <TouchableOpacity
            style={[s.saveBtn, (!isValid || !hasChanges || mutation.isPending) && s.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!isValid || !hasChanges || mutation.isPending}
            activeOpacity={0.85}
          >
            {mutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Save Changes</Text>}
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
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={K.colors.textMuted}
        autoCapitalize={autoCapitalize ?? "none"}
      />
    </View>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: K.colors.bgApp },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: K.colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: K.colors.bgSubtle },
  headerTitle: { fontSize: 16, fontWeight: "700", color: K.colors.textDark },

  scroll: { padding: 16, paddingBottom: 40 },

  avatarWrap: { alignItems: "center", marginBottom: 24 },
  avatarHint: { fontSize: 13, color: K.colors.textMuted, marginTop: 10 },

  card: {
    backgroundColor: K.colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: K.colors.border,
    marginBottom: 20,
  },

  fieldWrap: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: K.colors.textMid,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: K.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: K.colors.textDark,
    backgroundColor: K.colors.bgSubtle,
  },

  saveBtn: {
    backgroundColor: K.colors.darkGreen,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 12,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  cancelBtn: {
    borderWidth: 1,
    borderColor: K.colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelBtnText: { color: K.colors.textMid, fontWeight: "600", fontSize: 15 },
});
