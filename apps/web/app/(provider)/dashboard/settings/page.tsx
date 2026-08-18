"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  KeyRound,
  Search,
  Shield,
  Wallet,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PaymentSettingsForm } from "@/components/payments/PaymentSettingsForm";
import { cn } from "@/lib/utils";

type SettingsTab = "security" | "payments";

interface Notice {
  type: "success" | "error";
  text: string;
}

interface SectionFeedback {
  type: "success" | "error";
  text: string;
}

const tabs: Array<{ key: SettingsTab; label: string; icon: ReactNode; keywords: string }> = [
  { key: "security", label: "Security", icon: <Shield />, keywords: "password credentials sign in account" },
  { key: "payments", label: "Payments", icon: <Wallet />, keywords: "bank payout billing tax payment method stripe mobile money" },
];

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
  const router = useRouter();
  const { clearSession } = useAuthStore();
  const [tab, setTab] = useState<SettingsTab>("security");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sectionFeedback, setSectionFeedback] = useState<Record<string, SectionFeedback | null>>({});

  const [pwdForm, setPwdForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const filteredTabs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tabs;
    return tabs.filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(query));
  }, [search]);
  const visibleTabs = filteredTabs.length > 0 ? filteredTabs : tabs;

  const passwordMutation = useMutation({
    mutationFn: () =>
      api.post("/auth/change-password", {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
        confirmPassword: pwdForm.confirmPassword,
      }),
    onSuccess: () => {
      setPwdForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setNotice({ type: "success", text: "Password updated successfully. Logging out..." });
      setSectionFeedback((current) => ({ ...current, security: { type: "success", text: "Password updated successfully. Logging out..." } }));
      setTimeout(() => {
        clearSession();
        router.push("/auth/login");
      }, 1500);
    },
    onError: () => {
      setNotice({ type: "error", text: "Password update failed. Please verify your current password." });
      setSectionFeedback((current) => ({ ...current, security: { type: "error", text: "Password update failed. Please verify your current password." } }));
    },
  });

  const clearPasswordForm = () => {
    setPwdForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setSectionFeedback((current) => ({ ...current, security: null }));
    setNotice(null);
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

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Settings"
        subtitle="Manage your account security and payout details."
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
          {tab === "security" && (
            <SettingsCard
              title="Password Management"
              subtitle="Use a strong, unique password for your provider account."
              icon={<KeyRound />}
              feedback={sectionFeedback.security}
              footer={
                <>
                  <Button loading={passwordMutation.isPending} onClick={savePassword}>Update Password</Button>
                  <Button variant="outline" onClick={clearPasswordForm}>Cancel</Button>
                </>
              }
            >
              <div className="grid gap-4">
                <Input label="Current password" type="password" autoComplete="new-password" value={pwdForm.currentPassword} onChange={(e) => setPwdForm((f) => ({ ...f, currentPassword: e.target.value }))} />
                <Input label="New password" type="password" autoComplete="new-password" value={pwdForm.newPassword} onChange={(e) => setPwdForm((f) => ({ ...f, newPassword: e.target.value }))} />
                <PasswordStrength password={pwdForm.newPassword} />
                <Input label="Confirm new password" type="password" autoComplete="new-password" value={pwdForm.confirmPassword} onChange={(e) => setPwdForm((f) => ({ ...f, confirmPassword: e.target.value }))} error={pwdForm.confirmPassword && pwdForm.confirmPassword !== pwdForm.newPassword ? "Passwords do not match" : undefined} />
              </div>
            </SettingsCard>
          )}

          {tab === "payments" && <PaymentSettingsForm />}
        </div>
      </div>
    </div>
  );
}
