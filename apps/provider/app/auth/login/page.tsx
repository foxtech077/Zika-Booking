"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Mail, Lock, Zap } from "lucide-react";
import { api, storeToken } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface LoginResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      status: string;
      userType: string;
      businessName: string | null;
      country: string | null;
      emailVerified: boolean;
      currentTier: string;
      loyaltyPoints: number;
    };
    tokens: {
      accessToken: string;
      expiresIn: number;
    };
  };
  error?: { code: string; message: string };
}

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuthStore();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await api.post<LoginResponse>("/auth/login", payload);
      return res.data;
    },
    onSuccess: (data) => {
      if (!data.success || !data.data) {
        setError(data.error?.message ?? "Login failed.");
        return;
      }
      const { user, tokens } = data.data;

      // Check this is a provider account
      if (user.userType !== "provider") {
        setError("This portal is for provider accounts only. Please use the guest app.");
        return;
      }

      storeToken(tokens.accessToken);
      setSession(tokens.accessToken, user);
      router.replace("/dashboard");
    },
    onError: (err: any) => {
      const code = err?.response?.data?.error?.code ?? "";
      const msg  = err?.response?.data?.error?.message ?? "Invalid email or password.";
      if (
        code === "ACCOUNT_PENDING_APPROVAL" ||
        msg.toLowerCase().includes("pending admin approval")
      ) {
        router.replace("/dashboard");
        return;
      }
      setError(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.email || !form.password) {
      setError("Email and password are required.");
      return;
    }
    loginMutation.mutate(form);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex items-center justify-center p-4">
      {/* Decorative blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="text-white font-bold text-lg leading-none">Kainook</p>
              <p className="text-slate-400 text-xs">Partner Portal</p>
            </div>
          </div>
          <h1 className="text-white text-2xl font-bold mt-4">Welcome back</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to manage your listings and bookings</p>
        </div>

        {/* Card */}
        <div className="glass rounded-3xl border border-white/10 shadow-2xl p-8">
          <form id="login-form" onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-danger-light border border-danger/30 rounded-xl px-4 py-3 text-sm text-danger-dark">
                {error}
              </div>
            )}

            <Input
              id="email-input"
              label="Email address"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="you@company.com"
              leftIcon={<Mail />}
              autoComplete="email"
              required
            />

            <div>
              <Input
                id="password-input"
                label="Password"
                type={showPwd ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                leftIcon={<Lock />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                autoComplete="current-password"
                required
              />
            </div>

            <Button
              id="login-btn"
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              loading={loginMutation.isPending}
            >
              Sign In
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              Don&apos;t have an account?{" "}
              <Link href="/auth/register" className="text-primary font-semibold hover:underline">
                Register as provider
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          By signing in, you agree to Kainook&apos;s{" "}
          <a href="#" className="underline">Terms of Service</a>
        </p>
      </div>
    </div>
  );
}
