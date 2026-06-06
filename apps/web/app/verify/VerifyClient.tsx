"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, storeToken } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { ApiResponse, AuthResponse } from "@zika/types";

type State = "loading" | "success" | "already_verified" | "expired" | "used" | "invalid" | "error";

export function VerifyClient() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [state, setState] = useState<State>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const { setSession } = useAuthStore();

  useEffect(() => {
    if (!token || token.length !== 64) { setState("invalid"); return; }

    api.get<ApiResponse<AuthResponse & { message: string }>>(`/auth/verify?token=${token}`)
      .then((res) => {
        if (!res.data.success) { setState("error"); return; }
        const { tokens, user } = res.data.data;
        storeToken(tokens.accessToken);
        setSession(tokens.accessToken, user as any);
        const msg = res.data.data.message;
        setState(msg.includes("already") ? "already_verified" : "success");
        setEmail(user.email);
        setTimeout(() => router.replace(user.userType === "provider" ? "/dashboard" : "/traveller"), 2000);
      })
      .catch((err: { response?: { data?: ApiResponse<unknown>; status?: number } }) => {
        const code = (err.response?.data as { error?: { code?: string } } | undefined)?.error?.code;
        const status = err.response?.status;
        if (status === 410 || code === "TOKEN_EXPIRED") setState("expired");
        else if (code === "TOKEN_USED") setState("used");
        else if (code === "INVALID_TOKEN") setState("invalid");
        else setState("error");
      });
  }, [token, router, setSession]);

  const content: Record<State, { icon: string; title: string; body: React.ReactNode }> = {
    loading: {
      icon: "⏳", title: "Verifying your email…",
      body: <p className="text-gray-500">Please wait a moment.</p>,
    },
    success: {
      icon: "🎉", title: "Email verified!",
      body: <p className="text-gray-500">Welcome to ZikaBooking! Redirecting you now…</p>,
    },
    already_verified: {
      icon: "✅", title: "Already verified",
      body: <p className="text-gray-500">You're already verified. Redirecting…</p>,
    },
    expired: {
      icon: "⌛", title: "Link expired",
      body: (
        <div className="space-y-4">
          <p className="text-gray-500">Your verification link has expired (links are valid for 24 hours).</p>
          {email && (
            <Link href={`/auth/verify-pending?email=${encodeURIComponent(email)}`}
              className="inline-block bg-primary text-white px-6 py-2.5 rounded-lg font-semibold">
              Send a new link
            </Link>
          )}
        </div>
      ),
    },
    used: {
      icon: "🔒", title: "Link already used",
      body: (
        <div className="space-y-4">
          <p className="text-gray-500">This verification link has already been used.</p>
          <Link href="/auth/login" className="text-primary font-semibold">Sign in to your account</Link>
        </div>
      ),
    },
    invalid: {
      icon: "❌", title: "Invalid link",
      body: (
        <div className="space-y-4">
          <p className="text-gray-500">This verification link is invalid.</p>
          <Link href="/auth/register" className="text-primary font-semibold">Create an account</Link>
        </div>
      ),
    },
    error: {
      icon: "⚠️", title: "Something went wrong",
      body: <p className="text-gray-500">Please try clicking the link again, or <Link href="/auth/login" className="text-primary">sign in</Link>.</p>,
    },
  };

  const { icon, title, body } = content[state];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">{title}</h1>
      {body}
    </div>
  );
}
