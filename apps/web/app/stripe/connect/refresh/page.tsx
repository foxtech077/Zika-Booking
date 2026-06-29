"use client";

/**
 * /stripe/connect/refresh
 *
 * Stripe redirects here when the onboarding link has expired
 * (this is the refresh_url set in POST /merchant/me/stripe/connect).
 *
 * What this page does:
 *  1. Calls GET /merchant/me/stripe/connect/refresh to get a fresh URL.
 *  2. Redirects the provider to the new Stripe-hosted onboarding page.
 *  3. Shows a friendly error if the backend call fails.
 */

import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  extractApiErrorMessage,
  getStripeOnboardingUrl,
  refreshStripeConnect,
} from "@/lib/payment-api";

type State = "loading" | "error";

let initialRefreshPromise: Promise<string> | null = null;

async function fetchFreshStripeLink(): Promise<string> {
  const res = await refreshStripeConnect();
  const onboardingUrl = getStripeOnboardingUrl(res);

  if (!onboardingUrl) {
    throw new Error("Stripe onboarding URL was missing from the response.");
  }

  return onboardingUrl;
}

function fetchFreshStripeLinkOnce(): Promise<string> {
  if (!initialRefreshPromise) {
    initialRefreshPromise = fetchFreshStripeLink().finally(() => {
      initialRefreshPromise = null;
    });
  }

  return initialRefreshPromise;
}

export default function StripeConnectRefreshPage() {
  const [state, setState] = useState<State>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const redirectToFreshLink = async () => {
    setState("loading");
    setErrorMsg("");

    try {
      const onboardingUrl = await fetchFreshStripeLink();
      window.location.replace(onboardingUrl);
    } catch (error) {
      setErrorMsg(
        extractApiErrorMessage(
          error,
          "Unable to generate a new onboarding link. Please return to Settings and try again.",
        ),
      );
      setState("error");
    }
  };

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const onboardingUrl = await fetchFreshStripeLinkOnce();
        if (!cancelled) {
          window.location.replace(onboardingUrl);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMsg(
            extractApiErrorMessage(
              error,
              "Unable to generate a new onboarding link. Please return to Settings and try again.",
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-amber-50">
      <div className="mx-auto max-w-sm rounded-2xl bg-white p-10 shadow-xl text-center space-y-5">
        {state === "loading" && (
          <>
            <Loader2 className="mx-auto h-14 w-14 animate-spin text-amber-500" />
            <p className="text-lg font-semibold text-slate-800">Generating a fresh onboarding link...</p>
            <p className="text-sm text-slate-500">You will be redirected to Stripe in a moment.</p>
          </>
        )}

        {state === "error" && (
          <>
            <AlertCircle className="mx-auto h-14 w-14 text-red-500" />
            <p className="text-lg font-bold text-slate-900">Link refresh failed</p>
            <p className="text-sm text-slate-500">{errorMsg}</p>
            <div className="flex flex-col gap-3 pt-2">
              <Button variant="primary" onClick={() => void redirectToFreshLink()}>
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  window.location.assign("/dashboard/payments/settings");
                }}
              >
                Back to Settings
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
