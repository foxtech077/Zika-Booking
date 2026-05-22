"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, ShieldCheck, Zap, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

type Step = "credentials" | "totp";

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuthStore();

  const [step, setStep] = useState<Step>("credentials");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingToken, setPendingToken] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/admin/auth/login", { email, password });
      const { sessionToken, totpRequired } = data.data ?? data;
      if (totpRequired) {
        setPendingToken(sessionToken ?? "");
        setStep("totp");
      } else {
        // Fetch the full admin profile using the new session token
        const meRes = await api.get("/admin/auth/me", {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        const user = meRes.data?.data?.user ?? meRes.data?.user;
        setSession(sessionToken, user);
        router.replace("/dashboard");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? "Invalid email or password.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleTOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/admin/auth/totp/verify", {
        code: totp.replace(/\s/g, ""),
        sessionToken: pendingToken,
      });
      const { sessionToken } = data.data ?? data;
      const token = sessionToken ?? pendingToken;
      // Fetch the full admin profile using the resolved session token
      const meRes = await api.get("/admin/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = meRes.data?.data?.user ?? meRes.data?.user;
      setSession(token, user);
      router.replace("/dashboard");
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? "Invalid verification code.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] flex-col gradient-primary relative overflow-hidden flex-shrink-0">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-12 h-80 w-80 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -right-16 h-64 w-64 rounded-full bg-white/5" />

        <div className="relative flex flex-col flex-1 p-12 justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-none">ZikaBooking</p>
              <p className="text-white/60 text-xs mt-0.5">Administration</p>
            </div>
          </div>

          {/* Hero text */}
          <div>
            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
              Manage your<br />
              platform with<br />
              <span className="text-white/80">confidence.</span>
            </h1>
            <p className="mt-4 text-white/60 text-sm leading-relaxed max-w-sm">
              Access bookings, listings, analytics, financial reports, and platform controls from one secure dashboard.
            </p>

            {/* Feature chips */}
            <div className="mt-8 flex flex-wrap gap-2">
              {["Booking Management", "Revenue Analytics", "Listing Accreditation", "Commission Control", "Audit Trail"].map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs text-white/80 border border-white/10"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <p className="text-xs text-white/40">
            Secured with JWT + TOTP authentication. All actions are audited.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">ZikaBooking Admin</span>
          </div>

          {step === "credentials" ? (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Sign in to your admin account
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  id="email"
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                  leftIcon={<Mail className="h-4 w-4" />}
                />
                <Input
                  id="password"
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  leftIcon={<Lock className="h-4 w-4" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />

                {error && (
                  <div className="flex items-center gap-2 rounded-lg bg-danger-light border border-danger/20 p-3 text-sm text-danger-dark">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" fullWidth loading={loading} size="lg" className="mt-6">
                  Sign in
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Two-factor verification</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Enter the 6-digit code from your authenticator app.
                </p>
              </div>

              <form onSubmit={handleTOTP} className="space-y-4">
                <Input
                  id="totp"
                  label="Authentication code"
                  type="text"
                  inputMode="numeric"
                  value={totp}
                  onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123 456"
                  maxLength={6}
                  required
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                />

                {error && (
                  <div className="flex items-center gap-2 rounded-lg bg-danger-light border border-danger/20 p-3 text-sm text-danger-dark">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" fullWidth loading={loading} size="lg" className="mt-2">
                  Verify
                </Button>
                <button
                  type="button"
                  onClick={() => { setStep("credentials"); setError(""); setTotp(""); }}
                  className="w-full text-center text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  ← Back to sign in
                </button>
              </form>
            </>
          )}

          <p className="mt-8 text-center text-xs text-slate-400">
            ZikaBooking Admin Panel · Restricted access
          </p>
        </div>
      </div>
    </div>
  );
}
