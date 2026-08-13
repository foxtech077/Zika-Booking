/** Flat service fee charged to guests, as a decimal fraction (0.04 = 4%). */
export const SERVICE_FEE_RATE = 0.04;

/** Per-night/base rate with the provider commission baked in, for guest display. */
export function commissionInclusiveRate(rate: number, commissionRate: number): number {
  return Number((rate * (1 + commissionRate)).toFixed(2));
}

export type BillingInput = {
  listingCategory: string;
  checkIn?: string;
  checkOut?: string;
  pickupDatetime?: string;
  returnDatetime?: string;
  rate: number;
  deliveryFee?: number;
  promotionDiscount: number;
  voucherAmount: number;
  pointsDiscount?: number;
  taxRate: number;
  commissionRate: number;
  securityDeposit?: number;
  driverProvided?: boolean;
};

export type BillingResult = {
  units: number;
  baseAmount: number;
  discount: number;
  subtotal: number;
  promotionDiscount: number;
  voucherDiscount: number;
  pointsDiscount: number;
  serviceFee: number;
  taxAmount: number;
  deliveryFee: number;
  securityDeposit: number;
  totalAmount: number;
  commissionAmount: number;
  providerPayout: number;
};

function calcDays(from?: string, to?: string): number {
  if (!from || !to) return 0;
  return Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000));
}

export function calculateBilling(input: BillingInput): BillingResult {
  const units =
    input.listingCategory === "car"
      ? calcDays(input.pickupDatetime, input.returnDatetime)
      : calcDays(input.checkIn, input.checkOut);

  // Commission is baked into the guest-facing base price: the amount the guest
  // sees for the stay is rate × (1 + commissionRate). The 4% service fee is then
  // computed on that commission-inclusive subtotal.
  const baseAmount = Number((units * input.rate * (1 + input.commissionRate)).toFixed(2));
  const pointsDiscount = Number((input.pointsDiscount ?? 0).toFixed(2));

  // PRD 15.9: discount = best(promotion_discount, voucher_discount)
  const bestPromoVoucher = Math.max(input.promotionDiscount, input.voucherAmount);
  const discount = Number((bestPromoVoucher + pointsDiscount).toFixed(2));

  const subtotal = Number(Math.max(0, baseAmount - discount).toFixed(2));
  // service_fee = CEILING(subtotal × 4%, 2dp) — a flat fee on the
  // commission-inclusive subtotal, independent of the provider commission rate.
  const serviceFee = Math.ceil(subtotal * SERVICE_FEE_RATE * 100) / 100;
  const taxAmount = Number((subtotal * input.taxRate).toFixed(2));
  const securityDeposit = input.listingCategory === "car" && !input.driverProvided
    ? Number((input.securityDeposit ?? 0).toFixed(2))
    : 0;
  const deliveryFee = Number((input.deliveryFee ?? 0).toFixed(2));

  // Commission and payout are calculated on the non-deposit amount (deposit is refundable)
  const commissionableAmount = Number(Math.max(0, subtotal + serviceFee + taxAmount + deliveryFee).toFixed(2));
  const commissionAmount = Number((commissionableAmount * input.commissionRate).toFixed(2));
  const providerPayout = Number(Math.max(0, commissionableAmount - commissionAmount).toFixed(2));

  const totalAmount = Number(Math.max(0, commissionableAmount + securityDeposit).toFixed(2));

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
