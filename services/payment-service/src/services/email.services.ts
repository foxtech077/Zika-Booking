import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendGuestEmail(
  booking: any,
  invoice: any,
  pdf: { fileName: string; pdfUrl: string; pdfBuffer: Buffer }
) {
  await sgMail.send({
    to: booking.user.email ?? "ajinfg03@gmail.com", // ✅ fixed
    from: {
      email: process.env.SENDGRID_FROM_EMAIL!,
      name: process.env.SENDGRID_FROM_NAME ?? "ZikaBooking",
    },
    subject: `Your booking is confirmed — ${booking.code}`,
    html: `
      <h2>Booking Confirmed</h2>
      <p>Hi ${booking.user.name},</p>
      <p>Your booking has been successfully confirmed.</p>

      <h3>Booking Details</h3>
      <ul>
        <li><strong>Booking Reference:</strong> ${booking.code}</li>
        <li><strong>Listing:</strong> ${booking.listing.title}</li>
        <li><strong>Check-in:</strong> ${booking.checkIn}</li>
        <li><strong>Check-out:</strong> ${booking.checkOut}</li>
      </ul>

      <h3>Receipt</h3>
      <table border="1" cellpadding="8" cellspacing="0">
        <tr><td>Base Amount</td><td>${invoice.baseAmount}</td></tr>
        <tr><td>Discount</td><td>${invoice.discount}</td></tr>
        <tr><td>Subtotal</td><td>${invoice.subtotal}</td></tr>
        <tr><td>Service Fee</td><td>${invoice.serviceFee}</td></tr>
        <tr><td>Tax</td><td>${invoice.tax}</td></tr>
        <tr><td><strong>Total Paid</strong></td><td><strong>${invoice.total}</strong></td></tr>
      </table>

      <h3>Payment Information</h3>
      <ul>
        <li><strong>Transaction ID:</strong> ${booking.transactionId ?? "N/A"}</li>
        <li><strong>Payment Method:</strong> ${booking.paymentMethod ?? "Card"}</li>
        <li><strong>Payment Status:</strong> Paid</li>
      </ul>

      <h3>Cancellation Policy</h3>
      <p>Free cancellation before 24 hours of check-in.</p>

      <h3>Host Contact</h3>
      <p>${booking.listing.hostEmail ?? "Available in booking dashboard"}</p>

      <p>Your PDF voucher is attached to this email.</p>
      <p>Thank you for choosing Zika.</p>
    `,
    attachments: [
      {
        content: pdf.pdfBuffer.toString("base64"),
        filename: `ZikaBooking-${booking.code}.pdf`,
        type: "application/pdf",
        disposition: "attachment",
      },
    ],
  });
}

//  ADD THIS — required by bookingConfirmedHandler.ts retry logic
export async function sendAdminAlert(context: string, error: any) {
  await sgMail.send({
    to: process.env.ADMIN_ALERT_EMAIL!,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL!,
      name: "ZikaBooking Alerts",
    },
    subject: `🚨 Email failure: ${context}`,
    html: `<p>Failed after 3 attempts:</p><pre>${error.message}</pre>`,
  });
}