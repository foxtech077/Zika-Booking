import { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getApplicableVouchers, validateVoucher } from "../../services/voucher-service";
import type { ApplicableVoucher, ActivityScope } from "../../lib/types/voucher";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  totalAmount: number;
  currency: string;
  activity: ActivityScope;
  guestId: string;
  guestTier?: string | null;
  guestCountry?: string | null;
  onApplied: (discountAmount: number, code: string) => void;
  onCleared: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

function discountLabel(v: ApplicableVoucher, currency: string): string {
  if (v.discountType === "percentage") {
    const pct = `${v.discountValue}% OFF`;
    return v.maxDiscount != null
      ? `${pct} · max ${currency} ${v.maxDiscount.toLocaleString()}`
      : pct;
  }
  return `${currency} ${v.discountValue.toLocaleString()} OFF`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VoucherSelector({
  totalAmount,
  currency,
  activity,
  guestId,
  guestTier,
  guestCountry,
  onApplied,
  onCleared,
}: Props) {
  const [inputText, setInputText]       = useState("");
  const [isOpen, setIsOpen]             = useState(false);
  const [vouchers, setVouchers]         = useState<ApplicableVoucher[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [appliedCode, setAppliedCode]   = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<number | null>(null);
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);

  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownAnim = useRef(new Animated.Value(0)).current;

  // ── Fetch applicable vouchers once on mount ───────────────────────────────
  useEffect(() => {
    void (async () => {
      setFetchLoading(true);
      try {
        const list = await getApplicableVouchers(totalAmount, currency);
        console.log(
          `[VoucherSelector] API returned ${list.length} voucher(s):`,
          list.map((v) => `${v.code} (applicable=${v.applicable}, discount=${v.computedDiscount})`),
        );
        setVouchers(list);
      } catch (err) {
        console.warn("[VoucherSelector] Failed to fetch applicable vouchers:", err);
        // silently degrade — user can still type a code manually
      } finally {
        setFetchLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Animate dropdown (maxHeight + opacity, no layout jump) ───────────────
  useEffect(() => {
    Animated.spring(dropdownAnim, {
      toValue: isOpen ? 1 : 0,
      useNativeDriver: false,
      speed: 22,
      bounciness: 2,
    }).start();
  }, [isOpen, dropdownAnim]);

  const animMaxHeight = dropdownAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 400],
  });

  // ── Filtered voucher list ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = inputText.trim().toUpperCase();
    const result = !q
      ? vouchers
      : vouchers.filter(
          (v) =>
            v.code.includes(q) ||
            (v.title ?? "").toUpperCase().includes(q),
        );
    console.log(
      `[VoucherSelector] Showing ${result.length} / ${vouchers.length} voucher(s)` +
        (q ? ` (filter: "${q}")` : ""),
    );
    return result;
  }, [vouchers, inputText]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function clearAll() {
    setAppliedCode("");
    setAppliedDiscount(null);
    setInputText("");
    setErrorMsg(null);
    onCleared();
  }

  function handleTextChange(text: string) {
    const upper = text.toUpperCase();
    setInputText(upper);
    setErrorMsg(null);

    if (appliedCode) {
      setAppliedCode("");
      setAppliedDiscount(null);
      onCleared();
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = upper.trim();
    if (trimmed.length >= 4) {
      debounceRef.current = setTimeout(() => void doValidate(trimmed), 500);
    }
  }

  async function doValidate(code: string) {
    if (!code || isValidating) return;
    setIsValidating(true);
    setErrorMsg(null);
    try {
      const result = await validateVoucher({
        code,
        totalAmount,
        currency,
        activity,
        guestId,
        guestTier: guestTier ? capitalize(guestTier) : undefined,
        guestCountry: guestCountry ?? undefined,
      });
      if (result.valid) {
        setAppliedCode(code);
        setAppliedDiscount(result.discountAmount);
        setIsOpen(false);
        onApplied(result.discountAmount, code);
      } else {
        setErrorMsg(result.message);
      }
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.message ??
        err?.response?.data?.error?.message ??
        "Could not validate voucher. Please try again.",
      );
    } finally {
      setIsValidating(false);
    }
  }

  function handleSelectVoucher(v: ApplicableVoucher) {
    setInputText(v.code);
    setIsOpen(false);
    void doValidate(v.code);
  }

  // ── Derived flags ─────────────────────────────────────────────────────────

  const isApplied     = !!appliedCode;
  const showApplyBtn  = !isApplied && !isValidating && inputText.trim().length > 0;
  const canOpenChevron = !isApplied && !isValidating;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View>
      <Text style={s.label}>Voucher / Promo code</Text>

      {/* Input row */}
      <View style={[s.inputWrap, isApplied && s.inputWrapApplied]}>
        <Ionicons
          name="pricetag-outline"
          size={17}
          color={isApplied ? "#16a34a" : "#6b7280"}
          style={s.leadIcon}
        />

        <TextInput
          style={s.input}
          value={inputText}
          onChangeText={handleTextChange}
          onFocus={() => canOpenChevron && setIsOpen(true)}
          placeholder="Type or select a voucher"
          placeholderTextColor="#9ca3af"
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!isApplied && !isValidating}
          returnKeyType="done"
          onSubmitEditing={() => {
            const trimmed = inputText.trim();
            if (trimmed) void doValidate(trimmed);
          }}
        />

        {isValidating ? (
          <ActivityIndicator size="small" color="#16a34a" style={{ marginRight: 10 }} />
        ) : isApplied ? (
          <TouchableOpacity
            onPress={clearAll}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={s.trailBtn}
          >
            <Ionicons name="close-circle" size={20} color="#dc2626" />
          </TouchableOpacity>
        ) : showApplyBtn ? (
          <TouchableOpacity
            onPress={() => void doValidate(inputText.trim())}
            style={s.applyBtn}
          >
            <Text style={s.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => canOpenChevron && setIsOpen((o) => !o)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={s.trailBtn}
          >
            <Ionicons
              name={isOpen ? "chevron-up-outline" : "chevron-down-outline"}
              size={18}
              color="#6b7280"
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Animated dropdown */}
      <Animated.View
        style={[s.dropdown, { maxHeight: animMaxHeight, opacity: dropdownAnim }]}
      >
        {/* ScrollView ensures all vouchers are reachable even when the list
            exceeds the animated maxHeight (400 px ≈ 5 rows). Without it,
            rows beyond the height boundary are clipped by overflow: "hidden"
            and the user has no way to reach them. */}
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={filtered.length > 4}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {fetchLoading ? (
            <View style={s.ddCenter}>
              <ActivityIndicator color="#16a34a" size="small" />
              <Text style={s.ddLoadText}>Loading vouchers…</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={s.ddCenter}>
              <Ionicons name="ticket-outline" size={32} color="#d1d5db" />
              <Text style={s.ddEmptyText}>No vouchers available</Text>
            </View>
          ) : (
            filtered.map((v, idx) => (
              <TouchableOpacity
                key={v.code}
                style={[
                  s.voucherRow,
                  idx < filtered.length - 1 && s.voucherRowBorder,
                  !v.applicable && s.voucherRowDisabled,
                ]}
                onPress={() => v.applicable && handleSelectVoucher(v)}
                disabled={!v.applicable}
                activeOpacity={v.applicable ? 0.7 : 1}
              >
                {/* Icon */}
                <View
                  style={[
                    s.voucherIconWrap,
                    { backgroundColor: v.applicable ? "#f0fdf4" : "#f9fafb" },
                  ]}
                >
                  <Ionicons
                    name="pricetag"
                    size={15}
                    color={v.applicable ? "#16a34a" : "#9ca3af"}
                  />
                </View>

                {/* Text block */}
                <View style={{ flex: 1 }}>
                  {/* Title row */}
                  <View style={s.voucherTopRow}>
                    <Text
                      style={[s.voucherCode, !v.applicable && s.textMuted]}
                      numberOfLines={1}
                    >
                      {v.title ?? v.code}
                    </Text>
                    {v.applicable && (
                      <View style={s.savingsBadge}>
                        <Text style={s.savingsBadgeText}>
                          {currency} {v.computedDiscount.toLocaleString()} off
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Code (when title differs) */}
                  {v.title && v.title !== v.code && (
                    <Text style={[s.voucherSubCode, !v.applicable && s.textMuted]}>
                      {v.code}
                    </Text>
                  )}

                  {/* Discount description */}
                  <Text style={[s.voucherDiscountText, !v.applicable && s.textMuted]}>
                    {discountLabel(v, currency)}
                  </Text>

                  {/* Reason (when not applicable) */}
                  {!v.applicable && v.reason ? (
                    <Text style={s.voucherReason} numberOfLines={2}>
                      {v.reason}
                    </Text>
                  ) : null}
                </View>

                {v.applicable && (
                  <Ionicons
                    name="chevron-forward"
                    size={13}
                    color="#9ca3af"
                    style={{ marginLeft: 4 }}
                  />
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </Animated.View>

      {/* Applied success banner */}
      {isApplied && appliedDiscount != null && (
        <View style={s.appliedBanner}>
          <Ionicons name="checkmark-circle" size={15} color="#15803d" />
          <Text style={s.appliedText}>
            Voucher applied{" · "}
            <Text style={{ fontWeight: "800" }}>
              saving {currency} {appliedDiscount.toLocaleString()}
            </Text>
          </Text>
        </View>
      )}

      {/* Error */}
      {errorMsg && !isApplied && (
        <View style={s.errorRow}>
          <Ionicons name="alert-circle-outline" size={14} color="#dc2626" />
          <Text style={s.errorText} numberOfLines={3}>
            {errorMsg}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },

  // Input row
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingLeft: 10,
  },
  inputWrapApplied: {
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
  },
  leadIcon: {
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    paddingVertical: 11,
    letterSpacing: 0.5,
  },
  trailBtn: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  applyBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 6,
  },
  applyBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },

  // Dropdown
  dropdown: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    marginTop: 4,
    overflow: "hidden",
  },
  ddCenter: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 8,
  },
  ddLoadText: {
    fontSize: 13,
    color: "#6b7280",
  },
  ddEmptyText: {
    fontSize: 13,
    color: "#9ca3af",
    fontWeight: "500",
  },

  // Voucher row
  voucherRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  voucherRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  voucherRowDisabled: {
    opacity: 0.55,
  },
  voucherIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  voucherTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  voucherCode: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: 0.3,
  },
  voucherSubCode: {
    fontSize: 11,
    color: "#6b7280",
    letterSpacing: 0.5,
    marginTop: 1,
  },
  voucherDiscountText: {
    fontSize: 12,
    color: "#374151",
    marginTop: 2,
  },
  voucherReason: {
    fontSize: 11,
    color: "#d97706",
    marginTop: 3,
  },
  textMuted: {
    color: "#9ca3af",
  },
  savingsBadge: {
    backgroundColor: "#dcfce7",
    borderRadius: 100,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  savingsBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#15803d",
  },

  // Applied banner
  appliedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  appliedText: {
    fontSize: 13,
    color: "#15803d",
    flex: 1,
  },

  // Error
  errorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    marginTop: 7,
  },
  errorText: {
    fontSize: 13,
    color: "#dc2626",
    flex: 1,
    lineHeight: 18,
  },
});
