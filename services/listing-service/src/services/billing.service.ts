/**
 * Flat transaction fee charged to guests, as a decimal fraction (0.04 = 4%).
 * This is a pass-through that covers payment-gateway / processor costs — it is
 * NOT platform revenue and it is NOT part of the provider's payout basis.
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
  deliveryFee?: number;
  /** Admin promotion discount (absolute value, pre-computed from the ActivityPromotion). */
  promotionDiscount: number;
  /** Admin voucher discount (absolute value). */
  voucherAmount: number;
  /** Guest loyalty-points redemption (absolute value). */
  pointsDiscount?: number;
  taxRate: number;
  commissionRate: number;
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
  serviceFee: number;
  taxAmount: number;
  deliveryFee: number;
  securityDeposit: number;
  /** Guest-facing total: subtotal + serviceFee + tax + delivery + deposit. */
  totalAmount: number;
  /** Platform commission on the list price only: baseAmount × commissionRate. */
  commissionAmount: number;
  /** Provider payout: baseAmount − commissionAmount (never reduced by guest discounts). */
  providerPayout: number;
};

function calcDays(from?: string, to?: string): number {
  if (!from || !to) return 0;
  return Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000));
}

/**
 * Pricing model (see design doc):
 *
 *   Guest bill   = listPrice − discount + 4% transaction fee + tax + delivery + deposit
 *   Commission   = listPrice × commissionRate     (list price only, pre-discount)
 *   Payout       = listPrice − commission          (provider is never touched by the discount)
 *
 * Discounts (admin promotions / admin vouchers) are funded from the platform's
 * commission: guest pays less, the provider still gets paid on the full list
 * price, and the platform absorbs the discount from its commission. Discounts
 * must therefore never exceed the commission (validated by callers).
 *
 * The 4% service/transaction fee, tax and delivery are pass-throughs — they are
 * collected from the guest but never flow into the provider's payout basis or
 * into the commission base.
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

  // Commission and payout are computed on the list price only (pre-discount,
  // excluding the pass-throughs), so the provider keeps a constant share and
  // the platform's commission is the single funder of guest discounts.
  const commissionAmount = Number((baseAmount * input.commissionRate).toFixed(2));
  const providerPayout = Number(Math.max(0, baseAmount - commissionAmount).toFixed(2));

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