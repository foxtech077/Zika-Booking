"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Cog,
  HelpCircle,
  KeyRound,
  LogOut,
  Shield,
  Star,
  Ticket,
  Trophy,
  User,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { listingApi } from "@/lib/listing-api";
import { useAuthStore } from "@/stores/auth";
import type { AuthUser } from "@/stores/auth";
import { fetchMyReviews } from "@/services/traveller";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────────────────────

const COUNTRIES = [
  { value: "AE", label: "United Arab Emirates" },
  { value: "KE", label: "Kenya" },
  { value: "NG", label: "Nigeria" },
  { value: "GH", label: "Ghana" },
  { value: "TZ", label: "Tanzania" },
  { value: "ZA", label: "South Africa" },
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "IN", label: "India" },
  { value: "PK", label: "Pakistan" },
];

const TIER_CONFIG: Record<string, { label: string; badgeClass: string; icon: string }> = {
  bronze:  { label: "Bronze",  badgeClass: "bg-amber-50  text-amber-800  border-amber-200",  icon: "🥉" },
  silver:  { label: "Silver",  badgeClass: "bg-slate-100 text-slate-700  border-slate-300",  icon: "🥈" },
  gold:    { label: "Gold",    badgeClass: "bg-yellow-50 text-yellow-800 border-yellow-300", icon: "🥇" },
  diamond: { label: "Diamond", badgeClass: "bg-cyan-50   text-cyan-800   border-cyan-200",   icon: "💎" },
};

const TIER_GRADIENTS: Record<string, { gradient: string; text: string; subtext: string }> = {
  bronze:  { gradient: "from-amber-700 via-amber-500 to-amber-400",   text: "text-white", subtext: "text-amber-100" },
  silver:  { gradient: "from-slate-500 via-slate-400 to-slate-300",   text: "text-white", subtext: "text-slate-100" },
  gold:    { gradient: "from-yellow-600 via-yellow-500 to-yellow-300", text: "text-white", subtext: "text-yellow-100" },
  diamond: { gradient: "from-yellow-600 via-yellow-400 to-amber-300",  text: "text-white", subtext: "text-yellow-100" },
};

// Tier thresholds — purely visual, used for the progress bar only.
const TIER_THRESHOLDS: Record<string, { min: number; next: string | null; nextAt: number | null }> = {
  bronze:  { min: 0,    next: "Silver",  nextAt: 1000 },
  silver:  { min: 1000, next: "Gold",    nextAt: 2500 },
  gold:    { min: 2500, next: "Diamond", nextAt: 5000 },
  diamond: { min: 5000, next: null,      nextAt: null },
};

function getTierProgress(tier: string, points: number) {
  const cfg = TIER_THRESHOLDS[tier.toLowerCase()] ?? TIER_THRESHOLDS.bronze!;
  if (!cfg.nextAt) return { pct: 100, toNext: 0, nextTier: null };
  const range = cfg.nextAt - cfg.min;
  const earned = Math.max(0, points - cfg.min);
  return {
    pct: Math.min(100, Math.round((earned / range) * 100)),
    toNext: Math.max(0, cfg.nextAt - points),
    nextTier: cfg.next,
  };
}

// ── Feedback Banner ──────────────────────────────────────────────────────────

type FeedbackMsg = { type: "success" | "error"; text: string } | null;

function FeedbackBanner({ msg, onDismiss }: { msg: FeedbackMsg; onDismiss: () => void }) {
  if (!msg) return null;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
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

// ── Skeleton ─────────────────────────────────────────────────────────────────

function ProfileHeaderSkeleton() {
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

// ── Booking status helpers ───────────────────────────────────────────────────

function bookingStatusLabel(status: string) {
  const map: Record<string, string> = {
    confirmed: "Upcoming",
    pending_payment: "Pending",
    cancelled: "Cancelled",
    completed: "Completed",
    active: "Active",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

function bookingStatusClass(status: string) {
  if (status === "confirmed")       return "bg-[#0c2614] text-white";
  if (status === "pending_payment") return "bg-amber-100 text-amber-800";
  if (status === "cancelled")       return "bg-red-100 text-red-700";
  if (status === "completed")       return "bg-slate-100 text-slate-600";
  return "bg-slate-100 text-slate-700";
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function TravellerProfilePage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user: storedUser, updateUser, clearSession, _hasHydrated } = useAuthStore();

  // Local state for non-persisted preference toggles (visual only, no backend API exists)
  const [notifBooking, setNotifBooking] = useState(true);
  const [notifPromo,   setNotifPromo]   = useState(false);

  // ── Profile query (unchanged from original) ───────────────────────────────
  const { data: fetchedProfile, isLoading } = useQuery({
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

  // ── Reviews query ─────────────────────────────────────────────────────────
  const { data: reviews = [] } = useQuery({
    queryKey: ["traveller-my-reviews"],
    queryFn: fetchMyReviews,
    staleTime: 60_000,
    enabled: _hasHydrated,
  });



  // ── Recent bookings query ─────────────────────────────────────────────────
  const { data: recentBookings = [] } = useQuery({
    queryKey: ["traveller-bookings-profile"],
    queryFn: async () => {
      const res = await listingApi.get<any>("/guests/me/bookings");
      const raw: any[] =
        res.data?.data?.bookings ?? res.data?.data ?? (Array.isArray(res.data) ? res.data : []);
      return raw.slice(0, 3);
    },
    staleTime: 60_000,
    enabled: _hasHydrated,
  });

  // ── Wallet vouchers count ─────────────────────────────────────────────────
  const { data: walletVouchers = [] } = useQuery({
    queryKey: ["traveller-wallet-vouchers-profile"],
    queryFn: async () => {
      const res = await listingApi.get<any>("/vouchers/wallet");
      if (res.data?.success) return (res.data.data?.vouchers ?? []) as any[];
      return [] as any[];
    },
    staleTime: 60_000,
    enabled: _hasHydrated,
  });
  const voucherCount = walletVouchers.length;

  // ── Profile form state (unchanged from original) ──────────────────────────
  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", country: "" });
  const [pwdForm, setPwdForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [profileMsg, setProfileMsg] = useState<FeedbackMsg>(null);
  const [pwdMsg,     setPwdMsg]     = useState<FeedbackMsg>(null);

  // Populate edit form once profile arrives (runs once per identity)
  useEffect(() => {
    const source = fetchedProfile ?? storedUser;
    if (!source) return;
    setProfileForm({
      firstName: source.firstName ?? "",
      lastName:  source.lastName  ?? "",
      country:   source.country   ?? "",
    });
  }, [fetchedProfile?.id ?? storedUser?.id]);

  // ── Mutations (unchanged from original) ───────────────────────────────────
  const profileMutation = useMutation({
    mutationFn: () =>
      api.patch("/auth/profile", {
        firstName: profileForm.firstName.trim(),
        lastName:  profileForm.lastName.trim(),
        country:   profileForm.country || null,
      }),
    onSuccess: (res) => {
      const updated: AuthUser = res.data?.data?.user ?? res.data?.user;
      if (updated) updateUser(updated);
      queryClient.invalidateQueries({ queryKey: ["traveller-profile"] });
      setProfileMsg({ type: "success", text: "Profile updated successfully." });
    },
    onError: () => {
      setProfileMsg({ type: "error", text: "Profile update failed. Please try again." });
    },
  });

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

  const handleProfileSave = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profileForm.firstName.trim() || !profileForm.lastName.trim()) {
      setProfileMsg({ type: "error", text: "First name and last name are required." });
      return;
    }
    setProfileMsg(null);
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

  const handleLogout = () => {
    clearSession();
    router.replace("/auth/login");
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const fullName      = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Traveller";
  const tierKey       = user?.currentTier?.toLowerCase() ?? "bronze";
  const tier          = TIER_CONFIG[tierKey] ?? TIER_CONFIG.bronze!;
  const tierProgress  = getTierProgress(tierKey, user?.loyaltyPoints ?? 0);


  const reviewStats = useMemo(() => {
    const total = reviews.length;
    const avg   = total > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
    return { total, avg };
  }, [reviews]);

  // ── Sidebar items ─────────────────────────────────────────────────────────
  const sidebarItems = [
    { label: "Profile Overview", Icon: User,    href: "#overview",               active: true },
    { label: "Loyalty & Rewards",Icon: Trophy,  href: "#loyalty",                active: false },
    { label: "Recent Bookings",  Icon: BookOpen,href: "/traveller?tab=bookings", active: false, external: true },
    { label: "Account Settings", Icon: Cog,     href: "#settings",               active: false },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-start gap-6">

          {/* ── Left Sidebar ─────────────────────────────────────────────── */}
          <aside className="hidden lg:block w-56 xl:w-60 shrink-0">
            <div className="sticky top-24">
              <Card padding="lg" className="border-slate-200">
                {/* Title */}
                <div className="mb-5">
                  <h2 className="text-base font-bold text-slate-900">Profile</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Manage your travel experience</p>
                </div>

                {/* Nav */}
                <nav className="space-y-0.5">
                  {sidebarItems.map(({ label, Icon, href, active, external }) => {
                    const cls = cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                      active
                        ? "bg-[#e8f5e9] text-[#0c2614] font-semibold"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                    );
                    const iconCls = cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-[#1D8D2B]" : "text-slate-400",
                    );
                    return external ? (
                      <Link key={label} href={href} className={cls}>
                        <Icon className={iconCls} />
                        {label}
                      </Link>
                    ) : (
                      <a key={label} href={href} className={cls}>
                        <Icon className={iconCls} />
                        {label}
                      </a>
                    );
                  })}
                </nav>

                <div className="my-4 border-t border-slate-100" />

                {/* Bottom links */}
                <div className="space-y-0.5">
                  <Link
                    href="/traveller/messages"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900"
                  >
                    <HelpCircle className="h-4 w-4 shrink-0 text-slate-400" />
                    Support
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition-all hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    Sign Out
                  </button>
                </div>
              </Card>
            </div>
          </aside>

          {/* ── Main Content ─────────────────────────────────────────────── */}
          <main className="min-w-0 flex-1 space-y-5" id="overview">

            {/* 1 ── Profile Header ─────────────────────────────────────── */}
            <Card padding="lg" className="border-slate-200">
              {isLoading && !user ? (
                <ProfileHeaderSkeleton />
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  {/* Avatar + Identity */}
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      <Avatar name={fullName} size="xl" />
                      <span
                        className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-white text-sm shadow-sm"
                        title={`${tier.label} tier`}
                      >
                        {tier.icon}
                      </span>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-950">{fullName}</h2>
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                            tier.badgeClass,
                          )}
                        >
                          {tier.label} Tier
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-slate-500">{user?.email}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        {/* calendar icon */}
                        <span className="flex items-center gap-1">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Member
                        </span>
                        {user?.emailVerified ? (
                          <span className="flex items-center gap-1 font-medium text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Email verified
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 font-medium text-amber-600">
                            <XCircle className="h-3.5 w-3.5" />
                            Email unverified
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Edit Profile CTA */}
                  <a
                    href="#settings"
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#0c2614] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D8D2B]"
                  >
                    <User className="h-4 w-4" />
                    Edit Profile
                  </a>
                </div>
              )}
            </Card>

            {/* 2 ── Loyalty + Community ────────────────────────────────── */}
            <div className="grid gap-5 md:grid-cols-2" id="loyalty">
              {/* Loyalty & Rewards */}
              <Card padding="none" className="overflow-hidden border-slate-200">
                {/* Tier gradient header */}
                <div className={`bg-gradient-to-r ${TIER_GRADIENTS[tierKey]?.gradient ?? TIER_GRADIENTS.bronze!.gradient} px-5 py-4`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${TIER_GRADIENTS[tierKey]?.subtext ?? "text-white/70"} mb-1`}>
                    Tier Status
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-white/90" />
                      <h3 className={`text-lg font-bold ${TIER_GRADIENTS[tierKey]?.text ?? "text-white"}`}>
                        {tier.label} {tier.label === "Diamond" ? "Elite" : "Tier"}
                      </h3>
                    </div>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-xl">
                      {tier.icon}
                    </span>
                  </div>
                </div>

                {/* Points + progress */}
                <div className="px-5 py-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm text-slate-500">Available Points</span>
                    <span className="text-xl font-bold text-slate-900">
                      {(user?.loyaltyPoints ?? 0).toLocaleString()}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#1D8D2B] transition-all duration-500"
                      style={{ width: `${tierProgress.pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    {tierProgress.nextTier
                      ? `${tierProgress.toNext.toLocaleString()} points until your next ${tierProgress.nextTier} renewal.`
                      : "You've reached the highest tier!"}
                  </p>

                  {/* Vouchers row */}
                  <a
                    href="/traveller?tab=bookings"
                    className="mt-4 flex items-center justify-between rounded-xl border border-[#e0f2e1] bg-[#f0faf0] px-4 py-3 transition-colors hover:bg-[#e8f5e9]"
                  >
                    <div className="flex items-center gap-3">
                      <Ticket className="h-4 w-4 text-[#1D8D2B]" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {voucherCount} Available {voucherCount === 1 ? "Voucher" : "Vouchers"}
                        </p>
                        <p className="text-xs text-slate-500">View your rewards</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </a>
                </div>
              </Card>

              {/* Community Impact */}
              <Card padding="lg" className="border-slate-200">
                <h3 className="mb-4 font-bold text-slate-900">Community Impact</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                    <p className="text-3xl font-bold text-slate-900">{reviewStats.total}</p>
                    <p className="mt-1 text-xs text-slate-500">Reviews submitted</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <p className="text-3xl font-bold text-slate-900">
                        {reviewStats.avg > 0 ? reviewStats.avg.toFixed(1) : "—"}
                      </p>
                      {reviewStats.avg > 0 && (
                        <Star className="mb-0.5 h-5 w-5 fill-amber-400 text-amber-400" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Avg. Rating given</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* 3 ── Recent Bookings ────────────────────────────────────── */}
            <Card padding="lg" className="border-slate-200">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Recent Bookings</h3>
                <Link
                  href="/traveller?tab=bookings"
                  className="text-sm font-semibold text-[#1D8D2B] transition-colors hover:text-[#0c2614]"
                >
                  View All
                </Link>
              </div>

              {recentBookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                    <BookOpen className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">No bookings yet</p>
                  <p className="mt-1 text-xs text-slate-400">Your recent bookings will appear here.</p>
                  <Link
                    href="/traveller"
                    className="mt-3 text-xs font-semibold text-[#1D8D2B] hover:text-[#0c2614]"
                  >
                    Explore listings
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentBookings.map((booking: any) => {
                    const dateRange =
                      booking.checkIn && booking.checkOut
                        ? `${new Date(booking.checkIn).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}–${new Date(booking.checkOut).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                        : booking.pickupDatetime && booking.returnDatetime
                        ? `${new Date(booking.pickupDatetime).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}–${new Date(booking.returnDatetime).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                        : null;

                    return (
                      <div
                        key={booking.id}
                        className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
                      >
                        {/* Thumbnail */}
                        <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-200">
                          {booking.primaryPhotoUrl ? (
                            <img
                              src={booking.primaryPhotoUrl}
                              alt={booking.listingTitle ?? ""}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-emerald-100 to-teal-200" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {booking.listingTitle}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Ref: {booking.reference}
                            {dateRange ? ` · ${dateRange}` : ""}
                          </p>
                        </div>

                        {/* Status badge */}
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                            bookingStatusClass(booking.status),
                          )}
                        >
                          {bookingStatusLabel(booking.status)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* 4 ── Preferences & Security ─────────────────────────── */}
            <Card padding="lg" className="border-slate-200">
              <h3 className="mb-4 font-bold text-slate-900">Preferences & Security</h3>

              <div className="grid gap-6 sm:grid-cols-2">
                {/* Toggles */}
                <div className="space-y-4">
                  {/* Booking updates toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Booking Updates</p>
                      <p className="text-xs text-slate-400">Push & Email</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifBooking}
                      onClick={() => setNotifBooking((v) => !v)}
                      className={cn(
                        "relative h-6 w-11 rounded-full transition-colors focus:outline-none",
                        notifBooking ? "bg-[#1D8D2B]" : "bg-slate-200",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all",
                          notifBooking ? "left-6" : "left-1",
                        )}
                      />
                    </button>
                  </div>

                  {/* Promotions toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Promotions</p>
                      <p className="text-xs text-slate-400">Special offers only</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifPromo}
                      onClick={() => setNotifPromo((v) => !v)}
                      className={cn(
                        "relative h-6 w-11 rounded-full transition-colors focus:outline-none",
                        notifPromo ? "bg-[#1D8D2B]" : "bg-slate-200",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all",
                          notifPromo ? "left-6" : "left-1",
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Security links */}
                <div className="space-y-1 sm:border-l sm:border-slate-100 sm:pl-6">
                  <a
                    href="#settings"
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    <KeyRound className="h-4 w-4 text-slate-400" />
                    Change Password
                  </a>
                  <div className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-600">
                    <Shield className="h-4 w-4 text-[#1D8D2B]" />
                    Account Security
                    {user?.emailVerified && (
                      <CheckCircle2 className="ml-auto h-4 w-4 text-[#1D8D2B]" />
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* 5 ── Account Settings (Edit Profile + Change Password) ── */}
            <div className="grid gap-5 md:grid-cols-2" id="settings">
              {/* Edit Profile form */}
              <Card padding="lg" className="border-slate-200">
                <SectionHeader
                  title="Edit Profile"
                  subtitle="Update your personal information"
                />
                <form onSubmit={handleProfileSave} className="space-y-4">
                  <Input
                    label="First name"
                    placeholder="Enter your first name"
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm((f) => ({ ...f, firstName: e.target.value }))}
                    required
                    maxLength={60}
                  />
                  <Input
                    label="Last name"
                    placeholder="Enter your last name"
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm((f) => ({ ...f, lastName: e.target.value }))}
                    required
                    maxLength={60}
                  />
                  <Select
                    label="Country"
                    placeholder="Select a country"
                    value={profileForm.country ?? ""}
                    onChange={(e) => setProfileForm((f) => ({ ...f, country: e.target.value }))}
                    options={COUNTRIES}
                  />

                  <FeedbackBanner msg={profileMsg} onDismiss={() => setProfileMsg(null)} />

                  <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={profileMutation.isPending}
                      onClick={() => {
                        const source = fetchedProfile ?? storedUser;
                        setProfileForm({
                          firstName: source?.firstName ?? "",
                          lastName:  source?.lastName  ?? "",
                          country:   source?.country   ?? "",
                        });
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

              {/* Change Password form */}
              <Card padding="lg" className="border-slate-200">
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
                    onChange={(e) => setPwdForm((f) => ({ ...f, currentPassword: e.target.value }))}
                    required
                  />
                  <Input
                    label="New password"
                    type="password"
                    placeholder="At least 8 characters"
                    value={pwdForm.newPassword}
                    onChange={(e) => setPwdForm((f) => ({ ...f, newPassword: e.target.value }))}
                    required
                    hint="Minimum 8 characters"
                  />
                  <Input
                    label="Confirm new password"
                    type="password"
                    placeholder="Re-enter new password"
                    value={pwdForm.confirmPassword}
                    onChange={(e) => setPwdForm((f) => ({ ...f, confirmPassword: e.target.value }))}
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

          </main>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="bg-[#0c2614] text-green-300/70 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <p className="text-white font-serif text-xl font-light mb-1">Kainook</p>
              <p className="text-[10px] text-[#58B430]/70 uppercase tracking-[0.2em] mb-3">Private Collections</p>
              <p className="text-xs leading-relaxed mb-5">Redefining the standards of luxury travel through curated storytelling and architectural excellence.</p>
              <div className="flex gap-3">
                {[
                  { label: "Twitter/X", path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" },
                  { label: "Instagram", path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" },
                  { label: "LinkedIn", path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" },
                ].map(({ label, path }) => (
                  <a key={label} href="#" aria-label={label} className="text-green-300 hover:text-white transition">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d={path} /></svg>
                  </a>
                ))}
              </div>
            </div>
            {/* Explore */}
            <div>
              <p className="text-white text-[10px] font-semibold uppercase tracking-[0.25em] mb-4">Explore</p>
              <ul className="space-y-2.5 text-xs">
                {["Destinations", "Hotels", "Villas", "Car Rentals", "Experiences"].map(l => <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>)}
              </ul>
            </div>
            {/* Company */}
            <div>
              <p className="text-white text-[10px] font-semibold uppercase tracking-[0.25em] mb-4">Kainook</p>
              <ul className="space-y-2.5 text-xs">
                {["Our Story", "Sustainability", "Rewards Program", "Press & Media", "Contact Us"].map(l => <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>)}
              </ul>
            </div>
            {/* Newsletter */}
            <div>
              <p className="text-white text-[10px] font-semibold uppercase tracking-[0.25em] mb-4">Newsletter</p>
              <p className="text-xs mb-4 leading-relaxed">Receive curated travel inspiration and exclusive member offers.</p>
              <div className="space-y-2">
                <input type="email" placeholder="Your email address" className="w-full bg-[#081b0d]/60 border border-[#081b0d] rounded-lg px-3 py-2 text-xs text-white placeholder-green-600 focus:outline-none focus:border-white/40" />
                <button className="w-full bg-white hover:bg-green-50 text-[#0c2614] text-xs font-semibold py-2 rounded-lg transition">Subscribe</button>
              </div>
            </div>
          </div>
          <div className="border-t border-[#081b0d]/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[10px] tracking-wide">© {new Date().getFullYear()} Kainook · All rights reserved.</p>
            <div className="flex items-center gap-4">
              {[
                { label: "Twitter/X", path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" },
                { label: "Instagram", path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" },
                { label: "LinkedIn", path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" },
              ].map(({ label, path }) => (
                <a key={label} href="#" aria-label={label} className="text-green-300 hover:text-white transition">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d={path} /></svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
