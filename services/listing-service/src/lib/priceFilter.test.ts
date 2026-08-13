import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPriceFilter, buildGuestPriceExpr, buildPriceBoundClause } from "./priceFilter.js";

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

function buildExpr(overrides: Record<string, unknown> = {}) {
  const base = {
    category: "hotel",
    globalCommissionRate: 0.05,
    next: makeNext(),
  };
  return buildGuestPriceExpr({ ...base, ...overrides } as any);
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

test("guest price expression without a target currency bakes in commission only", () => {
  const r = buildExpr({ category: "apartment", targetCurrency: null, usdToTargetRate: null });
  assert.ok(r.expr.includes("ROUND(l.price_per_night * (1 + "), "commission-inclusive rounding");
  assert.ok(r.expr.includes(", 2)"), "2-decimal rounding");
  assert.ok(!r.expr.includes("exchange_rates er"), "no fx in expr");
  assert.ok(!r.joins.includes("exchange_rates er"), "no fx join");
  assert.deepEqual(r.params, [0.05]);
});

test("guest price expression converts to the target currency with ceiling rounding", () => {
  const r = buildExpr({ priceMax: undefined, targetCurrency: "USD", usdToTargetRate: 1 });
  assert.ok(r.expr.includes("CEIL("), "converted price must be ceiling-rounded");
  assert.ok(r.expr.includes("/ 100"), "2-decimal ceiling");
  assert.ok(r.expr.includes("CASE WHEN l.currency IS NULL OR l.currency = 'USD' THEN 1 ELSE er.rate END"), "fx divide-out");
  assert.ok(r.joins.includes("exchange_rates er"), "fx join present");
  assert.deepEqual(r.params, [0.05, "USD", 1], "comm, target, usdTarget in placeholder order");
});

test("guest price expression falls back to base price when the target currency has no rate", () => {
  const r = buildExpr({ targetCurrency: "XXX", usdToTargetRate: null });
  // Display shows no localized price in that case, so sort by the base price.
  assert.ok(r.expr.includes("ROUND("), "base-currency commission-inclusive price");
  assert.ok(!r.expr.includes("CEIL("), "no conversion ceiling");
  assert.ok(!r.joins.includes("exchange_rates er"), "no fx join without a rate");
  assert.deepEqual(r.params, [0.05]);
});

test("guest price expression for hotels uses the min active room type", () => {
  const r = buildExpr({ targetCurrency: null });
  assert.ok(
    r.expr.includes(
      "COALESCE((SELECT MIN(hrt.price_per_night) FROM listing.hotel_room_types hrt WHERE hrt.listing_id = l.id AND hrt.is_active = true), l.price_per_night)",
    ),
    "hotel price expression uses min active room type with listing-column fallback",
  );
});

test("guest price expression for cars uses price_per_day", () => {
  const r = buildExpr({ category: "car", targetCurrency: null });
  assert.ok(r.expr.includes("l.price_per_day"));
  assert.ok(!r.expr.includes("l.price_per_night"));
});

test("price bound clause appends bound placeholders after the expression params", () => {
  const next = makeNext();
  const price = buildGuestPriceExpr({ category: "hotel", targetCurrency: "USD", usdToTargetRate: 1, globalCommissionRate: 0.05, next });
  const bounds = buildPriceBoundClause(price, { priceMin: 0.5, priceMax: 1, next });
  assert.ok(bounds.clause!.includes(">= $4"), "price_min bound after comm/target/usdTarget");
  assert.ok(bounds.clause!.includes("<= $5"), "price_max bound");
  assert.deepEqual(bounds.params, [0.5, 1]);
});

test("sort-only guest-price params stay out of the COUNT slice yet align in the page query", () => {
  // Simulates search.ts's shared placeholder allocator + param array for a
  // price-sorted search with no price filter: the guest-price expression's
  // placeholders are allocated after the WHERE params, their values are pushed
  // after paginationStart (so the COUNT query never sees them), and LIMIT/OFFSET
  // are allocated and pushed last.
  let p = 0;
  const next = () => `$${++p}`;
  const params: unknown[] = [];
  const where: string[] = [];

  // Simulated WHERE section (e.g. category + status) — 2 params.
  where.push(`l.category::text = ${next()}`); params.push("hotel");
  where.push(`l.status::text = ANY(${next()})`); params.push(["approved"]);

  // Price-sort block (no filter): allocates $3, $4, $5 for comm/target/usdTarget.
  const price = buildGuestPriceExpr({ category: "hotel", targetCurrency: "USD", usdToTargetRate: 1, globalCommissionRate: 0.05, next });
  assert.ok(price.expr.includes("$3") && price.expr.includes("$4") && price.expr.includes("$5"), "expr references its placeholders");

  const paginationStart = params.length; // 2
  params.push(...price.params); // appended AFTER the count slice
  const limitRef = next(); // $6
  const offsetRef = next(); // $7
  params.push(20, 0); // LIMIT/OFFSET values

  // The COUNT query receives only the WHERE params.
  assert.deepEqual(params.slice(0, paginationStart), ["hotel", ["approved"]]);
  // The page query receives everything in $N order: $1, $2 (WHERE), $3, $4, $5
  // (price expr), $6 (LIMIT), $7 (OFFSET).
  assert.deepEqual(params, ["hotel", ["approved"], 0.05, "USD", 1, 20, 0]);
  assert.equal(limitRef, "$6");
  assert.equal(offsetRef, "$7");
});
