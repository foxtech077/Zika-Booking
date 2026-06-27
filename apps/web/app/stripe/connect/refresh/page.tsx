"use client";

/**
 * /stripe/connect/refresh
 *
 * Stripe redirects here when the onboarding link has expired
 * (this is the `refresh_url` set in POST /merchant/me/stripe/connect).
 *
 * What this page does:
 *  1. Calls GET /merchant/me/stripe/connect/refresh to get a fresh URL.
 *  2. Redirects the provider to the new Stripe-hosted onboarding page.
 *  3. Shows a friendly error if the backend call fails.
 */

import { useEffect, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { refreshStripeConnect } from "@/lib/payment-api";

type State = "loading" | "error";

export default function StripeConnectRefreshPage() {
  const [state, setState] = useState<State>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const doRefresh = async () => {
    setState("loading");
    setErrorMsg("");
    try {
      const res = await refreshStripeConnect();
      // Redirect the browser to the fresh Stripe onboarding link
      window.location.href = res.data.onboardingUrl;
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Unable to generate a new onboarding link. Please return to Settings and try again.";
      setErrorMsg(msg);
      setState("error");
    }
  };

  useEffect(() => {
    doRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-amber-50">
      <div className="mx-auto max-w-sm rounded-2xl bg-white p-10 shadow-xl text-center space-y-5">
        {state === "loading" && (
          <>
            <Loader2 className="mx-auto h-14 w-14 animate-spin text-amber-500" />
            <p className="text-lg font-semibold text-slate-800">Generating a fresh onboarding link…</p>
            <p className="text-sm text-slate-500">You will be redirected to Stripe in a moment.</p>
          </>
        )}

        {state === "error" && (
          <>
            <AlertCircle className="mx-auto h-14 w-14 text-red-500" />
            <p className="text-lg font-bold text-slate-900">Link refresh failed</p>
            <p className="text-sm text-slate-500">{errorMsg}</p>
            <div className="flex flex-col gap-3 pt-2">
              <Button variant="primary" onClick={doRefresh}>
                Try Again
              </Button>
              <Button variant="outline" onClick={() => { window.location.href = "/dashboard/payments/settings"; }}>
                Back to Settings
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
