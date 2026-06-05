"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { ApiResponse, AuthResponse } from "@zika/types";

type State = "loading" | "success" | "error";

export default function VerifyEmailClient() {
  const params = useSearchParams();
  const router = useRouter();
  const { setSession } = useAuthStore();
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setState("error");
      setMessage("No verification token found in the link. Please use the link from your email.");
      return;
    }

    api
      .get<ApiResponse<AuthResponse>>(`/auth/verify?token=${token}`)
      .then((res) => {
        if (res.data.success && res.data.data?.tokens?.accessToken) {
          const { tokens, user } = res.data.data;
          setSession(tokens.accessToken, user as any);
          setState("success");
          setMessage(res.data.data.message ?? "Email verified! Welcome to ZikaBooking.");
          // Auto-redirect to traveller dashboard after 2s
          setTimeout(() => {
            router.replace(user.userType === "provider" ? "/dashboard" : "/traveller");
          }, 2000);
        } else {
          setState("error");
          setMessage((res.data as any)?.error?.message ?? "Verification failed.");
        }
      })
      .catch((err) => {
        const msg =
          err.response?.data?.error?.message ??
          "This verification link is invalid or has expired. Please request a new one.";
        setState("error");
        setMessage(msg);
      });
  }, [params, router, setSession]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
      {state === "loading" && (
        <>
          <div className="flex justify-center mb-4">
            <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Verifying your email…</h1>
          <p className="text-gray-500 text-sm">Please wait a moment.</p>
        </>
      )}

      {state === "success" && (
        <>
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h1>
          <p className="text-gray-500 mb-6">{message}</p>
          <p className="text-sm text-gray-400">Redirecting you to your dashboard…</p>
        </>
      )}

      {state === "error" && (
        <>
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h1>
          <p className="text-red-500 mb-6 text-sm leading-relaxed">{message}</p>
          <div className="flex flex-col gap-3">
            <Link
              href="/auth/register"
              className="block w-full py-2.5 bg-primary text-white font-semibold rounded-xl text-sm hover:opacity-90 transition"
            >
              Create a new account
            </Link>
            <Link
              href="/auth/login"
              className="text-primary font-semibold text-sm hover:underline"
            >
              Back to Sign In
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
