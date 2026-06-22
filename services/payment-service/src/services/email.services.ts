import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const BOOKING_BASE_URL = (process.env["BOOKING_PUBLIC_URL"] ?? "https://kainook.com/bookings").trim().replace(/\/$/, "");
const LOGO_URL = (process.env["EMAIL_LOGO_URL"] ?? "https://zika-storage.s3.af-south-1.amazonaws.com/brand/kainook-logo.png").trim();

function emailLayout(body: string): string {
  return `
    <div style="font-family:Arial,sans-serif;background:#f4f4f5;padding:32px 16px">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <div style="background:#ffffff;padding:24px 32px;border-bottom:1px solid #e5e7eb;text-align:center">
          <img src="${LOGO_URL}" alt="Kainook" style="height:64px;width:auto" />
        </div>
        <div style="padding:32px">
          ${body}
        </div>
        <div style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center">
          <p style="color:#6b7280;font-size:12px;margin:0">© ${new Date().getFullYear()} Kainook. Travel. Discover. Experience.</p>
          <p style="color:#9ca3af;font-size:11px;margin:6px 0 0">If you did not request this email, you can safely ignore it.</p>
        </div>
      </div>
    </div>`;
}

export async function sendGuestEmail(
  booking: any,
  invoice: any,
  pdf: { fileName: string; pdfUrl: string; pdfBuffer: Buffer }
) {
  await sgMail.send({
    to: booking.user.email ?? ["EMAIL_ADDRESS"],
    from: {
      email: process.env.SENDGRID_FROM_EMAIL!,
      name: process.env.SENDGRID_FROM_NAME ?? "Kainook",
    },
    subject: `Your booking is confirmed — ${booking.code}`,
    html: emailLayout(`
      <h2 style="color:#15803d;margin-top:0">Booking Confirmed</h2>
      <p>Hi ${booking.user.name},</p>
      <p>Your booking has been successfully confirmed.</p>

      <h3 style="color:#374151">Booking Details</h3>
      <ul>
        <li><strong>Booking Reference:</strong> ${booking.code}</li>
        <li><strong>Listing:</strong> ${booking.listing.title}</li>
        <li><strong>Check-in:</strong> ${booking.checkIn}</li>
        <li><strong>Check-out:</strong> ${booking.checkOut}</li>
      </ul>

      <h3 style="color:#374151">Receipt</h3>
      <table style="width:100%;border-collapse:collapse;margin:8px 0">
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Base Amount</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${invoice.baseAmount}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Discount</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${invoice.discount}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Subtotal</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${invoice.subtotal}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Service Fee</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${invoice.serviceFee}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Tax</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${invoice.tax}</td></tr>
        <tr><td style="padding:8px;color:#374151;font-weight:bold">Total Paid</td><td style="padding:8px;font-weight:bold">${invoice.total}</td></tr>
      </table>

      <h3 style="color:#374151">Payment Information</h3>
      <ul>
        <li><strong>Transaction ID:</strong> ${booking.transactionId ?? "N/A"}</li>
        <li><strong>Payment Method:</strong> ${booking.paymentMethod ?? "Card"}</li>
        <li><strong>Payment Status:</strong> Paid</li>
      </ul>

      <h3 style="color:#374151">Cancellation Policy</h3>
      <p>Free cancellation before 24 hours of check-in.</p>

      <h3 style="color:#374151">Host Contact</h3>
      <p>${booking.listing.hostEmail ?? "Available in booking dashboard"}</p>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />

      <p style="text-align:center;">
        <a href="${BOOKING_BASE_URL}/${booking.code}"
           style="display:inline-block;background:#16a34a;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">
          View Your Booking
        </a>
      </p>

      <p style="text-align:center;margin-top:12px;">
        <a href="${pdf.pdfUrl}" style="color:#16a34a;font-size:14px;">
          Download Your Voucher PDF
        </a>
      </p>

      <p>Your PDF voucher is also attached to this email.</p>
      <p>Thank you for choosing Kainook.</p>`),
    attachments: [
      {
        content: pdf.pdfBuffer.toString("base64"),
        filename: `KAINOOK-${booking.code}.pdf`,
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
      name: process.env.SENDGRID_FROM_NAME ?? "Kainook",
    },
    subject: `Complete your payment for booking ${reference}`,
    html: emailLayout(`
      <h2 style="color:#15803d;margin-top:0">Complete Your Booking</h2>
      <p>Hi ${guestName},</p>
      <p>Your booking <strong>${reference}</strong> is almost ready.</p>
      <p>Please complete your payment of <strong>${amount} ${currency.toUpperCase()}</strong> by clicking the link below:</p>
      <p>
        <a href="${paymentUrl}" style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
          Pay Now
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px">Or copy and paste this link into your browser:<br><a href="${paymentUrl}" style="color:#16a34a">${paymentUrl}</a></p>
      <p>Thank you for choosing Kainook.</p>`),
  });
}

// required by bookingConfirmedHandler.ts retry logic
export async function sendAdminAlert(context: string, error: any) {
  await sgMail.send({
    to: process.env.ADMIN_ALERT_EMAIL!,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL!,
      name: "Kainook Alerts",
    },
    subject: `[Kainook] Email delivery failure: ${context}`,
    html: `<p><strong>Confirmation email failed after 3 attempts.</strong></p><pre>${error?.message ?? String(error)}</pre>`,
  });
}
