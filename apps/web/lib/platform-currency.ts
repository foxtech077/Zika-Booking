// Platform-currency display helpers for the checkout flow.
//
// After a listing is locked, the booking API returns a platform (charge)
// currency — EUR for Stripe, XAF for Tara — with the amount the guest will
// actually be charged. The price breakdown stays in the listing currency; only
// the end total is shown in the platform currency.

export interface PlatformInfo {
  platformCurrency: string;
  platformAmount: number;
  listingCurrency: string;
  listingTotal: number;
  platformRate: number | null;
}

export function derivePlatform(
  pp: { platformCurrency?: string; platformAmount?: number; platformRate?: number } | null | undefined,
  listingCurrency: string,
  listingTotal: number,
): PlatformInfo {
  return {
    platformCurrency: pp?.platformCurrency ?? listingCurrency,
    platformAmount: pp?.platformAmount != null ? pp.platformAmount : listingTotal,
    listingCurrency,
    listingTotal,
    platformRate: pp?.platformRate ?? null,
  };
}

/** Format an amount as "CODE value" with platform-appropriate decimals. */
export function fmtMoney(amount: number, currency: string): string {
  const code = (currency ?? "").toUpperCase();
  const decimals = code === "XAF" ? 0 : 2;
  return `${code} ${amount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
