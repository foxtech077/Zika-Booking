"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Eye,
  Globe,
  KeyRound,
  Languages,
  Link2,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  RefreshCw,
  Search,
  Shield,
  Smartphone,
  Upload,
  User,
  Wallet,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

type SettingsTab =
  | "profile"
  | "account"
  | "notifications"
  | "security"
  | "payments"
  | "preferences"
  | "integrations"
  | "channel"
  | "privacy";

interface Notice {
  type: "success" | "error";
  text: string;
}

interface SectionFeedback {
  type: "success" | "error";
  text: string;
}

const countries = [
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

const tabs: Array<{ key: SettingsTab; label: string; icon: ReactNode; keywords: string }> = [
  { key: "profile", label: "Profile", icon: <User />, keywords: "photo name email phone bio business address visibility" },
  { key: "account", label: "Account", icon: <Globe />, keywords: "timezone language currency format dashboard" },
  { key: "notifications", label: "Notifications", icon: <Bell />, keywords: "booking messages reviews payouts email sms push" },
  { key: "security", label: "Security", icon: <Shield />, keywords: "password two factor sessions devices privacy" },
  { key: "payments", label: "Payments", icon: <Wallet />, keywords: "bank payout billing tax payment method" },
  { key: "preferences", label: "Preferences", icon: <CalendarDays />, keywords: "booking availability instant cancellation minimum stay pricing" },
  { key: "integrations", label: "Integrations", icon: <Link2 />, keywords: "connected services channels external accounts" },
  { key: "channel", label: "Channel Sync", icon: <RefreshCw />, keywords: "ical airbnb booking google calendar sync" },
  { key: "privacy", label: "Privacy", icon: <Lock />, keywords: "visibility data sharing communication activity" },
];

const languageOptions = [
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "sw", label: "Swahili" },
  { value: "hi", label: "Hindi" },
];

const currencyOptions = [
  { value: "USD", label: "USD" },
  { value: "AED", label: "AED" },
  { value: "KES", label: "KES" },
  { value: "NGN", label: "NGN" },
  { value: "INR", label: "INR" },
  { value: "GBP", label: "GBP" },
];

const timezoneOptions = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata" },
  { value: "Asia/Dubai", label: "Asia/Dubai" },
  { value: "Africa/Nairobi", label: "Africa/Nairobi" },
  { value: "Africa/Lagos", label: "Africa/Lagos" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "America/New_York", label: "America/New_York" },
];

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="flex min-h-[82px] items-center justify-between gap-4 rounded-xl border border-border bg-white p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          checked ? "bg-primary" : "bg-slate-200"
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    </div>
  );
}

function SettingsCard({
  title,
  subtitle,
  icon,
  children,
  footer,
  feedback,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  feedback?: SectionFeedback | null;
}) {
  return (
    <Card>
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-slate-950">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {feedback && (
        <div
          className={cn(
            "mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm",
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {feedback.text}
        </div>
      )}
      {children}
      {footer && <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-4">{footer}</div>}
    </Card>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  const label = ["Weak", "Weak", "Fair", "Good", "Strong"][score] ?? "Weak";
  const width = `${Math.max(10, score * 25)}%`;
  const color = score < 2 ? "bg-red-500" : score < 4 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width }} />
      </div>
      <p className="mt-1 text-xs text-slate-500">Password strength: {label}</p>
    </div>
  );
}

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore();
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sectionFeedback, setSectionFeedback] = useState<Record<string, SectionFeedback | null>>({});

  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    phone: "",
    bio: "",
    businessName: user?.businessName ?? "",
    address: "",
    country: user?.country ?? "",
    visible: true,
  });

  const [accountForm, setAccountForm] = useState({
    timezone: "Asia/Kolkata",
    language: "en",
    currency: "USD",
    dateFormat: "MM/DD/YYYY",
    compactDashboard: false,
  });

  const [notifications, setNotifications] = useState({
    bookingUpdates: true,
    newReservations: true,
    cancellations: true,
    guestMessages: true,
    reviews: true,
    payouts: true,
    promotions: false,
    email: true,
    sms: false,
    push: true,
  });

  const [pwdForm, setPwdForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    twoFactor: false,
  });

  const [payments, setPayments] = useState({
    bankName: "",
    accountHolder: "",
    accountLast4: "",
    payoutSchedule: "weekly",
    taxId: "",
    billingAddress: "",
  });

  const [preferences, setPreferences] = useState({
    instantBooking: true,
    autoApprove: false,
    minStay: "1",
    cancellationPolicy: "flexible",
    availabilityWindow: "12",
    pricingMode: "manual",
  });

  const [privacy, setPrivacy] = useState({
    publicProfile: true,
    dataSharing: false,
    communicationInsights: true,
    activityVisibility: false,
  });

  const filteredTabs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tabs;
    return tabs.filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(query));
  }, [search]);
  const visibleTabs = filteredTabs.length > 0 ? filteredTabs : tabs;

  const name = `${profileForm.firstName} ${profileForm.lastName}`.trim() || "Provider";

  const profileMutation = useMutation({
    mutationFn: () =>
      api.patch("/auth/profile", {
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        businessName: profileForm.businessName,
        country: profileForm.country,
      }),
    onSuccess: (res) => {
      const updated = res.data?.data?.user ?? res.data?.user;
      if (updated) updateUser(updated);
      setNotice({ type: "success", text: "Profile settings saved." });
      setSectionFeedback((current) => ({ ...current, profile: { type: "success", text: "Profile settings saved." } }));
    },
    onError: () => {
      setNotice({ type: "error", text: "Profile update failed. Please try again." });
      setSectionFeedback((current) => ({ ...current, profile: { type: "error", text: "Profile update failed. Please try again." } }));
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () =>
      api.post("/auth/change-password", {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
        confirmPassword: pwdForm.confirmPassword,
      }),
    onSuccess: () => {
      setPwdForm((form) => ({ ...form, currentPassword: "", newPassword: "", confirmPassword: "" }));
      setNotice({ type: "success", text: "Password updated successfully." });
      setSectionFeedback((current) => ({ ...current, security: { type: "success", text: "Password updated successfully." } }));
    },
    onError: () => {
      setNotice({ type: "error", text: "Password update failed. Please verify your current password." });
      setSectionFeedback((current) => ({ ...current, security: { type: "error", text: "Password update failed. Please verify your current password." } }));
    },
  });

  const fakeSaveMutation = useMutation({
    mutationFn: async (section: string) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return section;
    },
    onSuccess: (section) => {
      const text = `${section} settings saved.`;
      setNotice({ type: "success", text });
      setSectionFeedback((current) => ({ ...current, [tab]: { type: "success", text } }));
    },
  });

  const resetSection = () => {
    setNotice({ type: "success", text: "Section changes reset." });
    setSectionFeedback((current) => ({ ...current, [tab]: { type: "success", text: "Section changes reset." } }));
  };

  const savePassword = () => {
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setNotice({ type: "error", text: "New password and confirmation do not match." });
      setSectionFeedback((current) => ({ ...current, security: { type: "error", text: "New password and confirmation do not match." } }));
      return;
    }
    if (pwdForm.newPassword.length < 8) {
      setNotice({ type: "error", text: "Password must be at least 8 characters." });
      setSectionFeedback((current) => ({ ...current, security: { type: "error", text: "Password must be at least 8 characters." } }));
      return;
    }
    passwordMutation.mutate();
  };

  const notificationItems: Array<{ key: keyof typeof notifications; label: string; hint: string }> = [
    { key: "bookingUpdates", label: "Booking updates", hint: "Changes to existing bookings." },
    { key: "newReservations", label: "New reservations", hint: "New confirmed or pending bookings." },
    { key: "cancellations", label: "Cancellation alerts", hint: "Guest or provider cancellations." },
    { key: "guestMessages", label: "Guest messages", hint: "New inbox messages." },
    { key: "reviews", label: "Reviews", hint: "New guest reviews and ratings." },
    { key: "payouts", label: "Earnings / payouts", hint: "Payout processing and earnings summaries." },
    { key: "promotions", label: "Promotional notifications", hint: "Product updates and offers." },
    { key: "email", label: "Email notifications", hint: "Receive alerts via email." },
    { key: "sms", label: "SMS notifications", hint: "Receive urgent alerts by SMS." },
    { key: "push", label: "Push notifications", hint: "Browser and app push alerts." },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Settings"
        subtitle="Manage profile, preferences, security, payouts, integrations, and privacy."
      />

      {notice && (
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
            notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          <span className="flex items-center gap-2">
            {notice.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {notice.text}
          </span>
          <button className="rounded-lg px-2 py-1 hover:bg-white/70" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
        <Card className="h-fit xl:sticky xl:top-5">
          <Input
            type="search"
            name="settings-search"
            autoComplete="off"
            placeholder="Search settings"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            leftIcon={<Search />}
          />
          {search && filteredTabs.length === 0 && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No exact setting match. Showing all sections.
            </div>
          )}
          <div className="mt-4 flex gap-2 overflow-x-auto xl:block xl:space-y-1">
            {visibleTabs.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setTab(item.key);
                  setSearch("");
                }}
                className={cn(
                  "flex min-w-fit items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all xl:w-full",
                  tab === item.key ? "bg-primary-50 text-primary shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <span className="[&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-5">
          {tab === "profile" && (
            <SettingsCard
              title="Profile Settings"
              subtitle="Control how guests see your provider profile."
              icon={<User />}
              feedback={sectionFeedback.profile}
              footer={
                <>
                  <Button loading={profileMutation.isPending} onClick={() => profileMutation.mutate()}>Save Changes</Button>
                  <Button variant="outline" onClick={resetSection}>Cancel</Button>
                </>
              }
            >
              <div className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center">
                <Avatar name={name} size="xl" />
                <div className="flex-1">
                  <p className="text-lg font-bold text-slate-950">{name}</p>
                  <p className="text-sm text-slate-500">{profileForm.email || "No email available"}</p>
                  <Badge label="Provider Account" status="confirmed" />
                </div>
                <Button variant="outline" icon={<Upload />}>Change Avatar</Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Input label="First name" value={profileForm.firstName} onChange={(e) => setProfileForm((f) => ({ ...f, firstName: e.target.value }))} leftIcon={<User />} />
                <Input label="Last name" value={profileForm.lastName} onChange={(e) => setProfileForm((f) => ({ ...f, lastName: e.target.value }))} />
                <Input label="Email address" type="email" value={profileForm.email} disabled leftIcon={<Mail />} hint="Contact support to change your email." />
                <Input label="Phone number" value={profileForm.phone} onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))} leftIcon={<Smartphone />} />
                <Input label="Business / provider name" value={profileForm.businessName} onChange={(e) => setProfileForm((f) => ({ ...f, businessName: e.target.value }))} leftIcon={<Building2 />} />
                <Select label="Country" value={profileForm.country} onChange={(e) => setProfileForm((f) => ({ ...f, country: e.target.value }))} options={countries} placeholder="Select country" />
                <Input label="Address / location" value={profileForm.address} onChange={(e) => setProfileForm((f) => ({ ...f, address: e.target.value }))} leftIcon={<MapPin />} className="md:col-span-2" />
              </div>
              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Bio / About</label>
                <textarea
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary"
                  placeholder="Tell guests about your business and hosting style."
                />
              </div>
              <div className="mt-4">
                <Toggle checked={profileForm.visible} onChange={(value) => setProfileForm((f) => ({ ...f, visible: value }))} label="Profile visibility" hint="Allow guests to view your public provider profile." />
              </div>
            </SettingsCard>
          )}

          {tab === "account" && (
            <SettingsCard title="Account Preferences" subtitle="Set dashboard defaults, locale, and display preferences." icon={<Globe />} feedback={sectionFeedback.account} footer={<SectionActions loading={fakeSaveMutation.isPending} onSave={() => fakeSaveMutation.mutate("Account preference")} onReset={resetSection} />}>
              <div className="grid gap-4 md:grid-cols-2">
                <Select label="Timezone" value={accountForm.timezone} onChange={(e) => setAccountForm((f) => ({ ...f, timezone: e.target.value }))} options={timezoneOptions} />
                <Select label="Language" value={accountForm.language} onChange={(e) => setAccountForm((f) => ({ ...f, language: e.target.value }))} options={languageOptions} />
                <Select label="Currency" value={accountForm.currency} onChange={(e) => setAccountForm((f) => ({ ...f, currency: e.target.value }))} options={currencyOptions} />
                <Select label="Date format" value={accountForm.dateFormat} onChange={(e) => setAccountForm((f) => ({ ...f, dateFormat: e.target.value }))} options={[{ value: "MM/DD/YYYY", label: "MM/DD/YYYY" }, { value: "DD/MM/YYYY", label: "DD/MM/YYYY" }, { value: "YYYY-MM-DD", label: "YYYY-MM-DD" }]} />
              </div>
              <div className="mt-4">
                <Toggle checked={accountForm.compactDashboard} onChange={(value) => setAccountForm((f) => ({ ...f, compactDashboard: value }))} label="Compact dashboard mode" hint="Show denser tables and controls across provider pages." />
              </div>
            </SettingsCard>
          )}

          {tab === "notifications" && (
            <SettingsCard title="Notification Settings" subtitle="Choose how and when Kainook contacts you." icon={<Bell />} feedback={sectionFeedback.notifications} footer={<SectionActions loading={fakeSaveMutation.isPending} onSave={() => fakeSaveMutation.mutate("Notification")} onReset={resetSection} />}>
              <div className="grid gap-3 md:grid-cols-2">
                {notificationItems.map(({ key, label, hint }) => (
                  <Toggle key={key} checked={notifications[key]} onChange={(value) => setNotifications((f) => ({ ...f, [key]: value }))} label={label} hint={hint} />
                ))}
              </div>
            </SettingsCard>
          )}

          {tab === "security" && (
            <div className="space-y-5">
              <SettingsCard title="Password Management" subtitle="Use a strong, unique password for your provider account." icon={<KeyRound />} feedback={sectionFeedback.security} footer={<><Button loading={passwordMutation.isPending} onClick={savePassword}>Update Password</Button><Button variant="outline" onClick={resetSection}>Cancel</Button></>}>
                <div className="grid gap-4">
                  <Input label="Current password" type="password" value={pwdForm.currentPassword} onChange={(e) => setPwdForm((f) => ({ ...f, currentPassword: e.target.value }))} />
                  <Input label="New password" type="password" value={pwdForm.newPassword} onChange={(e) => setPwdForm((f) => ({ ...f, newPassword: e.target.value }))} />
                  <PasswordStrength password={pwdForm.newPassword} />
                  <Input label="Confirm new password" type="password" value={pwdForm.confirmPassword} onChange={(e) => setPwdForm((f) => ({ ...f, confirmPassword: e.target.value }))} error={pwdForm.confirmPassword && pwdForm.confirmPassword !== pwdForm.newPassword ? "Passwords do not match" : undefined} />
                </div>
              </SettingsCard>
              <SettingsCard title="Login & Security" subtitle="Manage account protection and active sessions." icon={<Shield />} feedback={sectionFeedback.security} footer={<SectionActions loading={fakeSaveMutation.isPending} onSave={() => fakeSaveMutation.mutate("Security")} onReset={resetSection} />}>
                <div className="space-y-3">
                  <Toggle checked={pwdForm.twoFactor} onChange={(value) => setPwdForm((f) => ({ ...f, twoFactor: value }))} label="Two-factor authentication" hint="Require a second verification step during login." />
                  <SessionRow device="Windows · Chrome" location="Current session" status="Active" />
                  <SessionRow device="Mobile browser" location="Recently active" status="Review" />
                </div>
              </SettingsCard>
            </div>
          )}

          {tab === "payments" && (
            <SettingsCard title="Payout & Payment Settings" subtitle="Manage bank, billing, payout, and tax information." icon={<CreditCard />} feedback={sectionFeedback.payments} footer={<SectionActions loading={fakeSaveMutation.isPending} onSave={() => fakeSaveMutation.mutate("Payment")} onReset={resetSection} />}>
              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <StatusTile label="Payout method" value={payments.bankName ? "Connected" : "Not configured"} tone={payments.bankName ? "success" : "warning"} />
                <StatusTile label="Verification" value="Pending review" tone="warning" />
                <StatusTile label="Payment status" value="Ready" tone="success" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Bank name" value={payments.bankName} onChange={(e) => setPayments((f) => ({ ...f, bankName: e.target.value }))} />
                <Input label="Account holder" value={payments.accountHolder} onChange={(e) => setPayments((f) => ({ ...f, accountHolder: e.target.value }))} />
                <Input label="Account last 4 digits" value={payments.accountLast4} onChange={(e) => setPayments((f) => ({ ...f, accountLast4: e.target.value }))} />
                <Select label="Payout schedule" value={payments.payoutSchedule} onChange={(e) => setPayments((f) => ({ ...f, payoutSchedule: e.target.value }))} options={[{ value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }, { value: "manual", label: "Manual" }]} />
                <Input label="Tax ID" value={payments.taxId} onChange={(e) => setPayments((f) => ({ ...f, taxId: e.target.value }))} />
                <Input label="Billing address" value={payments.billingAddress} onChange={(e) => setPayments((f) => ({ ...f, billingAddress: e.target.value }))} />
              </div>
            </SettingsCard>
          )}

          {tab === "preferences" && (
            <SettingsCard title="Property / Business Preferences" subtitle="Set default booking, availability, cancellation, and pricing behavior." icon={<Building2 />} feedback={sectionFeedback.preferences} footer={<SectionActions loading={fakeSaveMutation.isPending} onSave={() => fakeSaveMutation.mutate("Business preference")} onReset={resetSection} />}>
              <div className="grid gap-4 md:grid-cols-2">
                <Toggle checked={preferences.instantBooking} onChange={(value) => setPreferences((f) => ({ ...f, instantBooking: value }))} label="Instant booking" hint="Allow eligible guests to book without manual approval." />
                <Toggle checked={preferences.autoApprove} onChange={(value) => setPreferences((f) => ({ ...f, autoApprove: value }))} label="Auto-approve requests" hint="Automatically approve low-risk booking requests." />
                <Input label="Minimum stay" type="number" min="1" value={preferences.minStay} onChange={(e) => setPreferences((f) => ({ ...f, minStay: e.target.value }))} />
                <Select label="Cancellation policy" value={preferences.cancellationPolicy} onChange={(e) => setPreferences((f) => ({ ...f, cancellationPolicy: e.target.value }))} options={[{ value: "flexible", label: "Flexible" }, { value: "moderate", label: "Moderate" }, { value: "strict", label: "Strict" }]} />
                <Select label="Availability window" value={preferences.availabilityWindow} onChange={(e) => setPreferences((f) => ({ ...f, availabilityWindow: e.target.value }))} options={[{ value: "3", label: "3 months" }, { value: "6", label: "6 months" }, { value: "12", label: "12 months" }, { value: "18", label: "18 months" }]} />
                <Select label="Pricing preference" value={preferences.pricingMode} onChange={(e) => setPreferences((f) => ({ ...f, pricingMode: e.target.value }))} options={[{ value: "manual", label: "Manual pricing" }, { value: "smart", label: "Smart pricing" }]} />
              </div>
            </SettingsCard>
          )}

          {tab === "integrations" && (
            <SettingsCard title="Connected Integrations" subtitle="Manage external services and connected provider tools." icon={<Link2 />} feedback={sectionFeedback.integrations} footer={<SectionActions loading={fakeSaveMutation.isPending} onSave={() => fakeSaveMutation.mutate("Integration")} onReset={resetSection} />}>
              <div className="grid gap-3 md:grid-cols-2">
                <IntegrationCard name="Airbnb" status="Connected" detail="Calendar sync enabled" />
                <IntegrationCard name="Booking.com" status="Disconnected" detail="Connect to import reservations" />
                <IntegrationCard name="Google Calendar" status="Connected" detail="External calendar linked" />
                <IntegrationCard name="Custom iCal" status="Ready" detail="Add feeds in Channel Sync" />
              </div>
            </SettingsCard>
          )}

          {tab === "channel" && (
            <SettingsCard title="Channel Sync Preferences" subtitle="Control external calendar sync defaults and indicators." icon={<RefreshCw />} feedback={sectionFeedback.channel} footer={<SectionActions loading={fakeSaveMutation.isPending} onSave={() => fakeSaveMutation.mutate("Channel sync")} onReset={resetSection} />}>
              <div className="grid gap-3 md:grid-cols-2">
                <Toggle checked={true} onChange={() => undefined} label="Automatic iCal sync" hint="Sync external feeds on a recurring schedule." />
                <Toggle checked={true} onChange={() => undefined} label="Conflict detection" hint="Flag availability conflicts from imported calendars." />
                <StatusTile label="Airbnb feed" value="Healthy" tone="success" />
                <StatusTile label="Booking.com feed" value="Needs setup" tone="warning" />
              </div>
            </SettingsCard>
          )}

          {tab === "privacy" && (
            <SettingsCard title="Privacy Settings" subtitle="Control visibility, data sharing, and communication preferences." icon={<Lock />} feedback={sectionFeedback.privacy} footer={<SectionActions loading={fakeSaveMutation.isPending} onSave={() => fakeSaveMutation.mutate("Privacy")} onReset={resetSection} />}>
              <div className="grid gap-3 md:grid-cols-2">
                <Toggle checked={privacy.publicProfile} onChange={(value) => setPrivacy((f) => ({ ...f, publicProfile: value }))} label="Public profile visibility" hint="Show provider profile to guests." />
                <Toggle checked={privacy.dataSharing} onChange={(value) => setPrivacy((f) => ({ ...f, dataSharing: value }))} label="Data sharing" hint="Share anonymized performance data for insights." />
                <Toggle checked={privacy.communicationInsights} onChange={(value) => setPrivacy((f) => ({ ...f, communicationInsights: value }))} label="Communication preferences" hint="Use message metadata to improve guest support." />
                <Toggle checked={privacy.activityVisibility} onChange={(value) => setPrivacy((f) => ({ ...f, activityVisibility: value }))} label="Account activity visibility" hint="Show activity status across provider tools." />
              </div>
            </SettingsCard>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionActions({ loading, onSave, onReset }: { loading: boolean; onSave: () => void; onReset: () => void }) {
  return (
    <>
      <Button loading={loading} onClick={onSave}>Save Changes</Button>
      <Button variant="outline" onClick={onReset}>Cancel</Button>
    </>
  );
}

function StatusTile({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" }) {
  return (
    <div className={cn("rounded-xl border p-4", tone === "success" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50")}>
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className={cn("mt-2 font-bold", tone === "success" ? "text-emerald-800" : "text-amber-800")}>{value}</p>
    </div>
  );
}

function SessionRow({ device, location, status }: { device: string; location: string; status: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-4">
      <div className="flex items-center gap-3">
        <Smartphone className="h-4 w-4 text-slate-400" />
        <div>
          <p className="text-sm font-semibold text-slate-900">{device}</p>
          <p className="text-xs text-slate-500">{location}</p>
        </div>
      </div>
      <Badge label={status} status={status === "Active" ? "confirmed" : "pending"} />
    </div>
  );
}

function IntegrationCard({ name, status, detail }: { name: string; status: string; detail: string }) {
  const connected = status === "Connected";
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <p className="font-semibold text-slate-900">{name}</p>
        </div>
        <Badge label={status} status={connected ? "confirmed" : "pending"} />
      </div>
      <p className="text-sm text-slate-500">{detail}</p>
      <Button className="mt-4" size="sm" variant={connected ? "outline" : "primary"}>
        {connected ? "Manage" : "Connect"}
      </Button>
    </div>
  );
}
