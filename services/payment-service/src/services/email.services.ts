import sgMail from "@sendgrid/mail";
import { money, fmtMoney as fmt } from "./currency-format.js";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const BOOKING_BASE_URL = (process.env["BOOKING_PUBLIC_URL"] ?? "https://kainook.com/bookings").trim().replace(/\/$/, "");
const LOGO_URL = (process.env["EMAIL_LOGO_URL"] ?? "https://zika-storage.s3.af-south-1.amazonaws.com/brand/kainook-logo.jpeg").trim();

function emailLayout(body: string): string {
  return `
    <div style="font-family:Arial,sans-serif;background:#f4f4f5;padding:32px 16px">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <div style="background:#ffffff;padding:24px 32px;border-bottom:1px solid #e5e7eb;text-align:center">
          <img src="${LOGO_URL}" alt="KAINOOK" width="120" height="120" style="display:inline-block; max-width:100%; height:auto; border:0; outline:none; text-decoration:none;" />
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
  pdf: { fileName: string; pdfUrl: string; pdfBuffer: Buffer },
  manageToken?: string | null
) {
  const isCar = booking.listingType === "car";
  const unitLabel = isCar ? "day" : "night";
  const dateLabel = isCar
    ? `Pick-up: ${booking.pickupDatetime ? new Date(booking.pickupDatetime).toLocaleString("en-GB") : "—"}<br>Return: ${booking.returnDatetime ? new Date(booking.returnDatetime).toLocaleString("en-GB") : "—"}`
    : `Check-in: ${booking.checkIn ? new Date(booking.checkIn).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"}<br>Check-out: ${booking.checkOut ? new Date(booking.checkOut).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"}`;
  const serviceFeePct = booking.serviceFeeRate ? Math.round(Number(booking.serviceFeeRate) * 100) : 0;
  const listingCurrency = invoice.listingCurrency ?? (booking.currency ?? "").toUpperCase();
  const platformCurrency = invoice.platform?.currency ?? listingCurrency;
  const platformAmount = invoice.platform?.amount ?? invoice.total;
  const listingTotal = invoice.total;
  // Use the commission-inclusive per-night rate from the booking's price
  // snapshot so the receipt line reconciles with the subtotal. The stored
  // nightlyRate/dailyRate columns hold the raw base rate, and the internal
  // fetch does not select them anyway — falling back to the snapshot first.
  const snapRate = booking.priceBreakdownJson?.breakdown?.nightlyRate ?? booking.priceBreakdownJson?.breakdown?.dailyRate;
  const nightlyRate = Number(snapRate ?? booking.nightlyRate ?? booking.dailyRate ?? 0);

  await sgMail.send({
    to: booking.user.email ?? ["EMAIL_ADDRESS"],
    from: {
      email: process.env.SENDGRID_FROM_EMAIL!,
      name: process.env.SENDGRID_FROM_NAME ?? "Kainook",
    },
    subject: `Booking Confirmed — ${booking.code}`,
    html: emailLayout(`
      <h2 style="color:#15803d;margin-top:0">Your booking is confirmed!</h2>
      <p>Hi ${booking.user.name},</p>
      <p>Great news — your booking at <strong>${booking.listing.title}</strong> is confirmed.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Booking Reference</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold;font-family:monospace">${booking.code}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Property</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${booking.listing.title}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Dates</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${dateLabel}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Duration</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${booking.nightsOrDays} ${unitLabel}${booking.nightsOrDays !== 1 ? "s" : ""}</td></tr>
      </table>

      <h3 style="color:#1e293b;font-size:14px;margin:20px 0 8px">Receipt</h3>
      <table style="width:100%;border-collapse:collapse;margin:8px 0">
        <tr><td style="padding:6px 8px;color:#6b7280">${listingCurrency} ${fmt(nightlyRate)} × ${booking.nightsOrDays} ${unitLabel}${booking.nightsOrDays !== 1 ? "s" : ""}</td><td style="padding:6px 8px;text-align:right">${money(invoice.baseAmount, listingCurrency)}</td></tr>
        ${Number(invoice.discount) > 0 ? `<tr><td style="padding:6px 8px;color:#15803d">Discount</td><td style="padding:6px 8px;text-align:right;color:#15803d">−${money(invoice.discount, listingCurrency)}</td></tr>` : ''}
        <tr><td style="padding:6px 8px;border-top:1px solid #e5e7eb;color:#6b7280">Subtotal</td><td style="padding:6px 8px;border-top:1px solid #e5e7eb;text-align:right">${money(invoice.subtotal, listingCurrency)}</td></tr>
        <tr><td style="padding:6px 8px;color:#6b7280">Service fee${serviceFeePct > 0 ? ` (${serviceFeePct}%)` : ''}</td><td style="padding:6px 8px;text-align:right">${money(invoice.serviceFee, listingCurrency)}</td></tr>
        ${Number(invoice.tax) > 0 ? `<tr><td style="padding:6px 8px;color:#6b7280">Taxes</td><td style="padding:6px 8px;text-align:right">${money(invoice.tax, listingCurrency)}</td></tr>` : ''}
        ${isCar && Number(invoice.securityDeposit) > 0 ? `<tr><td style="padding:6px 8px;color:#6b7280">Security deposit</td><td style="padding:6px 8px;text-align:right">${money(invoice.securityDeposit, listingCurrency)}</td></tr>` : ''}
        <tr>
          <td style="padding:8px;border-top:2px solid #1e293b;font-weight:bold;color:#1e293b">Total Paid</td>
          <td style="padding:8px;border-top:2px solid #1e293b;font-weight:bold;text-align:right;color:#1e293b">
            ${money(platformAmount, platformCurrency)}
            ${listingCurrency !== platformCurrency ? `<div style="font-weight:normal;color:#9ca3af;font-size:12px">≈ ${money(listingTotal, listingCurrency)}</div>` : ''}
          </td>
        </tr>
      </table>

      <h3 style="color:#374151;font-size:14px;margin:20px 0 8px">Payment Information</h3>
      <table style="width:100%;border-collapse:collapse;margin:8px 0">
        <tr><td style="padding:6px 8px;color:#6b7280">Transaction ID</td><td style="padding:6px 8px;font-family:monospace">${booking.transactionId ?? "N/A"}</td></tr>
        <tr><td style="padding:6px 8px;color:#6b7280">Payment Method</td><td style="padding:6px 8px">${booking.paymentMethod ?? "Card"}</td></tr>
        <tr><td style="padding:6px 8px;color:#6b7280">Payment Status</td><td style="padding:6px 8px;color:#15803d;font-weight:bold">Paid</td></tr>
      </table>

      <h3 style="color:#374151;font-size:14px;margin:20px 0 8px">Cancellation Policy</h3>
      <p style="color:#4b5563;font-size:13px">Free cancellation before 24 hours of check-in.</p>

      <h3 style="color:#374151;font-size:14px;margin:20px 0 8px">Host Contact</h3>
      <p style="color:#4b5563;font-size:13px">${booking.listing.hostEmail ?? "Available in booking dashboard"}</p>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />

      <p style="text-align:center;">
        <a href="${manageToken ? `${BOOKING_BASE_URL}/${booking.code}?token=${manageToken}` : `${BOOKING_BASE_URL}/${booking.code}`}"
           style="display:inline-block;background:#16a34a;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">
          ${manageToken ? "View & Manage Your Booking" : "View Your Booking"}
        </a>
      </p>

      <p style="text-align:center;margin-top:12px;">
        <a href="${pdf.pdfUrl}" style="color:#16a34a;font-size:14px;">
          Download Your Voucher PDF
        </a>
      </p>

      <p style="text-align:center;color:#6b7280;font-size:13px">Your PDF voucher is also attached to this email.</p>
      <p>Thank you for choosing Kainook.</p>`),
    attachments: [
      {
        content: pdf.pdfBuffer.toString("base64"),
        filename: `KAIN-${booking.code}.pdf`,
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
