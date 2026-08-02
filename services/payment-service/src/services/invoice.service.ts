export interface InvoiceCharge {
  /** Platform/charge currency — EUR for Stripe, XAF for Tara. */
  currency: string;
  /** Actual amount charged in platform currency (buffered for EUR). */
  amount: number | null;
  /** Exchange rate listingCurrency → platformCurrency at charge time. */
  rate: number | null;
}

/**
 * Build the receipt itemization for a confirmed booking.
 *
 * The breakdown / split-up is always expressed in the listing base currency
 * (`booking.currency`). The platform-currency amount (EUR for Stripe, XAF for
 * Tara) is carried separately so the total can be shown in the charge currency
 * with the listing amount muted — no conversion math is displayed per line.
 */
export function buildInvoice(booking: any, charge?: InvoiceCharge | null) {
  const baseAmount = Number(booking.subtotal || 0) + Number(booking.deliveryFee || 0);
  const discount = Number(booking.discountAmount || 0) + Number(booking.voucherDiscount || 0);
  const serviceFee = Number(booking.serviceFee || 0);
  const tax = Number(booking.taxAmount || 0);
  const securityDeposit = Number(booking.securityDeposit || 0);

  const subtotal = baseAmount - discount;
  const total = Number(booking.totalAmount || 0);

  const listingCurrency = (booking.currency ?? "").toUpperCase();

  return {
    baseAmount,
    discount,
    subtotal,
    serviceFee,
    tax,
    securityDeposit,
    total,
    listingCurrency,
    platform: {
      currency: charge?.currency?.toUpperCase() ?? listingCurrency,
      amount: charge?.amount != null ? Number(charge.amount) : total,
      rate: charge?.rate != null ? Number(charge.rate) : 1,
    },
  };
}
