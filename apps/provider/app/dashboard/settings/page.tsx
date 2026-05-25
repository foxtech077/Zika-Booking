"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, User, Building2, Globe, Mail, Shield } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";

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

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore();
  const [tab, setTab] = useState<"profile" | "security">("profile");

  const [profileForm, setProfileForm] = useState({
    firstName:    user?.firstName ?? "",
    lastName:     user?.lastName ?? "",
    businessName: user?.businessName ?? "",
    country:      user?.country ?? "",
  });

  const [pwdForm, setPwdForm] = useState({
    currentPassword: "",
    newPassword:     "",
    confirmPassword: "",
  });

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const profileMutation = useMutation({
    mutationFn: () => api.patch("/auth/profile", profileForm),
    onSuccess: (res) => {
      const u = res.data?.data?.user ?? res.data?.user;
      if (u) updateUser(u);
      setSuccessMsg("Profile updated successfully.");
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.error?.message ?? "Update failed.");
      setSuccessMsg(null);
    },
  });

  const pwdMutation = useMutation({
    mutationFn: () => api.post("/auth/change-password", pwdForm),
    onSuccess: () => {
      setSuccessMsg("Password changed successfully.");
      setErrorMsg(null);
      setPwdForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.error?.message ?? "Password change failed.");
      setSuccessMsg(null);
    },
  });

  const handlePwdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setErrorMsg("New passwords do not match.");
      return;
    }
    if (pwdForm.newPassword.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }
    pwdMutation.mutate();
  };

  const name = user ? `${user.firstName} ${user.lastName}` : "";

  const TABS = [
    { key: "profile",  label: "Profile",  icon: <User className="w-4 h-4" /> },
    { key: "security", label: "Security", icon: <Shield className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
      <SectionHeader title="Settings" subtitle="Manage your profile and account security" />

      {/* Tab bar */}
      <div className="flex gap-1 bg-surface-muted p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key as typeof tab); setSuccessMsg(null); setErrorMsg(null); }}
            id={`tab-${t.key}`}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? "bg-white shadow-card text-primary"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="bg-success-light border border-success/30 rounded-xl px-4 py-3 text-sm text-success-dark">
          ✓ {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-danger-light border border-danger/30 rounded-xl px-4 py-3 text-sm text-danger">
          {errorMsg}
        </div>
      )}

      {tab === "profile" && (
        <Card>
          {/* Avatar section */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
            <Avatar name={name} size="xl" />
            <div>
              <p className="font-bold text-slate-900 text-lg">{name}</p>
              <p className="text-sm text-slate-500">{user?.email}</p>
              <span className="inline-flex items-center gap-1 text-xs text-primary font-medium bg-primary-50 px-2 py-0.5 rounded-full mt-1">
                <Building2 className="w-3 h-3" />
                Provider Account
              </span>
            </div>
          </div>

          <form
            id="profile-form"
            onSubmit={(e) => { e.preventDefault(); profileMutation.mutate(); }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First name"
                value={profileForm.firstName}
                onChange={(e) => setProfileForm((f) => ({ ...f, firstName: e.target.value }))}
                placeholder="John"
                leftIcon={<User />}
                required
              />
              <Input
                label="Last name"
                value={profileForm.lastName}
                onChange={(e) => setProfileForm((f) => ({ ...f, lastName: e.target.value }))}
                placeholder="Doe"
                required
              />
            </div>

            <Input
              label="Email"
              type="email"
              value={user?.email ?? ""}
              disabled
              hint="Contact support to change your email"
              leftIcon={<Mail />}
            />

            <Input
              label="Business / Property name"
              value={profileForm.businessName}
              onChange={(e) => setProfileForm((f) => ({ ...f, businessName: e.target.value }))}
              placeholder="My Hotel Group"
              leftIcon={<Building2 />}
            />

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Country</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  value={profileForm.country}
                  onChange={(e) => setProfileForm((f) => ({ ...f, country: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-border bg-white pl-9 pr-3 text-sm text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                >
                  <option value="">Select country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <Button
                type="submit"
                variant="primary"
                loading={profileMutation.isPending}
                id="save-profile-btn"
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Card>
      )}

      {tab === "security" && (
        <Card>
          <h3 className="font-bold text-slate-900 mb-1">Change Password</h3>
          <p className="text-sm text-slate-500 mb-5">
            Use a strong, unique password for your account
          </p>

          <form id="password-form" onSubmit={handlePwdSubmit} className="space-y-4">
            <Input
              label="Current password"
              type="password"
              value={pwdForm.currentPassword}
              onChange={(e) => setPwdForm((f) => ({ ...f, currentPassword: e.target.value }))}
              placeholder="••••••••"
              required
            />
            <Input
              label="New password"
              type="password"
              value={pwdForm.newPassword}
              onChange={(e) => setPwdForm((f) => ({ ...f, newPassword: e.target.value }))}
              placeholder="Min. 8 characters"
              required
            />
            <Input
              label="Confirm new password"
              type="password"
              value={pwdForm.confirmPassword}
              onChange={(e) => setPwdForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              placeholder="Repeat password"
              required
            />
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                loading={pwdMutation.isPending}
                id="change-password-btn"
              >
                Update Password
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
