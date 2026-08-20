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
import { useKeyboard } from "../hooks/useKeyboard";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../store/auth";
import { useUpdateProfile, useProfilePhoto, useDeleteAccount, type UpdateProfilePayload } from "../hooks/profile";
import { ProfileAvatar } from "../components/profile/ProfileAvatar";
import { normalizeTier } from "../constants/loyaltyTiers";
import { K } from "../constants/theme";

export default function EditProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isKeyboardOpen = useKeyboard();
  // Triggers a fetch here too (if the cached photo is stale/missing) rather
  // than relying solely on the Profile tab having already populated it.
  const { data: freshPhotoUrl } = useProfilePhoto();

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [businessName, setBusinessName] = useState(user?.businessName ?? "");
  // Business name belongs to host onboarding, not to an account type, so it is
  // shown only to users who already have one rather than to every traveller.
  //
  // Frozen at mount, like the field values above: deriving it live from the
  // store would make the input vanish mid-edit the moment someone cleared it
  // and saved, with no way to type it back in.
  const [showBusinessField] = useState(() => !!user?.businessName);

  const mutation = useUpdateProfile();

  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim();
  const trimmedBusiness = businessName.trim();
  const isValid = trimmedFirst.length > 0 && trimmedLast.length > 0;

  const hasChanges =
    trimmedFirst !== (user?.firstName ?? "") ||
    trimmedLast !== (user?.lastName ?? "") ||
    (showBusinessField && trimmedBusiness !== (user?.businessName ?? ""));

  function handleSave() {
    // Only send fields that actually changed.
    const patch: UpdateProfilePayload = {};
    if (trimmedFirst !== (user?.firstName ?? "")) patch.firstName = trimmedFirst;
    if (trimmedLast !== (user?.lastName ?? "")) patch.lastName = trimmedLast;
    if (showBusinessField && trimmedBusiness !== (user?.businessName ?? "")) patch.businessName = trimmedBusiness || null;

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
                  { text: "OK", onPress: () => router.replace("/") },
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

  return (
    <SafeAreaView style={s.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : isKeyboardOpen
              ? "height"
              : undefined
        }
      >
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
            {showBusinessField && (
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

          <View style={s.dangerSection}>
            <Text style={s.dangerTitle}>Danger Zone</Text>
            <Text style={s.dangerDesc}>
              Permanently delete your Kainook account and all associated personal data.
            </Text>
            <TouchableOpacity
              style={s.deleteAccountBtn}
              onPress={handleDeleteAccount}
              disabled={deleteAccountMutation.isPending}
              activeOpacity={0.8}
            >
              {deleteAccountMutation.isPending ? (
                <ActivityIndicator color="#dc2626" size="small" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color="#dc2626" style={{ marginRight: 6 }} />
                  <Text style={s.deleteAccountText}>Delete Account</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
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

  dangerSection: {
    marginTop: 32,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  dangerTitle: { fontSize: 14, fontWeight: "700", color: "#991b1b", marginBottom: 4 },
  dangerDesc: { fontSize: 12, color: "#7f1d1d", marginBottom: 14, lineHeight: 17 },
  deleteAccountBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fca5a5",
  },
  deleteAccountText: { color: "#dc2626", fontWeight: "700", fontSize: 14 },
});
