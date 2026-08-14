"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  Globe,
  KeyRound,
  MapPin,
  Phone,
  Shield,
  Star,
  User,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { AuthUser } from "@/stores/auth";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { CountryCombobox, WORLD_COUNTRIES } from "@/components/ui/CountryCombobox";
import { cn } from "@/lib/utils";
import { ALL_COUNTRIES, parsePhoneNumber } from "@/lib/countries";

// Must match the API's international format rule (see registerSchema /
// patchProfileSchema in the auth-service): a "+" country prefix is required.
const PHONE_REGEX = /^\+[1-9]\d{6,14}$/;

const TIER_CONFIG: Record<string, { label: string; className: string }> = {
  bronze:  { label: "Bronze",  className: "bg-amber-50 text-amber-800 border-amber-200" },
  silver:  { label: "Silver",  className: "bg-slate-100 text-slate-700 border-slate-300" },
  gold:    { label: "Gold",    className: "bg-yellow-50 text-yellow-800 border-yellow-300" },
  diamond: { label: "Diamond", className: "bg-cyan-50 text-cyan-800 border-cyan-200" },
};

function ProfileSkeleton() {
  return (
    <div className="flex items-center gap-4">
      <Skeleton className="h-16 w-16 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
    </div>
  );
}

type FeedbackMsg = { type: "success" | "error"; text: string } | null;

function FeedbackBanner({ msg, onDismiss }: { msg: FeedbackMsg; onDismiss: () => void }) {
  if (!msg) return null;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm",
        msg.type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-700",
      )}
    >
      <span>{msg.text}</span>
      <button type="button" className="shrink-0 text-xs underline opacity-70 hover:opacity-100" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}

export default function TravellerProfilePage() {
  const queryClient = useQueryClient();
  const { user: storedUser, updateUser, _hasHydrated } = useAuthStore();

  const {
    data: fetchedProfile,
    isLoading,
  } = useQuery({
    queryKey: ["traveller-profile"],
    queryFn: async (): Promise<AuthUser> => {
      const res = await api.get("/auth/me");
      const u: AuthUser = res.data?.data?.user ?? res.data?.user;
      if (u) updateUser(u);
      return u;
    },
    enabled: _hasHydrated,
    staleTime: 60_000,
  });

  const user = fetchedProfile ?? storedUser;

  const [profileForm, setProfileForm] = useState({
    firstName:    "",
    lastName:     "",
    businessName: "",
    country:      "",
  });

  const [phoneCountryCode, setPhoneCountryCode] = useState("+254");
  const [phoneLocalNumber, setPhoneLocalNumber] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [pwdForm, setPwdForm] = useState({
    currentPassword: "",
    newPassword:     "",
    confirmPassword: "",
  });

  const [profileMsg, setProfileMsg] = useState<FeedbackMsg>(null);
  const [pwdMsg,     setPwdMsg]     = useState<FeedbackMsg>(null);

  const countryDialOptions = useMemo(() => {
    const seen = new Set<string>();
    return ALL_COUNTRIES
      .filter((c) => (seen.has(c.dialCode) ? false : (seen.add(c.dialCode), true)))
      .map((c) => ({
        value: c.dialCode,
        label: `${c.flag} ${c.dialCode}`,
      }));
  }, []);

  // Populate edit form once profile arrives (runs once per identity)
  useEffect(() => {
    const source = fetchedProfile ?? storedUser;
    if (!source) return;
    setProfileForm({
      firstName:    source.firstName    ?? "",
      lastName:     source.lastName     ?? "",
      businessName: source.businessName ?? "",
      country:      source.country      ?? "",
    });
    const parsed = parsePhoneNumber(source.phone ?? "");
    setPhoneCountryCode(parsed.countryCode || "+254");
    setPhoneLocalNumber(parsed.localNumber);
  }, [fetchedProfile?.id ?? storedUser?.id]);

  // PATCH /auth/profile
  const profileMutation = useMutation({
    mutationFn: () => {
      const combinedPhone = buildCombinedPhone();
      return api.patch("/auth/profile", {
        firstName:    profileForm.firstName.trim(),
        lastName:     profileForm.lastName.trim(),
        businessName: profileForm.businessName.trim() || null,
        country:      profileForm.country || null,
        phone:        combinedPhone || null,
      });
    },
    onSuccess: (res) => {
      const updated: AuthUser = res.data?.data?.user ?? res.data?.user;
      if (updated) {
        updateUser(updated);
        setProfileForm((f) => ({
          ...f,
          firstName:    updated.firstName    ?? "",
          lastName:     updated.lastName     ?? "",
          businessName: updated.businessName ?? "",
          country:      updated.country      ?? "",
        }));
        const parsed = parsePhoneNumber(updated.phone ?? "");
        setPhoneCountryCode(parsed.countryCode || "+254");
        setPhoneLocalNumber(parsed.localNumber);
      }
      queryClient.invalidateQueries({ queryKey: ["traveller-profile"] });
      setFieldErrors({});
      setProfileMsg({ type: "success", text: "Profile updated successfully." });
    },
    onError: (err: any) => {
      const fields = err?.response?.data?.error?.fields;
      if (fields) setFieldErrors(fields);
      setProfileMsg({ type: "error", text: "Profile update failed. Please try again." });
    },
  });

  // POST /auth/change-password
  const passwordMutation = useMutation({
    mutationFn: () =>
      api.post("/auth/change-password", {
        currentPassword: pwdForm.currentPassword,
        newPassword:     pwdForm.newPassword,
        confirmPassword: pwdForm.confirmPassword,
      }),
    onSuccess: () => {
      setPwdForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPwdMsg({ type: "success", text: "Password updated successfully." });
    },
    onError: () => {
      setPwdMsg({ type: "error", text: "Password update failed. Please verify your current password." });
    },
  });

  const buildCombinedPhone = () => {
    if (!phoneLocalNumber) return "";
    const code = phoneCountryCode.startsWith("+") ? phoneCountryCode : `+${phoneCountryCode}`;
    return `${code}${phoneLocalNumber}`;
  };

  const handleProfileSave = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profileForm.firstName.trim() || !profileForm.lastName.trim()) {
      setProfileMsg({ type: "error", text: "First name and last name are required." });
      return;
    }
    const combinedPhone = buildCombinedPhone();
    if (phoneLocalNumber && !PHONE_REGEX.test(combinedPhone)) {
      setFieldErrors((prev) => ({ ...prev, phone: "Phone number must include the + country prefix in international format (e.g. +254712345678)." }));
      setProfileMsg({ type: "error", text: "Phone number must include the + country prefix in international format (e.g. +254712345678)." });
      return;
    }
    setProfileMsg(null);
    setFieldErrors({});
    profileMutation.mutate();
  };

  const handlePasswordSave = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdMsg({ type: "error", text: "New password and confirmation do not match." });
      return;
    }
    if (pwdForm.newPassword.length < 8) {
      setPwdMsg({ type: "error", text: "Password must be at least 8 characters." });
      return;
    }
    setPwdMsg(null);
    passwordMutation.mutate();
  };

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Traveller";
  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const tier = TIER_CONFIG[user?.currentTier?.toLowerCase() ?? "bronze"] ?? TIER_CONFIG.bronze;

  return (
    <>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_40%),linear-gradient(180deg,_#f8fafc_0%,_#f3f7f2_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Page header */}
        <Card
          className="mb-6 border-emerald-100 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur"
          padding="lg"
        >
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">
              My account
            </p>
            <h1 className="text-3xl font-bold text-slate-950">Profile</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-500">
              Manage your personal information and account security.
            </p>
          </div>
        </Card>

        {/* Identity strip */}
        <Card
          className="mb-6 border-slate-200/80 bg-white/95 shadow-[0_12px_40px_rgba(15,23,42,0.06)]"
          padding="lg"
        >
          {isLoading && !user ? (
            <ProfileSkeleton />
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xl font-bold text-white shadow-md">
                  {initials}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-950">{fullName}</h2>
                  <p className="text-sm text-slate-500">{user?.email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize",
                        tier?.className,
                      )}
                    >
                      {tier?.label} Member
                    </span>
                    {user?.emailVerified ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Email verified
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                        <XCircle className="h-3.5 w-3.5" />
                        Email unverified
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8 text-center">
                <div>
                  <p className="text-2xl font-bold text-slate-950">
                    {(user?.loyaltyPoints ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Loyalty Points
                  </p>
                </div>
                <div>
                  <p className="text-lg font-bold capitalize text-slate-950">{user?.status ?? "—"}</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Account Status
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Main grid */}
        <div className="grid gap-6 xl:grid-cols-[440px_1fr]">

          {/* Left: edit profile form */}
          <Card
            className="border-slate-200/80 bg-white/95 shadow-[0_12px_40px_rgba(15,23,42,0.06)]"
            padding="lg"
          >
            <SectionHeader
              title="Edit Profile"
              subtitle="Update your personal and business information"
            />

            <form onSubmit={handleProfileSave} className="space-y-6">
              {/* Personal Information */}
              <div>
                <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <User className="h-4 w-4 text-emerald-600" />
                  Personal Information
                </h3>
                <p className="mb-4 text-xs text-slate-500">
                  Your personal details and the country on your account.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="First name"
                    placeholder="Enter your first name"
                    value={profileForm.firstName}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, firstName: e.target.value }))
                    }
                    required
                    maxLength={60}
                    error={fieldErrors.firstName}
                  />
                  <Input
                    label="Last name"
                    placeholder="Enter your last name"
                    value={profileForm.lastName}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, lastName: e.target.value }))
                    }
                    required
                    maxLength={60}
                    error={fieldErrors.lastName}
                  />
                  <CountryCombobox
                    label="Country"
                    value={profileForm.country}
                    onChange={(code) => {
                      setProfileForm((f) => ({ ...f, country: code }));
                      setFieldErrors((prev) => ({ ...prev, country: "" }));
                    }}
                    error={fieldErrors.country}
                  />
                </div>
              </div>

              <div className="border-t border-slate-100" />

              {/* Business Information */}
              <div>
                <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Building2 className="h-4 w-4 text-emerald-600" />
                  Business Information
                </h3>
                <p className="mb-4 text-xs text-slate-500">
                  Shown to guests on your listings and used for payouts.
                </p>
                <div className="grid gap-4">
                  <Input
                    label="Business name"
                    placeholder="e.g. Serena Hotels Ltd"
                    value={profileForm.businessName}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, businessName: e.target.value }))
                    }
                    maxLength={255}
                    error={fieldErrors.businessName}
                  />
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Phone number
                    </label>
                    <div className="flex gap-2">
                      <div className="w-[110px] shrink-0">
                        <Select
                          value={phoneCountryCode}
                          onChange={(e) => {
                            setPhoneCountryCode(e.target.value);
                            setFieldErrors((prev) => ({ ...prev, phone: "" }));
                          }}
                          options={countryDialOptions}
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          value={phoneLocalNumber}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(/[^0-9]/g, "");
                            setPhoneLocalNumber(cleaned);
                            setFieldErrors((prev) => ({ ...prev, phone: "" }));
                          }}
                          placeholder="e.g. 712345678"
                          error={fieldErrors.phone}
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Optional — used for business contact and payouts.
                    </p>
                  </div>
                </div>
              </div>

              <FeedbackBanner msg={profileMsg} onDismiss={() => setProfileMsg(null)} />

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={profileMutation.isPending}
                  onClick={() => {
                    const source = fetchedProfile ?? storedUser;
                    setProfileForm({
                      firstName:    source?.firstName    ?? "",
                      lastName:     source?.lastName     ?? "",
                      businessName: source?.businessName ?? "",
                      country:      source?.country      ?? "",
                    });
                    const parsed = parsePhoneNumber(source?.phone ?? "");
                    setPhoneCountryCode(parsed.countryCode || "+254");
                    setPhoneLocalNumber(parsed.localNumber);
                    setFieldErrors({});
                    setProfileMsg(null);
                  }}
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  icon={<User />}
                  loading={profileMutation.isPending}
                  disabled={profileMutation.isPending}
                >
                  Save changes
                </Button>
              </div>
            </form>
          </Card>

          {/* Right column */}
          <div className="space-y-6">

            {/* Account info (read-only) */}
            <Card
              className="border-slate-200/80 bg-white/95 shadow-[0_12px_40px_rgba(15,23,42,0.06)]"
              padding="lg"
            >
              <SectionHeader
                title="Account Information"
                subtitle="Read-only details from your account"
              />
              {isLoading && !user ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ))}
                </div>
              ) : (
                <dl className="grid gap-4 sm:grid-cols-2">
                  {[
                    {
                      label: "Email address",
                      value: user?.email,
                      icon: <Globe className="h-3.5 w-3.5" />,
                    },
                    {
                      label: "Account status",
                      value: user?.status,
                      icon: <Shield className="h-3.5 w-3.5" />,
                    },
                    {
                      label: "Country",
                      value: user?.country
                        ? WORLD_COUNTRIES.find((c) => c.code === user.country)?.name ?? user.country
                        : "—",
                      icon: <MapPin className="h-3.5 w-3.5" />,
                    },
                    {
                      label: "Business name",
                      value: user?.businessName,
                      icon: <Building2 className="h-3.5 w-3.5" />,
                    },
                    {
                      label: "Phone",
                      value: user?.phone,
                      icon: <Phone className="h-3.5 w-3.5" />,
                    },
                    {
                      label: "Loyalty tier",
                      value: tier?.label,
                      icon: <Star className="h-3.5 w-3.5" />,
                    },
                    {
                      label: "Loyalty points",
                      value: (user?.loyaltyPoints ?? 0).toLocaleString(),
                      icon: <Star className="h-3.5 w-3.5" />,
                    },
                  ].map(({ label, value, icon }) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
                    >
                      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        {icon}
                        {label}
                      </dt>
                      <dd className="mt-2 text-sm font-semibold capitalize text-slate-900">
                        {value ?? "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </Card>

            {/* Change password */}
            <Card
              className="border-slate-200/80 bg-white/95 shadow-[0_12px_40px_rgba(15,23,42,0.06)]"
              padding="lg"
            >
              <SectionHeader
                title="Change Password"
                subtitle="Use a strong password you don't reuse elsewhere"
              />

              <form onSubmit={handlePasswordSave} className="space-y-4">
                <Input
                  label="Current password"
                  type="password"
                  placeholder="Enter your current password"
                  value={pwdForm.currentPassword}
                  onChange={(e) =>
                    setPwdForm((f) => ({ ...f, currentPassword: e.target.value }))
                  }
                  required
                />
                <Input
                  label="New password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={pwdForm.newPassword}
                  onChange={(e) =>
                    setPwdForm((f) => ({ ...f, newPassword: e.target.value }))
                  }
                  required
                  hint="Minimum 8 characters"
                />
                <Input
                  label="Confirm new password"
                  type="password"
                  placeholder="Re-enter new password"
                  value={pwdForm.confirmPassword}
                  onChange={(e) =>
                    setPwdForm((f) => ({ ...f, confirmPassword: e.target.value }))
                  }
                  required
                />

                <FeedbackBanner msg={pwdMsg} onDismiss={() => setPwdMsg(null)} />

                <div className="flex justify-end border-t border-slate-100 pt-3">
                  <Button
                    type="submit"
                    variant="secondary"
                    icon={<KeyRound />}
                    loading={passwordMutation.isPending}
                    disabled={passwordMutation.isPending}
                  >
                    Update password
                  </Button>
                </div>
              </form>
            </Card>

          </div>
        </div>

      </div>
    </div>
    </>
  );
}
