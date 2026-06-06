"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Mail, Lock, User, Building2, Globe, Zap } from "lucide-react";
import { api, storeToken } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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

export default function RegisterPage() {
  const router = useRouter();
  const { setSession } = useAuthStore();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    businessName: "",
    country: "",
  });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const registerMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/auth/register", {
        ...form,
        userType: "provider",
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (!data.success) {
        setError(data.error?.message ?? "Registration failed.");
        return;
      }
      // Dev mode (SKIP_EMAIL_VERIFICATION=true): backend returns tokens immediately.
      if (data.data?.tokens?.accessToken && data.data?.user) {
        storeToken(data.data.tokens.accessToken);
        setSession(data.data.tokens.accessToken, data.data.user);
        router.replace("/dashboard");
        return;
      }
      // Production: email verification is required — show confirmation screen.
      setSubmitted(true);
    },
    onError: (err: any) => {
      const fields = err?.response?.data?.error?.fields;
      if (fields) {
        const msgs = Object.values(fields).join(". ");
        setError(msgs);
      } else {
        setError(err?.response?.data?.error?.message ?? "Registration failed. Please try again.");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    registerMutation.mutate();
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex items-center justify-center p-4">
        <div className="glass rounded-3xl border border-white/10 shadow-2xl p-10 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✉️</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Check your email</h1>
          <p className="text-slate-500 mb-2">
            We&apos;ve sent a verification link to
          </p>
          <p className="font-semibold text-slate-800 mb-6">{form.email}</p>
          <p className="text-sm text-slate-400 mb-6">
            Click the link in the email to activate your account. It expires in 24 hours.
          </p>
          <Link href="/auth/login" className="text-primary font-semibold hover:underline">
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="text-white font-bold text-lg leading-none">ZikaBooking</p>
              <p className="text-slate-400 text-xs">Partner Portal</p>
            </div>
          </div>
          <h1 className="text-white text-2xl font-bold mt-4">Become a Partner</h1>
          <p className="text-slate-400 text-sm mt-1">Start listing your properties and vehicles today</p>
        </div>

        <div className="glass rounded-3xl border border-white/10 shadow-2xl p-8">
          <form id="register-form" onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-danger-light border border-danger/30 rounded-xl px-4 py-3 text-sm text-danger-dark">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input
                id="first-name-input"
                label="First name"
                value={form.firstName}
                onChange={set("firstName")}
                placeholder="John"
                leftIcon={<User />}
                required
              />
              <Input
                id="last-name-input"
                label="Last name"
                value={form.lastName}
                onChange={set("lastName")}
                placeholder="Doe"
                required
              />
            </div>

            <Input
              id="email-input"
              label="Business email"
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="you@business.com"
              leftIcon={<Mail />}
              required
            />

            <Input
              id="business-name-input"
              label="Business / Property name"
              value={form.businessName}
              onChange={set("businessName")}
              placeholder="My Hotel Group"
              leftIcon={<Building2 />}
            />

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Country</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  id="country-select"
                  value={form.country}
                  onChange={set("country")}
                  className="w-full h-10 rounded-xl border border-border bg-white pl-9 pr-3 text-sm text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                >
                  <option value="">Select country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <Input
              id="password-input"
              label="Password"
              type={showPwd ? "text" : "password"}
              value={form.password}
              onChange={set("password")}
              placeholder="Min. 8 characters"
              leftIcon={<Lock />}
              rightIcon={
                <button type="button" onClick={() => setShowPwd((v) => !v)} className="text-slate-400 hover:text-slate-700">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              required
            />

            <Input
              id="confirm-password-input"
              label="Confirm password"
              type={showPwd ? "text" : "password"}
              value={form.confirmPassword}
              onChange={set("confirmPassword")}
              placeholder="Repeat password"
              leftIcon={<Lock />}
              required
            />

            <Button
              id="register-btn"
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              loading={registerMutation.isPending}
            >
              Create Provider Account
            </Button>
          </form>

          <div className="mt-5 text-center">
            <p className="text-sm text-slate-600">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-primary font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
