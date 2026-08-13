import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPriceFilter } from "./priceFilter.js";

/** Allocates sequential $1, $2, ... placeholders like search.ts does. */
function makeNext() {
  let p = 0;
  return () => `$${++p}`;
}

function build(overrides: Record<string, unknown> = {}) {
  const base = {
    category: "hotel",
    globalCommissionRate: 0.05,
    next: makeNext(),
  };
  return buildPriceFilter({ ...base, ...overrides } as any);
}

test("returns no clause/joins/params when no price filter is present", () => {
  const r = build({ priceMin: undefined, priceMax: undefined, targetCurrency: "USD", usdToTargetRate: 1 });
  assert.equal(r.clause, null);
  assert.equal(r.joins, "");
  assert.deepEqual(r.params, []);
});

test("price_max filters on the commission-inclusive, FX-converted price (the reported bug)", () => {
  const r = build({ priceMax: 1, targetCurrency: "USD", usdToTargetRate: 1 });
  assert.ok(r.clause, "clause expected");
  // Uses the guest-facing localized price, not the raw listing price:
  assert.ok(r.clause!.includes("l.price_per_night"), "should compare the price column");
  assert.ok(r.clause!.includes("CEIL("), "converted price must be ceiling-rounded like localizedNightlyRate");
  assert.ok(r.clause!.includes("/ 100"), "2-decimal ceiling");
  // FX conversion USD→base is divided out (rate(base→target) = usdToTarget / usdToBase):
  assert.ok(
    r.clause!.includes("CASE WHEN l.currency IS NULL OR l.currency = 'USD' THEN 1 ELSE er.rate END"),
    "base-currency fx rate (er.rate) must be divided out",
  );
  // Commission baked in with country-row override and global fallback:
  assert.ok(r.clause!.includes("cr.pending_rate"), "country commission pending-rate rule");
  assert.ok(r.joins.includes("commission_rates cr"), "commission join");
  assert.ok(r.joins.includes("exchange_rates er"), "fx join");
  assert.ok(
    r.joins.includes('er."fromCurrency" = \'USD\'') && r.joins.includes('er."toCurrency" = l.currency'),
    "fx join must use the actual quoted camelCase column names",
  );
  // Same-currency listings must not be converted (matches localizedNightlyRate semantics):
  assert.ok(r.clause!.includes("COALESCE(l.currency, 'USD') = $2"), "same-currency branch");
  assert.ok(r.clause!.includes("<= $4"), "bound must be bound as a parameter");
  assert.deepEqual(r.params, [0.05, "USD", 1, 1]);
});

test("without a target currency the filter only bakes in commission (no FX, no ceiling)", () => {
  const r = build({ category: "apartment", priceMax: 1, targetCurrency: null, usdToTargetRate: null });
  assert.ok(r.clause!.includes("ROUND(l.price_per_night * (1 + "), "commission-inclusive rounding");
  assert.ok(r.clause!.includes(", 2)"), "2-decimal rounding");
  assert.ok(!r.clause!.includes("exchange_rates er"), "no fx join without target currency");
  assert.ok(!r.clause!.includes("CEIL("), "no ceiling without conversion");
  assert.ok(!r.joins.includes("exchange_rates er"), "no fx join in FROM");
  assert.deepEqual(r.params, [0.05, 1]);
});

test("hotels price from the min active room type, falling back to the listing column", () => {
  const r = build({ priceMax: 1, targetCurrency: "USD", usdToTargetRate: 1 });
  // The listing-level price column is often NULL when room types exist; the
  // filter must use the cheapest active room type exactly like the response
  // builder, so such hotels are not silently dropped from price-filtered searches.
  assert.ok(
    r.clause!.includes(
      "COALESCE((SELECT MIN(hrt.price_per_night) FROM listing.hotel_room_types hrt WHERE hrt.listing_id = l.id AND hrt.is_active = true), l.price_per_night)",
    ),
    "hotel price expression uses min active room type with listing-column fallback",
  );
});

test("apartments filter on the listing price column directly (no room-type subquery)", () => {
  const r = build({ category: "apartment", priceMax: 1, targetCurrency: "USD", usdToTargetRate: 1 });
  assert.ok(r.clause!.includes("l.price_per_night"));
  assert.ok(!r.clause!.includes("hotel_room_types"), "no room-type subquery for apartments");
});

test("zero-decimal target currencies ceiling to a whole number (no /100)", () => {
  const r = build({ priceMax: 100, targetCurrency: "JPY", usdToTargetRate: 155 });
  assert.ok(r.clause!.includes("CEIL("), "ceiling applied");
  assert.ok(!r.clause!.includes("/ 100"), "no cent precision for zero-decimal currency");
});

test("car listings filter on price_per_day", () => {
  const r = build({ category: "car", priceMax: 5000, targetCurrency: "KES", usdToTargetRate: 128 });
  assert.ok(r.clause!.includes("l.price_per_day"));
  assert.ok(!r.clause!.includes("l.price_per_night"));
});

test("price_min and price_max both emit their own bound parameter", () => {
  const r = build({ priceMin: 0.5, priceMax: 1, targetCurrency: "USD", usdToTargetRate: 1 });
  assert.ok(r.clause!.includes(">= $4"), "price_min bound");
  assert.ok(r.clause!.includes("<= $5"), "price_max bound");
  assert.deepEqual(r.params, [0.05, "USD", 1, 0.5, 1]);
});

test("when the target currency has no rate, nothing can be verified in it — exclude all", () => {
  const r = build({ priceMax: 1, targetCurrency: "XXX", usdToTargetRate: null });
  assert.equal(r.clause, "1 = 0");
  assert.equal(r.joins, "");
  assert.deepEqual(r.params, []);
});
