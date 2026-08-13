import { ZERO_DECIMAL_CURRENCIES } from "../services/exchangeRate.services.js";

/**
 * Builds the SQL expression for the guest-payable price — the exact value the
 * search response exposes as `localizedNightlyRate` / `localizedDailyRate`
 * (pre-promo-discount, which is a category-wide client-side badge, not a
 * per-booking guarantee): commission-inclusive, converted to the requested
 * currency and ceiling-rounded.
 *
 * Used for BOTH the price filter clause and the price sort (`price_asc` /
 * `price_desc`), so filtering and ordering agree with the displayed prices.
 * Previously the sort ordered by the raw stored base-currency listing price,
 * which ignores the min-room-type price for hotels (NULL listing column),
 * per-country commission and the display-currency conversion — so a
 * `price_desc` sort could show a 0.09 EUR listing above a 31.98 EUR one.
 *
 * The caller supplies the effective global commission rate and the USD→target
 * rate (both read once per request, matching the display-side helpers) and the
 * `next()` placeholder allocator, so params stay aligned with search.ts's
 * shared parameter list.
 *
 * When the target currency has no exchange rate the display shows no localized
 * price (localized values are null), so the expression falls back to the
 * commission-inclusive base-currency price — matching the fallback the
 * response/display uses.
 */
export function buildGuestPriceExpr(input: {
  category: string;
  /** Uppercase ISO 4217 target currency, or null when no conversion is requested. */
  targetCurrency?: string | null;
  /** USD→target rate; null means the target currency has no rate (conversion unavailable). */
  usdToTargetRate?: number | null;
  /** Effective global commission rate (decimal fraction), used as fallback for countries without a row. */
  globalCommissionRate: number;
  /** Allocates the next `$N` placeholder in the shared param sequence. */
  next: () => string;
}): { expr: string; joins: string; params: unknown[] } {
  const { category, targetCurrency, usdToTargetRate, globalCommissionRate, next } = input;

  const priceCol = category === "car" ? "l.price_per_day" : "l.price_per_night";

  // Hotels price from the cheapest active room type, exactly like the response
  // builder (search.ts: Math.min over hotelRoomTypes). The listing-level column
  // is often NULL when room types exist, which previously made the whole
  // expression NULL and silently dropped every such hotel from price-filtered
  // searches (and ordered them last in price sorts). Other categories use their
  // own price column directly.
  const rawPriceExpr =
    category === "hotel"
      ? `COALESCE((SELECT MIN(hrt.price_per_night) FROM listing.hotel_room_types hrt WHERE hrt.listing_id = l.id AND hrt.is_active = true), ${priceCol})`
      : priceCol;

  const comm = next();
  const commissionSql = `COALESCE(CASE WHEN cr.pending_rate IS NOT NULL AND cr.pending_effective_from <= now() THEN cr.pending_rate ELSE cr.rate END, ${comm})`;

  const params: unknown[] = [globalCommissionRate];
  const joins = [`LEFT JOIN listing.commission_rates cr ON cr.country = l.country`];

  // Base-currency guest price (commission-inclusive), used as-is when no
  // conversion is requested and as the fallback when conversion is unavailable.
  const baseExpr = `ROUND(${rawPriceExpr} * (1 + ${commissionSql}), 2)`;

  let expr = baseExpr;
  if (targetCurrency && usdToTargetRate != null) {
    const target = next();
    const usdTarget = next();
    params.push(targetCurrency, usdToTargetRate);
    joins.push(
      `LEFT JOIN listing.exchange_rates er ON er."fromCurrency" = 'USD' AND er."toCurrency" = l.currency AND er."expiresAt" >= now()`,
    );

    // Mirrors the response builder in search.ts:
    //  - same currency → nightlyRate = round2(raw × (1+commission))
    //  - otherwise → localizedNightlyRate = ceilingForCurrency(raw × (1+commission) × fx, target)
    //    where fx(base→target) = usdToTarget / usdToBase; a NULL-currency listing is USD.
    //  - missing usd→base row (and listing not USD) → display shows null → excluded.
    const fxSql = `(${usdTarget} / CASE WHEN l.currency IS NULL OR l.currency = 'USD' THEN 1 ELSE er.rate END)`;
    const converted = `(${rawPriceExpr} * (1 + ${commissionSql}) * ${fxSql})`;
    const rounded = ZERO_DECIMAL_CURRENCIES.has(targetCurrency)
      ? `CEIL(${converted})`
      : `CEIL(${converted} * 100) / 100`;
    expr = `CASE
        WHEN COALESCE(l.currency, 'USD') = ${target} THEN ${baseExpr}
        WHEN l.currency IS NOT NULL AND l.currency <> 'USD' AND er.rate IS NULL THEN NULL
        ELSE ${rounded}
      END`;
  }

  return { expr, joins: joins.join("\n      "), params };
}

/**
 * Appends the price_min/price_max bound comparisons to a guest-price
 * expression, allocating one `$N` placeholder per bound.
 */
export function buildPriceBoundClause(
  price: { expr: string },
  opts: { priceMin?: number; priceMax?: number; next: () => string },
): { clause: string | null; params: unknown[] } {
  const { priceMin, priceMax, next } = opts;
  const conds: string[] = [];
  const params: unknown[] = [];
  if (priceMin !== undefined) {
    conds.push(`(${price.expr} >= ${next()})`);
    params.push(priceMin);
  }
  if (priceMax !== undefined) {
    conds.push(`(${price.expr} <= ${next()})`);
    params.push(priceMax);
  }
  return { clause: conds.length ? conds.join(" AND ") : null, params };
}

/**
 * Builds the SQL WHERE clause + joins that filter listings by the price a guest
 * actually pays: commission-inclusive, converted to the requested currency and
 * ceiling-rounded — the exact value the search response exposes as
 * `localizedNightlyRate` / `localizedDailyRate` (pre-promo-discount, which is a
 * category-wide client-side badge, not a per-booking guarantee).
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
  targetCurrency?: string | null;
  usdToTargetRate?: number | null;
  globalCommissionRate: number;
  next: () => string;
}): { clause: string | null; joins: string; params: unknown[] } {
  const { priceMin, priceMax, targetCurrency, usdToTargetRate, next } = input;

  if (priceMin === undefined && priceMax === undefined) {
    return { clause: null, joins: "", params: [] };
  }

  // Target currency has no exchange rate → the display can't produce a localized
  // price for any listing, so nothing can be verified against a price bound.
  if (targetCurrency && usdToTargetRate == null) {
    return { clause: "1 = 0", joins: "", params: [] };
  }

  const price = buildGuestPriceExpr(input);
  const bounds = buildPriceBoundClause(price, { priceMin, priceMax, next });
  return {
    clause: bounds.clause,
    joins: price.joins,
    params: [...price.params, ...bounds.params],
  };
}
