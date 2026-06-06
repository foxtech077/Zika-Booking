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
} from "react-native";
import { Link, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { registerSchema } from "@zika/validators";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/auth";
import { K } from "../../constants/theme";
import { handleRoleAndStatusRedirect } from "./login";
import type { ApiResponse, PublicUser } from "@zika/types";
import { ALL_COUNTRIES, POPULAR_COUNTRIES, type CountryData } from "../../constants/countries";

const { height } = Dimensions.get("window");


interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  businessName?: string;
  country?: string;
  general?: string;
}

export default function RegisterScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setLocalCurrency = useAuthStore((s) => s.setLocalCurrency);

  const [userType, setUserType] = useState<"guest" | "provider">("guest");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    businessName: "",
    country: "",
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPass, setShowPass] = useState(false);

  // Country modal state
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);

  const set = (key: keyof typeof form) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const clearError = (key: keyof FieldErrors) =>
    setErrors((prev) => ({ ...prev, [key]: undefined }));

  const registerMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        confirmPassword: form.confirmPassword,
        userType,
        businessName: userType === "provider" ? form.businessName || undefined : undefined,
        country: form.country || undefined,
      };
      const res = await api.post<ApiResponse<{
        message?: string;
        user?: PublicUser;
        tokens?: { accessToken: string };
      }>>("/auth/register", payload);
      return res.data;
    },
    onSuccess: async (data) => {
      if (data.success && data.data?.user && data.data?.tokens) {
        await setAuth(data.data.user, data.data.tokens.accessToken);
        handleRoleAndStatusRedirect(data.data.user);
      } else {
        // Email verification required — go to verify-pending with resend capability
        router.push({ pathname: "/(auth)/verify-pending", params: { email: form.email } });
      }
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: ApiResponse<unknown> } };
      const data = axiosErr.response?.data;
      if (data && !data.success) {
        const fields = data.error.fields ?? {};
        setErrors({ ...fields, general: data.error.fields ? undefined : data.error.message });
      } else {
        setErrors({ general: "Something went wrong. Please check your connection and try again." });
      }
    },
  });

  const handleSelectCountry = (country: CountryData) => {
    setSelectedCountry(country);
    set("country")(country.code);
    clearError("country");
    void setLocalCurrency(country.currency);
    setCountryModalVisible(false);
    setCountrySearchQuery("");
  };

  const filteredCountries = ALL_COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(countrySearchQuery.toLowerCase())
  );

  function validate() {
    const payload = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      password: form.password,
      confirmPassword: form.confirmPassword,
      userType,
      businessName: userType === "provider" ? form.businessName || undefined : undefined,
      country: form.country || undefined,
    };

    const result = registerSchema.safeParse(payload);
    if (!result.success) {
      const fe: FieldErrors = {};
      for (const issue of result.error.issues) {
        const k = issue.path[0] as keyof FieldErrors;
        if (k && !fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      return false;
    }

    setErrors({});
    return true;
  }

  function handleSubmit() {
    if (validate()) registerMutation.mutate();
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.brandRow}>
          <View style={styles.logoContainer}>
            <Image
              source={require("../../assets/logo.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>

        <Text style={styles.headline}>Create{"\n"}Account</Text>
        <Text style={styles.subheadline}>Join our premium ecosystem today</Text>

        {/* Tab: Traveller / Partner Host */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, userType === "guest" && styles.tabButtonActive]}
            onPress={() => { setUserType("guest"); setErrors({}); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabButtonText, userType === "guest" && styles.tabButtonTextActive]}>
              Traveller
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, userType === "provider" && styles.tabButtonActive]}
            onPress={() => { setUserType("provider"); setErrors({}); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabButtonText, userType === "provider" && styles.tabButtonTextActive]}>
              Partner Host
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          {/* First / Last Name */}
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={[styles.input, errors.firstName ? styles.inputError : null]}
                value={form.firstName}
                onChangeText={(v) => { set("firstName")(v); clearError("firstName"); }}
                placeholder="Ada"
                placeholderTextColor={K.colors.textLightDim}
              />
              {errors.firstName ? <Text style={styles.fieldError}>{errors.firstName}</Text> : null}
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={[styles.input, errors.lastName ? styles.inputError : null]}
                value={form.lastName}
                onChangeText={(v) => { set("lastName")(v); clearError("lastName"); }}
                placeholder="Okafor"
                placeholderTextColor={K.colors.textLightDim}
              />
              {errors.lastName ? <Text style={styles.fieldError}>{errors.lastName}</Text> : null}
            </View>
          </View>

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              value={form.email}
              onChangeText={(v) => { set("email")(v); clearError("email"); }}
              placeholder="you@example.com"
              placeholderTextColor={K.colors.textLightDim}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
          </View>

          {/* Provider-only: Business Name */}
          {userType === "provider" && (
            <View style={styles.field}>
              <Text style={styles.label}>Business Name</Text>
              <TextInput
                style={[styles.input, errors.businessName ? styles.inputError : null]}
                value={form.businessName}
                onChangeText={(v) => { set("businessName")(v); clearError("businessName"); }}
                placeholder="Serena Hotels Ltd."
                placeholderTextColor={K.colors.textLightDim}
              />
              {errors.businessName ? <Text style={styles.fieldError}>{errors.businessName}</Text> : null}
            </View>
          )}

          {/* Country (both roles, sets local currency) */}
          <View style={styles.field}>
            <Text style={styles.label}>Country</Text>
            <TouchableOpacity
              style={[styles.input, styles.comboSelector, errors.country ? styles.inputError : null]}
              onPress={() => setCountryModalVisible(true)}
              activeOpacity={0.8}
            >
              {selectedCountry ? (
                <Text style={styles.selectedCountryText}>
                  {selectedCountry.flag} {selectedCountry.name} ({selectedCountry.code})
                </Text>
              ) : (
                <Text style={styles.placeholderText}>Search or select country</Text>
              )}
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>
            {errors.country ? <Text style={styles.fieldError}>{errors.country}</Text> : null}
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passRow}>
              <TextInput
                style={[styles.input, styles.inputFlex, errors.password ? styles.inputError : null]}
                value={form.password}
                onChangeText={(v) => { set("password")(v); clearError("password"); }}
                placeholder="Min. 8 characters"
                placeholderTextColor={K.colors.textLightDim}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass((v) => !v)}>
                <Text style={styles.eyeIcon}>{showPass ? "🙈" : "👁️"}</Text>
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}
          </View>

          {/* Confirm Password */}
          <View style={styles.field}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={[styles.input, errors.confirmPassword ? styles.inputError : null]}
              value={form.confirmPassword}
              onChangeText={(v) => { set("confirmPassword")(v); clearError("confirmPassword"); }}
              placeholder="Repeat password"
              placeholderTextColor={K.colors.textLightDim}
              secureTextEntry={!showPass}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            {errors.confirmPassword ? <Text style={styles.fieldError}>{errors.confirmPassword}</Text> : null}
          </View>

          {errors.general ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errors.general}</Text>
            </View>
          ) : null}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.primaryBtn, registerMutation.isPending && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={registerMutation.isPending}
            activeOpacity={0.85}
          >
            {registerMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {userType === "guest" ? "Create Account" : "Register as Partner"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already a member? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>

      {/* Country Selector Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={countryModalVisible}
        onRequestClose={() => setCountryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => setCountryModalVisible(false)}>
                <Text style={styles.modalCloseButton}>Close</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchBar}
              value={countrySearchQuery}
              onChangeText={setCountrySearchQuery}
              placeholder="Search by country name or code..."
              placeholderTextColor={K.colors.textMuted}
              autoCapitalize="none"
              autoFocus
            />

            {!countrySearchQuery && (
              <View style={styles.shortcutsWrapper}>
                <Text style={styles.shortcutsTitle}>Popular</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.shortcutsScroll}
                >
                  {POPULAR_COUNTRIES.map((item) => (
                    <TouchableOpacity
                      key={item.code}
                      style={styles.shortcutBtn}
                      onPress={() => handleSelectCountry(item)}
                    >
                      <Text style={styles.shortcutText}>{item.flag} {item.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text style={styles.listSectionTitle}>
              {countrySearchQuery ? "Search Results" : "All Countries"}
            </Text>

            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.countryItem}
                  onPress={() => handleSelectCountry(item)}
                >
                  <Text style={styles.countryItemText}>
                    <Text style={styles.countryFlag}>{item.flag}</Text> {item.name} ({item.code})
                  </Text>
                  <Text style={styles.countryDialCode}>{item.dialCode}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <View style={styles.emptyResults}>
                  <Text style={styles.emptyResultsText}>No countries match your search</Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.darkGreen },
  scroll: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },

  brandRow: { alignItems: "flex-start", marginBottom: 32 },
  logoContainer: {
    width: 130, height: 130, borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  logoImage: { width: 118, height: 118 },

  headline: { fontSize: K.font.xxxl, fontWeight: "800", color: "#fff", lineHeight: 38, letterSpacing: -0.5 },
  subheadline: { fontSize: K.font.base, color: K.colors.textLightMuted, marginTop: 8, marginBottom: 28 },

  tabContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: K.radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 4,
    marginBottom: 24,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: K.radius.sm,
  },
  tabButtonActive: { backgroundColor: K.colors.accent },
  tabButtonText: { color: K.colors.textLightMuted, fontWeight: "600", fontSize: K.font.sm },
  tabButtonTextActive: { color: "#fff", fontWeight: "700" },

  card: {
    backgroundColor: K.colors.glassBg,
    borderRadius: K.radius.xxl,
    borderWidth: 1,
    borderColor: K.colors.glassBorder,
    padding: 24,
  },
  row: { flexDirection: "row", gap: 12 },
  halfField: { flex: 1, marginBottom: 16 },
  field: { marginBottom: 16 },
  label: {
    fontSize: K.font.sm,
    fontWeight: "600",
    color: K.colors.textLightMuted,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: K.colors.glassInput,
    borderWidth: 1,
    borderColor: K.colors.glassInputBorder,
    borderRadius: K.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: K.font.base,
    color: K.colors.textLight,
    flex: 1,
  },
  inputFlex: { flex: 1 },
  inputError: { borderColor: K.colors.error },
  passRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  eyeBtn: {
    backgroundColor: K.colors.glassInput,
    borderWidth: 1,
    borderColor: K.colors.glassInputBorder,
    borderRadius: K.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  eyeIcon: { fontSize: 16 },
  fieldError: { fontSize: 12, color: "#FCA5A5", marginTop: 4 },

  comboSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 52,
  },
  selectedCountryText: { color: "#fff", fontSize: K.font.base, fontWeight: "600" },
  placeholderText: { color: K.colors.textLightDim, fontSize: K.font.base },
  dropdownArrow: { color: K.colors.textLightDim, fontSize: 10 },

  errorBox: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderRadius: K.radius.md,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.30)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  errorText: { color: "#FCA5A5", fontSize: K.font.sm, lineHeight: 20 },

  primaryBtn: {
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.md,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: "#fff", fontSize: K.font.lg, fontWeight: "700", letterSpacing: 0.3 },

  loginRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 24 },
  loginText: { color: K.colors.textLightMuted, fontSize: K.font.sm },
  loginLink: { color: K.colors.accentLight, fontSize: K.font.sm, fontWeight: "700" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(9,43,30,0.85)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: K.colors.darkGreen,
    borderTopLeftRadius: K.radius.xxl,
    borderTopRightRadius: K.radius.xxl,
    height: height * 0.75,
    paddingTop: 20,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: K.colors.glassBorder,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { color: "#fff", fontSize: K.font.xl, fontWeight: "800" },
  modalCloseButton: { color: K.colors.accentLight, fontSize: K.font.base, fontWeight: "700" },
  searchBar: {
    backgroundColor: K.colors.glassInput,
    borderWidth: 1,
    borderColor: K.colors.glassInputBorder,
    borderRadius: K.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#fff",
    fontSize: K.font.base,
    marginBottom: 20,
  },
  countryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.borderDark,
  },
  countryItemText: { color: "#fff", fontSize: K.font.base, fontWeight: "500" },
  countryFlag: { fontSize: 20 },
  countryDialCode: { color: K.colors.accentLight, fontSize: K.font.sm, fontWeight: "700" },
  emptyResults: { alignItems: "center", paddingVertical: 40 },
  emptyResultsText: { color: K.colors.textLightDim, fontSize: K.font.base },

  shortcutsWrapper: { marginBottom: 16 },
  shortcutsTitle: {
    color: K.colors.textLightMuted,
    fontSize: K.font.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  shortcutsScroll: { gap: 8, paddingRight: 24 },
  shortcutBtn: {
    backgroundColor: K.colors.glassInput,
    borderWidth: 1,
    borderColor: K.colors.glassInputBorder,
    borderRadius: K.radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  shortcutText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  listSectionTitle: {
    color: K.colors.textLightMuted,
    fontSize: K.font.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 8,
  },
});
