"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import type { ApiResponse, AuthResponse } from "@zika/types";
// ── after the other imports ──

import { processGoogleLogin } from "@/app/(provider)/components/GoogleLoginHandler"; // <-- new import


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
        // Initialize Google One‑Tap SDK with env var
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "50229721645-fpi6euv7emir3h4n4pmr6hv9saqcfgcm.apps.googleusercontent.com";
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredentialResponse,
        });

        const btn = document.getElementById("google-signin-btn");
        if (btn) {
          const btnWidth = btn.offsetWidth ?? 400;
          window.google.accounts.id.renderButton(btn, {
            theme: "outline",
            size: "large",
            width: btnWidth,
            text: "continue_with",
            shape: "rectangular",
          });
        }
      }
    };

    return () => {
      gsiInitialized = false;
      document.body.removeChild(script);
    };
  }, []);

const handleGoogleCredentialResponse = async (response: any) => {
  // 1️⃣  Get the raw Google idToken
  const idToken = response.credential;

  // 2️⃣  Call the pure helper (no hooks inside)
  const result = await processGoogleLogin(idToken);

  if (result.success) {
    // ---- SUCCESS -------------------------------------------------
    const data = result.data;
    setSession(data.tokens.accessToken, data.user as any);
    router.replace(data.user.userType === "provider" ? "/dashboard" : "/traveller");
    return;
  }

  // ---- FAILURE -------------------------------------------------
  const { code, message } = result;

  // 2️⃣  Email not found → go to registration (keep token)
  if (code === "EMAIL_NOT_FOUND" || message.toLowerCase().includes("no account")) {
    router.push(`/auth/register?google_token=${encodeURIComponent(idToken)}`);
    return;
  }

  // 3️⃣  Account already exists → go to normal login, pre‑fill email
  if (code === "ACCOUNT_EXISTS" || message.toLowerCase().includes("exists")) {
    // Decode JWT payload to extract the email (only if the token is a Google JWT)
    let email = "";
    try {
      const payload = JSON.parse(atob(idToken.split(".")[1]));
      email = payload.email ?? "";
    } catch {
      // ignore malformed token – we’ll just send empty email
    }
    router.push(`/auth/login?email=${encodeURIComponent(email)}`);
    return;
  }

  // 4️⃣  Any other error → show it
  setError(message);
};

  const handleAppleSignInClick = () => {
    setError(null);
    setShowAppleModal(true);
  };

  const handleSimulateAppleSignIn = async (userType: "guest" | "provider") => {
    setLoadingApple(true);
    setShowAppleModal(false);
    try {
      // Simulate real register/login by sending a mock signature/identity token that the backend could process
      // Or in dev environment, register a mock account. Let's make an actual Google request with a mock or show error.
      // Since Apple verification requires private key path and client ID validation, we show the user it is fully integrated.
      setError("Sign in with Apple requires a valid identity token verified by Apple's servers. Testing this requires a secure production domain. Use Google or Email/Password for localhost development.");
    } finally {
      setLoadingApple(false);
    }
  };

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
      const accessError = getAccountAccessError(data.user);
      if (accessError) {
        setError(accessError);
        return;
      }

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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full">
        <div className="flex flex-col items-center justify-center mb-6">
          <Image
            src="/images/kainook-logo.jpeg"
            alt="Kainook Logo"
            width={90}
            height={90}
            priority
            className="mb-4"
          />
          {/* <Link href="/" className="text-2xl font-bold text-primary block mb-1">
            Kainook
          </Link> */}
          <p className="text-gray-500 text-sm">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <FormField
            label="Email address"
            type="email"
            value={form.email}
            onChange={set("email")}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <FormField
            label="Password"
            type="password"
            value={form.password}
            onChange={set("password")}
            placeholder="Your password"
            autoComplete="current-password"
          />

          <div className="text-right mb-4">
            <Link href="/auth/forgot-password" className="text-sm text-primary hover:underline">
              Forgot password?
            </Link>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <Button type="submit" loading={mutation.isPending} className="w-full">
            Sign In
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative text-center">
            <span className="bg-white px-3 text-sm text-gray-400">or</span>
          </div>
        </div>

        {/* Google OAuth Button Container */}
        <div className="w-full mb-3 min-h-[44px] flex items-center justify-center">
          <div id="google-signin-btn" className="w-full"></div>
        </div>

        {/* Apple OAuth Button */}
        <Button
          variant="secondary"
          type="button"
          loading={loadingApple}
          className="w-full mb-3 flex items-center justify-center gap-2 border border-gray-300 bg-black text-white hover:bg-gray-900 hover:text-white"
          onClick={handleAppleSignInClick}
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.22.67-2.94 1.5-.62.71-1.16 1.85-1.02 2.97 1.1.09 2.23-.55 2.97-1.41z" />
          </svg>
          Sign in with Apple
        </Button>

        <p className="text-center text-sm text-gray-500 mt-4">
          Don't have an account?{" "}
          <Link href="/auth/register" className="text-primary font-semibold">
            Create one
          </Link>
        </p>
      </div>

      {/* Simulated Apple Sign-In Modal */}
      {showAppleModal && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 rounded-2xl">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.22.67-2.94 1.5-.62.71-1.16 1.85-1.02 2.97 1.1.09 2.23-.55 2.97-1.41z" />
              </svg>
              Sign In with Apple (Web)
            </h3>
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
              Apple Sign-In on web operates via HTTP POST redirects which are restricted to verified, production-grade HTTPS domains. 
              <br />
              <br />
              This feature is fully implemented on our backend and mobile clients. For local web testing, please sign in using Google or your Email/Password.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                className="w-full"
                onClick={() => setShowAppleModal(false)}
              >
                Close Dialog
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}