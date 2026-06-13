// src/services/billing.service.ts

export type BillingInput = {
  listingCategory: "hotel" | "apartment" | "car" | string;

  checkIn?: string | Date;
  checkOut?: string | Date;

  pickupDatetime?: string | Date;
  returnDatetime?: string | Date;

  rate: number;
  deliveryFee?: number;

  promotionRate?: number;
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
  deliveryFee: number;
  promotionDiscount: number;
  voucherAmount: number;
  taxRate: number;
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

  const baseAmount = units * input.rate;

  const subtotal = Math.max(
    0,
    baseAmount - input.promotionDiscount - input.voucherAmount
  );

  const serviceFee = Math.ceil(subtotal * (input.commissionRate / 100) * 100) / 100;

  const taxAmount = Number((subtotal * input.taxRate).toFixed(2));

  const totalAmount = Math.max(
    0,
    Number(
      (
        subtotal +
        serviceFee +
        taxAmount +
        input.deliveryFee
      ).toFixed(2)
    )
  );

  const commissionAmount = serviceFee;
  const providerPayout = Number((totalAmount - commissionAmount).toFixed(2));

  return {
    units,
    baseAmount,
    subtotal,
    promotionDiscount: input.promotionDiscount,
    voucherDiscount: input.voucherAmount,
    serviceFee,
    taxAmount,
    deliveryFee: input.deliveryFee,
    totalAmount,
    commissionAmount,
    providerPayout,
  };
}