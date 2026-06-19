export function buildInvoice(booking: any) {
  const baseAmount = Number(booking.subtotal) + Number(booking.deliveryFee || 0);
  const discount = Number(booking.discountAmount || 0);
  const serviceFee = Number(booking.serviceFee || 0);
  const tax = Number(booking.taxAmount || 0);

  const subtotal = baseAmount - discount;
  const total = Number(booking.totalAmount);

  return { baseAmount, discount, subtotal, serviceFee, tax, total };
}