"use client";

/**
 * One-time consent gate.
 *
 * Collects the Privacy Policy acceptance the client requires at registration,
 * for accounts that never saw a consent checkbox — principally Google/Apple
 * signups (on web the register page has no social button at all, so every
 * social signup arrives via the login screen). Also shown to existing users
 * after a policy version bump.
 *
 * The Terms & Conditions are NOT collected here — per the client's spec they
 * are accepted at checkout, before completing a payment or booking.
 *
 * Deliberately offers no way past it other than accepting or signing out.
 */

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { ApiResponse } from "@zika/types";

export default function AcceptTermsClient() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, isAuthenticated, clearSession, updateUser } = useAuthStore();

  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Held true from success through the route change. `mutation.isPending` flips
  // back to false the instant the request resolves, which would flash the idle
  // button for a frame while the redirect is still in flight.
  const [redirecting, setRedirecting] = useState(false);

  const next = params.get("next") || "/";

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<{ acceptedAt: string }>>("/auth/accept-terms", {
        acceptedPrivacy: true,
      });
      if (!res.data.success) throw res.data;
      return res.data.data;
    },
    onSuccess: (data) => {
      setRedirecting(true);
      updateUser({ requiresPrivacyAcceptance: false, privacyAcceptedAt: data?.acceptedAt } as never);
      router.replace(next);
    },
    onError: (err: any) => {
      setRedirecting(false);
      setError(err?.response?.data?.error?.message ?? "Could not save your acceptance. Please try again.");
    },
  });

  function handleContinue() {
    if (!agreedToPrivacy) {
      setError("Please accept the Privacy Policy to continue.");
      return;
    }
    setError(null);
    mutation.mutate();
  }

  function handleSignOut() {
    clearSession();
    router.replace("/auth/login");
  }

  const busy = mutation.isPending || redirecting;

  if (!isAuthenticated) {
    router.replace("/auth/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl p-7">
        <h1 className="text-xl font-bold text-slate-900">Before you continue</h1>
        <p className="mt-2 text-sm text-slate-600">
          {user?.firstName ? `${user.firstName}, please` : "Please"} review and accept our Privacy Policy
          to continue. We only need this once.
        </p>

        <div className="mt-6 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToPrivacy}
              onChange={(e) => {
                setAgreedToPrivacy(e.target.checked);
                setError(null);
              }}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#1D8D2B] focus:ring-[#1D8D2B]"
            />
            <span className="text-sm text-slate-700">
              I have read and agree to the{" "}
              <Link href="/legal/privacy" target="_blank" className="font-semibold text-[#1D8D2B] underline">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={handleContinue}
          disabled={!agreedToPrivacy || busy}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1D8D2B] py-3 text-sm font-semibold text-white transition hover:bg-[#166f22] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Saving…
            </>
          ) : "Accept and continue"}
        </button>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={busy}
          className="mt-3 w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
