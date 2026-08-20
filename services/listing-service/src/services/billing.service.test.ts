import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateBilling, SERVICE_FEE_RATE } from "./billing.service.js";

/** Hotel/apartment night-stay billing input helper. */
function stay(overrides: Record<string, unknown> = {}) {
  return {
    listingCategory: "hotel",
    checkIn: "2026-01-01",
    checkOut: "2026-01-03", // 2 nights
    rate: 100,              // raw list price
    deliveryFee: 0,
    promotionDiscount: 0,
    voucherAmount: 0,
    pointsDiscount: 0,
    taxRate: 0.16,
    commissionRate: 0.1,
    ...overrides,
  };
}

test("guest pays listPrice × units + 4% transaction fee + tax; commission and payout on list price only", () => {
  const b = calculateBilling(stay());

  assert.equal(b.units, 2);
  assert.equal(b.baseAmount, 200);       // 2 × 100 list price
  assert.equal(b.subtotal, 200);
  assert.equal(b.serviceFee, 8);         // ceil(200 × 4%)
  assert.equal(b.taxAmount, 32);         // 200 × 16%
  assert.equal(b.discount, 0);
  // Commission on the list price only — NOT on service fee / tax / delivery.
  assert.equal(b.commissionAmount, 20);  // 200 × 10%
  assert.equal(b.providerPayout, 180);   // 200 − 20
  assert.equal(b.totalAmount, 240);      // 200 + 8 + 32
});

test("admin discount reduces the guest bill but never the provider payout (funded from commission)", () => {
  // Discount 15 ≤ commission 20 → allowed.
  const b = calculateBilling(stay({ promotionDiscount: 15 }));

  assert.equal(b.baseAmount, 200);       // list price untouched
  assert.equal(b.subtotal, 185);         // 200 − 15
  assert.equal(b.serviceFee, 7.4);       // ceil(185 × 4%) to 2dp
  assert.equal(b.taxAmount, 29.6);       // 185 × 16%
  assert.equal(b.discount, 15);
  // Provider is paid on the full list price — the discount comes off the
  // platform's commission, not the provider.
  assert.equal(b.commissionAmount, 20);
  assert.equal(b.providerPayout, 180);
  assert.equal(b.totalAmount, 222);      // 185 + 7.4 + 29.6
});

test("only the best of promotion vs voucher is counted as the discount", () => {
  const b = calculateBilling(stay({ promotionDiscount: 30, voucherAmount: 10 }));
  assert.equal(b.discount, 30);
  assert.equal(b.subtotal, 170);

  const b2 = calculateBilling(stay({ promotionDiscount: 5, voucherAmount: 25 }));
  assert.equal(b2.discount, 25);
  assert.equal(b2.subtotal, 175);
});

test("points redemption is an additional guest discount on top of promo/voucher", () => {
  const b = calculateBilling(stay({ promotionDiscount: 10, pointsDiscount: 5 }));
  assert.equal(b.discount, 15);
  assert.equal(b.subtotal, 185);
  assert.equal(b.commissionAmount, 20);  // payout still untouched
  assert.equal(b.providerPayout, 180);
});

test("car bookings use rental days, apply the deposit, and only charge delivery when requested", () => {
  const b = calculateBilling({
    listingCategory: "car",
    pickupDatetime: "2026-01-10T08:00:00Z",
    returnDatetime: "2026-01-13T08:00:00Z", // 3 days
    rate: 50,
    deliveryFee: 25,
    promotionDiscount: 0,
    voucherAmount: 0,
    taxRate: 0,
    commissionRate: 0.15,
    securityDeposit: 200,
    driverProvided: false,
  });

  assert.equal(b.units, 3);
  assert.equal(b.baseAmount, 150);
  assert.equal(b.serviceFee, 6);         // ceil(150 × 4%) to 2dp — fee is on the subtotal, not delivery
  assert.equal(b.deliveryFee, 25);
  assert.equal(b.securityDeposit, 200);
  assert.equal(b.commissionAmount, 22.5);    // 150 × 15%
  assert.equal(b.providerPayout, 352.5);     // 150 base + 25 delivery + 200 deposit − 22.5 commission
  assert.equal(b.totalAmount, 381);          // 150 + 6 + 0 + 25 + 200
});

test("a driver-provided car waives the security deposit", () => {
  const b = calculateBilling({
    listingCategory: "car",
    pickupDatetime: "2026-01-10T08:00:00Z",
    returnDatetime: "2026-01-12T08:00:00Z",
    rate: 50,
    deliveryFee: 0,
    promotionDiscount: 0,
    voucherAmount: 0,
    taxRate: 0,
    commissionRate: 0.15,
    securityDeposit: 200,
    driverProvided: true,
  });
  assert.equal(b.securityDeposit, 0);
  // No deposit collected, no delivery charged → payout is base minus commission (2 days × 50 = 100 − 15).
  assert.equal(b.providerPayout, 85);        // 100 + 0 + 0 − 15
});

test("discount is clamped so the guest subtotal never goes negative", () => {
  const b = calculateBilling(stay({ promotionDiscount: 1000 }));
  assert.equal(b.subtotal, 0);
  // Provider is still paid on the full list price.
  assert.equal(b.providerPayout, 180);
  assert.equal(b.totalAmount, b.serviceFee + b.taxAmount);
});