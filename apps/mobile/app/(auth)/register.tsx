import { useState } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Modal,
  FlatList,
  ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { registerSchema } from "@zika/validators";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/auth";
import { handleRoleAndStatusRedirect, GoogleSignInButton } from "./login";
import type { ApiResponse, PublicUser } from "@zika/types";
import { useKeyboard } from "../../hooks/useKeyboard";
import { ALL_COUNTRIES, POPULAR_COUNTRIES, type CountryData } from "../../constants/countries";

const { height: SCREEN_H } = Dimensions.get("window");

const GREEN    = "#024622";
const ACCENT   = "#1D8D2B";
const TEAL     = "#0D7377";      // provider accent tint
const TEXT     = "#111827";
const MUTED    = "#6B7280";
const BORDER   = "#E5E7EB";
const INPUT_BG = "#F3F4F6";
const ERR      = "#EF4444";

interface FieldErrors {
  firstName?:      string;
  lastName?:       string;
  email?:          string;
  password?:       string;
  confirmPassword?: string;
  businessName?:   string;
  country?:        string;
  general?:        string;
}

export default function RegisterScreen() {
  const setAuth          = useAuthStore((s) => s.setAuth);
  const setLocalCurrency = useAuthStore((s) => s.setLocalCurrency);
  const isKeyboardOpen = useKeyboard();

  const params = useLocalSearchParams<{ userType?: string }>();
  const [userType, setUserType] = useState<"guest" | "provider">(
    params.userType === "provider" ? "provider" : "guest"
  );
  const [form, setForm] = useState({
    firstName:       "",
    lastName:        "",
    email:           "",
    password:        "",
    confirmPassword: "",
    businessName:    "",
    country:         "",
    phone:           "",
  });
  const [errors,             setErrors]             = useState<FieldErrors>({});
  const [showPass,           setShowPass]           = useState(false);
  const [showConfirm,        setShowConfirm]        = useState(false);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [countrySearch,      setCountrySearch]      = useState("");
  const [selectedCountry,    setSelectedCountry]    = useState<CountryData | null>(null);
  const [privacyAccepted,    setPrivacyAccepted]    = useState(false);

  const set = (key: keyof typeof form) => (v: string) =>
    setForm((prev) => ({ ...prev, [key]: v }));

  const clearErr = (key: keyof FieldErrors) =>
    setErrors((prev) => ({ ...prev, [key]: undefined }));

  // ── Mutation ────────────────────────────────────────────────────────────────
  const registerMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        firstName:       form.firstName.trim(),
        lastName:        form.lastName.trim(),
        email:           form.email.trim(),
        password:        form.password,
        confirmPassword: form.confirmPassword,
        userType,
        businessName:    userType === "provider" ? form.businessName.trim() || undefined : undefined,
        country:         form.country || undefined,
        phone:           userType === "provider" ? form.phone.trim() || undefined : undefined,
      };
      const res = await api.post<ApiResponse<{
        message?: string;
        user?:   PublicUser;
        tokens?: { accessToken: string };
      }>>("auth/register", payload);
      return res.data;
    },
    onSuccess: async (data) => {
      if (data.success && data.data?.user && data.data?.tokens) {
        await setAuth(data.data.user, data.data.tokens.accessToken);
        handleRoleAndStatusRedirect(data.data.user);
      } else {
        router.push({ pathname: "/(auth)/verify-pending", params: { email: form.email } });
      }
    },
    onError: (err: unknown) => {
      const data = (err as any)?.response?.data;
      if (data && !data.success && data.error && typeof data.error === "object") {
        const e       = data.error as { code?: string; message?: string; fields?: Record<string, string> };
        const fields  = e.fields ?? {};
        const hasF    = Object.keys(fields).length > 0;
        setErrors({ ...fields, general: hasF ? undefined : (e.message ?? "Something went wrong.") });
      } else {
        setErrors({ general: "Something went wrong. Please check your connection and try again." });
      }
    },
  });

  // ── Country ──────────────────────────────────────────────────────────────────
  const handleSelectCountry = (c: CountryData) => {
    setSelectedCountry(c);
    set("country")(c.code);
    clearErr("country");
    void setLocalCurrency(c.currency);
    setCountryModalVisible(false);
    setCountrySearch("");
  };

  const filteredCountries = ALL_COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.code.toLowerCase().includes(countrySearch.toLowerCase()),
  );

  // ── Validation ───────────────────────────────────────────────────────────────
  function validate(): boolean {
    const payload = {
      firstName:       form.firstName.trim(),
      lastName:        form.lastName.trim(),
      email:           form.email.trim(),
      password:        form.password,
      confirmPassword: form.confirmPassword,
      userType,
      businessName:    userType === "provider" ? form.businessName.trim() || undefined : undefined,
      country:         form.country || undefined,
    };
    const result = registerSchema.safeParse(payload);
    if (!result.success) {
      const fe: FieldErrors = {};
      for (const issue of result.error.issues) {
        const k = issue.path[0] as keyof FieldErrors;
        if (k && !fe[k]) fe[k] = issue.message;
      }
      fe.general = "Please fix the errors above and try again.";
      setErrors(fe);
      return false;
    }
    setErrors({});
    return true;
  }

  function handleSubmit() {
    if (!privacyAccepted) {
      setErrors({ general: "Please accept the Privacy Policy to continue." });
      return;
    }
    try {
      if (validate()) registerMutation.mutate();
    } catch {
      setErrors({ general: "An unexpected error occurred. Please try again." });
    }
  }

  // ── Hero colours change by account type ─────────────────────────────────────
  const isProvider     = userType === "provider";
  const heroBg         = isProvider ? "#011F2E" : GREEN;
  const heroAccent     = isProvider ? TEAL      : ACCENT;
  const btnColor       = isProvider ? "#0D7377" : GREEN;
  const heroTagline    = isProvider ? "List your property, grow your business" : "Discover & book premium stays";
  const heroTitle      = isProvider ? "Partner Host" : "Traveller";

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView
      style={ss.root}
      edges={Platform.OS === "android" ? ["top", "bottom"] : ["top"]}
    >
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
      {/* Back button (fixed / floating) */}
      <TouchableOpacity style={ss.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </TouchableOpacity>

      <ScrollView
        style={{
          flex: 1,
          backgroundColor: "#fff",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
        }}
        contentContainerStyle={ss.formContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero section ── */}
        <ImageBackground
          source={require("../../assets/splash.png")}
          style={[ss.hero, { height: Math.round(SCREEN_H * 0.43) }]}
          resizeMode="contain"
        >
          <View style={ss.heroOverlay} />
        </ImageBackground>

        <View style={{ paddingHorizontal: 24, marginTop: -30 }}>
          <Text style={ss.cardTitle}>Create Account</Text>
        {/* ── Account type tabs ── */}
        <View style={ss.tabRow}>
          <TouchableOpacity
            style={[ss.tab, userType === "guest" && ss.tabActive]}
            onPress={() => { setUserType("guest"); setErrors({}); }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="airplane-outline"
              size={15}
              color={userType === "guest" ? GREEN : MUTED}
              style={{ marginRight: 6 }}
            />
            <Text style={[ss.tabTxt, userType === "guest" && ss.tabTxtActive]}>Traveller</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[ss.tab, userType === "provider" && [ss.tabActive, ss.tabActiveProvider]]}
            onPress={() => { setUserType("provider"); setErrors({}); }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="home-outline"
              size={15}
              color={userType === "provider" ? TEAL : MUTED}
              style={{ marginRight: 6 }}
            />
            <Text style={[ss.tabTxt, userType === "provider" && [ss.tabTxtActive, { color: TEAL }]]}>
              Partner Host
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Section header ── */}
        <Text style={ss.sectionTitle}>
          {isProvider ? "Provider Details" : "Personal Details"}
        </Text>

        {/* ── First Name ── */}
        <View style={ss.field}>
          <Text style={ss.label}>First Name</Text>
          <View style={[ss.inputBox, errors.firstName ? ss.inputErr : null]}>
            <TextInput
              style={ss.input}
              value={form.firstName}
              onChangeText={(v) => { set("firstName")(v); clearErr("firstName"); }}
              placeholder="Ada"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          {errors.firstName ? <Text style={ss.fieldErr}>{errors.firstName}</Text> : null}
        </View>

        {/* ── Last Name ── */}
        <View style={ss.field}>
          <Text style={ss.label}>Last Name</Text>
          <View style={[ss.inputBox, errors.lastName ? ss.inputErr : null]}>
            <TextInput
              style={ss.input}
              value={form.lastName}
              onChangeText={(v) => { set("lastName")(v); clearErr("lastName"); }}
              placeholder="Okafor"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          {errors.lastName ? <Text style={ss.fieldErr}>{errors.lastName}</Text> : null}
        </View>

        {/* ── Email ── */}
        <View style={ss.field}>
          <Text style={ss.label}>Email Address</Text>
          <View style={[ss.inputRow, errors.email ? ss.inputErr : null]}>
            <Ionicons name="mail-outline" size={17} color={MUTED} style={ss.inputIcon} />
            <TextInput
              style={ss.input}
              value={form.email}
              onChangeText={(v) => { set("email")(v); clearErr("email"); }}
              placeholder="you@example.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>
          {errors.email ? <Text style={ss.fieldErr}>{errors.email}</Text> : null}
        </View>

        {/* ── Provider fields ── */}
        {isProvider && (
          <>
            <Text style={[ss.sectionTitle, { marginTop: 4 }]}>Business Details</Text>

            <View style={ss.field}>
              <Text style={ss.label}>Business Name</Text>
              <View style={[ss.inputRow, errors.businessName ? ss.inputErr : null]}>
                <Ionicons name="business-outline" size={17} color={MUTED} style={ss.inputIcon} />
                <TextInput
                  style={ss.input}
                  value={form.businessName}
                  onChangeText={(v) => { set("businessName")(v); clearErr("businessName"); }}
                  placeholder="Serena Hotels Ltd."
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              {errors.businessName ? <Text style={ss.fieldErr}>{errors.businessName}</Text> : null}
            </View>

            <View style={ss.field}>
              <Text style={ss.label}>Country</Text>
              <TouchableOpacity
                style={[ss.inputRow, errors.country ? ss.inputErr : null]}
                onPress={() => setCountryModalVisible(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="globe-outline" size={17} color={MUTED} style={ss.inputIcon} />
                <Text style={[ss.input, { paddingVertical: 13, color: selectedCountry ? TEXT : "#9CA3AF" }]}>
                  {selectedCountry ? `${selectedCountry.flag}  ${selectedCountry.name}` : "Select your country"}
                </Text>
                <Ionicons name="chevron-down" size={14} color={MUTED} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
              {errors.country ? <Text style={ss.fieldErr}>{errors.country}</Text> : null}
            </View>

            <View style={ss.field}>
              <Text style={ss.label}>Phone number</Text>
              <View style={[ss.inputRow, errors.phone ? ss.inputErr : null]}>
                <Ionicons name="call-outline" size={17} color={MUTED} style={ss.inputIcon} />
                <TextInput
                  style={ss.input}
                  value={form.phone}
                  onChangeText={(v) => {
                    const cleaned = v.replace(/[^+\d\s-]/g, "");
                    set("phone")(cleaned);
                    clearErr("phone");
                  }}
                  placeholder="+254 712 345 678"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                />
              </View>
              {errors.phone ? <Text style={ss.fieldErr}>{errors.phone}</Text> : null}
            </View>
          </>
        )}

        {/* ── Security section ── */}
        <Text style={[ss.sectionTitle, { marginTop: 4 }]}>Security</Text>

        {/* Password */}
        <View style={ss.field}>
          <Text style={ss.label}>Password</Text>
          <View style={[ss.inputRow, errors.password ? ss.inputErr : null]}>
            <Ionicons name="lock-closed-outline" size={17} color={MUTED} style={ss.inputIcon} />
            <TextInput
              style={ss.input}
              value={form.password}
              onChangeText={(v) => { set("password")(v); clearErr("password"); }}
              placeholder="Min. 8 chars, uppercase, number, symbol"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPass}
            />
            <TouchableOpacity onPress={() => setShowPass((p) => !p)} style={ss.eye}>
              <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={17} color={MUTED} />
            </TouchableOpacity>
          </View>
          {errors.password ? <Text style={ss.fieldErr}>{errors.password}</Text> : null}
        </View>

        {/* Confirm Password */}
        <View style={ss.field}>
          <Text style={ss.label}>Confirm Password</Text>
          <View style={[ss.inputRow, errors.confirmPassword ? ss.inputErr : null]}>
            <Ionicons name="lock-closed-outline" size={17} color={MUTED} style={ss.inputIcon} />
            <TextInput
              style={ss.input}
              value={form.confirmPassword}
              onChangeText={(v) => { set("confirmPassword")(v); clearErr("confirmPassword"); }}
              placeholder="Repeat your password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showConfirm}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <TouchableOpacity onPress={() => setShowConfirm((p) => !p)} style={ss.eye}>
              <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={17} color={MUTED} />
            </TouchableOpacity>
          </View>
          {errors.confirmPassword ? <Text style={ss.fieldErr}>{errors.confirmPassword}</Text> : null}
        </View>

        {/* Privacy Policy checkbox */}
        <TouchableOpacity
          style={ss.checkRow}
          onPress={() => setPrivacyAccepted((v) => !v)}
          activeOpacity={0.75}
        >
          <View style={[ss.checkbox, privacyAccepted && { backgroundColor: btnColor, borderColor: btnColor }]}>
            {privacyAccepted && <Ionicons name="checkmark" size={13} color="#fff" />}
          </View>
          <Text style={ss.checkLabel}>
            I have read and agree to the{" "}
            <Text
              style={[ss.checkLink, { color: btnColor }]}
              onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "privacy" } } as any)}
            >
              Privacy Policy
            </Text>
          </Text>
        </TouchableOpacity>

        {/* General error */}
        {errors.general ? (
          <View style={ss.errBox}>
            <Ionicons name="alert-circle-outline" size={15} color={ERR} />
            <Text style={ss.errTxt}>{errors.general}</Text>
          </View>
        ) : null}

        {/* Submit button */}
        <TouchableOpacity
          style={[ss.btn, { backgroundColor: btnColor }, (registerMutation.isPending || !privacyAccepted) && ss.btnDim]}
          onPress={handleSubmit}
          disabled={registerMutation.isPending || !privacyAccepted}
          activeOpacity={0.85}
        >
          {registerMutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={ss.btnTxt}>
                {isProvider ? "Register as Partner Host" : "Create Traveller Account"}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>

        {/* Google sign-in (travellers only) */}
        {!isProvider && (
          <>
            <View style={ss.divRow}>
              <View style={ss.divLine} />
              <Text style={ss.divTxt}>or</Text>
              <View style={ss.divLine} />
            </View>
            <GoogleSignInButton onError={(msg) => setErrors({ general: msg })} />
          </>
        )}

        {/* Sign in link */}
        <View style={ss.linkRow}>
          <Text style={ss.linkTxt}>Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={ss.link}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
        </View>
      </ScrollView>

      {/* ── Country picker modal ── */}
      <Modal
        animationType="slide"
        transparent
        visible={countryModalVisible}
        onRequestClose={() => setCountryModalVisible(false)}
      >
        <View style={ss.modalBack}>
          <View style={ss.modalSheet}>
            {/* Handle */}
            <View style={ss.modalHandle} />

            <View style={ss.modalHeader}>
              <Text style={ss.modalTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => setCountryModalVisible(false)} style={ss.modalClose}>
                <Ionicons name="close" size={20} color={TEXT} />
              </TouchableOpacity>
            </View>

            <View style={ss.searchBox}>
              <Ionicons name="search-outline" size={16} color={MUTED} />
              <TextInput
                style={ss.searchInput}
                value={countrySearch}
                onChangeText={setCountrySearch}
                placeholder="Search country name or code…"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoFocus
              />
            </View>

            {!countrySearch && (
              <View style={ss.popularSection}>
                <Text style={ss.popularTitle}>Popular</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingRight: 24 }}
                >
                  {POPULAR_COUNTRIES.map((c) => (
                    <TouchableOpacity
                      key={c.code}
                      style={ss.popularChip}
                      onPress={() => handleSelectCountry(c)}
                    >
                      <Text style={ss.popularChipTxt}>{c.flag}  {c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text style={ss.listLabel}>
              {countrySearch ? "Results" : "All Countries"}
            </Text>

            <FlatList
              data={filteredCountries}
              keyExtractor={(c) => c.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[ss.countryRow, selectedCountry?.code === item.code && ss.countryRowActive]}
                  onPress={() => handleSelectCountry(item)}
                >
                  <Text style={ss.countryFlag}>{item.flag}</Text>
                  <Text style={ss.countryName}>{item.name}</Text>
                  <Text style={ss.countryCode}>{item.code}</Text>
                  {selectedCountry?.code === item.code && (
                    <Ionicons name="checkmark-circle" size={18} color={TEAL} style={{ marginLeft: "auto" }} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Text style={{ color: MUTED }}>No countries found</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: GREEN },

  // Hero
  hero: {
    width: "100%",
    justifyContent: "flex-end",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    marginBottom: 16,
    overflow: "hidden",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  backBtn: {
    position: "absolute",
    top: 48,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },

  // Form
  formScroll:   { flex: 1, backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  formContent:  { paddingTop: 24, paddingBottom: 40 },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: TEXT,
    marginBottom: 14,
    letterSpacing: -0.3,
  },

  // Tab row
  tabRow: {
    flexDirection: "row", gap: 10, marginBottom: 22,
    backgroundColor: INPUT_BG, borderRadius: 12, padding: 4,
  },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 10, borderRadius: 10,
  },
  tabActive:         { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabActiveProvider: { },
  tabTxt:            { fontSize: 13, fontWeight: "600", color: MUTED },
  tabTxtActive:      { color: GREEN },

  // Section header
  sectionTitle: {
    fontSize: 11, fontWeight: "700", color: MUTED,
    textTransform: "uppercase", letterSpacing: 1.2,
    marginBottom: 12,
  },

  // Name row
  nameRow: { flexDirection: "row", gap: 10 },

  // Fields
  field:    { marginBottom: 14 },
  label:    { fontSize: 13, fontWeight: "600", color: TEXT, marginBottom: 7 },
  inputBox: {
    backgroundColor: INPUT_BG, borderRadius: 12,
    borderWidth: 1.5, borderColor: BORDER,
    paddingHorizontal: 14,
  },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: INPUT_BG, borderRadius: 12,
    borderWidth: 1.5, borderColor: BORDER,
    paddingHorizontal: 14,
  },
  inputErr:  { borderColor: ERR },
  inputIcon: { marginRight: 10 },
  input:     { flex: 1, paddingVertical: 13, fontSize: 15, color: TEXT },
  eye:       { paddingVertical: 13, paddingLeft: 8 },
  fieldErr:  { fontSize: 12, color: ERR, marginTop: 5 },

  // Error banner
  errBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#FEF2F2", borderRadius: 10,
    borderWidth: 1.5, borderColor: "#FECACA",
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
  },
  errTxt: { flex: 1, color: "#DC2626", fontSize: 13, lineHeight: 18 },

  // Privacy checkbox
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
    paddingVertical: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: BORDER,
    backgroundColor: INPUT_BG,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  checkLabel: { flex: 1, fontSize: 13, color: TEXT, lineHeight: 20 },
  checkLink:  { fontWeight: "700", textDecorationLine: "underline" },

  // Button
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderRadius: 14, height: 52,
  },
  btnDim: { opacity: 0.6 },
  btnTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Divider
  divRow:  { flexDirection: "row", alignItems: "center", marginVertical: 20 },
  divLine: { flex: 1, height: 1, backgroundColor: BORDER },
  divTxt:  { marginHorizontal: 12, color: MUTED, fontSize: 12 },

  // Link row
  linkRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 22 },
  linkTxt: { color: MUTED, fontSize: 14 },
  link:    { color: ACCENT, fontSize: 14, fontWeight: "700" },

  // Country modal
  modalBack: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    height: SCREEN_H * 0.78,
    paddingTop: 12,
  },
  modalHandle: {
    width: 36, height: 4, backgroundColor: BORDER,
    borderRadius: 2, alignSelf: "center", marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: TEXT },
  modalClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: INPUT_BG, alignItems: "center", justifyContent: "center",
  },

  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 20, backgroundColor: INPUT_BG,
    borderRadius: 12, borderWidth: 1.5, borderColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 11, marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: 15, color: TEXT },

  popularSection: { paddingLeft: 20, marginBottom: 14 },
  popularTitle:   { fontSize: 11, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  popularChip: {
    backgroundColor: INPUT_BG, borderRadius: 20,
    borderWidth: 1.5, borderColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  popularChipTxt: { fontSize: 13, fontWeight: "600", color: TEXT },

  listLabel: {
    fontSize: 11, fontWeight: "700", color: MUTED,
    textTransform: "uppercase", letterSpacing: 1,
    paddingHorizontal: 20, marginBottom: 6,
  },

  countryRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
    gap: 12,
  },
  countryRowActive: { backgroundColor: "#F0FDF4" },
  countryFlag:      { fontSize: 22 },
  countryName:      { flex: 1, fontSize: 15, color: TEXT, fontWeight: "500" },
  countryCode:      { fontSize: 12, color: MUTED, fontWeight: "600" },
});
