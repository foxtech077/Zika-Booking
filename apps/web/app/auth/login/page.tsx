"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { api, storeToken } from "@/lib/api";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import type { ApiResponse, AuthResponse } from "@zika/types";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [k]: e.target.value }));
    setError(null);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<AuthResponse>>("/auth/login", form);
      if (!res.data.success) throw res.data;
      return res.data.data;
    },
    onSuccess: (data) => {
      storeToken(data.tokens.accessToken);
      // Redirect based on user type
      router.replace(data.user.userType === "provider" ? "/provider" : "/");
    },
    onError: (err: any) => {
      const e = err.response?.data?.error;
      if (e?.code === "EMAIL_NOT_VERIFIED") {
        router.push(`/auth/verify-pending?email=${encodeURIComponent(form.email)}`);
        return;
      }
      setError(e?.message ?? "Unable to connect. Please check your network and try again.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password) { setError("Please enter your email and password."); return; }
    mutation.mutate();
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full">
        <Link href="/" className="text-2xl font-bold text-primary block mb-1">ZikaBooking</Link>
        <p className="text-gray-500 text-sm mb-6">Sign in to your account</p>

        <form onSubmit={handleSubmit} noValidate>
          <FormField label="Email address" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" autoComplete="email" />
          <FormField label="Password" type="password" value={form.password} onChange={set("password")} placeholder="Your password" autoComplete="current-password" />

          <div className="text-right mb-4">
            <Link href="/auth/forgot-password" className="text-sm text-primary hover:underline">Forgot password?</Link>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <Button type="submit" loading={mutation.isPending} className="w-full">Sign In</Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
          <div className="relative text-center"><span className="bg-white px-3 text-sm text-gray-400">or</span></div>
        </div>

        {/* Google OAuth — client-side redirect flow for web */}
        <Button variant="secondary" className="w-full mb-3" onClick={() => {
          window.location.href = `/api/auth/oauth/google/redirect`;
        }}>
          <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </Button>

        <p className="text-center text-sm text-gray-500 mt-4">
          Don't have an account?{" "}
          <Link href="/auth/register" className="text-primary font-semibold">Create one</Link>
        </p>
      </div>
    </div>
  );
}
