export interface InvoiceCharge {
  /** Platform/charge currency — EUR for Stripe, XAF for Tara. */
  currency: string;
  /** Actual amount charged in platform currency (EUR for Stripe, XAF for Tara). */
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
  const breakdown = ((booking.priceBreakdownJson ?? {})?.breakdown ?? {}) as Record<string, unknown>;
  const deliveryFee = Number(booking.deliveryFee || 0);
  // booking.subtotal is the post-discount subtotal. Read the gross
  // commission-inclusive base and the full discount from the price snapshot
  // (what was actually charged); fall back to reconstructing the gross from the
  // booking columns for older bookings without a snapshot.
  // The breakdown snapshot may or may not include voucher discounts in its
  // discountAmount. Use the booking-level fields (which are always split) as
  // the authoritative source for the total discount amount. The fallback to
  // the snapshot only applies when BOTH booking-level fields are zero/missing
  // (e.g. very old bookings).
  const bookingDiscount = Number(booking.discountAmount || 0);
  const snapshotDiscount = breakdown.discountAmount != null ? Number(breakdown.discountAmount) : 0;
  // discountAmount is the total discount, not an additional amount on top of
  // voucherDiscount. Prefer the persisted split snapshot when available so a
  // voucher is never counted twice on receipts.
  const splitDiscount = ["promotionDiscount", "voucherDiscount", "pointsDiscount"]
    .some((key) => breakdown[key] != null)
    ? Number(breakdown.promotionDiscount ?? 0) +
      Number(breakdown.voucherDiscount ?? 0) +
      Number(breakdown.pointsDiscount ?? 0)
    : 0;
  const discount = splitDiscount > 0
    ? splitDiscount
    : snapshotDiscount > 0
      ? snapshotDiscount
      : bookingDiscount;
  const grossBase =
    breakdown.baseAmount != null
      ? Number(breakdown.baseAmount)
      : Number(booking.subtotal || 0) + discount;
  const baseAmount = grossBase + deliveryFee;
  const serviceFee = Number(booking.serviceFee || 0);
  const securityDeposit = Number(booking.securityDeposit || 0);

  const subtotal = baseAmount - discount;
  const total = Number(booking.totalAmount || 0);

  const listingCurrency = (booking.currency ?? "").toUpperCase();

  return {
    baseAmount,
    discount,
    subtotal,
    serviceFee,
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
