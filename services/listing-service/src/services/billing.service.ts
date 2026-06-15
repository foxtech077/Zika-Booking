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
  taxRate: number;
  commissionRate: number;
};

export type BillingResult = {
  units: number;
  baseAmount: number;
  discount: number;
  subtotal: number;
  promotionDiscount: number;
  voucherDiscount: number;
  serviceFee: number;
  taxAmount: number;
  deliveryFee: number;
  totalAmount: number;
  commissionAmount: number;
  providerPayout: number;
};

function calcDays(from?: string, to?: string): number {
  if (!from || !to) return 0;
  return Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
}

export function calculateBilling(input: BillingInput): BillingResult {
  const units =
    input.listingCategory === "car"
      ? calcDays(input.pickupDatetime, input.returnDatetime)
      : calcDays(input.checkIn, input.checkOut);

  const baseAmount = Number((units * input.rate).toFixed(2));
  // PRD 15.9: discount = best(promotion_discount, voucher_discount)
  const discount = Number(Math.max(input.promotionDiscount, input.voucherAmount).toFixed(2));
  const subtotal = Number(Math.max(0, baseAmount - discount).toFixed(2));
  // PRD 15.9: service_fee = CEILING(subtotal × commission_rate, 2dp)
  const serviceFee = Math.ceil(subtotal * input.commissionRate * 100) / 100;
  const taxAmount = Number((subtotal * input.taxRate).toFixed(2));
  const deliveryFee = Number((input.deliveryFee ?? 0).toFixed(2));
  const totalAmount = Number(Math.max(0, subtotal + serviceFee + taxAmount + deliveryFee).toFixed(2));
  const commissionAmount = Number((totalAmount * input.commissionRate).toFixed(2));
  const providerPayout = Number(Math.max(0, totalAmount - commissionAmount).toFixed(2));

  return {
    units,
    baseAmount,
    discount,
    subtotal,
    promotionDiscount: input.promotionDiscount,
    voucherDiscount: input.voucherAmount,
    serviceFee,
    taxAmount,
    deliveryFee,
    totalAmount,
    commissionAmount,
    providerPayout,
  };
}
