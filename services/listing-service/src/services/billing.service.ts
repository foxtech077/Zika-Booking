// src/services/billing.service.ts

export type BillingInput = {
  listingCategory: "hotel" | "apartment" | "car" | string;

  checkIn?: string | Date;
  checkOut?: string | Date;

  pickupDatetime?: string | Date;
  returnDatetime?: string | Date;

  rate: number;
  deliveryFee?: number;

  promotionDiscount?: number; 
  voucherAmount?: number;

  taxRate?: number;
  commissionRate: number;
};

export function calculateBilling(input: {
  listingCategory: string;
  checkIn?: string;
  checkOut?: string;
  pickupDatetime?: string;
  returnDatetime?: string;
  rate: number;
  deliveryFee?: number;
  promotionDiscount?: number; 
  voucherAmount?: number;
  taxRate?: number;
  commissionRate: number;
}) {
  function calculateDays(pickup?: string, drop?: string): number {
    if (!pickup || !drop) return 0;
    const ms = new Date(drop).getTime() - new Date(pickup).getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  }

  function calculateNights(checkIn?: string, checkOut?: string): number {
    if (!checkIn || !checkOut) return 0;
    const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  }

  const units =
    input.listingCategory === "car"
      ? calculateDays(input.pickupDatetime, input.returnDatetime)
      : calculateNights(input.checkIn, input.checkOut);

  const baseAmount = Number((units * input.rate).toFixed(2));

  const promo = input.promotionDiscount ?? 0;
  const voucher = input.voucherAmount ?? 0;

  //  Best of promotion vs voucher — NO stacking
  const discount = Math.max(promo, voucher);

  const subtotal = Number(Math.max(0, baseAmount - discount).toFixed(2));

  const serviceFee = Math.ceil(subtotal * 0.05 * 100) / 100;

  const taxAmount = Number((subtotal * (input.taxRate ?? 0)).toFixed(2));

  const deliveryFee = Math.max(0, input.deliveryFee ?? 0);

  const totalAmount = Number(
    (subtotal + serviceFee + taxAmount + deliveryFee).toFixed(2)
  );

  const commissionAmount = Number((totalAmount * input.commissionRate).toFixed(2));

  const providerPayout = Number((totalAmount - commissionAmount).toFixed(2));

  return {
    units,
    baseAmount,
    subtotal,
    discount,
    promotionDiscount: promo,
    voucherDiscount: voucher,
    appliedDiscountType:
      promo >= voucher ? "promotion" : "voucher",
    serviceFee,
    taxAmount,
    deliveryFee,
    totalAmount,
    commissionAmount,
    providerPayout,
  };
}