import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const BOOKING_BASE_URL = (process.env["BOOKING_PUBLIC_URL"] ?? "https://kainook.com/bookings").trim().replace(/\/$/, "");

export async function sendGuestEmail(
  booking: any,
  invoice: any,
  pdf: { fileName: string; pdfUrl: string; pdfBuffer: Buffer }
) {
  await sgMail.send({
    to: booking.user.email ?? ["EMAIL_ADDRESS"],
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

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />

      <p style="text-align:center;">
        <a href="${BOOKING_BASE_URL}/${booking.code}"
           style="display:inline-block;background:#1e3a8a;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">
          View Your Booking
        </a>
      </p>

      <p style="text-align:center;margin-top:12px;">
        <a href="${pdf.pdfUrl}" style="color:#1e3a8a;font-size:14px;">
          📄 Download Your Voucher PDF
        </a>
      </p>

      <p>Your PDF voucher is also attached to this email.</p>
      <p>Thank you for choosing Kainook.</p>
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

export async function sendPaymentLinkEmail(
  email: string,
  guestName: string,
  amount: number,
  currency: string,
  paymentUrl: string,
  reference: string
) {
  await sgMail.send({
    to: email,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL!,
      name: process.env.SENDGRID_FROM_NAME ?? "ZikaBooking",
    },
    subject: `Complete your payment for booking ${reference}`,
    html: `
      <h2>Complete Your Booking</h2>
      <p>Hi ${guestName},</p>
      <p>Your booking <strong>${reference}</strong> is almost ready.</p>
      <p>Please complete your payment of <strong>${amount} ${currency.toUpperCase()}</strong> by clicking the link below:</p>
      <p><a href="${paymentUrl}" style="padding: 10px 20px; background: #000; color: #fff; text-decoration: none; border-radius: 5px;">Pay Now</a></p>
      <p>Alternatively, copy and paste this link into your browser:</p>
      <p><a href="${paymentUrl}">${paymentUrl}</a></p>
      <p>Thank you for choosing Zika.</p>
    `,
  });
}

// required by bookingConfirmedHandler.ts retry logic
export async function sendAdminAlert(context: string, error: any) {
  await sgMail.send({
    to: process.env.ADMIN_ALERT_EMAIL!,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL!,
      name: "ZikaBooking Alerts",
    },
    subject: `Email failure: ${context}`,
    html: `<p>Failed after 3 attempts:</p><pre>${error.message}</pre>`,
  });
}
