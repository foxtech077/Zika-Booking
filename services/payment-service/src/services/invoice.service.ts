export function buildInvoice(booking: any) {
  const baseAmount = Number(booking.subtotal || 0) + Number(booking.deliveryFee || 0);
  const discount = Number(booking.discountAmount || 0) + Number(booking.voucherDiscount || 0);
  const serviceFee = Number(booking.serviceFee || 0);
  const tax = Number(booking.taxAmount || 0);
  const securityDeposit = Number(booking.securityDeposit || 0);

  const subtotal = baseAmount - discount;
  const total = Number(booking.totalAmount || 0);

  return { baseAmount, discount, subtotal, serviceFee, tax, securityDeposit, total };
}