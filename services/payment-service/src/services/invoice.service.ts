export function buildInvoice(booking: any) {
    const baseAmount = booking.amount;
    const discount = booking.discount || 0;
    const serviceFee = booking.serviceFee || 0;
    const tax = booking.tax || 0;
  
    const subtotal = baseAmount - discount;
    const total = subtotal + serviceFee + tax;
  
    return { baseAmount, discount, subtotal, serviceFee, tax, total };
  }