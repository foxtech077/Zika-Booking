/**
 * Flat transaction fee charged to guests, as a decimal fraction (0.04 = 4%).
 * This is the payment-processing fee — it covers payment-gateway / processor
 * costs. It is collected from the guest and retained on the platform side; it
 * is NOT part of the provider's payout.
 */
export const SERVICE_FEE_RATE = 0.04;

export type BillingInput = {
  listingCategory: string;
  checkIn?: string;
  checkOut?: string;
  pickupDatetime?: string;
  returnDatetime?: string;
  /** Raw list rate per night/day — commission-exclusive (what the guest sees on the listing). */
  rate: number;
  /** Delivery fee — passed through to the provider on payout. */
  deliveryFee?: number;
  /** Admin promotion discount (absolute value, pre-computed from the ActivityPromotion). */
  promotionDiscount: number;
  /** Admin voucher discount (absolute value) — absorbed by the platform, never reduces the provider payout. */
  voucherAmount: number;
  /** Guest loyalty-points redemption (absolute value). */
  pointsDiscount?: number;
  /** Tax rate charged to the guest; tax is retained on the platform side (no remittance is performed in code). */
  taxRate: number;
  commissionRate: number;
  /** Refundable security deposit collected from the guest — passed through to the provider on payout. */
  securityDeposit?: number;
  driverProvided?: boolean;
};

export type BillingResult = {
  units: number;
  /** List price for the stay: units × rate. Payout and commission basis, never reduced by discounts. */
  baseAmount: number;
  /** Total discount applied to the guest bill: best(promotion, voucher) + points. */
  discount: number;
  promotionDiscount: number;
  voucherDiscount: number;
  pointsDiscount: number;
  /** Guest subtotal after discounts (clamped at 0). */
  subtotal: number;
  /** Payment-processing fee (SERVICE_FEE_RATE) — collected from the guest and retained on the platform side. */
  serviceFee: number;
  /** Tax charged to the guest — retained on the platform side. */
  taxAmount: number;
  /** Delivery fee — passed through to the provider on payout. */
  deliveryFee: number;
  /** Refundable security deposit — passed through to the provider on payout so the provider holds and returns it. */
  securityDeposit: number;
  /** Guest-facing total: subtotal + serviceFee + tax + delivery + deposit. */
  totalAmount: number;
  /** Platform commission on the list price only: baseAmount × commissionRate. */
  commissionAmount: number;
  /** Provider payout: everything the guest pays except tax, commission and the service fee (base + delivery + deposit − commission). Never reduced by guest discounts. */
  providerPayout: number;
};

function calcDays(from?: string, to?: string): number {
  if (!from || !to) return 0;
  return Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000));
}

/**
 * Pricing model (see design doc):
 *
 *   Guest bill   = listPrice − discount + payment-processing fee + tax + delivery + deposit
 *   Commission   = listPrice × commissionRate     (list price only, pre-discount)
 *   Payout       = listPrice + delivery + deposit − commission
 *
 * What the platform keeps (revenue): commission + payment-processing fee + tax.
 * Discounts (admin promotions / admin vouchers) are funded from the platform's
 * commission: the guest pays less, the provider still gets paid on the full
 * list price, and the platform absorbs the discount from its commission.
 * Discounts must therefore never exceed the commission (validated by callers).
 *
 * What passes through to the provider on payout: the full list price (never
 * reduced by discounts) plus the delivery fee and the security deposit. The
 * security deposit is a refundable hold collected from the guest; it is passed
 * to the provider at payout so the provider holds and returns it. The
 * payment-processing fee and tax are collected from the guest but never flow
 * into the provider's payout basis or into the commission base.
 */
export function calculateBilling(input: BillingInput): BillingResult {
  const units =
    input.listingCategory === "car"
      ? calcDays(input.pickupDatetime, input.returnDatetime)
      : calcDays(input.checkIn, input.checkOut);

  // List price for the stay — commission-exclusive and pre-discount. This is
  // the number the provider is paid out on, so discounts never shrink it.
  const baseAmount = Number((units * input.rate).toFixed(2));

  // Guest discount = best (promotion, voucher) + points.
  const bestPromoVoucher = Math.max(input.promotionDiscount, input.voucherAmount);
  const pointsDiscount = Number((input.pointsDiscount ?? 0).toFixed(2));
  const discount = Number((bestPromoVoucher + pointsDiscount).toFixed(2));

  const subtotal = Number(Math.max(0, baseAmount - discount).toFixed(2));
  // 4% transaction fee on the post-discount subtotal — pass-through to the
  // payment processor, ceiling-rounded (same as before).
  const serviceFee = Math.ceil(subtotal * SERVICE_FEE_RATE * 100) / 100;
  const taxAmount = Number((subtotal * input.taxRate).toFixed(2));
  const securityDeposit = input.listingCategory === "car" && !input.driverProvided
    ? Number((input.securityDeposit ?? 0).toFixed(2))
    : 0;
  const deliveryFee = Number((input.deliveryFee ?? 0).toFixed(2));

  // Commission is computed on the list price only (pre-discount). The provider
  // receives everything else the guest pays except tax, commission and the
  // payment-processing fee — i.e. the full list price plus the delivery fee and
  // security deposit, minus commission. Discounts are absorbed by the
  // platform's commission and never reduce this payout.
  const commissionAmount = Number((baseAmount * input.commissionRate).toFixed(2));
  const providerPayout = Number(Math.max(0, baseAmount + deliveryFee + securityDeposit - commissionAmount).toFixed(2));

  const totalAmount = Number(Math.max(0, subtotal + serviceFee + taxAmount + deliveryFee + securityDeposit).toFixed(2));

  return {
    units,
    baseAmount,
    discount,
    subtotal,
    promotionDiscount: input.promotionDiscount,
    voucherDiscount: input.voucherAmount,
    pointsDiscount,
    serviceFee,
    taxAmount,
    deliveryFee,
    securityDeposit,
    totalAmount,
    commissionAmount,
    providerPayout,
  };
}