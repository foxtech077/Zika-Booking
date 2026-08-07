// Platform-currency display helpers for the checkout flow.
//
// After a listing is locked, the booking API returns a platform (charge)
// currency — EUR for Stripe, XAF for Tara — alongside the amount the guest will
// actually be charged. The price breakdown stays in the listing currency; only
// the end total is also shown in the platform currency, so a guest paying in
// XAF is not surprised at the payment sheet.
//
// Mirrors apps/web/lib/platform-currency.ts so both clients present the same
// number the same way.

export interface PlatformInfo {
  platformCurrency: string;
  platformAmount: number;
  listingCurrency: string;
  listingTotal: number;
  platformRate: number | null;
}

export function derivePlatform(
  pp:
    | { platformCurrency?: string | null; platformAmount?: number | null; platformRate?: number | null }
    | null
    | undefined,
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

/**
 * True when the charge currency differs from the listing currency, i.e. when
 * showing the converted figure actually tells the guest something.
 */
export function isConverted(info: PlatformInfo): boolean {
  return info.platformCurrency.toUpperCase() !== info.listingCurrency.toUpperCase();
}

/** Format as "CODE value". XAF has no minor unit, so it renders without decimals. */
export function fmtMoney(amount: number, currency: string): string {
  const code = (currency ?? "").toUpperCase();
  const decimals = code === "XAF" ? 0 : 2;
  return `${code} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}
