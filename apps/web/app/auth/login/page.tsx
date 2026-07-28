"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { ApiResponse, AuthResponse } from "@zika/types";

// Declare global google object for TypeScript
declare global {
  interface Window {
    google?: any;
  }
}

let gsiInitialized = false;

function getPostLoginPath(user: AuthResponse["user"]) {
  return user.userType === "provider" ? "/dashboard" : "/traveller";
}

function getAccountAccessError(user: AuthResponse["user"]) {
  if (!user.emailVerified || user.status === "pending_verification") {
    return "Please verify your email address to sign in.";
  }
  if (user.status === "suspended") {
    return "Your account has been suspended. Please contact support for assistance.";
  }
  if (user.status === "banned") {
    return "Your account has been permanently removed from Kainook.";
  }
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuthStore();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showAppleModal, setShowAppleModal] = useState(false);
  const [loadingApple, setLoadingApple] = useState(false);

  // Initialize and load Google GIS SDK
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.google && !gsiInitialized) {
        gsiInitialized = true;
        window.google.accounts.id.initialize({
          client_id: "397191986681-clt35826mp608u6ptq9udm8m7c7dk80u.apps.googleusercontent.com",
          callback: handleGoogleCredentialResponse,
        });

        const btn = document.getElementById("google-signin-btn");
        const btnWidth = btn?.offsetWidth ?? 400;
        window.google.accounts.id.renderButton(btn, {
          theme: "outline",
          size: "large",
          width: btnWidth,
          text: "continue_with",
          shape: "rectangular",
        });
      }
    };

    return () => {
      gsiInitialized = false;
      document.body.removeChild(script);
    };
  }, []);

  const handleGoogleCredentialResponse = async (response: any) => {
    setError(null);
    try {
      const res = await api.post<ApiResponse<AuthResponse>>("auth/oauth/google", {
        idToken: response.credential,
      });
      if (!res.data.success) throw res.data;
      const data = res.data.data;
      const accessError = getAccountAccessError(data.user);
      if (accessError) { setError(accessError); return; }
      setSession(data.tokens.accessToken, data.user as any);
      router.replace(getPostLoginPath(data.user));
    } catch (err: any) {
      const msg = err.response?.data?.error?.message ?? "Sign in with Google failed. Please try again.";
      setError(msg);
    }
  };

  const handleAppleSignInClick = () => {
    setError(null);
    setShowAppleModal(true);
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [k]: e.target.value }));
    setError(null);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<AuthResponse>>("auth/login", form);
      if (!res.data.success) throw res.data;
      return res.data.data;
    },
    onSuccess: (data) => {
      const accessError = getAccountAccessError(data.user);
      if (accessError) { setError(accessError); return; }
      setSession(data.tokens.accessToken, data.user as any);
      router.replace(getPostLoginPath(data.user));
    },
    onError: (err: any) => {
      const e = err.response?.data?.error;
      if (e?.code === "EMAIL_NOT_VERIFIED") {
        router.push(`/auth/verify-pending?email=${encodeURIComponent(form.email)}`);
        return;
      }
      if (
        e?.code === "ACCOUNT_PENDING_APPROVAL" ||
        (e?.message ?? "").toLowerCase().includes("pending admin approval")
      ) {
        router.replace("/dashboard");
        return;
      }
      setError(e?.message ?? "Unable to connect. Please check your network and try again.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError("Please enter your email and password.");
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="min-h-screen min-h-[100dvh] w-full flex items-center justify-center p-3 sm:p-4 md:p-6 bg-gradient-to-br from-[#07543f] via-[#128055] to-[#2ac98a] py-6 sm:py-10">
      <div className="w-full max-w-5xl flex rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl bg-white md:h-[min(600px,calc(100vh-2rem))]">

        {/* ── Left Panel: Image ── */}
        <div className="relative hidden md:flex md:w-[45%] flex-col justify-between overflow-hidden rounded-l-3xl">
          <Image
            src="/images/Login.png"
            alt="Kainook city backdrop"
            fill
            priority
            className="object-cover"
            sizes="45vw"
          />
          {/* Dark overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/70" />

          {/* Top: Logo */}
          <div className="relative z-10 p-8 flex items-center gap-3">
            <Image
              src="/images/kainook-logo.jpeg"
              alt="Kainook Logo"
              width={50}
              height={50}
              className="rounded-2xl"
            />
            <span className="text-white font-bold text-xl tracking-wide">KAINOOK</span>
          </div>

          {/* Bottom: Welcome text + trust badge */}
          <div className="relative z-10 p-8 pb-10">
            <h2 className="text-white text-3xl font-bold leading-snug mb-2">
              Welcome back!
            </h2>
            <p className="text-white/80 text-sm leading-relaxed">
              Sign in to continue your journey<br />
              with <span className="text-[#4ade80] font-semibold">Kainook.</span>
            </p>

            <div className="mt-8 flex items-center gap-2">
              <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <span className="text-white/70 text-xs">Your data is safe with us</span>
            </div>
          </div>
        </div>

        {/* ── Right Panel: Form ── */}
        <div className="flex-1 bg-white flex flex-col justify-center px-4 py-6 sm:px-8 md:px-12 rounded-2xl md:rounded-l-none md:rounded-r-3xl overflow-y-auto">
          {/* Mobile Logo */}
          <div className="flex md:hidden items-center justify-center gap-2 mb-4">
            <Image
              src="/images/kainook-logo.jpeg"
              alt="Kainook Logo"
              width={40}
              height={40}
              className="rounded-xl"
            />
            <span className="font-bold text-lg text-primary tracking-wide">KAINOOK</span>
          </div>

          <h1 className="text-xl font-bold text-center text-gray-900 mb-5">
            <span className="text-primary">Sign in</span> to your account
          </h1>
          <div className="w-full max-w-md mx-auto">
          <form onSubmit={handleSubmit} noValidate className="space-y-3">
            {/* Email */}
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-4.5 h-4.5 w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </span>
                <input
                  id="login-email"
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-[#f6fdf8] text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </span>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 bg-[#f6fdf8] text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div className="text-right -mt-1">
              <Link href="/auth/forgot-password" className="text-sm text-primary hover:underline font-medium">
                Forgot password?
              </Link>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {mutation.isPending ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in…
                </>
              ) : "Sign In"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-gray-400">or</span>
            </div>
          </div>

          {/* Google */}
          <div className="w-full mb-2 min-h-[44px] flex items-center justify-center">
            <div id="google-signin-btn" className="w-full"/>
          </div>

          {/* Apple */}
          <button
            id="login-apple-btn"
            type="button"
            disabled={loadingApple}
            onClick={handleAppleSignInClick}
            className="w-full flex items-center justify-center gap-2.5 bg-black hover:bg-gray-900 text-white font-semibold py-3 rounded-xl transition-all duration-200 text-sm disabled:opacity-60"
          >
            <svg className="w-4.5 h-4.5 w-[18px] h-[18px] fill-current" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.22.67-2.94 1.5-.62.71-1.16 1.85-1.02 2.97 1.1.09 2.23-.55 2.97-1.41z" />
            </svg>
            Sign in with Apple
          </button>

          {/* Sign up link */}
          <p className="text-center text-sm text-gray-500 mt-4">
            Don&apos;t have an account?{" "}
            <Link href="/auth/register" className="text-primary font-semibold hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>

      {/* Apple Modal */}
      {showAppleModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-gray-100 animate-slide-in-up">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.22.67-2.94 1.5-.62.71-1.16 1.85-1.02 2.97 1.1.09 2.23-.55 2.97-1.41z" />
              </svg>
              Sign In with Apple (Web)
            </h3>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">
              Apple Sign-In on web operates via HTTP POST redirects which are restricted to verified, production-grade HTTPS domains.
              <br /><br />
              This feature is fully implemented on our backend and mobile clients. For local web testing, please sign in using Google or Email/Password.
            </p>
            <button
              type="button"
              onClick={() => setShowAppleModal(false)}
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-xl transition text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
      </div>

    </div>
  );
}
