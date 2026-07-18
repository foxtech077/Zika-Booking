"use client";

import { AlertTriangle } from "lucide-react";
import { getCurrencyForCountry } from "./countryCurrencyMap";

interface Props {
  providerCountry: string | null | undefined;
  listingCountry: string;
  currency: string;
}

export function PayoutCurrencyWarning({ providerCountry, listingCountry, currency }: Props) {
  if (!providerCountry || !currency) return null;

  const country = listingCountry || providerCountry;
  const expectedCurrency = getCurrencyForCountry(country);

  if (!expectedCurrency || expectedCurrency === currency) return null;

  const accountCurrency = getCurrencyForCountry(providerCountry);

  return (
    <div className="flex gap-3 rounded-2xl bg-amber-50 border border-amber-200/60 p-4">
      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-amber-800">Payout Currency Notice</p>
        <p className="text-xs text-amber-700/80 mt-0.5">
          Your account is registered in <strong>{providerCountry}</strong> ({accountCurrency ?? "—"}).
          This listing is in <strong>{currency}</strong>. Make sure you have a payout method configured for{" "}
          <strong>{currency}</strong> in your{" "}
          <a href="/dashboard/settings" className="underline font-medium hover:text-amber-900">payment settings</a>{" "}
          to receive payouts.
        </p>
      </div>
    </div>
  );
}
