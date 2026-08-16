import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { api, BASE_URL } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { useKeyboard } from "../hooks/useKeyboard";
import { K } from "../constants/theme";
import type { PublicUser } from "@zika/types";

// Mirrors GET /auth/host/profile. Hosting is applied for, then reviewed by an
// admin — it is not an account type chosen at signup.
type HostStatus = "approved" | "pending" | "rejected" | null;

interface HostProfile {
  status: HostStatus;
  businessName: string | null;
  registrationNo: string | null;
  taxId: string | null;
  documentsUrl: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

const STATUS_CFG: Record<
  Exclude<HostStatus, null>,
  { icon: string; tint: string; bg: string; title: string; body: string }
> = {
  pending: {
    icon: "time-outline",
    tint: "#B45309",
    bg: "#FFFBEB",
    title: "Application under review",
    body: "We are reviewing your details. You will be able to create listings as soon as it is approved.",
  },
  approved: {
    icon: "checkmark-circle-outline",
    tint: "#15803D",
    bg: "#F0FDF4",
    title: "You are an approved host",
    body: "Your application was approved. You can now create and manage listings.",
  },
  rejected: {
    icon: "close-circle-outline",
    tint: "#B91C1C",
    bg: "#FEF2F2",
    title: "Application not approved",
    body: "You can correct the details below and submit again.",
  },
};

export default function HostOnboardingScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const isKeyboardOpen = useKeyboard();
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [businessName, setBusinessName] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [taxId, setTaxId] = useState("");
  const [documentsUrl, setDocumentsUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    router.replace("/(provider)" as any);
  }, []);

  const { data: hostProfile, isLoading } = useQuery<HostProfile | null>({
    queryKey: ["host-profile"],
    queryFn: async () => {
      const res = await api.get("auth/host/profile");
      return res.data?.data?.hostProfile ?? null;
    },
  });

  // Pre-fill from the saved application so a rejected applicant can correct and
  // resubmit without retyping everything.
  useEffect(() => {
    if (!hostProfile) return;
    setBusinessName(hostProfile.businessName ?? "");
    setRegistrationNo(hostProfile.registrationNo ?? "");
    setTaxId(hostProfile.taxId ?? "");
    setDocumentsUrl(hostProfile.documentsUrl ?? "");
  }, [hostProfile]);

  // Listing endpoints — and now the (provider) tab bar's own layout guard —
  // gate on the hostStatus claim baked into the access token, so a freshly
  // approved host still gets 403/redirected-back until the token is re-minted.
  // The refresh response carries the updated user, so the store picks up
  // hostStatus in the same call.
  // Holds the in-flight promise, not just a "done" flag — the effect below
  // and the button's tap handler can both call this, and the second caller
  // needs to actually await the first's result, not skip waiting because a
  // call is merely "already started".
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  function refreshHostStatus(): Promise<void> {
    return Promise.resolve();
  }

  const status = hostProfile?.status ?? null;
  const isApproved = status === "approved";
  const isPending = status === "pending";
  const canEdit = !isPending && !isApproved;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("auth/host/profile", {
        businessName: businessName.trim(),
        ...(registrationNo.trim() ? { registrationNo: registrationNo.trim() } : {}),
        ...(taxId.trim() ? { taxId: taxId.trim() } : {}),
        ...(documentsUrl.trim() ? { documentsUrl: documentsUrl.trim() } : {}),
      });
      if (!res.data?.success) throw res.data;
      return res.data.data;
    },
    onSuccess: async () => {
      setError(null);
      await qc.invalidateQueries({ queryKey: ["host-profile"] });
    },
    onError: (err: any) => {
      console.log("errrorrr:", err)
      // The API returns per-field detail under error.fields; surface the first
      // one so an invalid documents URL says so instead of "Validation failed".
      const apiErr = err?.response?.data?.error;
      const firstField = apiErr?.fields && Object.values(apiErr.fields)[0];
      setError(
        (typeof firstField === "string" ? firstField : null) ??
        apiErr?.message ??
        "Could not submit your application. Please try again.",
      );
    },
  });

  function handleSubmit() {
    if (!businessName.trim()) {
      setError("Business name is required.");
      return;
    }
    // Checked client-side because the API requires a valid URL and would
    // otherwise reject the whole submission with a generic message.
    const url = documentsUrl.trim();
    if (url && !/^https?:\/\/\S+$/i.test(url)) {
      setError("Documents link must be a full URL starting with http:// or https://");
      return;
    }
    setError(null);
    mutation.mutate();
  }

  if (isLoading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={K.colors.darkGreen} />
        </View>
      </SafeAreaView>
    );
  }

  const cfg = status ? STATUS_CFG[status] : null;

  return (
    <SafeAreaView style={s.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : isKeyboardOpen ? "height" : undefined}
      >
        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={K.colors.textDark} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Become a Host</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {cfg && (
            <View style={[s.banner, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon as any} size={22} color={cfg.tint} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[s.bannerTitle, { color: cfg.tint }]}>{cfg.title}</Text>
                <Text style={s.bannerBody}>{cfg.body}</Text>
                {status === "rejected" && hostProfile?.rejectionReason ? (
                  <Text style={s.reason}>Reason: {hostProfile.rejectionReason}</Text>
                ) : null}
              </View>
            </View>
          )}

          {isApproved && (
            <TouchableOpacity
              style={s.primaryBtn}
              // Switches into the hosting tab bar, matching what the "Switch
              // to Hosting" row in Profile does once approved. Waits for the
              // token refresh rather than trusting the background effect
              // already finished — (provider)'s own layout redirects straight
              // back to /host if hostStatus in the store isn't "approved" yet.
              onPress={async () => {
                await refreshHostStatus();
                router.replace("/(provider)" as any);
              }}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>Go to My Listings</Text>
              <Ionicons name="arrow-forward" size={17} color="#fff" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          )}

          {!status && (
            <Text style={s.intro}>
              Tell us about your business. An admin reviews every application before you can
              publish listings.
            </Text>
          )}

          {/* Hidden once approved — see canEdit above. */}
          {!isApproved && (
            <View style={s.card}>
              <Field
                label="Business Name *"
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="Ada's Getaways"
                editable={canEdit}
                autoCapitalize="words"
              />
              <Field
                label="Registration Number"
                value={registrationNo}
                onChangeText={setRegistrationNo}
                placeholder="Optional"
                editable={canEdit}
              />
              <Field
                label="Tax ID"
                value={taxId}
                onChangeText={setTaxId}
                placeholder="Optional"
                editable={canEdit}
              />
              <Field
                label="Documents Link"
                value={documentsUrl}
                onChangeText={setDocumentsUrl}
                placeholder="https://drive.google.com/..."
                editable={canEdit}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
          )}

          {error ? (
            <View style={s.errBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#B91C1C" />
              <Text style={s.errText}>{error}</Text>
            </View>
          ) : null}

          {canEdit && (
            <TouchableOpacity
              style={[s.primaryBtn, mutation.isPending && s.primaryBtnDisabled]}
              onPress={handleSubmit}
              disabled={mutation.isPending}
              activeOpacity={0.85}
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.primaryBtnText}>
                  {status === "rejected" ? "Resubmit Application" : "Submit Application"}
                </Text>
              )}
            </TouchableOpacity>
          )}
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
  editable = true,
  autoCapitalize,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  editable?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "url";
}) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.fieldInput, !editable && s.fieldInputDisabled]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={K.colors.textMuted}
        editable={editable}
        autoCapitalize={autoCapitalize ?? "none"}
        keyboardType={keyboardType ?? "default"}
      />
    </View>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: K.colors.bgApp },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

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
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: K.colors.bgSubtle,
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: K.colors.textDark },

  scroll: { padding: 16, paddingBottom: 40 },

  intro: { fontSize: 13, color: K.colors.textMid, lineHeight: 19, marginBottom: 16 },

  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  bannerTitle: { fontSize: 14, fontWeight: "700", marginBottom: 3 },
  bannerBody: { fontSize: 12.5, color: K.colors.textMid, lineHeight: 18 },
  reason: { fontSize: 12.5, color: "#B91C1C", marginTop: 6, fontWeight: "600" },

  card: {
    backgroundColor: K.colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: K.colors.border,
    marginBottom: 16,
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
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: K.colors.textDark,
    backgroundColor: K.colors.bgSubtle,
  },
  fieldInputDisabled: { opacity: 0.6 },

  errBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errText: { flex: 1, fontSize: 12.5, color: "#B91C1C" },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: K.colors.darkGreen,
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 12,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
