"use client";

import { useState, useEffect, useRef } from "react";
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

// Web Application OAuth client (project 1022728776661 / kainook-cd1d2).
// Identical to the `webClientId` the mobile app configures GoogleSignin with,
// and to the audience auth-service verifies id_tokens against. Client IDs are
// public, not secrets — hardcoded to match the mobile app's convention.
//
// Only the *web* client works here: iOS/Android client IDs have no
// "Authorized JavaScript origins" and are rejected by browser sign-in.
//
// NOTE: this ID being correct is necessary but not sufficient — the browser's
// page origin must also be registered on this client in Google Cloud Console,
// or sign-in fails with "Error 400: origin_mismatch" before any token is
// issued. Native mobile sign-in has no origin, so it is unaffected.
const GOOGLE_CLIENT_ID_WEB =
  "1022728776661-50ctighki9jm25ig10b39matcr0ihslr.apps.googleusercontent.com";

function getPostLoginPath(user: AuthResponse["user"]) {
  // Accounts created through Google/Apple never see a consent checkbox — this
  // is the only signup path on web, since the register page has no social
  // button. Gate on the Privacy Policy, which the client requires at
  // registration; the Terms are collected later, at checkout.
  if ((user as { requiresPrivacyAcceptance?: boolean }).requiresPrivacyAcceptance) {
    const next = user.userType === "provider" ? "/dashboard" : "/traveller";
    return `/auth/accept-terms?next=${encodeURIComponent(next)}`;
  }
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
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [gsiReady, setGsiReady] = useState(false);

  // Load the Google Identity Services SDK once.
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
          client_id: GOOGLE_CLIENT_ID_WEB,
          callback: handleGoogleCredentialResponse,
        });
      }
      setGsiReady(true);
    };

    return () => {
      gsiInitialized = false;
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    const el = googleBtnRef.current;
    if (!gsiReady || !el || !window.google) return;

    el.innerHTML = "";
    window.google.accounts.id.renderButton(el, {
      theme: "outline",
      size: "large",
      width: 400,
      text: "continue_with",
      shape: "rectangular",
    });
  }, [gsiReady]);

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
  const trustPoints = [
    "Instant confirmation on every booking",
    "Verified stays, homes and car rentals",
    "Your data protected end to end",
  ];

  return (
    <div className="relative min-h-screen min-h-[100dvh] w-full bg-white lg:grid lg:grid-cols-[1.05fr_1fr]">

      {/* ── Left: full-bleed brand panel (desktop) ── */}
      <aside className="relative hidden overflow-hidden lg:sticky lg:top-0 lg:block lg:h-screen">
        <Image
          src="/images/Login.webp"
          alt=""
          fill
          priority
          sizes="55vw"
          className="object-cover"
        />
        {/* Layered scrim — keeps the photo readable behind text without flattening it */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#03301f] via-[#03301f]/60 to-[#03301f]/20" />
        <div className="absolute inset-0 bg-[radial-gradient(115%_75%_at_50%_0%,transparent_35%,rgba(3,48,31,0.5)_100%)]" />

        <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
          <Link href="/" className="flex w-fit items-center gap-3">
            <Image
              src="/images/kainook-logo.jpeg"
              alt="Kainook"
              width={48}
              height={48}
              className="rounded-2xl ring-1 ring-white/20"
            />
            <span className="text-xl font-bold tracking-[0.16em] text-white">KAINOOK</span>
          </Link>

          <div className="max-w-md">
            <h2 className="text-4xl font-bold leading-[1.08] tracking-tight text-white xl:text-5xl">
              Welcome back.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/75">
              Pick up where you left off — your trips, your saved stays and your
              rewards, all in one place.
            </p>

            <ul className="mt-10 space-y-3.5">
              {trustPoints.map((point) => (
                <li key={point} className="flex items-center gap-3 text-sm text-white/80">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4ade80]/15 ring-1 ring-[#4ade80]/30">
                    <svg className="h-3.5 w-3.5 text-[#4ade80]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      {/* ── Right: form ── */}
      <main className="flex min-h-screen min-h-[100dvh] flex-col lg:h-screen lg:overflow-y-auto">

        {/* Mobile hero — same photograph, compact */}
        <div className="relative h-44 w-full shrink-0 overflow-hidden lg:hidden">
          <Image
            src="/images/Login.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#03301f] via-[#03301f]/65 to-[#03301f]/25" />
          <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-8">
            <Link href="/" className="flex w-fit items-center gap-2.5">
              <Image
                src="/images/kainook-logo.jpeg"
                alt="Kainook"
                width={38}
                height={38}
                className="rounded-xl ring-1 ring-white/20"
              />
              <span className="text-base font-bold tracking-[0.16em] text-white">KAINOOK</span>
            </Link>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">Welcome back.</h2>
          </div>
        </div>

        <div className="mx-auto my-auto w-full max-w-[600px] px-6 py-10 sm:px-8 lg:px-10 lg:py-14">
          <div className="mb-8">
            <h1 className="text-[26px] font-bold tracking-tight text-gray-900">Sign in</h1>
            <p className="mt-1.5 text-sm text-gray-500">
              Enter your details to access your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className="w-full rounded-xl border border-gray-200 bg-[#f6fdf8] py-3.5 pl-10 pr-4 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label htmlFor="login-password" className="text-sm font-medium text-gray-700">
                  Password
                </label>
                <Link href="/auth/forgot-password" className="text-xs font-medium text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className="w-full rounded-xl border border-gray-200 bg-[#f6fdf8] py-3.5 pl-10 pr-11 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={mutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-dark hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mutation.isPending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in…
                </>
              ) : "Sign In"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs uppercase tracking-wider text-gray-400">or continue with</span>
            </div>
          </div>

          {/* Google — see the effect above for why this is two stacked layers */}
          {/* h-12 (48px) matches the Sign In / Apple buttons exactly: both are
              py-3.5 (28px) + text-sm line-height (20px) = 48px. */}
          <div className="relative mb-2.5 h-12 w-full">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm"
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
              </svg>
              Continue with Google
            </div>
            <div ref={googleBtnRef} className="google-btn-proxy absolute inset-0 overflow-hidden opacity-0" />
          </div>

          {/* Apple */}
          <button
            id="login-apple-btn"
            type="button"
            disabled={loadingApple}
            onClick={handleAppleSignInClick}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-black py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-gray-900 disabled:opacity-60"
          >
            <svg className="h-[18px] w-[18px] fill-current" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.22.67-2.94 1.5-.62.71-1.16 1.85-1.02 2.97 1.1.09 2.23-.55 2.97-1.41z" />
            </svg>
            Sign in with Apple
          </button>

          <p className="mt-8 text-center text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <Link href="/auth/register" className="font-semibold text-primary hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </main>

      {/* Apple Modal */}
      {showAppleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="animate-slide-in-up w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.22.67-2.94 1.5-.62.71-1.16 1.85-1.02 2.97 1.1.09 2.23-.55 2.97-1.41z" />
              </svg>
              Sign In with Apple (Web)
            </h3>
            <p className="mb-5 text-sm leading-relaxed text-gray-500">
              Apple Sign-In on web operates via HTTP POST redirects which are restricted to verified, production-grade HTTPS domains.
              <br /><br />
              This feature is fully implemented on our backend and mobile clients. For local web testing, please sign in using Google or Email/Password.
            </p>
            <button
              type="button"
              onClick={() => setShowAppleModal(false)}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
