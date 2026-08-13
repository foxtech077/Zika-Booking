import { ZERO_DECIMAL_CURRENCIES } from "../services/exchangeRate.services.js";

/**
 * Builds the SQL WHERE clause + joins that filter listings by the price a guest
 * actually pays: commission-inclusive, converted to the requested currency and
 * ceiling-rounded — the exact value the search response exposes as
 * `localizedNightlyRate` / `localizedDailyRate` (pre-promo-discount, which is a
 * category-wide client-side badge, not a per-booking guarantee).
 *
 * Previously the filter compared the raw stored base-currency price, so a
 * `price_max` bound in the display currency let through listings whose
 * displayed localized price exceeded the bound (e.g. a 1.0 KYD listing with
 * 10% commission returned as $1.33 USD under a `price_max=1` filter).
 *
 * The caller supplies the effective global commission rate and the USD→target
 * rate (both read once per request, matching the display-side helpers) and the
 * `next()` placeholder allocator, so params stay aligned with search.ts's
 * shared parameter list.
 */
export function buildPriceFilter(input: {
  category: string;
  priceMin?: number;
  priceMax?: number;
  /** Uppercase ISO 4217 target currency, or null when no conversion is requested. */
  targetCurrency?: string | null;
  /** USD→target rate; null means the target currency has no rate (conversion unavailable). */
  usdToTargetRate?: number | null;
  /** Effective global commission rate (decimal fraction), used as fallback for countries without a row. */
  globalCommissionRate: number;
  /** Allocates the next `$N` placeholder in the shared param sequence. */
  next: () => string;
}): { clause: string | null; joins: string; params: unknown[] } {
  const { category, priceMin, priceMax, targetCurrency, usdToTargetRate, globalCommissionRate, next } = input;

  if (priceMin === undefined && priceMax === undefined) {
    return { clause: null, joins: "", params: [] };
  }

  const priceCol = category === "car" ? "l.price_per_day" : "l.price_per_night";

  // Hotels price from the cheapest active room type, exactly like the response
  // builder (search.ts: Math.min over hotelRoomTypes). The listing-level column
  // is often NULL when room types exist, which previously made the whole filter
  // expression NULL and silently dropped every such hotel from price-filtered
  // searches. Other categories use their own price column directly.
  const rawPriceExpr =
    category === "hotel"
      ? `COALESCE((SELECT MIN(hrt.price_per_night) FROM listing.hotel_room_types hrt WHERE hrt.listing_id = l.id AND hrt.is_active = true), ${priceCol})`
      : priceCol;

  // Target currency has no exchange rate → the display can't produce a localized
  // price for any listing, so nothing can be verified against a price bound.
  if (targetCurrency && usdToTargetRate == null) {
    return { clause: "1 = 0", joins: "", params: [] };
  }

  // Placeholders are allocated in the order params are collected below.
  const comm = next();
  const target = targetCurrency ? next() : null;
  const usdTarget = targetCurrency ? next() : null;

  const params: unknown[] = [globalCommissionRate];
  if (target) params.push(targetCurrency);
  if (usdTarget) params.push(usdToTargetRate);

  const commissionSql = `COALESCE(CASE WHEN cr.pending_rate IS NOT NULL AND cr.pending_effective_from <= now() THEN cr.pending_rate ELSE cr.rate END, ${comm})`;

  const joins = [
    `LEFT JOIN listing.commission_rates cr ON cr.country = l.country`,
    ...(targetCurrency ? [`LEFT JOIN listing.exchange_rates er ON er."fromCurrency" = 'USD' AND er."toCurrency" = l.currency AND er."expiresAt" >= now()`] : []),
  ].join("\n      ");

  // Mirrors the response builders in search.ts:
  //  - no target currency / same currency → nightlyRate = round2(raw × (1+commission))
  //  - otherwise → localizedNightlyRate = ceilingForCurrency(raw × (1+commission) × fx, target)
  //    where fx(base→target) = usdToTarget / usdToBase; a NULL-currency listing is USD.
  //  - missing usd→base row (and listing not USD) → display shows null → excluded.
  let guestPrice: string;
  if (!targetCurrency) {
    guestPrice = `ROUND(${rawPriceExpr} * (1 + ${commissionSql}), 2)`;
  } else {
    const fxSql = `(${usdTarget} / CASE WHEN l.currency IS NULL OR l.currency = 'USD' THEN 1 ELSE er.rate END)`;
    const converted = `(${rawPriceExpr} * (1 + ${commissionSql}) * ${fxSql})`;
    const rounded = ZERO_DECIMAL_CURRENCIES.has(targetCurrency)
      ? `CEIL(${converted})`
      : `CEIL(${converted} * 100) / 100`;
    guestPrice = `CASE
        WHEN COALESCE(l.currency, 'USD') = ${target} THEN ROUND(${rawPriceExpr} * (1 + ${commissionSql}), 2)
        WHEN l.currency IS NOT NULL AND l.currency <> 'USD' AND er.rate IS NULL THEN NULL
        ELSE ${rounded}
      END`;
  }

  const conds: string[] = [];
  if (priceMin !== undefined) conds.push(`(${guestPrice} >= ${next()})`);
  if (priceMax !== undefined) conds.push(`(${guestPrice} <= ${next()})`);
  if (priceMin !== undefined) params.push(priceMin);
  if (priceMax !== undefined) params.push(priceMax);

  return { clause: conds.join(" AND "), joins, params };
}
