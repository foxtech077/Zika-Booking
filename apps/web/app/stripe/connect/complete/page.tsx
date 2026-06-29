"use client";

/**
 * /stripe/connect/complete
 *
 * Stripe redirects the provider here after they finish the hosted onboarding
 * form (this is the return_url set in POST /merchant/me/stripe/connect).
 *
 * What this page does:
 *  1. Calls GET /merchant/me/stripe/connect/status to confirm the onboarding result.
 *  2. Shows a brief visual feedback (loading -> success/partial).
 *  3. Redirects back to /dashboard/payments/settings after a short delay.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import {
  extractApiErrorMessage,
  getStripeConnectStatus,
  type StripeConnectStatusResponse,
} from "@/lib/payment-api";

type State = "loading" | "complete" | "incomplete" | "error";

let initialStatusPromise: Promise<StripeConnectStatusResponse> | null = null;

async function fetchStripeStatus(): Promise<StripeConnectStatusResponse> {
  const res = await getStripeConnectStatus();
  return res.data;
}

function fetchStripeStatusOnce(): Promise<StripeConnectStatusResponse> {
  if (!initialStatusPromise) {
    initialStatusPromise = fetchStripeStatus().finally(() => {
      initialStatusPromise = null;
    });
  }

  return initialStatusPromise;
}

export default function StripeConnectCompletePage() {
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [countdown, setCountdown] = useState(3);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const status = await fetchStripeStatusOnce();
        if (!cancelled) {
          setState(status.onboardingComplete ? "complete" : "incomplete");
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMsg(
            extractApiErrorMessage(
              error,
              "We could not verify your Stripe status. You can check it manually from Payment Settings.",
            ),
          );
          setState("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state === "loading") return;

    const iv = setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          clearInterval(iv);
          router.push("/dashboard/payments/settings");
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => clearInterval(iv);
  }, [state, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50">
      <div className="mx-auto max-w-sm rounded-2xl bg-white p-10 shadow-xl text-center space-y-5">
        {state === "loading" && (
          <>
            <Loader2 className="mx-auto h-14 w-14 animate-spin text-emerald-500" />
            <p className="text-lg font-semibold text-slate-800">Verifying your Stripe connection...</p>
            <p className="text-sm text-slate-500">This only takes a moment.</p>
          </>
        )}

        {state === "complete" && (
          <>
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <p className="text-lg font-bold text-slate-900">Stripe Connected!</p>
            <p className="text-sm text-slate-500">
              Your account is fully onboarded. Payouts will now be sent directly to your Stripe account.
            </p>
            <p className="text-xs text-slate-400">Redirecting in {countdown}s...</p>
          </>
        )}

        {state === "incomplete" && (
          <>
            <AlertCircle className="mx-auto h-14 w-14 text-amber-500" />
            <p className="text-lg font-bold text-slate-900">Almost there...</p>
            <p className="text-sm text-slate-500">
              Your Stripe onboarding is not fully complete yet. Please finish all required steps in the dashboard.
            </p>
            <p className="text-xs text-slate-400">Redirecting in {countdown}s...</p>
          </>
        )}

        {state === "error" && (
          <>
            <AlertCircle className="mx-auto h-14 w-14 text-red-500" />
            <p className="text-lg font-bold text-slate-900">Verification failed</p>
            <p className="text-sm text-slate-500">{errorMsg}</p>
            <p className="text-xs text-slate-400">Redirecting in {countdown}s...</p>
          </>
        )}
      </div>
    </div>
  );
}
